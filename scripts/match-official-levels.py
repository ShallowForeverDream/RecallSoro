import json
import re
from difflib import SequenceMatcher

import pdfplumber

PDF = r'C:\College\竞赛\湖北大学本科生赛道（组别）学科竞赛目录-教学字2026-5号.pdf'

official = []
with pdfplumber.open(PDF) as pdf:
    for page in pdf.pages:
        for table in page.extract_tables():
            for row in table:
                if not row or len(row) < 3:
                    continue
                no = (row[0] or '').strip()
                cat = (row[1] or '').strip()
                name = (row[2] or '').replace('\n', '').replace(' ', '').strip()
                if no.isdigit() and cat in {'A1', 'A2', 'B1', 'B2'} and name:
                    official.append({'no': int(no), 'category': cat, 'name': name})

print('official entries', len(official))


def norm(s):
    s = str(s or '')
    s = re.sub(r'[\s（）()《》、，,。.：:；;"\'\'“”\-—_]', '', s)
    return s


data = json.load(open('docs/competitions/competition-ledger.json', encoding='utf-8'))
results = []
for rec in data['records']:
    title = norm(rec['title'])
    best = None
    for o in official:
        name = norm(o['name'])
        sm = SequenceMatcher(None, title, name)
        m = sm.find_longest_match(0, len(title), 0, len(name))
        lcs = m.size / max(len(title), 1)
        ratio = sm.ratio()
        score = max(lcs, ratio)
        if not best or score > best['score']:
            best = {'score': score, 'lcs': lcs, 'ratio': ratio, 'o': o}
    results.append({
        'id': rec['id'],
        'title': rec['title'],
        'official_no': best['o']['no'],
        'official_level': best['o']['category'],
        'official_name': best['o']['name'],
        'score': round(best['score'], 3),
        'lcs': round(best['lcs'], 3),
        'old_level': rec['hubei_level'],
        'award': rec['award'],
    })

json.dump(results, open('docs/competitions/official-level-matches.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

low = [r for r in results if r['score'] < 0.5]
print('total', len(results), 'low_confidence', len(low))
for r in low[:50]:
    print(f"{r['id']} score={r['score']} old={r['old_level']} new={r['official_level']} | {r['title'][:40]} => {r['official_name'][:40]}")
