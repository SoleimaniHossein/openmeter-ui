import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

// Dropdown with a search box. `options` is [{ value, label, hint?, badge? }].
//   - single mode: `value` is a string; choosing an item closes the dropdown.
//   - multiple mode (`multiple`): `value` is an array of strings; selected items
//     render as removable chips, choosing toggles an item, and the dropdown stays open.
// `hint` renders as a secondary line and `badge` as a right-aligned pill.
// When `allowCustom` is set, typing a value not in the list is allowed
// (pressing Enter or clicking "Use ..." commits the typed value).
const BADGE_STYLES = {
  SUM: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
  COUNT: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  AVG: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  MIN: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  MAX: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
};
const SearchableSelect = ({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  allowCustom = false,
  disabled = false,
  multiple = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const values = multiple ? (Array.isArray(value) ? value : []) : value;

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

  const isSelected = (v) => (multiple ? values.includes(v) : v === value);

  const selected = options.filter((o) => isSelected(o.value));

  // One chip per selected value, even when several options share the same
  // value (e.g. meters with the same eventType). When the value is ambiguous,
  // the chip shows the raw value instead of the first option's label.
  const chips = (multiple ? values : []).map((v) => {
    const matches = options.filter((o) => o.value === v);
    return {
      value: v,
      label: matches.length === 1 ? matches[0].label : v,
      title: matches.length > 0
        ? matches.map((o) => (o.hint ? `${o.label} — ${o.hint}` : o.label)).join(', ')
        : v,
    };
  });

  const filtered = options.filter((o) =>
    (o.label || '').toLowerCase().includes(query.trim().toLowerCase())
  );

  const toggle = (v) => {
    if (!multiple) {
      onChange(v);
      setOpen(false);
      return;
    }
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (allowCustom && query.trim() && !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase())) {
        toggle(query.trim());
      } else if (filtered.length > 0) {
        toggle(filtered[0].value);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const triggerContent = () => {
    if (multiple) {
      return (
        <div
          onClick={() => setOpen((o) => !o)}
          className="w-full flex flex-wrap items-center gap-1.5 min-h-[38px] px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 bg-white dark:bg-slate-800 transition"
        >
          {chips.length === 0 && <span className="text-slate-400 dark:text-slate-500 px-1.5 py-0.5">{placeholder}</span>}
          {chips.map((o, idx) => (
            <span
              key={`${o.value}-${idx}`}
              title={o.title || o.label}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-xs font-medium"
            >
              <span className="truncate max-w-[14rem]">{o.label}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggle(o.value); }}
                className="p-0.5 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-600/40 transition flex-shrink-0"
                title={`Remove ${o.label}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {values.length > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="ml-auto p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 rounded-full transition flex-shrink-0"
              title="Clear all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0 ml-auto" />
        </div>
      );
    }
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600"
      >
        <span className={value ? 'text-slate-900 dark:text-white truncate' : 'text-slate-400 dark:text-slate-500 truncate'}>
          {selected[0]?.label || value || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2" />
      </button>
    );
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
          {label}
          {multiple && values.length > 0 && (
            <span className="ml-1.5 normal-case font-medium text-indigo-500 dark:text-indigo-400">
              {values.length} selected
            </span>
          )}
        </label>
      )}
      <div>{triggerContent()}</div>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-black/40">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              ref={inputRef}
              type="text"
              className="w-full text-sm bg-transparent text-slate-900 dark:text-white focus:outline-none"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
            />
            {allowCustom && query.trim() && (
              <button
                type="button"
                onClick={() => toggle(query.trim())}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-medium whitespace-nowrap hover:text-indigo-800 dark:hover:text-indigo-300"
              >
                Use "{query.trim()}"
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">No matches</p>
            )}
            {filtered.map((o, idx) => (
              <button
                type="button"
                key={`${o.value}-${idx}`}
                title={o.label}
                onClick={() => toggle(o.value)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition ${
                  isSelected(o.value)
                    ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-medium'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && <span className="block truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">{o.hint}</span>}
                  </span>
                  {o.badge && (
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${BADGE_STYLES[o.badge] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                      {o.badge}
                    </span>
                  )}
                </span>
                {isSelected(o.value) && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
