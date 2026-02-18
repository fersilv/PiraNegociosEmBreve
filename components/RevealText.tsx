import React, { useEffect, useRef, useState } from 'react';

interface RevealTextProps {
  text: string;
  delay?: number;
  className?: string;
  tag?: 'h1' | 'h2' | 'p' | 'span';
}

export const RevealText: React.FC<RevealTextProps> = ({ text, delay = 0, className = '', tag = 'p' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const Tag = tag as any;

  return (
    <Tag 
      ref={ref}
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-8 blur-sm'
      } ${className}`}
    >
      {text}
    </Tag>
  );
};