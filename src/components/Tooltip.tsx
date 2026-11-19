import React from 'react';
import { Info } from 'lucide-react';

interface TooltipProps {
  text: string;
  className?: string;
  children?: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ text, className = '', children }) => {
  return (
    <span
      className={`group relative inline-flex items-center cursor-help ${className}`}
      title={text}
    >
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex z-50 flex-col items-center">
        <span className="whitespace-normal min-w-[160px] max-w-[280px] rounded-xl bg-slate-900/95 px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug text-white shadow-xl backdrop-blur-xs border border-white/10">
          {text}
        </span>
        <span className="w-2 h-1 -mt-px border-t-4 border-l-4 border-r-4 border-t-slate-900/95 border-l-transparent border-r-transparent"></span>
      </span>
    </span>
  );
};

export const InfoTooltip: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  return (
    <Tooltip text={text} className={className}>
      <span className="w-4 h-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors">
        <Info className="w-2.5 h-2.5 stroke-[2.5]" />
      </span>
    </Tooltip>
  );
};
