from pathlib import Path
import re

path = Path(r'c:\Users\Lenovo\OneDrive\folder fix\web\app\(dashboard)\penyetelan-dapur\page.tsx')
text = path.read_text(encoding='utf-8')
start = text.index('return (\n    <div className="max-w-7xl')
seg = text[start:]
lines = seg.splitlines()
print('start line', text[:start].count('\n') + 1)
pattern = re.compile(r'<(/?)([A-Za-z0-9_\.:-]+)([^>]*)>')
voids = {'br','img','input','hr','meta','link','path','rect','circle','polygon','line','polyline','stop','defs','use','area','col','source','track','wbr'}
stack=[]
for lineno,line in enumerate(lines, start=text[:start].count('\n') + 1):
    for m in pattern.finditer(line):
        slash, tag, rest = m.group(1), m.group(2), m.group(3)
        full = m.group(0)
        if tag.lower() in voids or full.endswith('/>'):
            continue
        if slash == '/':
            if not stack:
                print('unmatched close', tag, lineno, line)
                raise SystemExit
            if stack[-1][0] != tag:
                print('mismatch close', tag, 'expected', stack[-1], 'at', lineno, line)
                raise SystemExit
            stack.pop()
        else:
            stack.append((tag, lineno))
print('stack tail', stack[-20:])
print('stack len', len(stack))
