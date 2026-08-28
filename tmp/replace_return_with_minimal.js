const fs=require('fs');const p='c:\\Users\\Lenovo\\OneDrive\\folder fix\\web\\app\\(dashboard)\\penyetelan-dapur\\page.tsx';let s=fs.readFileSync(p,'utf8');const start = s.indexOf('\n  return ('); if(start===-1){console.error('start not found'); process.exit(1);} const afterStart = s.slice(start+1); // from '  return ('
// find matching closing for the parentheses after return: count parens
let i=0; let depth=0; let found=false; for(i=0;i<afterStart.length;i++){ const ch=afterStart[i]; if(ch==='(') depth++; else if(ch===')'){ depth--; if(depth===0){ // this is the closing paren for return(
 const endIndex = start+1+i; const before=s.slice(0,start+1); const after=s.slice(endIndex+1); const newReturn = '  return (<div />);'; const out = before + newReturn + after; fs.writeFileSync(p,out,'utf8'); console.log('replaced return block'); found=true; break; } } }
if(!found) console.error('matching paren not found');
