from pathlib import Path
path = Path(r'c:\Users\Lenovo\OneDrive\folder fix\web\app\(dashboard)\penyetelan-dapur\page.tsx')
lines = path.read_text(encoding='utf-8').splitlines()
for i in range(638, 650):
    print(i+1, repr(lines[i]))
