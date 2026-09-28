"""Package reproducible source and account for every exported byte. Docker only."""
import gzip,hashlib,io,json,pathlib,shutil,sys,tarfile
root=pathlib.Path(__file__).resolve().parents[1]
out=(root/(sys.argv[1] if len(sys.argv)>1 else 'export')).resolve()
out.relative_to(root)
source=out/'site/source';source.mkdir(parents=True,exist_ok=True)
for name in ('README.md','LICENSE','THIRD_PARTY_NOTICES.md'):
    shutil.copyfile(root/name,out/'site'/name)
for name in ('docs','provenance'):
    shutil.copytree(root/name,out/'site'/name,dirs_exist_ok=True)
(out/'site/.nojekyll').write_text('')
include_dirs=['engine','firmware','src','tests','tools','docker','provenance','catalogue','docs','.github']
include_files=['CMakeLists.txt','LICENSE','README.md','THIRD_PARTY_NOTICES.md','package.json','package-lock.json','tsconfig.json','vite.config.ts','playwright.config.ts','index.html','.dockerignore','.gitignore','.gitattributes','compose.yaml']
files=[root/p for p in include_files if (root/p).is_file()]
for name in include_dirs:files.extend(p for p in (root/name).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
files.append(root/'public/diagnostics/index.html')
epoch=1790467200
archive=source/'wiresnaps-source.tar.gz'
with archive.open('wb') as stream,gzip.GzipFile(fileobj=stream,mode='wb',filename='',mtime=epoch) as compressed,tarfile.open(fileobj=compressed,mode='w') as tar:
    for p in sorted(set(files)):
        name='wiresnaps/'+p.relative_to(root).as_posix()
        data=p.read_bytes();info=tarfile.TarInfo(name);info.size=len(data);info.mtime=epoch;info.mode=0o644
        tar.addfile(info,io.BytesIO(data))
coverage=json.loads((root/'catalogue/coverage.json').read_text())
report={'schemaVersion':1,'version':'0.1.0','status':'development-milestone','fullRelease':False,
        'catalogueCandidates':len(coverage['parts']),'inventoryComplete':coverage['inventoryComplete'],
        'engineOrigin':'https://github.com/SimulIDE/SimulIDE/tree/4bf26bc839147551a00938aa2949012681a3e046',
        'files':[],'limitBytes':1000000000,'initialCompressedLimitBytes':20000000}
for p in sorted(out.rglob('*')):
    if p.is_file() and p.name!='distribution.json':
        data=p.read_bytes();report['files'].append({'path':p.relative_to(out).as_posix(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
report['payloadBytes']=sum(row['bytes'] for row in report['files'])
# Conservative bound: count all runtime JS (even lazily imported Blockly), images
# and firmware. Optional diagnostics and the source download are counted above.
report['runtimeGzipUpperBoundBytes']=sum(len(gzip.compress((out/row['path']).read_bytes(),mtime=epoch)) for row in report['files'] if row['path'].startswith('site/') and not any(row['path'].startswith('site/'+d+'/') for d in ('source','diagnostics','catalogue')))
(out/'distribution.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ('payloadBytes','runtimeGzipUpperBoundBytes','catalogueCandidates','status')}))
