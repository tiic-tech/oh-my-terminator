import React from 'react';

/**
 * Custom hook for toggle state management
 * This should be classified as "function" (not "component")
 * because it starts with "use" and doesn't return JSX
 */
export function useToggle(initialValue = false): {
  value: boolean;
  toggle: () => void;
  setTrue: () => void;
  setFalse: () => void;
} {
  const [value, setValue] = React.useState(initialValue);

  const toggle = () => setValue(v => !v);
  const setTrue = () => setValue(true);
  const setFalse = () => setValue(false);

  return { value, toggle, setTrue, setFalse };
}

/**
 * Another hook - useCounter
 * Should also be "function" kind
 */
export function useCounter(initialCount = 0) {
  const [count, setCount] = React.useState(initialCount);

  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  const reset = () => setCount(initialCount);

  return { count, increment, decrement, reset };
}