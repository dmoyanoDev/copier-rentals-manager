import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'secondary';
}

export const Badge = ({ className = '', variant = 'secondary', children, ...props }: BadgeProps) => {
  const baseStyle = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide transition-colors';
  
  const variants = {
    success: 'bg-emerald-950 text-emerald-300 border border-emerald-800',
    warning: 'bg-amber-950 text-amber-300 border border-amber-800',
    danger: 'bg-red-950 text-red-300 border border-red-800',
    info: 'bg-blue-950 text-blue-300 border border-blue-800',
    secondary: 'bg-slate-800 text-slate-300 border border-slate-700',
  };

  return (
    <span className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
};
