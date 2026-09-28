"""Check concrete attribution/data hygiene, not legal clearance. Docker only."""
import hashlib
import json
from pathlib import Path
import sys
import tarfile


def check(out):
    root=Path(__file__).resolve().parents[1]
    site=Path(out)/'site'
    data=json.loads((root/'catalogue/coverage.json').read_text())
    recorded=json.loads((root/'provenance/catalogue-data-review.json').read_text())
    identifiers='\n'.join(sorted(p['partNumber'] for p in data['parts']))
    assert hashlib.sha256(identifiers.encode()).hexdigest()==recorded['partNumbersSha256'], 'Frozen inventory changed; review deliberately'

    def minimal(manifest):
        for part in manifest['parts']:
            for row in part['evidence']:
                assert set(row)<= {'manual','url','page','sourceSha256'}, 'Copied reference text in inventory'
                assert all(k in row for k in ('url','page')), 'Missing source locator'

    minimal(data)
    minimal(json.loads((site/'catalogue/coverage.json').read_text()))
    assert (site/'source/LICENSE').read_bytes()==(root/'LICENSE').read_bytes(), 'Missing GPL text'
    notices=json.loads((site/'source/dependency-notices.json').read_text())
    runtime=json.loads((root/'package.json').read_text())['dependencies']
    for name,version in runtime.items():
        records=[n for n in notices if n['name']==name and n['version']==version]
        assert records and records[0]['files'], 'Missing runtime licence text: '+name
        for file in records[0]['files']:
            assert (site/'source/licenses'/file).stat().st_size>0, 'Empty licence: '+file
    for extra in json.loads((root/'provenance/dependency-licenses/sources.json').read_text()):
        assert hashlib.sha256((site/'source/licenses'/extra['file']).read_bytes()).hexdigest()==extra['sha256'], 'Changed supplemental licence'
    with tarfile.open(site/'source/wiresnaps-source.tar.gz') as archive:
        names=archive.getnames()
        assert 'wiresnaps/docs/IP_REVIEW.md' in names
        assert 'wiresnaps/provenance/dependency-licenses/sources.json' in names
        assert not any('/.cache/' in p or p.lower().endswith('.pdf') for p in names), 'Reference cache/PDF in source archive'
        minimal(json.load(archive.extractfile('wiresnaps/catalogue/coverage.json')))
    assert not any(p.suffix.lower()=='.pdf' or '.cache' in p.parts for p in site.rglob('*')), 'Reference PDF/cache in site'
    assert (site/'demo/review.html').is_file(), 'Missing visible review'
    print('Attribution/data checks passed: frozen IDs, minimal evidence, runtime licence texts, clean current source archive. This is not legal clearance.')


if __name__=='__main__':
    check(Path(sys.argv[1] if len(sys.argv)>1 else 'export'))
