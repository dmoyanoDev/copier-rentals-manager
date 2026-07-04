import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseStyle = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
    
    const variants = {
      primary: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm focus:ring-emerald-500 focus:ring-offset-slate-900',
      secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 focus:ring-slate-500 focus:ring-offset-slate-900',
      danger: 'bg-red-600 hover:bg-red-500 text-white shadow-sm focus:ring-red-500 focus:ring-offset-slate-900',
      ghost: 'bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-100 focus:ring-slate-500 focus:ring-offset-slate-900',
      outline: 'bg-transparent border border-slate-700 text-slate-300 hover:bg-slate-800 focus:ring-slate-500 focus:ring-offset-slate-900',
      success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm focus:ring-emerald-500 focus:ring-offset-slate-900',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-base',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
