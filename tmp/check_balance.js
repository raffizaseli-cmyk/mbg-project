const fs = require('fs');
const path = 'c:\\Users\\Lenovo\\OneDrive\\folder fix\\web\\app\\(dashboard)\\penyetelan-dapur\\page.tsx';
const text = fs.readFileSync(path, 'utf8');
const lines = text.split(/\r?\n/);
const sections = [
  {name:'nutrisiStart', pat:'{activeTab === "nutrisi" && ('},
  {name:'mappingStart', pat:'{activeTab === "mapping" && ('},
  {name:'modalStart', pat:'{modalType !== null && ('}
];
for(const s of sections){
  const idx = text.indexOf(s.pat);
  console.log(s.name, idx < 0 ? 'not found' : text.slice(0, idx).split(/\r?\n/).length);
}

function countChars(str, chars){
  const counts = {};
  for(const c of chars) counts[c]=0;
  for(const ch of str) if(chars.includes(ch)) counts[ch]++;
  return counts;
}
const nutriStart = text.indexOf('{activeTab === "nutrisi" && (');
const mappingStart = text.indexOf('{activeTab === "mapping" && (');
const slice = text.slice(nutriStart, mappingStart);
console.log('slice length', slice.length);
console.log(countChars(slice, ['{','}','(',')','<','>']));
const open = [];
for(let i=0;i<slice.length;i++){
  const ch=slice[i];
  if(ch==='('||ch==='{'||ch==='[') open.push({ch,i});
  else if(ch===')'||ch==='}'||ch===']'){
    const last=open.pop();
    if(!last){ console.log('unmatched close', ch, 'pos', i, 'line', slice.slice(0,i).split(/\r?\n/).length); break; }
    if(last.ch==='('&&ch!==')'|| last.ch==='{'&&ch!=='}'|| last.ch==='['&&ch!==']'){
      console.log('mismatch', last.ch, ch, 'pos', i, 'line', slice.slice(0,i).split(/\r?\n/).length);
      break;
    }
  }
}
console.log('remaining stack', open.map(x=>x.ch));
