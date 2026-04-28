import React from 'react';

// --- Card ---
interface NeuCardProps extends React.ComponentPropsWithoutRef<'div'> {
  children?: React.ReactNode;
  glass?: boolean;
  animate?: boolean;
}

export const NeuCard: React.FC<NeuCardProps> = ({ children, className = '', onClick, glass, animate = true, ...props }) => (
  <div 
    onClick={onClick}
    className={`
      rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-8 transition-all duration-500 ease-out
      ${animate ? 'animate-slide-up' : ''}
      ${glass ? 'bg-white/70 backdrop-blur-md border-white/40 shadow-xl' : 'bg-white border border-slate-200 shadow-sm'}
      hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1
      ${onClick ? 'cursor-pointer hover:border-neu-accent/30 active:scale-[0.98]' : ''}
      ${className}
    `}
    {...props}
  >
    {children}
  </div>
);

// --- Button ---
interface ButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  variant?: 'primary' | 'danger' | 'default' | 'ghost' | 'glass';
}

export const NeuButton: React.FC<ButtonProps> = ({ children, className = '', variant = 'default', ...props }) => {
  const baseStyle = "px-6 py-3.5 md:px-8 md:py-4 rounded-xl md:rounded-2xl font-bold text-xs uppercase tracking-widest transition-all duration-300 outline-none flex items-center justify-center gap-2 transform active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0";
  
  let colorStyle = "";
  if (variant === 'primary') {
    colorStyle = "bg-neu-accent text-white hover:bg-neu-accent/90 shadow-md shadow-neu-accent/20 border-2 border-transparent hover:shadow-xl hover:-translate-y-0.5";
  } else if (variant === 'danger') {
    colorStyle = "bg-rose-50 text-rose-600 hover:bg-rose-100 border-2 border-rose-100";
  } else if (variant === 'ghost') {
    colorStyle = "bg-transparent text-slate-500 hover:text-neu-accent hover:bg-slate-50";
  } else if (variant === 'glass') {
    colorStyle = "bg-white/90 text-neu-accent border-2 border-neu-accent hover:bg-white hover:shadow-lg";
  } else {
    colorStyle = "bg-white text-slate-700 border-2 border-slate-100 hover:border-neu-accent/30 hover:bg-slate-50 hover:shadow-soft";
  }

  return (
    <button className={`${baseStyle} ${colorStyle} ${className}`} {...props}>
      {children}
    </button>
  );
};

// --- Input ---
export const NeuInput: React.FC<React.ComponentPropsWithoutRef<'input'>> = (props) => (
  <div className="relative group w-full">
    <input 
      className={`
        w-full bg-white rounded-xl border-2 border-slate-200 px-5 py-3 md:px-6 md:py-4 outline-none 
        focus:border-neu-accent focus:bg-white focus:ring-4 focus:ring-neu-accent/10
        transition-all text-slate-900 placeholder-slate-400 font-medium text-sm md:text-base
        group-hover:border-slate-300
        ${props.className || ''}
      `}
      {...props}
    />
  </div>
);

export const NeuSelect: React.FC<React.ComponentPropsWithoutRef<'select'>> = ({ children, className = '', ...props }) => (
  <div className="relative group w-full">
    <select 
      className={`
        w-full bg-white rounded-xl border-2 border-slate-200 px-5 md:px-6 h-[52px] md:h-[60px] outline-none 
        focus:border-neu-accent focus:bg-white focus:ring-4 focus:ring-neu-accent/10
        transition-all text-slate-900 cursor-pointer font-medium appearance-none text-sm md:text-base
        group-hover:border-slate-300
        ${className}
      `}
      {...props}
    >
      {children}
    </select>
    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-neu-accent transition-colors">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
    </div>
  </div>
);

export const NeuTextarea: React.FC<React.ComponentPropsWithoutRef<'textarea'>> = ({ className = '', ...props }) => (
  <textarea 
    className={`
      w-full bg-white rounded-xl border-2 border-slate-200 px-5 py-3 md:px-6 md:py-4 outline-none 
      focus:border-neu-accent focus:bg-white focus:ring-4 focus:ring-neu-accent/10
      transition-all text-slate-900 placeholder-slate-400 font-medium text-sm md:text-base
      min-h-[100px] md:min-h-[120px] group-hover:border-slate-300 ${className}
    `}
    {...props}
  />
);

interface BadgeProps extends React.ComponentPropsWithoutRef<'div'> {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'neutral' | 'primary';
}

export const NeuBadge: React.FC<BadgeProps> = ({ children, variant, className = "", ...props }) => {
  let styleClass = 'bg-slate-100 text-slate-500 border-slate-200';
  switch(variant) {
      case 'success': styleClass = 'bg-emerald-100 text-emerald-800 border-emerald-200'; break;
      case 'warning': styleClass = 'bg-amber-100 text-amber-800 border-amber-200'; break;
      case 'danger': styleClass = 'bg-rose-100 text-rose-800 border-rose-200'; break;
      case 'primary': styleClass = 'bg-neu-accent/10 text-neu-accent border-neu-accent/20'; break;
      case 'neutral': default: styleClass = 'bg-slate-100 text-slate-600 border-slate-200'; break;
  }
  return (
    <div className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider border whitespace-nowrap animate-fade-in ${styleClass} ${className}`} {...props}>
      {children}
    </div>
  );
};