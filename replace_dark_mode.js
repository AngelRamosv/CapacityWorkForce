const fs = require('fs');

let content = fs.readFileSync('client/src/pages/LiveDashboard.tsx', 'utf8');

const replacements = [
    { from: /bg-white/g, to: 'bg-[#161a22]' },
    { from: /bg-gray-50\/50/g, to: 'bg-slate-800/30' },
    { from: /bg-gray-50/g, to: 'bg-[#0e1117]' },
    { from: /bg-gray-100/g, to: 'bg-slate-800' },
    { from: /border-gray-50/g, to: 'border-slate-800/50' },
    { from: /border-gray-100/g, to: 'border-slate-800' },
    { from: /border-gray-200/g, to: 'border-slate-700' },
    { from: /border-amber-100/g, to: 'border-slate-800' },
    { from: /divide-gray-50/g, to: 'divide-slate-800/50' },
    { from: /hover:bg-gray-50/g, to: 'hover:bg-slate-800' },
    { from: /hover:bg-gray-100/g, to: 'hover:bg-slate-700' },
    { from: /text-gray-900/g, to: 'text-slate-50' },
    { from: /text-gray-800/g, to: 'text-slate-100' },
    { from: /text-gray-700/g, to: 'text-slate-200' },
    { from: /text-gray-600/g, to: 'text-slate-300' },
    { from: /text-gray-500/g, to: 'text-slate-400' },
    { from: /text-gray-400/g, to: 'text-slate-500' },
    { from: /text-indigo-900/g, to: 'text-indigo-100' },
    { from: /bg-indigo-50/g, to: 'bg-indigo-900/30' },
    { from: /bg-rose-50\/50/g, to: 'bg-rose-900/20' },
    { from: /bg-rose-50/g, to: 'bg-rose-900/20' },
    { from: /border-rose-100\/50/g, to: 'border-rose-800/30' },
    { from: /border-rose-200/g, to: 'border-rose-800/50' },
    { from: /bg-amber-50\/50/g, to: 'bg-amber-900/20' },
    { from: /bg-amber-50/g, to: 'bg-amber-900/20' },
    { from: /border-amber-100\/50/g, to: 'border-amber-800/30' },
    { from: /border-amber-200/g, to: 'border-amber-800/50' },
    { from: /bg-emerald-50/g, to: 'bg-emerald-900/20' },
    { from: /border-emerald-200/g, to: 'border-emerald-800/50' },
    { from: /bg-indigo-600/g, to: 'bg-indigo-500' }, // slightly brighter for dark mode
    { from: /text-indigo-600/g, to: 'text-indigo-400' },
    { from: /text-indigo-700/g, to: 'text-indigo-300' },
    { from: /text-amber-600/g, to: 'text-amber-400' },
    { from: /text-amber-700/g, to: 'text-amber-300' },
    { from: /text-emerald-600/g, to: 'text-emerald-400' },
    { from: /text-rose-600/g, to: 'text-rose-400' },
    { from: /text-green-700/g, to: 'text-green-300' },
    { from: /bg-green-100/g, to: 'bg-green-900/30' },
    { from: /text-purple-700/g, to: 'text-purple-300' },
    { from: /bg-purple-100/g, to: 'bg-purple-900/30' }
];

// Perform replacements sequentially
replacements.forEach(r => {
    content = content.replace(r.from, r.to);
});

fs.writeFileSync('client/src/pages/LiveDashboard.tsx', content);
console.log('LiveDashboard updated!');
