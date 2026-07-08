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
let updatedCount = 0;

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (!content.includes("runtime = 'edge'") && !content.includes('runtime = "edge"')) {
    fs.writeFileSync(f, "export const runtime = 'edge';\n" + content);
    updatedCount++;
  }
});

console.log('Updated ' + updatedCount + ' files to use Edge runtime.');
