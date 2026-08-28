const fs=require('fs'); const p='c:\\Users\\Lenovo\\OneDrive\\folder fix\\web\\app\\(dashboard)\\penyetelan-dapur\\page.tsx'; const s=fs.readFileSync(p,'utf8'); const regex = /<\/?div(\s|>|\/)/g; let m; const stack=[]; while((m=regex.exec(s))){ const token = m[0]; const pos=m.index; const line = s.slice(0,pos).split(/\r?\n/).length; if(token.startsWith('</')){ const last = stack.pop(); if(!last){ console.log('Unmatched close </div> at line', line); break; } } else { // opening <div ...> could be self-closing if ends with '/>' in same tag
    // check substring until next '>' to see if self-closing
    const end = s.indexOf('>', pos);
    const tagContent = s.slice(pos, end+1);
    if(tagContent.endsWith('/>')){
      // self-closing, ignore
    } else {
      stack.push({pos,line});
    }
 }
}
if(stack.length>0){ console.log('Unmatched open <div> at line', stack[stack.length-1].line, 'count', stack.length); } else console.log('All divs matched');
