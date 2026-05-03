import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Card component for displaying content in a boxed layout
 */
export const Card = ({ title, children, footer }: CardProps) => (
  <div className="card">
    <div className="card-header">
      <h3>{title}</h3>
    </div>
    <div className="card-body">
      {children}
    </div>
    {footer && (
      <div className="card-footer">
        {footer}
      </div>
    )}
  </div>
);

// Named export only (no default)