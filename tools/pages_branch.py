"""Publish a verified static export to gh-pages without touching the source checkout.

Run inside Docker. Uses a temporary index and ordinary, non-forced Git updates.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile


def publish(repository, site, source_revision=None, remote=None):
    repository, site = Path(repository).resolve(), Path(site).resolve()
    if site == repository or site in repository.parents:
        raise ValueError('The site must be a separate build directory.')
    required = ('index.html', 'engine/wiresnaps.wasm', '.nojekyll', 'LICENSE',
                'THIRD_PARTY_NOTICES.md', 'source/wiresnaps-source.tar.gz')
    for name in required:
        if not (site / name).is_file():
            raise ValueError('Missing built-site file: ' + name)
    files = [p for p in site.rglob('*') if p.is_file() or p.is_symlink()]
    for path in files:
        if path.is_symlink() or '.git' in path.relative_to(site).parts:
            raise ValueError('The published site cannot contain symlinks or Git metadata.')
        if path.stat().st_size >= 100_000_000:
            raise ValueError('File exceeds the GitHub branch file limit: ' + str(path))
    report = json.loads((site.parent / 'distribution.json').read_text())
    expected = {row['path'][5:]: row for row in report['files'] if row['path'].startswith('site/')}
    if {p.relative_to(site).as_posix() for p in files} != set(expected):
        raise ValueError('Built-site files differ from distribution.json; repackage first.')
    for path in files:
        row = expected[path.relative_to(site).as_posix()]
        if hashlib.sha256(path.read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('Built-site file changed after packaging: ' + row['path'])

    env = os.environ.copy()
    env['GIT_TERMINAL_PROMPT'] = '0'

    def git(*args, check=True, input=None, extra_env=None):
        return subprocess.run(['git', '-c', 'safe.directory=' + str(repository),
                               '-C', str(repository), *args], text=True, input=input,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                              env={**env, **(extra_env or {})}, check=check)

    ref = 'refs/heads/gh-pages'
    if git('symbolic-ref', '--quiet', 'HEAD', check=False).stdout.strip() == ref:
        raise ValueError('Run this from the source checkout, not a gh-pages checkout.')
    old = git('rev-parse', '--verify', ref, check=False).stdout.strip()
    parent = old
    if remote:
        url = git('remote', 'get-url', remote).stdout.strip()
        token = env.pop('GITHUB_TOKEN', '')
        if token:
            server = env.get('GITHUB_SERVER_URL', 'https://github.com').rstrip('/')
            if not url.startswith(server + '/'):
                raise ValueError('Refusing to send the GitHub token to a different server.')
            n = int(env.get('GIT_CONFIG_COUNT', '0'))
            env[f'GIT_CONFIG_KEY_{n}'] = f'http.{server}/.extraheader'
            env[f'GIT_CONFIG_VALUE_{n}'] = 'AUTHORIZATION: basic ' + base64.b64encode(
                ('x-access-token:' + token).encode()).decode()
            env['GIT_CONFIG_COUNT'] = str(n + 1)
        found = git('ls-remote', '--exit-code', remote, ref, check=False)
        if found.returncode not in (0, 2):
            raise RuntimeError('Cannot read the remote gh-pages branch: ' + found.stderr)
        if found.returncode == 0:
            git('fetch', '--no-tags', remote, ref)
            upstream = git('rev-parse', 'FETCH_HEAD').stdout.strip()
            if not old or git('merge-base', '--is-ancestor', old, upstream, check=False).returncode == 0:
                parent = upstream
            elif git('merge-base', '--is-ancestor', upstream, old, check=False).returncode != 0:
                raise ValueError('Local and remote gh-pages histories diverged; no branch was overwritten.')

    gitdir = git('rev-parse', '--absolute-git-dir').stdout.strip()
    with tempfile.TemporaryDirectory(prefix='wiresnaps-pages-') as temp:
        index_env = {'GIT_INDEX_FILE': str(Path(temp) / 'index')}

        def index_git(*args):
            return git('--git-dir=' + gitdir, '--work-tree=' + str(site),
                       '-C', str(site), *args, extra_env=index_env).stdout.strip()

        index_git('read-tree', '--empty')
        # No source files enter this index. Force includes .nojekyll and all assets.
        index_git('add', '--all', '--force', '--', '.')
        tree = index_git('write-tree')
    old_tree = git('rev-parse', parent + '^{tree}').stdout.strip() if parent else ''
    if old_tree == tree:
        commit = parent
    else:
        name = git('config', 'user.name', check=False).stdout.strip() or 'WireSnaps build'
        email = git('config', 'user.email', check=False).stdout.strip() or 'build@wiresnaps.invalid'
        identity = {key: env.get(key, value) for key, value in {
            'GIT_AUTHOR_NAME': name, 'GIT_COMMITTER_NAME': name,
            'GIT_AUTHOR_EMAIL': email, 'GIT_COMMITTER_EMAIL': email}.items()}
        revision = source_revision or git('rev-parse', '--verify', 'HEAD', check=False).stdout.strip()
        message = 'Build WireSnaps static site\n\nSource: ' + (revision or 'local working tree') + '\n'
        args = ['commit-tree', tree] + (['-p', parent] if parent else [])
        commit = git(*args, input=message, extra_env=identity).stdout.strip()
    if old != commit:
        git('update-ref', ref, commit, old or '0' * 40)
    if remote:
        git('push', remote, ref + ':' + ref)
    print(f'gh-pages: {commit} ({"unchanged" if tree == old_tree else "built"})')
    return commit


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', default='export/site')
    parser.add_argument('--repository', default='.')
    parser.add_argument('--source-revision')
    parser.add_argument('--push', metavar='REMOTE', help='Push without force; reject divergent history.')
    args = parser.parse_args()
    try:
        publish(args.repository, args.site, args.source_revision, args.push)
    except (ValueError, OSError, KeyError, subprocess.CalledProcessError, RuntimeError) as error:
        parser.exit(1, 'Pages build branch failed: ' + str(error) + '\n')
