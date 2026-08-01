import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

// Dropdown with a search box. `options` is [{ value, label }].
//   - single mode: `value` is a string; choosing an item closes the dropdown.
//   - multiple mode (`multiple`): `value` is an array of strings; selected items
//     render as removable chips, choosing toggles an item, and the dropdown stays open.
// When `allowCustom` is set, typing a value not in the list is allowed
// (pressing Enter or clicking "Use ..." commits the typed value).
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
          className="w-full flex flex-wrap items-center gap-1.5 min-h-[38px] px-2 py-1.5 rounded-lg border border-slate-300 text-sm cursor-pointer hover:border-slate-400 transition"
        >
          {values.length === 0 && <span className="text-slate-400 px-1.5 py-0.5">{placeholder}</span>}
          {selected.map((o) => (
            <span
              key={o.value}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium"
            >
              <span className="truncate max-w-[14rem]">{o.label}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggle(o.value); }}
                className="p-0.5 rounded-full hover:bg-indigo-200 transition flex-shrink-0"
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
              className="ml-auto p-1 text-slate-400 hover:text-red-500 rounded-full transition flex-shrink-0"
              title="Clear all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-auto" />
        </div>
      );
    }
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
      >
        <span className={value ? 'text-slate-900 truncate' : 'text-slate-400 truncate'}>
          {selected[0]?.label || value || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
      </button>
    );
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          {label}
          {multiple && values.length > 0 && (
            <span className="ml-1.5 normal-case font-medium text-indigo-500">
              {values.length} selected
            </span>
          )}
        </label>
      )}
      <div>{triggerContent()}</div>

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
            {allowCustom && query.trim() && (
              <button
                type="button"
                onClick={() => toggle(query.trim())}
                className="text-xs text-indigo-600 font-medium whitespace-nowrap hover:text-indigo-800"
              >
                Use "{query.trim()}"
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
                onClick={() => toggle(o.value)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-indigo-50 transition ${
                  isSelected(o.value) ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'
                }`}
              >
                <span className="truncate">{o.label}</span>
                {isSelected(o.value) && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
