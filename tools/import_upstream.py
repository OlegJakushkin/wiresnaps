"""Acquire the exact upstream snapshot. Run exclusively in the engine container."""
import hashlib
import io
import json
import pathlib
import tarfile
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
REVISION = '4bf26bc839147551a00938aa2949012681a3e046'
URL = f'https://codeload.github.com/SimulIDE/SimulIDE/tar.gz/{REVISION}'
cache = ROOT / '.cache' / 'upstream'
cache.mkdir(parents=True, exist_ok=True)
archive = cache / f'{REVISION}.tar.gz'
if not archive.exists():
    archive.write_bytes(urllib.request.urlopen(URL, timeout=30).read())
rows = []
with tarfile.open(fileobj=io.BytesIO(archive.read_bytes()), mode='r:gz') as tar:
    for member in tar.getmembers():
        if not member.isfile():
            continue
        path = pathlib.PurePosixPath(*pathlib.PurePosixPath(member.name).parts[1:])
        if '..' in path.parts or path.is_absolute():
            raise ValueError('Invalid archive path')
        contents = tar.extractfile(member).read()
        dest = cache / 'source' / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(contents)
        if str(path).startswith(('src/simulator/', 'src/simavr/', 'src/gpsim/', 'src/gui/circuitwidget/components/')):
            rows.append({'path': str(path), 'sha256': hashlib.sha256(contents).hexdigest(), 'bytes': len(contents)})
(ROOT / 'provenance').mkdir(exist_ok=True)
(ROOT / 'provenance/upstream.json').write_text(json.dumps({
    'repository': 'https://github.com/SimulIDE/SimulIDE', 'revision': REVISION,
    'archiveUrl': URL, 'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    'files': rows,
}, indent=2) + '\n')
(ROOT / 'LICENSE').write_bytes((cache / 'source/LICENSE').read_bytes())
print(f'Pinned upstream: {REVISION}; {len(rows)} inventoried source files')
