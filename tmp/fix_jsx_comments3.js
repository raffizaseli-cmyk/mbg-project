const fs=require('fs');const path='c:\\Users\\Lenovo\\OneDrive\\folder fix\\web\\app\\(dashboard)\\penyetelan-dapur\\page.tsx';let s=fs.readFileSync(path,'utf8');const retStart = s.indexOf('\n  return (');if(retStart===-1){console.error('return not found');process.exit(1);}const retEnd = s.lastIndexOf('\n  );');if(retEnd===-1){console.error('return end not found');process.exit(1);}let before=s.slice(0,retStart);let jsx=s.slice(retStart,retEnd);let after=s.slice(retEnd);
let count=0;
// Replace occurrences of /* ... */ not already wrapped as JSX comments
let out='';let i=0;while(i<jsx.length){const idx=jsx.indexOf('/*', i);if(idx===-1){out+=jsx.slice(i);break;}out+=jsx.slice(i, idx);const prevChar = idx-1>=0? jsx[idx-1]: null; if(prevChar === '{'){ // already JSX comment
 out+='/*'; i=idx+2; continue; }
 const closeIdx = jsx.indexOf('*/', idx+2);
 if(closeIdx===-1){ out+=jsx.slice(idx); break; }
 const inner = jsx.slice(idx+2, closeIdx);
 out+='{/*'+inner+'*/}';
 count++;
 i = closeIdx+2;
}
const combined = before + out + after;
fs.writeFileSync(path, combined, 'utf8');console.log('patched3, replacements:',count);
