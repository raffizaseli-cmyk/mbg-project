const fs=require('fs');const committed='c:\\Users\\Lenovo\\OneDrive\\folder fix\\tmp\\page_committed_utf8.tsx';const live='c:\\Users\\Lenovo\\OneDrive\\folder fix\\web\\app\\(dashboard)\\penyetelan-dapur\\page.tsx';const committedText=fs.readFileSync(committed,'utf8');const liveText=fs.readFileSync(live,'utf8');const startIdx = committedText.indexOf('\n  return ('); if(startIdx===-1){console.error('committed return not found');process.exit(1);} const endIdx = committedText.lastIndexOf('\n  );'); if(endIdx===-1){console.error('committed return end not found');process.exit(1);} const returnBlock = committedText.slice(startIdx, endIdx+4); // include '  );'
const lines = returnBlock.split(/\r?\n/);
const n = Number(process.argv[2]||lines.length);
if(n<1||n>lines.length){console.error('n out of range',n,lines.length);process.exit(1);}const prefix = lines.slice(0,n).join('\n');
// Now replace live file return block
const liveStart = liveText.indexOf('  return (');
if(liveStart===-1){console.error('live return not found');process.exit(1);} // find the next closing ');' after liveStart
const liveEndRel = liveText.indexOf(');', liveStart);
if(liveEndRel===-1){console.error('live return end not found');process.exit(1);}const before=liveText.slice(0,liveStart);const after=liveText.slice(liveEndRel+2);
const newText = before + prefix + after;
fs.writeFileSync(live,newText,'utf8');console.log('wrote live with',n,'lines of return');
