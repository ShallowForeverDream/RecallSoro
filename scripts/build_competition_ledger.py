import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from docx import Document

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'competitions'
OUT.mkdir(parents=True, exist_ok=True)

CATALOG = Path(r'C:\College\竞赛\竞赛历程\整理\资料管理数据\catalog.sqlite3')
DOCX = Path(r'C:\College\竞赛\竞赛历程\朱俊好部分竞赛历程.docx')


def norm_date(value):
    if not value or value.strip() in {'-', '—', '待确认', '未开始'}:
        return '', 'unknown'
    s = value.strip()
    m = re.match(r'^(20\d{2})[.\-/年]\s*(\d{1,2})(?:[.\-/月]\s*(\d{1,2}))?', s)
    if not m:
        return '', 'unknown'
    y, mo, d = m.group(1), int(m.group(2)), m.group(3)
    if d:
        return f'{y}-{mo:02d}-{int(d):02d}', 'day'
    return f'{y}-{mo:02d}', 'month'


import sqlite3

con = sqlite3.connect(str(CATALOG))
con.row_factory = sqlite3.Row
rows = [dict(r) for r in con.execute('select id, body, version from records')]
records = []
for r in rows:
    b = json.loads(r['body'])
    date, precision = norm_date(b.get('date', ''))
    src = b.get('import_source') or {}
    records.append({
        'id': b.get('id') or r['id'],
        'title': (b.get('title') or '').strip(),
        'date_raw': b.get('date', ''),
        'date': date,
        'time_precision': precision,
        'award': b.get('award', ''),
        'doc_award': b.get('doc_award', ''),
        'score': b.get('score', ''),
        'rank': b.get('rank', ''),
        'category': b.get('category', ''),
        'evidence_status': b.get('status', ''),
        'group': b.get('group', ''),
        'tags': b.get('tags') or [],
        'notes': b.get('notes', ''),
        'legacy_notes': src.get('legacy_notes', ''),
        'reference_row': src.get('reference_row'),
        'archived': bool(b.get('archived')),
        'version': r['version'],
        'updated_at': b.get('updated_at', ''),
    })

# Word original table: location / awarding body / registration time
word_rows = []
doc = Document(str(DOCX))
if doc.tables:
    table = doc.tables[0]
    for i, row in enumerate(table.rows[1:], start=1):
        cells = [c.text.strip().replace('\n', ' ') for c in row.cells]
        if len(cells) < 8:
            continue
        word_rows.append({
            'row': i,
            'register_time': cells[0],
            'competition_time': cells[1],
            'award_time': cells[2],
            'title': cells[3],
            'level': cells[4],
            'award': cells[5],
            'location': cells[6],
            'issuer': cells[7],
        })

by_row = {w['row']: w for w in word_rows}
for rec in records:
    w = by_row.get(rec['reference_row'])
    if w:
        rec['location'] = w['location']
        rec['issuer'] = w['issuer']
        rec['level'] = w['level']
        rec['register_time'] = w['register_time']
    else:
        rec['location'] = ''
        rec['issuer'] = ''
        rec['level'] = ''
        rec['register_time'] = ''

# WeChat-derived evidence (user-authorized read). Only high-confidence, non-award facts.
WECHAT_NOTES = {
    'R77': ('2026-10-21', 'day', '微信证据：2026-09-12 与父亲讨论 CCF CCSP 报名（凭 CCF 认证 360 分具备资格，报名费 500）；2026-10-21 至 22 在四川参赛。无获奖证明，只记参赛。'),
    'R74': ('', 'unknown', '微信证据：2026-11-13 提到“明天华为杯初赛”，实网对抗赛初赛 11 月 14 日完赛。'),
    'R75': ('', 'unknown', '微信证据：2026-10-13 起在“强网杯S10”群，2026-11-14 提及强网杯。证据不足，不认定获奖。'),
}
for rec in records:
    extra = WECHAT_NOTES.get(rec['id'])
    if extra:
        date, precision, note = extra
        if not rec['date'] and date:
            rec['date'] = date
            rec['time_precision'] = precision
        rec['wechat_note'] = note
        rec['notes'] = (rec['notes'] + ' ' + note).strip()
    else:
        rec['wechat_note'] = ''

# duplicate detection by normalized title + date + award
seen = {}
for rec in records:
    key = (re.sub(r'\s+', '', rec['title']), rec['date'], rec['award'])
    if key in seen:
        rec['duplicate_of'] = seen[key]
    else:
        seen[key] = rec['id']
        rec['duplicate_of'] = ''

summary = {
    'total': len(records),
    'dated': sum(1 for r in records if r['date']),
    'unknown_date': sum(1 for r in records if not r['date']),
    'by_group': {},
    'by_evidence': {},
    'duplicates': sum(1 for r in records if r['duplicate_of']),
    'wechat_enriched': sum(1 for r in records if r['wechat_note']),
}
for r in records:
    summary['by_group'][r['group'] or '未分组'] = summary['by_group'].get(r['group'] or '未分组', 0) + 1
    summary['by_evidence'][r['evidence_status'] or '未标注'] = summary['by_evidence'].get(r['evidence_status'] or '未标注', 0) + 1

with open(OUT / 'competition-ledger.json', 'w', encoding='utf-8') as f:
    json.dump({'summary': summary, 'records': records, 'word_rows': word_rows}, f, ensure_ascii=False, indent=2)

lines = [
    '# 朱俊好竞赛经历总台账', '',
    f"共 {summary['total']} 条记录；有明确日期 {summary['dated']} 条，日期待确认 {summary['unknown_date']} 条；疑似重复 {summary['duplicates']} 条。", '',
    '数据来源：本地已核验台账 `catalog.sqlite3`（98 条）+ 原始 Word 历程表（79 行）。核对状态、奖项冲突说明保留在备注中；按“同赛事只取最高奖项”的口径展示时请结合备注判断。', '',
    '## 全部记录', '',
    '| 编号 | 赛事 | 时间 | 级别/分组 | 奖项 | 成绩/排名 | 证据状态 | 地点 | 备注 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
]
for r in records:
    note = r['notes']
    if r['legacy_notes'] and r['legacy_notes'] not in note:
        note = (note + ' ' + r['legacy_notes']).strip()
    note = note.replace('|', '\\|')
    lines.append('| {} | {} | {} | {} | {} | {} | {} | {} | {} |'.format(
        r['id'], r['title'].replace('|', '\\|'), r['date'] or r['date_raw'] or '待确认',
        ' / '.join(filter(None, [r['level'], r['group']])) or '-',
        r['award'] or '-', ' / '.join(filter(None, [r['score'], r['rank']])) or '-',
        r['evidence_status'] or '-', r['location'] or '-', note[:180],
    ))
with open(OUT / 'competition-ledger.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

# RecallSoro backup import package
now_iso = datetime.now(timezone.utc).isoformat()
experiences = []
for r in records:
    desc_parts = []
    if r['award']:
        desc_parts.append(f"奖项：{r['award']}")
    if r['doc_award'] and r['doc_award'] != r['award']:
        desc_parts.append(f"证书/原表：{r['doc_award']}")
    if r['score']:
        desc_parts.append(f"成绩：{r['score']}")
    if r['rank']:
        desc_parts.append(f"排名：{r['rank']}")
    if r['location']:
        desc_parts.append(f"地点：{r['location']}")
    if r['issuer']:
        desc_parts.append(f"颁奖单位：{r['issuer']}")
    if r['notes']:
        desc_parts.append(r['notes'])
    if r['legacy_notes']:
        desc_parts.append(f"核对说明：{r['legacy_notes']}")
    experiences.append({
        'id': f"comp-{r['id']}",
        'title': r['title'],
        'description': '\n'.join(desc_parts),
        'startAt': r['date'] or None,
        'endAt': None,
        'timePrecision': r['time_precision'],
        'location': r['location'],
        'status': 'archived' if r['archived'] else 'active',
        'tags': [x for x in [r['group'], r['category'], r['evidence_status']] if x],
        'captureIds': [],
        'createdAt': now_iso,
        'updatedAt': now_iso,
    })

collection = {
    'id': 'collection-all-competitions',
    'templateId': 'tpl-competition',
    'title': '全部竞赛经历',
    'description': f"从本地已核验台账整理，共 {len(records)} 条。导入后可在模板视图中按时间查看。",
    'coverCaptureId': None,
    'fieldValues': {
        'level': '校级 / 省级 / 国家级 / 国际级',
        'review': '奖项冲突和证据不足项见每条经历备注，未凭参赛事实推定获奖。',
    },
    'experienceIds': [e['id'] for e in experiences],
    'captureIds': [],
    'createdAt': now_iso,
    'updatedAt': now_iso,
}

backup = {
    'app': 'RecallSoro',
    'version': 1,
    'exportedAt': now_iso,
    'captures': [],
    'experiences': experiences,
    'templates': [],
    'collections': [collection],
    'relations': [],
    'settings': [],
    'files': {},
}

zip_path = OUT / 'recallsoro-competitions-import.zip'
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('backup.json', json.dumps(backup, ensure_ascii=False, indent=2))

print(json.dumps(summary, ensure_ascii=False, indent=2))
print('written:', OUT)
