# GitHub Pages

The source branch holds the application. **`gh-pages` holds only the generated
static website**, including GPL notices, documentation and corresponding source.
Make edits on the source branch; a subsequent build replaces the generated files.

## First publication

1. Push this source checkout, including `.github/workflows/pages.yml`, to a GitHub
   repository. No repository URL is hardcoded in the app or workflow.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. Ensure repository rules allow the workflow to write `gh-pages`, and the
   `github-pages` environment allows deployments from your default branch.
4. Push to the default branch, or run **Build and publish Pages** manually there.
   The deployment job reports the public URL.

The workflow runs native and sanitizer checks, firmware compilation, WebAssembly
fixtures, frontend tests and Chromium/Firefox/WebKit checks inside Docker. It
exports a development milestone, checks both size limits, updates `gh-pages`
without force-pushing, and deploys the exact same `export/site` artifact.
The full export (including native deliverables and reports) is also saved as an
Actions artifact. Deployments stop if any required build or test fails.

Use the Actions publishing source even though a build branch exists: commits
made with `GITHUB_TOKEN` do not trigger branch-based Pages builds.
See [GitHub's publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
and [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

This does **not** mark the full catalogue complete. The stricter `release-export`
Docker target continues to reject an incomplete inventory or per-part coverage;
see [remaining gates](STATUS.md).

## Prepare the branch locally

First build `export` using the README command. Then, in PowerShell or a POSIX shell:

```sh
docker build -f docker/Dockerfile --target toolchain -t wiresnaps-pages-tools .
docker run --rm --mount type=bind,source="$PWD",target=/workspace -w /workspace wiresnaps-pages-tools python3 tools/pages_branch.py --site export/site
```

The helper creates an ordinary commit on `gh-pages` with a separate temporary
index. It preserves the current checkout, staging area and uncommitted source,
including when the source branch has no first commit yet. An unchanged export
does not create another commit. To publish through the helper, append `--push
origin` after configuring the remote; divergent history is rejected.

Relative assets, hash navigation and `.nojekyll` support both root sites and
`/<repository>/` sites without route rewriting. Serve over HTTP(S); browser
modules and workers cannot run by opening `index.html` directly from disk.
`/diagnostics/` contains the browser C++ test runner.

The exported `demo/` guide is generated from `docs/demo/*.md` and
`docs/IP_REVIEW.md`. It uses local CSS and screenshots, with no runtime JavaScript
or remote fonts. Its launch links use `?demo=<template-id>#build`; the app opens
a new project copy after recovering browser storage, and consumes the query so
a refresh does not repeatedly create copies. Invalid IDs show a recoverable
message. Breakage demos retain their paused Experiment-mode opening.

The distribution gate also checks runtime licence texts and that the current
site/source archive contains no cached manufacturer PDFs or copied catalogue
evidence text. These are packaging checks, not a legal clearance determination.

## Refresh README screenshots

With an existing export, capture the actual application in Docker:

```sh
docker run --rm --mount type=bind,source="$PWD",target=/workspace --mount type=volume,source=wiresnaps_node_modules,target=/workspace/node_modules -w /workspace node:22-bookworm-slim npm ci
docker run --rm --init -e LIBGL_ALWAYS_SOFTWARE=1 --mount type=bind,source="$PWD",target=/workspace --mount type=volume,source=wiresnaps_node_modules,target=/workspace/node_modules -w /workspace mcr.microsoft.com/playwright:v1.56.1-noble node tools/capture_readme.mjs
```

This also checks a project-subpath deployment, WASM/worker loading and Blockly
compilation, and fails on missing assets, script errors or external requests.
Rebuild the export afterward to include the refreshed images and source archive.
