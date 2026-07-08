const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('page.tsx') || file.endsWith('route.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('src/app');
let fixedCount = 0;

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  
  // Clean up any existing incorrectly placed edge runtime declarations
  content = content.replace(/^export const runtime = ['"]edge['"];\n?/gm, '');
  
  // Re-insert it in the correct place
  const useClientRegex = /^(['"]use client['"];?)\n/i;
  
  if (useClientRegex.test(content)) {
    // If it has "use client", place runtime=edge AFTER it
    content = content.replace(useClientRegex, "$1\nexport const runtime = 'edge';\n");
  } else {
    // Otherwise place at the very top
    content = "export const runtime = 'edge';\n" + content;
  }
  
  fs.writeFileSync(f, content);
  fixedCount++;
});

console.log('Fixed ' + fixedCount + ' files.');
