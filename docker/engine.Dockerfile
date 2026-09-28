FROM emscripten/emsdk:3.1.74@sha256:af45409f3199d88db4b1b03af0098532c8fb33a375ac257463eeb0a622870d06
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    cmake ninja-build g++ python3 python3-requests python3-bs4 python3-lxml poppler-utils \
    nlohmann-json3-dev gcc-avr avr-libc binutils-avr gputils ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
ENV SOURCE_DATE_EPOCH=1636026660
