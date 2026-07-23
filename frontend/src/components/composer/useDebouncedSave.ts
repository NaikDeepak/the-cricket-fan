import { useEffect, useRef } from "react";

export function useDebouncedSave<T>(
  value: T,
  onSave: (v: T) => void,
  delayMs = 500
) {
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const id = setTimeout(() => onSave(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs, onSave]);
}
