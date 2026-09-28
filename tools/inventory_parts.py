"""Extract factual part-number evidence. Unreviewed entries fail the release gate."""
import json, pathlib, re, collections
root=pathlib.Path(__file__).resolve().parents[1]
refs=json.loads((root/'catalogue/references/manuals.json').read_text())
parts=collections.defaultdict(list)
for ref in refs['references']:
    if ref['status']!='extracted': continue
    text=(root/'.cache/catalogue'/f"{ref['cacheKey']}.txt").read_text(errors='replace')
    for page,body in enumerate(text.split('\f'),1):
        lines=body.splitlines()
        for i,line in enumerate(lines):
            for match in re.finditer(r'\b(?:6SC|6BR|9TL)[A-Za-z0-9_-]+',line):
                number=match.group().upper().rstrip('_-')
                if len(number)>18: continue
                # Export only factual identifiers and source locators, never manual prose.
                parts[number].append({'manual':ref['model'],'url':ref['url'],'page':page,
                    'sourceSha256':ref['sha256']})
existing={}
path=root/'catalogue/coverage.json'
if path.exists(): existing={p['partNumber']:p for p in json.loads(path.read_text())['parts']}
entries=[]
for number,evidence in sorted(parts.items()):
    entry=existing.get(number,{'partNumber':number,'candidateName':'Catalogue part '+number,'status':'needs-review','componentId':None})
    entry['evidence']=list({(e['url'],e['page']):e for e in evidence}.values())
    entries.append(entry)
path.write_text(json.dumps({'schemaVersion':1,'frozenOn':refs['frozenOn'],
    'inventoryComplete':False,'scope':'Official manuals index; part-number evidence requires review and accessory audit.',
    'parts':entries},indent=2)+'\n')
print(json.dumps({'candidates':len(entries),'reviewed':sum(e['status']!='needs-review' for e in entries)}))
for p in entries: print(p['partNumber'],p['candidateName'])
