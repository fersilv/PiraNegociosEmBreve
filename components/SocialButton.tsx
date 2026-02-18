import React from 'react';
import { ArrowRight } from 'lucide-react';

interface SocialButtonProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'secondary';
}

export const SocialButton: React.FC<SocialButtonProps> = ({ href, icon, label, variant = 'primary' }) => {
  const baseStyles = "group relative w-full sm:w-auto min-w-[280px] flex items-center justify-between px-8 py-4 rounded-full transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl overflow-hidden border";
  
  const styles = variant === 'primary' 
    ? "bg-terracotta-500 text-white border-terracotta-500 hover:bg-terracotta-600" 
    : "bg-transparent text-terracotta-800 border-terracotta-800 hover:bg-terracotta-50";

  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`${baseStyles} ${styles}`}
    >
      <span className="flex items-center gap-4 text-lg font-medium relative z-10">
        {icon}
        {label}
      </span>
      <ArrowRight className="w-5 h-5 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 relative z-10" />
      
      {/* Shine effect on hover */}
      <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
    </a>
  );
};