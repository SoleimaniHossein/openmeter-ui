import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`relative inline-flex items-center w-14 h-8 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-200/70 dark:bg-slate-800 transition-colors flex-shrink-0 ${className}`}
    >
      <Sun className="w-3.5 h-3.5 text-amber-500/80 ml-[9px] flex-shrink-0" />
      <Moon className="w-3.5 h-3.5 text-indigo-400/80 ml-auto mr-[9px] flex-shrink-0" />
      <span
        className={`absolute top-0.5 left-0.5 w-7 h-7 rounded-full flex items-center justify-center bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-600 transition-transform duration-200 ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {isDark ? (
          <Moon className="w-4 h-4 text-indigo-400" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500" />
        )}
      </span>
    </button>
  );
};

export default ThemeToggle;
