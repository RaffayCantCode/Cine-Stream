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
  const newContent = content.replace(/^export const runtime = ['"]edge['"];\r?\n?/gm, '');
  if (newContent !== content) {
    fs.writeFileSync(f, newContent);
    fixedCount++;
  }
});

console.log('Removed edge runtime from ' + fixedCount + ' files.');
