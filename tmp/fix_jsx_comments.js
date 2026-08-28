const fs = require('fs');
const path = 'c:\\Users\\Lenovo\\OneDrive\\folder fix\\web\\app\\(dashboard)\\penyetelan-dapur\\page.tsx';
let s = fs.readFileSync(path,'utf8');
const retIndex = s.indexOf('\n  return (');
if(retIndex === -1) {
  console.error('return not found'); process.exit(1);
}
// find the matching closing for the return: find the last appearance of '\n  );\n}' which ends file
const endIndex = s.lastIndexOf('\n  );');
if(endIndex === -1) {
  console.error('return end not found'); process.exit(1);
}
const before = s.slice(0, retIndex);
const jsx = s.slice(retIndex, endIndex);
const after = s.slice(endIndex);
// replace occurrences of /* ... */ within jsx, but avoid already JSX comments that start with '{/*'
const fixedJsx = jsx.replace(/(?<!\{)\/\*([\s\S]*?)\*\//g, function(m, inner){
  return '{/*' + inner + '*/}';
});
const out = before + fixedJsx + after;
fs.writeFileSync(path, out, 'utf8');
console.log('patched file');
