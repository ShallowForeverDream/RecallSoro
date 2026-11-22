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
        rec['competition_time_raw'] = w['competition_time']
        rec['award_time_raw'] = w['award_time']
    else:
        rec['location'] = ''
        rec['issuer'] = ''
        rec['level'] = ''
        rec['register_time'] = ''
        rec['competition_time_raw'] = ''
        rec['award_time_raw'] = ''
    # 原表“级别”列即旧版分级；最新湖大分级尚未取得官方名单，先保留原值并标记待确认。
    raw_level = (rec['level'] or '').strip()
    rec['hubei_level'] = raw_level if raw_level in {'A1', 'A2', 'B1', 'B2'} else '待确认'
    rec['awarded'] = bool(rec['award'] and rec['award'] not in {'-', '—', '未开始', '未公布', '待确认'})

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

# 湖北大学本科生院教学字〔2026〕5 号目录：按赛事名称规则回填分级。
# 该目录只有 A2 / B1 / B2，没有 A1 类别。
OFFICIAL_RULES = [
    (r'蓝桥杯', 'A2', '官方目录：蓝桥杯全国大学生软件和信息技术大赛'),
    (r'ICPC|国际大学生程序设计', 'A2', '官方目录：ICPC国际大学生程序设计竞赛'),
    (r'天梯赛|团体程序设计|中国高校计算机大赛', 'A2', '官方目录：中国高校计算机大赛（含团体程序设计天梯赛）'),
    (r'百度之星', 'A2', '官方目录：百度之星·程序设计大赛'),
    (r'睿抗|RAICOM|RoboCom', 'A2', '官方目录：睿抗机器人开发者大赛（RAICOM）'),
    (r'信息安全与对抗技术竞赛|ISCC', 'A2', '官方目录：全国大学生信息安全与对抗技术竞赛'),
    (r'全国大学生信息安全竞赛', 'A2', '官方目录：全国大学生信息安全竞赛'),
    (r'密码数学挑战赛|密码技术竞赛', 'B1', '官方目录：全国高校密码数学挑战赛 / 全国密码技术竞赛'),
    (r'全国大学生数学竞赛', 'B1', '官方目录：全国大学生数学竞赛'),
    (r'楚慧杯', 'B2', '官方目录：“楚慧杯”网络空间安全实践能力竞赛'),
    (r'强网杯', 'B2', '官方目录：“强网杯”全国网络安全挑战赛'),
    (r'网鼎杯', 'B1', '官方目录：“网鼎杯”网络安全大赛'),
    (r'长城杯', 'B1', '官方目录：“长城杯”信息安全铁人三项赛'),
    (r'华为ICT大赛', 'A2', '官方目录：华为ICT大赛'),
    (r'中国高校智能机器人创意大赛|机器人创意大赛', 'A2', '官方目录：中国高校智能机器人创意大赛'),
    (r'全国大学生广告艺术大赛', 'A2', '官方目录：全国大学生广告艺术大赛'),
    (r'中国大学生广告艺术节学院奖', 'B2', '官方目录：中国大学生广告艺术节学院奖'),
]


def classify_official(title):
    for pattern, level, basis in OFFICIAL_RULES:
        if re.search(pattern, title, re.I):
            return level, basis
    return '未列入目录', '2026 年本科生赛道学科竞赛目录中未找到对应赛事'


for rec in records:
    level, basis = classify_official(rec['title'])
    rec['official_level'] = level
    rec['official_basis'] = basis
    rec['hubei_level'] = level

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
    'awarded': sum(1 for r in records if r['awarded']),
    'by_hubei_level': {},
}
for r in records:
    level = r['hubei_level']
    summary['by_hubei_level'][level] = summary['by_hubei_level'].get(level, 0) + 1
for r in records:
    summary['by_group'][r['group'] or '未分组'] = summary['by_group'].get(r['group'] or '未分组', 0) + 1
    summary['by_evidence'][r['evidence_status'] or '未标注'] = summary['by_evidence'].get(r['evidence_status'] or '未标注', 0) + 1

with open(OUT / 'competition-ledger.json', 'w', encoding='utf-8') as f:
    json.dump({'summary': summary, 'records': records, 'word_rows': word_rows}, f, ensure_ascii=False, indent=2)

lines = [
    '# 朱俊好竞赛经历总台账', '',
    f"共 {summary['total']} 条记录；有明确日期 {summary['dated']} 条，日期待确认 {summary['unknown_date']} 条；疑似重复 {summary['duplicates']} 条。", '',
    '数据来源：本地已核验台账 `catalog.sqlite3`（98 条）+ 原始 Word 历程表（79 行）+ 湖北大学本科生院教学字〔2026〕5 号竞赛目录。核对状态、奖项冲突说明保留在备注中；按“同赛事只取最高奖项”的口径展示时请结合备注判断。', '',
    '“湖大分级”按 2026 官方目录回填，只有 A2/B1/B2；“未列入目录”表示不在该本科生赛道目录中。', '',
    '## 全部记录', '',
    '| 编号 | 赛事 | 报名时间 | 比赛时间 | 获奖时间 | 个人赛/团队赛 | 团队赛负责人 | 指导老师 | 湖大分级 | 分组 | 是否获奖 | 奖项 | 成绩/排名 | 地点 | 颁奖单位 | 证据状态 | 备注 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
]
for r in records:
    note = r['notes']
    if r['legacy_notes'] and r['legacy_notes'] not in note:
        note = (note + ' ' + r['legacy_notes']).strip()
    note = note.replace('|', '\\|')
    m = re.search(r'指导老师为([^；，,。]+)', r['notes'])
    advisor = m.group(1).strip() if m else '待补充'
    event_type = '团队赛' if '团队' in r['title'] or '团体' in r['title'] else '个人赛' if '个人' in r['title'] else '待补充'
    lines.append('| {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} |'.format(
        r['id'], r['title'].replace('|', '\\|'), r['register_time'] or '-',
        r['competition_time_raw'] or '-', r['award_time_raw'] or r['date_raw'] or '-',
        event_type, '待补充', advisor,
        r['hubei_level'], r['group'] or '未分组', '是' if r['awarded'] else '否',
        r['award'] or '-', ' / '.join(filter(None, [r['score'], r['rank']])) or '-',
        r['location'] or '-', r['issuer'] or '-', r['evidence_status'] or '-', note[:180],
    ))
with open(OUT / 'competition-ledger.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

grading_lines = [
    '# 湖北大学竞赛分级确认表', '',
    '依据：湖北大学本科生院《教学字〔2026〕5 号 湖北大学本科生赛道（组别）学科竞赛目录》。',
    '该目录只有 A2 / B1 / B2 三类，没有 A1。能明确对应的赛事已回填；“未列入目录”表示不在 2026 本科生赛道目录中。', '',
    '| 编号 | 赛事 | 原表级别 | 最新分级 | 分级依据 | 奖项 | 证据状态 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
]
for r in records:
    grading_lines.append('| {} | {} | {} | {} | {} | {} | {} |'.format(
        r['id'], r['title'].replace('|', '\\|'), r['level'] or '-',
        r['hubei_level'], r['official_basis'], r['award'] or '-', r['evidence_status'] or '-',
    ))
with open(OUT / 'hubei-grading-confirmation.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(grading_lines) + '\n')

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
        'customFields': {
            '报名时间': r['register_time'],
            '比赛时间': r['competition_time_raw'],
            '获奖时间': r['award_time_raw'],
            '个人赛/团队赛': ('团队赛' if '团队' in r['title'] or '团体' in r['title'] else '个人赛' if '个人' in r['title'] else '待补充'),
            '团队赛负责人': '待补充',
            '指导老师': (re.search(r'指导老师为([^；，,。]+)', r['notes']).group(1).strip() if re.search(r'指导老师为([^；，,。]+)', r['notes']) else '待补充'),
            '湖大分级': r['hubei_level'],
            '分级依据': r['official_basis'],
            '原表级别': r['level'],
            '是否获奖': '是' if r['awarded'] else '否',
            '奖项': r['award'],
            '成绩': r['score'],
            '排名': r['rank'],
            '比赛地点': r['location'],
            '颁奖单位': r['issuer'],
            '证书照片': '待补：请在收件箱上传证书并关联' if r['awarded'] else '无',
            '奖牌照片': '待补：请在收件箱上传奖牌并关联' if r['awarded'] else '无',
            '合照': '待补：请在收件箱上传合照并关联',
            '相关图片': '待补：请把其他佐证图片放进收件箱并关联',
            '备注': r['notes'],
        },
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
