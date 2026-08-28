const fs=require('fs');
const path='c:\\Users\\Lenovo\\OneDrive\\folder fix\\web\\app\\(dashboard)\\penyetelan-dapur\\page.tsx';
const s=fs.readFileSync(path,'utf8');
const lines=s.split(/\r?\n/);
const from=792-1; const to=810-1;
for(let i=from;i<=to && i<lines.length;i++){
  const line=lines[i];
  const codes=Array.from(line).map(ch=>ch.charCodeAt(0));
  console.log((i+1)+": "+line);
  console.log(' codes: '+codes.join(','));
}
