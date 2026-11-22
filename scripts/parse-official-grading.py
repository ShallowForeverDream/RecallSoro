import re

text = open('.grading.pdf.txt', encoding='utf-8').read()
lines = [l.strip() for l in text.splitlines() if l.strip()]

blocks = []
i = 0
while i < len(lines):
    m = re.fullmatch(r'(\d+)', lines[i])
    if not m:
        i += 1
        continue
    num = int(m.group(1))
    if i + 1 >= len(lines) or lines[i + 1] not in {'A1', 'A2', 'B1', 'B2'}:
        i += 1
        continue
    category = lines[i + 1]
    j = i + 2
    chunk = []
    while j < len(lines) and not re.fullmatch(r'\d+', lines[j]):
        chunk.append(lines[j])
        j += 1
    blocks.append({'no': num, 'category': category, 'lines': chunk, 'text': ''.join(chunk)})
    i = j

print('blocks', len(blocks))
from collections import Counter
print(Counter(b['category'] for b in blocks))
for b in blocks[:6]:
    print(b['no'], b['category'], '|', b['lines'][:4])
