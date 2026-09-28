"""Hard distribution checks, with an explicit non-release milestone mode."""
import hashlib,json,pathlib,re,sys
from check_ip_artifacts import check as check_ip_artifacts
root=pathlib.Path(__file__).resolve().parents[1]
out=(root/(sys.argv[1] if len(sys.argv)>1 else 'export')).resolve()
milestone='--milestone' in sys.argv
errors=[]
try:check_ip_artifacts(out)
except (AssertionError,OSError,KeyError,ValueError) as e:errors.append('Attribution/data packaging: '+str(e))
for manifest in ('core-port.json','mcu-port.json'):
    for row in json.loads((root/'provenance'/manifest).read_text()):
        path=root/row['local']
        if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest()!=row['modifiedSha256']:
            errors.append('Unrecorded imported-source modification: '+row['local'])
for p in (root/'engine').rglob('*'):
    if p.suffix in ('.h','.c','.cpp','.cc'):
        code=p.read_text(errors='replace')
        if re.search(r'^\s*#\s*include\s*[<"](?:Qt|Q[A-Z])|\b(?:Q_OBJECT|QApplication|QObject|QString|QScriptEngine|QTimer|QThread)\b',code,re.M):errors.append('Qt dependency: '+str(p.relative_to(root)))
report=json.loads((out/'distribution.json').read_text())
for row in report['files']:
    p=out/row['path']
    if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=row['sha256']:errors.append('Distribution changed after packaging: '+row['path'])
total=sum(p.stat().st_size for p in out.rglob('*') if p.is_file())
if total>=1000000000:errors.append(f'Distribution exceeds 1,000,000,000 bytes: {total}')
if report['runtimeGzipUpperBoundBytes']>=20000000:errors.append('Compressed runtime exceeds 20 MB')
for file in ('site/index.html','site/engine/wiresnaps.wasm','site/engine/wiresnaps.mjs','site/firmware/avr-runtime.hex','site/firmware/pic-runtime.hex','site/source/wiresnaps-source.tar.gz','native/libwiresnaps.so','site/diagnostics/core_tests.wasm','site/diagnostics/mcu_tests.wasm','site/diagnostics/physics_tests.wasm'):
    if not (out/file).is_file():errors.append('Missing deliverable: '+file)
coverage=json.loads((root/'catalogue/coverage.json').read_text())
pending=[p['partNumber'] for p in coverage['parts'] if p['status'] not in ('verified','cosmetic-alias','excluded-with-evidence')]
if not milestone:
    if not coverage['inventoryComplete']:errors.append('The full catalogue inventory has not passed its accessory/discontinued-kit audit.')
    if pending:errors.append(f'{len(pending)} catalogue candidates require review or implementation; first: '+', '.join(pending[:12]))
    for p in coverage['parts']:
        if p['status']=='verified' and (not p.get('componentId') or not p.get('validation',{}).get('passed')):errors.append('Missing per-part validation: '+p['partNumber'])
print(f'{"MILESTONE" if milestone else "FULL RELEASE"}: {total:,} bytes, compressed runtime upper bound {report["runtimeGzipUpperBoundBytes"]:,} bytes; {len(pending)} pending catalogue candidates.')
for e in errors:print('FAIL:',e)
if errors:sys.exit(1)
print('Checks passed.'+(' This is not a full-catalogue release.' if milestone else ''))
