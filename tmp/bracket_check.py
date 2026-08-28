from pathlib import Path
path = Path(r'c:\Users\Lenovo\OneDrive\folder fix\web\app\(dashboard)\penyetelan-dapur\page.tsx')
text = path.read_text(encoding='utf-8')
lines = text.splitlines()
# simple stateful scanner that ignores strings and comments
def scan(text):
    stack = []
    in_single = False
    in_double = False
    in_back = False
    escaped = False
    i = 0
    line = 1
    col = 1
    while i < len(text):
        ch = text[i]
        if ch == '\n':
            line += 1
            col = 1
            i += 1
            continue
        if in_single:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == "'":
                in_single = False
            i += 1
            col += 1
            continue
        if in_double:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == '"':
                in_double = False
            i += 1
            col += 1
            continue
        if in_back:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == '`':
                in_back = False
            i += 1
            col += 1
            continue
        if ch == "'":
            in_single = True
        elif ch == '"':
            in_double = True
        elif ch == '`':
            in_back = True
        elif ch == '/' and i+1 < len(text) and text[i+1] == '/':
            # skip line comment
            while i < len(text) and text[i] != '\n':
                i += 1
            continue
        elif ch == '/' and i+1 < len(text) and text[i+1] == '*':
            i += 2
            while i+1 < len(text) and not (text[i] == '*' and text[i+1] == '/'):
                if text[i] == '\n':
                    line += 1
                    col = 0
                i += 1
                col += 1
            i += 2
            col += 2
            continue
        elif ch in '([{':
            stack.append((ch,line,col))
        elif ch in ')]}':
            if not stack:
                return False, f'unmatched closing {ch} at {line}:{col}'
            top, tl, tc = stack[-1]
            match = {')':'(', ']':'[', '}':'{'}[ch]
            if top != match:
                return False, f'mismatch {top} at {tl}:{tc} closed by {ch} at {line}:{col}'
            stack.pop()
        i += 1
        col += 1
    if stack:
        return False, f'unmatched opening {stack[-1][0]} at {stack[-1][1]}:{stack[-1][2]}'
    return True, 'ok'
result, msg = scan(text)
print(result, msg)
