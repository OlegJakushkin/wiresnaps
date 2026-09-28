"""Assemble all local runtime assets; run in Docker after the WASM build."""
import pathlib,shutil
r=pathlib.Path(__file__).resolve().parents[1]
for name in ('wiresnaps.mjs','wiresnaps.wasm'):
    dest=r/'public/engine'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(r/'build/wasm'/name,dest)
for test in ('core','mcu','physics'):
    for suffix in ('.mjs','.wasm'):shutil.copyfile(r/'build/wasm'/(test+'_tests'+suffix),r/'public/diagnostics'/(test+'_tests'+suffix))
if (r/'node_modules/blockly/media').exists():shutil.copytree(r/'node_modules/blockly/media',r/'public/blockly',dirs_exist_ok=True)
source=r/'public/source';source.mkdir(parents=True,exist_ok=True)
for name in ('LICENSE','THIRD_PARTY_NOTICES.md'):shutil.copyfile(r/name,source/name)
licenses=source/'licenses';licenses.mkdir(parents=True,exist_ok=True)
for path,name in [('/usr/share/common-licenses/LGPL-2.1','gpsim-LGPL-2.1.txt'),('/usr/share/doc/avr-libc/copyright','avr-libc.txt'),('/emsdk/upstream/emscripten/LICENSE','emscripten.txt')]:
    if pathlib.Path(path).exists():shutil.copyfile(path,licenses/name)
shutil.copyfile(r/'engine/vendor/nlohmann/json.hpp',licenses/'nlohmann-json-header-with-MIT-notice.txt')
