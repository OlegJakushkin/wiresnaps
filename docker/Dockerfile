FROM emscripten/emsdk:3.1.74@sha256:af45409f3199d88db4b1b03af0098532c8fb33a375ac257463eeb0a622870d06 AS toolchain
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    cmake ninja-build g++ python3 git gcc-avr avr-libc binutils-avr gputils ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
ENV SOURCE_DATE_EPOCH=1790467200
FROM toolchain AS firmware
COPY firmware firmware
COPY tools/build_firmware.py tools/build_firmware.py
RUN python3 tools/build_firmware.py

FROM firmware AS engine-source
COPY engine engine
COPY CMakeLists.txt .
COPY tools/run_wasm_test.mjs tools/run_wasm_test.mjs

FROM engine-source AS native-tests
RUN cmake -S . -B build/native -G Ninja -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build/native -j4 && ctest --test-dir build/native --output-on-failure --output-junit native-tests.xml

FROM engine-source AS sanitizer-tests
RUN cmake -S . -B build/asan -G Ninja -DCMAKE_BUILD_TYPE=Debug -DWS_SANITIZE=ON \
    && cmake --build build/asan -j4 && ctest --test-dir build/asan --output-on-failure --output-junit sanitizer-tests.xml

FROM engine-source AS wasm-tests
RUN emcmake cmake -S . -B build/wasm -G Ninja -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build/wasm -j4 && ctest --test-dir build/wasm --output-on-failure --output-junit wasm-tests.xml
COPY tools/stage_site.py tools/stage_site.py
COPY public/diagnostics/index.html public/diagnostics/index.html
COPY LICENSE THIRD_PARTY_NOTICES.md ./
RUN python3 tools/stage_site.py

FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS frontend-tests
COPY . .
COPY --from=wasm-tests /workspace/public/engine public/engine
COPY --from=wasm-tests /workspace/public/diagnostics public/diagnostics
COPY --from=wasm-tests /workspace/public/firmware public/firmware
COPY --from=wasm-tests /workspace/public/source public/source
RUN cp -r node_modules/blockly/media public/blockly && node tools/build_site_data.mjs \
    && mkdir -p build/reports && npm test -- --reporter=default --reporter=json --outputFile=build/reports/unit.json && npm run build

FROM mcr.microsoft.com/playwright:v1.56.1-noble@sha256:f1e7e01021efd65dd1a2c56064be399f3e4de00fd021ac561325f2bfbb2b837a AS browser-tests
WORKDIR /workspace
ENV LIBGL_ALWAYS_SOFTWARE=1
COPY --from=frontend-tests /workspace /workspace
RUN xvfb-run -a npm run test:browser && mkdir -p build/reports && cp -r playwright-report build/reports/browser

FROM toolchain AS package
COPY . .
COPY --from=browser-tests /workspace/dist export/site
COPY --from=browser-tests /workspace/build/reports export/reports
COPY --from=native-tests /workspace/build/native/native-tests.xml export/reports/native-tests.xml
COPY --from=sanitizer-tests /workspace/build/asan/sanitizer-tests.xml export/reports/sanitizer-tests.xml
COPY --from=wasm-tests /workspace/build/wasm/wasm-tests.xml export/reports/wasm-tests.xml
COPY --from=native-tests /workspace/build/native/libwiresnaps.so export/native/libwiresnaps.so
COPY --from=native-tests /workspace/build/native/core_tests export/native/core_tests
COPY --from=native-tests /workspace/build/native/mcu_tests export/native/mcu_tests
COPY --from=native-tests /workspace/build/native/physics_tests export/native/physics_tests
COPY engine/include/wiresnaps.h export/native/wiresnaps.h
RUN PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_pages_branch.py' \
    && python3 tools/export_distribution.py export && python3 tools/check_release.py export --milestone

# A reviewable milestone remains available while catalogue work is incomplete.
FROM scratch AS milestone-export
COPY --from=package /workspace/export /

# Full release deliberately fails until every documented catalogue part passes.
FROM package AS release-check
RUN python3 tools/check_release.py export
FROM scratch AS release-export
COPY --from=release-check /workspace/export /
