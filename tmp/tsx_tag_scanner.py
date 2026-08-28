from pathlib import Path
import re

path = Path(r'c:\Users\Lenovo\OneDrive\folder fix\web\app\(dashboard)\penyetelan-dapur\page.tsx')
text = path.read_text(encoding='utf-8')

# ignore content inside JS string literals and comments
out = []
in_single = False
in_double = False
in_back = False
escaped = False
i = 0
while i < len(text):
    c = text[i]
    if in_single:
        if escaped:
            escaped = False
        elif c == '\\':
            escaped = True
        elif c == "'":
            in_single = False
        out.append(' ')
        i += 1
        continue
    if in_double:
        if escaped:
            escaped = False
        elif c == '\\':
            escaped = True
        elif c == '"':
            in_double = False
        out.append(' ')
        i += 1
        continue
    if in_back:
        if escaped:
            escaped = False
        elif c == '\\':
            escaped = True
        elif c == '`':
            in_back = False
        out.append(' ')
        i += 1
        continue
    if c == "'":
        in_single = True
        out.append(' ')
        i += 1
        continue
    if c == '"':
        in_double = True
        out.append(' ')
        i += 1
        continue
    if c == '`':
        in_back = True
        out.append(' ')
        i += 1
        continue
    if c == '/' and i + 1 < len(text) and text[i+1] == '/':
        out.append('  ')
        i += 2
        while i < len(text) and text[i] != '\n':
            out.append(' ')
            i += 1
        continue
    if c == '/' and i + 1 < len(text) and text[i+1] == '*':
        out.append('  ')
        i += 2
        while i + 1 < len(text) and not (text[i] == '*' and text[i+1] == '/'):
            out.append(' ')
            if text[i] == '\n':
                out.append('\n')
            i += 1
        if i + 1 < len(text):
            out.append('  ')
            out.append(' ')
            i += 2
        continue
    out.append(c)
    i += 1
clean = ''.join(out)

lines = clean.splitlines()

voids = {'br','img','input','hr','meta','link','path','rect','circle','polygon','line','polyline','stop','defs','use','area','col','source','track','wbr'}
stack = []
line = 1
i = 0

while i < len(clean):
    c = clean[i]
    if c == '<':
        if i+1 < len(clean) and clean[i+1] == '/':
            closing = True
            j = i+2
        else:
            closing = False
            j = i+1
        # skip tags that are not valid JSX tags? if next char is non-letter, ignore
        if j < len(clean) and not re.match(r'[A-Za-z]', clean[j]):
            i += 1
            continue
        tag = ''
        while j < len(clean) and re.match(r'[A-Za-z0-9_:\.-]', clean[j]):
            tag += clean[j]
            j += 1
        # skip namespace / components with dot? okay
        # find end of tag
        end = j
        depth = 0
        while end < len(clean) and clean[end] != '>':
            if clean[end] == '\n':
                pass
            end += 1
        if end >= len(clean):
            break
        rest = clean[j:end]
        # determine if self-closing
        selfclose = rest.strip().endswith('/')
        if not tag:
            i = end + 1
            continue
        if closing:
            if not stack:
                print('unmatched close', tag, 'at', line)
                raise SystemExit
            if stack[-1][0] != tag:
                print('mismatch close', tag, 'expected', stack[-1], 'at', line)
                raise SystemExit
            stack.pop()
        else:
            if tag.lower() not in voids and not selfclose:
                stack.append((tag,line,rest.strip()))
        i = end + 1
        continue
    if c == '\n':
        line += 1
    i += 1

print('stack tail', stack[-20:])
print('stack len', len(stack))
