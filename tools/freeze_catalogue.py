"""Freeze manufacturer references; download/extract only in the Docker toolchain.

The PDFs are an ignored research cache, never shipped as product artwork/content.
Every failed reference is preserved in the audit instead of silently omitted.
"""
import concurrent.futures
import hashlib
import json
import pathlib
import re
import subprocess
import time
import requests
from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'catalogue'
OUT = ROOT / 'catalogue' / 'references'
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
INDEX = 'https://elenco.com/new-manuals/'
session = requests.Session()
session.headers['User-Agent'] = 'WireSnaps educational component research'
cookies = CACHE / 'browser-cookies.json'
if cookies.exists():
    for cookie in json.loads(cookies.read_text()):
        session.cookies.set(cookie['name'], cookie['value'], domain=cookie['domain'], path=cookie['path'])
index_cache = CACHE / 'index.html'
if not index_cache.exists():
    response = session.get(INDEX, timeout=40)
    response.raise_for_status()
    index_cache.write_bytes(response.content)
soup = BeautifulSoup(index_cache.read_bytes(), 'html.parser')
references = []
seen = set()
for row in soup.select('tr'):
    cells = row.select('td')
    if len(cells) < 3:
        continue
    model, name = (c.get_text(' ', strip=True) for c in cells[:2])
    if not (re.match(r'^(6SC|SC|UC|ACSNAP|CI73|CM125|CM200|SB.?125)', model) or 'snap' in name.lower()):
        continue
    link = cells[2].find('a', href=True)
    if not link:
        references.append({'model': model, 'title': name, 'status': 'missing-reference'})
        continue
    url = requests.compat.urljoin(INDEX, link['href'])
    if (model, url) in seen:
        continue
    seen.add((model, url))
    references.append({'model': model, 'title': name, 'url': url})
if not references:
    raise RuntimeError('No manual rows found. Acquire the JavaScript-rendered index with tools/fetch_manual_index.mjs first.')
for model, url in [
    ('PARTS-2022','https://elenco.com/wp-content/uploads/2022/02/Snap-Circuits_Order-Form.pdf'),
    ('PARTS-2020','https://www.elenco.com/wp-content/uploads/2019/05/Snap_Circuits_Order_Form_021220.pdf'),
    ('PARTS-2019','https://www.elenco.com/wp-content/uploads/2019/01/Snap_Circuits_Order_Form_011619.pdf'),
    ('PARTS-2015','https://www.elenco.com/wp-content/uploads/2018/03/scparts.pdf')]:
    references.append({'model':model,'title':'Official replacement parts and accessories catalogue','url':url})

def fetch(ref):
    if 'url' not in ref:
        return ref
    key = hashlib.sha256(ref['url'].encode()).hexdigest()[:16]
    path = CACHE / (key + '.pdf')
    extracted = CACHE / (key + '.txt')
    try:
        if not path.exists():
            response = session.get(ref['url'], timeout=30)
            response.raise_for_status()
            if not response.content.startswith(b'%PDF'):
                raise ValueError('Reference is not a PDF')
            path.write_bytes(response.content)
        if not extracted.exists():
            subprocess.run(['pdftotext', '-layout', str(path), str(extracted)], check=True, capture_output=True, timeout=30)
        text = extracted.read_text(errors='replace')
        return {**ref, 'status': 'extracted', 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'cacheKey': key, 'pages': text.count('\f'), 'partNumbers': sorted(set(re.findall(r'\b6SC[A-Z0-9_-]+', text)))}
    except Exception as e:
        return {**ref, 'status': 'fetch-failed', 'error': str(e)}

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    references = list(pool.map(fetch, references))
manifest = {'frozenOn': '2026-09-27', 'index': INDEX,
            'indexSha256': hashlib.sha256(index_cache.read_bytes()).hexdigest(),
            'references': references}
(OUT / 'manuals.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'references': len(references), 'extracted': sum(x['status']=='extracted' for x in references),
                  'unresolved': [x['model'] for x in references if x['status']!='extracted']}))
