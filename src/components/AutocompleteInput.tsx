import { useState, useRef, useEffect } from 'react';

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  /** Defaults to [] when omitted or undefined (e.g. partial sync payloads). */
  suggestions?: string[];
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export default function AutocompleteInput({
  value,
  onChange,
  suggestions = [],
  placeholder = '',
  className = '',
  onFocus,
  onBlur,
}: AutocompleteInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tokenized = value.toUpperCase().split('-');
  const activeToken = tokenized[tokenized.length - 1]?.trim() || '';
  const filtered = suggestions.filter(s =>
    s.toUpperCase().includes(activeToken) && s.toUpperCase() !== activeToken
  ).slice(0, 5);

  function applySuggestion(suggestion: string) {
    if (value.includes('-')) {
      const parts = value.toUpperCase().split('-');
      parts[parts.length - 1] = suggestion;
      onChange(parts.join('-'));
      return;
    }
    onChange(suggestion);
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setIsTyping(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || filtered.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Tab') {
      // Tab only shifts focus — never auto-fills. Use Arrow + Enter or click to pick a suggestion.
      setShowDropdown(false);
      setIsTyping(false);
      setHighlighted(-1);
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      applySuggestion(filtered[highlighted]);
      setShowDropdown(false);
      setIsTyping(false);
      setHighlighted(-1);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setIsTyping(false);
      setHighlighted(-1);
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => {
          onChange(e.target.value.toUpperCase());
          setShowDropdown(true);
          setIsTyping(true);
          setHighlighted(-1);
        }}
        onFocus={() => {
          setShowDropdown(true);
          onFocus?.();
        }}
        onBlur={() => {
          setTimeout(() => {
            setIsTyping(false);
            onBlur?.();
          }, 200);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {showDropdown && isTyping && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full left-0 right-0 bg-gray-900 border border-gray-600 max-h-40 overflow-y-auto shadow-xl"
        >
          {filtered.map((s, i) => (
            <div
              key={s}
              className={`px-3 py-1.5 cursor-pointer text-sm font-mono ${
                i === highlighted ? 'bg-amber-600 text-white' : 'text-gray-300 hover:bg-gray-700'
              }`}
              onMouseDown={() => {
                applySuggestion(s);
                setShowDropdown(false);
                setIsTyping(false);
                setHighlighted(-1);
                inputRef.current?.focus();
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
