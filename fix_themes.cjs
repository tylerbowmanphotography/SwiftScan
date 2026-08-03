const fs = require('fs');
function fix(file) {
  let content = fs.readFileSync(file, 'utf8');
  // Simple regex replacements for App.tsx and Header.tsx
  
  // Backgrounds
  content = content.replace(/bg-slate-950/g, 'bg-slate-50 dark:bg-slate-950');
  content = content.replace(/bg-slate-900/g, 'bg-white dark:bg-slate-900');
  content = content.replace(/bg-black/g, 'bg-slate-100 dark:bg-black');
  
  // Texts
  content = content.replace(/text-slate-100/g, 'text-slate-900 dark:text-slate-100');
  content = content.replace(/text-slate-200/g, 'text-slate-800 dark:text-slate-200');
  content = content.replace(/text-slate-300/g, 'text-slate-700 dark:text-slate-300');
  content = content.replace(/text-slate-400/g, 'text-slate-500 dark:text-slate-400');
  content = content.replace(/text-white/g, 'text-slate-900 dark:text-white');
  
  // Borders
  content = content.replace(/border-slate-800/g, 'border-slate-200 dark:border-slate-800');
  content = content.replace(/border-slate-700/g, 'border-slate-300 dark:border-slate-700');
  
  fs.writeFileSync(file, content);
}

fix('src/App.tsx');
fix('src/components/Header.tsx');
console.log("Done");
