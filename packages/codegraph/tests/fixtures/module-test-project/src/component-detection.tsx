// A2 Test: Component Type Judgment
// Tests how to distinguish component vs function

import React from 'react';

// Case 1: Explicit JSX.Element return type -> component
export function Header({ title }: { title: string }): JSX.Element {
  return <h1>{title}</h1>;
}
// Expected: kind = "component"

// Case 2: React.ReactElement return type -> component
export function Footer(): React.ReactElement {
  return <footer>Copyright 2024</footer>;
}
// Expected: kind = "component"

// Case 3: JSX in body, no type annotation -> component
export function Button({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}>
      {label}
    </button>
  );
}
// Expected: kind = "component" (JSX in body)

// Case 4: Arrow function with JSX -> component
export const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="card">
    <h2>{title}</h2>
    {children}
  </div>
);
// Expected: kind = "component"

// Case 5: Hook (use prefix) with JSX -> function (NOT component)
export function useModal() {
  const [isOpen, setIsOpen] = React.useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  // Even though this returns JSX-related, it's a hook
  return { isOpen, open, close };
}
// Expected: kind = "function" (hook pattern, name starts with "use")

// Case 6: Pure function, no JSX -> function
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
// Expected: kind = "function"

// Case 7: Function with React.ReactNode but not component
export function getErrorMessage(code: number): React.ReactNode {
  // Returns ReactNode but not JSX - this is debatable
  // Could be "function" as it doesn't render JSX directly
  if (code === 404) return 'Not Found';
  return 'Unknown Error';
}
// Expected: kind = "function" (no JSX elements in body)

// Case 8: Self-closing JSX element
export function Icon({ name }: { name: string }) {
  return <span className={`icon icon-${name}`} />;
}
// Expected: kind = "component"