from pathlib import Path
path = Path(r'c:\Users\Lenovo\OneDrive\folder fix\web\app\(dashboard)\penyetelan-dapur\page.tsx')
text = path.read_text(encoding='utf-8')
# find positions of branches
nut_pos = text.find('{activeTab === "nutrisi" && (')
map_pos = text.find('{activeTab === "mapping" && (')
print('nut_pos', nut_pos, 'map_pos', map_pos)
print('nut line', text[:nut_pos].count('\n')+1)
print('map line', text[:map_pos].count('\n')+1)
segment = text[nut_pos:map_pos]
print('segment len', len(segment))
for sym in ['{','}','(',')','[',']']:
    print(sym, segment.count(sym))
