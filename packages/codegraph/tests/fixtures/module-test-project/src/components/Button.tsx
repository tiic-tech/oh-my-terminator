import React from 'react';

interface ButtonProps {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

/**
 * A reusable button component
 * @param props - Button properties
 * @returns JSX.Element
 */
export function Button({
  label,
  onClick,
  disabled = false,
  variant = 'primary'
}: ButtonProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
    >
      {label}
    </button>
  );
}

// Default export variant
export default Button;