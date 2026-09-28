"""Deployment safety checks. Execute inside Docker; all repositories are temporary."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('pages_branch', Path(__file__).resolve().parents[1] / 'tools/pages_branch.py')
pages = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pages)


class PagesBranchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.repo = self.root / 'source'
        self.repo.mkdir()
        self.git('init', '-b', 'main')
        self.git('config', 'user.name', 'Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.site = self.repo / 'export/site'
        for name in ('index.html', 'engine/wiresnaps.wasm', '.nojekyll', 'LICENSE',
                     'THIRD_PARTY_NOTICES.md', 'source/wiresnaps-source.tar.gz'):
            path = self.site / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b'fixture ' + name.encode())
        self.manifest()

    def tearDown(self):
        self.temp.cleanup()

    def git(self, *args):
        return subprocess.run(['git', '-C', str(self.repo), *args], check=True,
                              text=True, capture_output=True).stdout.strip()

    def manifest(self):
        rows = [{'path': 'site/' + p.relative_to(self.site).as_posix(),
                 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                for p in self.site.rglob('*') if p.is_file()]
        (self.site.parent / 'distribution.json').write_text(json.dumps({'files': rows}))

    def test_unborn_source_and_staging_are_preserved(self):
        (self.repo / 'source.txt').write_text('staged version')
        self.git('add', 'source.txt')
        (self.repo / 'source.txt').write_text('uncommitted version')
        before = (self.repo / '.git/index').read_bytes()
        head = (self.repo / '.git/HEAD').read_bytes()
        commit = pages.publish(self.repo, self.site)
        self.assertEqual((self.repo / '.git/HEAD').read_bytes(), head)
        self.assertEqual((self.repo / '.git/index').read_bytes(), before)
        self.assertEqual((self.repo / 'source.txt').read_text(), 'uncommitted version')
        self.assertEqual(self.git('show', ':source.txt'), 'staged version')
        self.assertNotIn('source.txt', self.git('ls-tree', '-r', '--name-only', commit).splitlines())
        self.assertIn('.nojekyll', self.git('ls-tree', '-r', '--name-only', commit).splitlines())

    def test_idempotent_and_append_only(self):
        first = pages.publish(self.repo, self.site)
        self.assertEqual(first, pages.publish(self.repo, self.site))
        (self.site / 'index.html').write_text('new site')
        self.manifest()
        second = pages.publish(self.repo, self.site)
        self.assertEqual(self.git('rev-parse', second + '^'), first)
        self.assertEqual(self.git('show', 'gh-pages:index.html'), 'new site')

    def test_reject_unverified_export_and_symlinks(self):
        (self.site / 'index.html').write_text('unexpected edit')
        with self.assertRaisesRegex(ValueError, 'changed after packaging'):
            pages.publish(self.repo, self.site)
        self.manifest()
        (self.site / 'secret').symlink_to(self.repo / '.git/config')
        with self.assertRaisesRegex(ValueError, 'symlinks'):
            pages.publish(self.repo, self.site)

    def test_reject_build_branch_checkout(self):
        pages.publish(self.repo, self.site)
        self.git('symbolic-ref', 'HEAD', 'refs/heads/gh-pages')
        with self.assertRaisesRegex(ValueError, 'source checkout'):
            pages.publish(self.repo, self.site)

    def test_remote_updates_and_divergence_protection(self):
        remote = self.root / 'remote.git'
        self.git('init', '--bare', str(remote))
        self.git('remote', 'add', 'origin', str(remote))
        first = pages.publish(self.repo, self.site, remote='origin')
        (self.site / 'index.html').write_text('second')
        self.manifest()
        second = pages.publish(self.repo, self.site, remote='origin')
        self.assertEqual(self.git('ls-remote', 'origin', 'refs/heads/gh-pages').split()[0], second)
        # Simulate another publisher advancing the branch while this clone has no local ref.
        self.git('update-ref', '-d', 'refs/heads/gh-pages', second)
        self.assertEqual(second, pages.publish(self.repo, self.site, remote='origin'))
        # A concurrent publisher creates a sibling of second. Never overwrite it.
        self.git('update-ref', 'refs/heads/gh-pages', first)
        (self.site / 'index.html').write_text('divergent')
        self.manifest()
        divergent = pages.publish(self.repo, self.site)
        with self.assertRaisesRegex(ValueError, 'diverged'):
            pages.publish(self.repo, self.site, remote='origin')
        self.assertEqual(self.git('rev-parse', 'gh-pages'), divergent)
        self.assertEqual(self.git('ls-remote', 'origin', 'refs/heads/gh-pages').split()[0], second)


if __name__ == '__main__':
    unittest.main()
