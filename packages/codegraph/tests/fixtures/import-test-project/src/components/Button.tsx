/**
 * React component for testing JSX imports.
 */

import React from 'react';
import { useState } from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps): React.ReactElement {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = (): void => {
    setIsClicked(true);
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isClicked}
      className="btn"
    >
      {label}
    </button>
  );
}

export default Button;