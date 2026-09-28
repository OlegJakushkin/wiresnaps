"""Link implemented definitions to collected evidence, without declaring coverage."""
import json,pathlib
r=pathlib.Path(__file__).resolve().parents[1]
path=r/'catalogue/coverage.json';manifest=json.loads(path.read_text())
definitions=json.loads((r/'public/catalogue/components.json').read_text())['components']
mapped={number:d for d in definitions for number in d['provenance']['partNumbers']}
citations={}
for row in manifest['parts']:
    if row['evidence']:
        e=row['evidence'][0];citations[row['partNumber']]={'url':e['url'],'page':e['page'],'manual':e['manual']}
    d=mapped.get(row['partNumber'])
    if d:
        row['implementation']={'componentId':d['id'],'model':d['model'],'status':'implemented-needs-hardware-review',
          'contracts':'tests/project.test.ts','physicsFamilies':'engine/tests/physics_tests.cpp',
          'remaining':['Verify terminal positions against the cited part drawing.','Verify published ratings and distinguish every estimate.','Complete per-part nominal, polarity and overload fixtures.']}
manifest['inventoryComplete']=False
manifest['scope']='Collected official manuals and replacement catalogues as of 2026-09-27. Candidates remain unreviewed; discontinued-kit and unnumbered-accessory audits are incomplete.'
path.write_text(json.dumps(manifest,indent=2)+'\n')
(r/'catalogue/citations.json').write_text(json.dumps(citations,indent=2)+'\n')
print(f'{len(mapped)} implemented part numbers linked; no coverage candidates falsely promoted to verified.')
