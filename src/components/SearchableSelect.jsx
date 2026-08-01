import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

// Dropdown with a search box. `options` is [{ value, label }].
// When `allowCustom` is set, typing a value not in the list is allowed
// (pressing Enter commits the typed value).
const SearchableSelect = ({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  allowCustom = false,
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const filtered = options.filter((o) =>
    (o.label || '').toLowerCase().includes(query.trim().toLowerCase())
  );

  const choose = (v) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (allowCustom && query.trim()) {
        choose(query.trim());
      } else if (filtered.length === 1) {
        choose(filtered[0].value);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
      >
        <span className={value ? 'text-slate-900 truncate' : 'text-slate-400 truncate'}>
          {selected?.label || value || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl bg-white border border-slate-200 shadow-lg">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              className="w-full text-sm focus:outline-none"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
            />
            {allowCustom && (
              <button
                type="button"
                onClick={() => { choose(query.trim()); }}
                disabled={!query.trim()}
                className="text-xs text-indigo-600 font-medium disabled:text-slate-300"
              >
                Use "{query.trim() || '...'}"
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-400">No matches</p>
            )}
            {filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                onClick={() => choose(o.value)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition ${
                  o.value === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
