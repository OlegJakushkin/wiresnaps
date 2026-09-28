# Third-party notices

## SimulIDE and simavr

SimulIDE Community Edition, revision
4bf26bc839147551a00938aa2949012681a3e046, by Santiago González Rodríguez and
contributors. GPL-3.0-or-later. https://github.com/SimulIDE/SimulIDE

Bundled simavr by Michel Pollet and contributors. GPL-3.0-or-later. Original
copyright notices are retained in each imported file.

## gpsim

Bundled libgpsim by T. Scott Dattalo, Roy R. Rankin and contributors, with SimulIDE
modifications. Applicable files retain LGPL-2.1-or-later notices.

## Browser and build libraries

The application and original WireSnaps source are GPL-3.0-or-later. This does not
replace the licences of individual dependencies. The exported `source/licenses`
directory and `source/dependency-notices.json` contain the installed dependency
versions, their declared licences, repositories and supplied notice files.

- React / React DOM: Meta Platforms, Inc. and affiliates; MIT.
- Three.js: the three.js authors; MIT.
- Blockly: Google LLC and contributors; Apache-2.0.
- Rapier: Dimforge and contributors; Apache-2.0. The browser bundles Rapier's
  WebAssembly runtime locally.
- Zod: Colin McDonnell and contributors; MIT.
- nlohmann/json 3.10.5: Niels Lohmann and contributors; MIT. The unmodified
  vendored headers retain their licence text.
- Emscripten: Emscripten authors; MIT and University of Illinois/NCSA licences.
  Its supplied licence text is included with the exported notices.
- AVR-libc and bundled AVR device headers: their respective authors; BSD-style
  licences with notices retained. The AVR-libc distribution copyright file is
  included with the firmware notices.
- TypeScript, Vite, esbuild, Vitest, Playwright and other build/test dependencies:
  see the version-specific exported dependency notices and package lock.
- markdown-it and its dependencies render the static demo guide during the
  Docker build; they are not loaded by guide visitors. See their MIT/other
  version-specific notices in the dependency manifest.

Blockly 12.3.1 and Rapier JS 0.19.0 licence texts are supplemented from their
versioned upstream repositories because the installed packages omit them.
`provenance/dependency-licenses/sources.json` records their URLs and hashes.
The dependency manifest distinguishes included text from a package declaration
alone for build-only dependencies that did not supply a separate notice file.

Modified SimulIDE/gpsim/simavr sources and complete original WireSnaps build
inputs are included in `source/wiresnaps-source.tar.gz`. Build toolchains use
pinned container-image digests. The source archive includes the generated
Qt-free sources and the extraction scripts, so rebuilding the exported engine
does not require the original Qt application. GPL-3.0 and LGPL-2.1 texts are
included. All inherited file-level copyright notices remain intact.

## Catalogue references

Elenco Snap Circuits manuals and parts lists are factual references. WireSnaps is
an independent project. Original manuals, logos, photographs and project prose
are not redistributed as application assets. Model geometry and educational
content are authored for this project. Undocumented model parameters are estimates.

Only factual part identifiers, original descriptions and source locators/hashes
are retained in the inventory. Copied catalogue context and prices are not
redistributed. This does not settle separate UK/EU database rights; see
`docs/IP_REVIEW.md` in the corresponding source and `demo/review.html` in the site.

## Names and independence

Snap Circuits and Snapino are brands used by Elenco Electronics, LLC. Znatok /
Знаток refers to the corresponding construction-kit brand; ownership and
registration territories were not independently verified. Arduino is a trademark
of Arduino S.r.l. AVR and PIC identify Microchip device families. Other product
names and marks belong to their respective owners.

WireSnaps is independent and is not affiliated with, sponsored by or endorsed by
these manufacturers. Reference codes and names describe functional comparisons
or emulated device profiles; they do not claim certified hardware compatibility.
No manufacturer logos or certification badges form part of the application
artwork. Software licensing does not grant rights to third-party trademarks,
patents, designs or catalogue databases.

The detailed patent/trademark/data review is preliminary, with unresolved
official-registry and territorial checks. No legal clearance is claimed.
