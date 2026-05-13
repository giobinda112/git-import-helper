import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      const parsed = item ? JSON.parse(item) : initialValue;
      if (Array.isArray(initialValue)) {
        return (Array.isArray(parsed) ? parsed : initialValue) as T;
      }
      return (parsed ?? initialValue) as T;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const valueToStore = value instanceof Function ? value(prev) : value;
      try {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch {
        // quota exceeded
      }
      return valueToStore;
    });
  }, [key]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setStoredValue(prev => {
            if (Array.isArray(prev)) {
              return (Array.isArray(parsed) ? parsed : prev) as T;
            }
            return (parsed ?? prev) as T;
          });
        } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [key]);

  return [storedValue, setValue];
}
