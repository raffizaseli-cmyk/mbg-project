from pathlib import Path
import re

path = Path(r'c:\Users\Lenovo\OneDrive\folder fix\web\app\(dashboard)\penyetelan-dapur\page.tsx')
text = path.read_text(encoding='utf-8')
lines = text.splitlines()
print('lines', len(lines))
for i in range(640, 670):
    print(f'{i+1}: {lines[i]}')
print('---')
stack=[]
voids={'br','img','input','hr','meta','link','path','rect','circle','polygon','line','polyline','stop','defs','use','area','col','source','track','wbr'}
pattern = re.compile(r'<(/?)([A-Za-z0-9_\.:-]+)([^>]*)>')
for lineno, line in enumerate(lines, start=1):
    for m in pattern.finditer(line):
        slash, tag, rest = m.group(1), m.group(2), m.group(3)
        full = m.group(0)
        if tag.lower() in voids or full.endswith('/>'):
            continue
        if slash == '/':
            if not stack:
                print('UNMATCHED CLOSE', tag, lineno)
                raise SystemExit
            if stack[-1][0] != tag:
                print('MISMATCH', tag, 'expected', stack[-1], 'at', lineno)
                raise SystemExit
            stack.pop()
        else:
            stack.append((tag, lineno))
print('OPEN TAGS', stack[-20:])
print('OPEN TAGS COUNT', len(stack))
