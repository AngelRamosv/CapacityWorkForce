const fs = require('fs');
const path = require('path');

const pagesDir = 'client/src/pages';
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

const replacements = [
    { from: /hover:shadow-indigo-50\/50/g, to: 'hover:shadow-indigo-900/20' },
    { from: /shadow-indigo-100/g, to: 'shadow-indigo-900/20' },
    { from: /shadow-emerald-100/g, to: 'shadow-emerald-900/20' },
    { from: /shadow-emerald-50/g, to: 'shadow-emerald-900/20' },
    // Simulator card
    { from: /bg-green-50 border-green-100 shadow-green-100/g, to: 'bg-emerald-900/20 border-emerald-800/50 shadow-emerald-900/20' },
    { from: /bg-red-50 border-red-100 shadow-red-100/g, to: 'bg-rose-900/20 border-rose-800/50 shadow-rose-900/20' },
];

files.forEach(file => {
    const filePath = path.join(pagesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    replacements.forEach(r => {
        content = content.replace(r.from, r.to);
    });
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
});
