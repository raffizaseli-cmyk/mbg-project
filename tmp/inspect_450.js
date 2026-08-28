const fs = require('fs');
const path = 'web/app/(dashboard)/penyetelan-dapur/page.tsx';
const text = fs.readFileSync(path, 'utf8');
const lines = text.split(/\r?\n/);
for (let i = 448; i <= 460; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
const region = lines.slice(448, 460).join('\n');
const tags = [...region.matchAll(/<(/?)([A-Za-z0-9_\.:-]+)([^>]*)>/g)];
for (const t of tags) {
  console.log('TAG', t.index, t[0]);
}
