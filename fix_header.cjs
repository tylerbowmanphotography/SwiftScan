const fs = require('fs');

let header = fs.readFileSync('src/components/Header.tsx', 'utf8');

header = header.replace('import { Camera, Search, Smartphone, Monitor, History, Sparkles, ScanBarcode } from \'lucide-react\';', 'import { Camera, Search, Smartphone, Monitor, History, Sparkles, ScanBarcode, Moon, Sun } from \'lucide-react\';');

header = header.replace('isIphoneFrameMode: boolean;', 'isIphoneFrameMode: boolean;\n  isDarkMode: boolean;\n  onToggleTheme: () => void;');
header = header.replace('isIphoneFrameMode,\n  onToggleIphoneFrame', 'isIphoneFrameMode,\n  onToggleIphoneFrame,\n  isDarkMode,\n  onToggleTheme');

const toggleBtn = `          {/* Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2.5 bg-white dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-center"
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
`;

header = header.replace('{/* Quick Search Button */}', toggleBtn + '\n          {/* Quick Search Button */}');

fs.writeFileSync('src/components/Header.tsx', header);

let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace('isIphoneFrameMode={isIphoneFrameMode}', 'isIphoneFrameMode={isIphoneFrameMode}\n        isDarkMode={isDarkMode}\n        onToggleTheme={() => setIsDarkMode(!isDarkMode)}');
fs.writeFileSync('src/App.tsx', app);
