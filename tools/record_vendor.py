"""Record unchanged vendored header origins. Run in Docker."""
import pathlib,json,hashlib
r=pathlib.Path(__file__).resolve().parents[1]
rows=[]
for p in sorted((r/'engine/vendor/nlohmann').rglob('*.hpp')):
    rows.append({'local':p.relative_to(r).as_posix(),'origin':'https://github.com/nlohmann/json/tree/v3.10.5/include/nlohmann/'+p.relative_to(r/'engine/vendor/nlohmann').as_posix(),'version':'3.10.5','license':'MIT','changes':[],'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(r/'provenance/vendor.json').write_text(json.dumps(rows,indent=2)+'\n')
