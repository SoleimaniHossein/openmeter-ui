import React from 'react';

const TextBox = React.forwardRef(({ type = 'text', className = '', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={`px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 transition ${className}`}
    {...props}
  />
));

export default TextBox;
