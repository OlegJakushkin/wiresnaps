"""Remove copied reference text, retaining the frozen inventory and source locators.

Docker only. No entries, implementation links or coverage statuses are removed.
"""
import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
path=root/'catalogue/coverage.json'
manifest=json.loads(path.read_text())
refs=json.loads((root/'catalogue/references/manuals.json').read_text())['references']
hashes={r['url']:r.get('sha256') for r in refs if 'url' in r}
components=json.loads((root/'public/catalogue/components.json').read_text())['components']
names={d['id']:d['name'] for d in components}
removed=0
for part in manifest['parts']:
    part['candidateName']=names.get(part.get('componentId'),'Catalogue part '+part['partNumber'])
    evidence={}
    for source in part['evidence']:
        removed+=int('context' in source)+int('label' in source)
        minimal={key:source[key] for key in ('manual','url','page')}
        if hashes.get(source['url']):minimal['sourceSha256']=hashes[source['url']]
        evidence[(source['url'],source['page'])]=minimal
    part['evidence']=list(evidence.values())
manifest['dataPolicy']='Factual part identifiers, original descriptions and source locators only. Reference manuals and extracted prose are not redistributed. Database-rights review remains open.'
path.write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Preserved {len(manifest["parts"])} inventory entries; removed {removed} copied text fields.')
