import React, { useState, useEffect } from 'react';
import { Instagram, Smartphone, Sparkles, MapPin } from 'lucide-react';
import { LINKS, TEXTS } from './constants';
import { SocialButton } from './components/SocialButton';
import { RevealText } from './components/RevealText';

export default function App() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Subtle parallax effect tracking mouse
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden selection:bg-terracotta-200 selection:text-terracotta-900">
      
      {/* Background Decorative Elements */}
      <div 
        className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-terracotta-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float"
        style={{ transform: `translate(${mousePosition.x * -1}px, ${mousePosition.y * -1}px)` }}
      />
      <div 
        className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-terracotta-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"
        style={{ animationDelay: '2s', transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)` }}
      />
      
      {/* Main Container */}
      <main className="relative z-10 container mx-auto px-6 py-12 flex flex-col items-center text-center max-w-4xl">
        
        {/* Mysterious Tag */}
        <div className="mb-8 overflow-hidden">
          <RevealText 
            tag="span" 
            text={TEXTS.MYSTERY_TAG.toUpperCase()} 
            delay={100} 
            className="inline-flex items-center gap-2 text-xs md:text-sm font-bold tracking-[0.3em] text-terracotta-600 uppercase border-b border-terracotta-300 pb-2"
          />
        </div>

        {/* Hero Title */}
        <div className="relative mb-6">
           <div className="animate-subtle-pulse">
             <RevealText 
              tag="h1" 
              text={TEXTS.TITLE} 
              delay={300} 
              className="font-serif text-6xl md:text-8xl lg:text-9xl font-bold text-terracotta-900 leading-tight"
            />
           </div>
          <div className="absolute -top-6 -right-6 md:-top-8 md:-right-12 text-terracotta-400 opacity-60 animate-bounce" style={{ animationDuration: '3s' }}>
            <Sparkles size={42} strokeWidth={1} />
          </div>
        </div>

        {/* Subtitle */}
        <RevealText 
            tag="h2" 
            text={TEXTS.SUBTITLE} 
            delay={600} 
            className="text-2xl md:text-4xl font-light text-terracotta-700 italic font-serif mb-8"
        />

        {/* Divider */}
        <div className="w-24 h-[1px] bg-terracotta-800/20 mb-8 mx-auto" />

        {/* Description */}
        <RevealText 
          tag="p" 
          text={TEXTS.DESCRIPTION} 
          delay={900} 
          className="text-lg md:text-xl text-stone-600 max-w-2xl mb-12 font-sans font-light leading-relaxed"
        />

        {/* Buttons Section */}
        <div className="flex flex-col md:flex-row gap-6 w-full items-center justify-center opacity-0 animate-fade-in-up" style={{ animationDelay: '1.2s' }}>
          <SocialButton 
            href={LINKS.INSTAGRAM}
            icon={<Instagram className="w-6 h-6" />}
            label={TEXTS.CTA_INSTAGRAM}
            variant="secondary"
          />
          <SocialButton 
            href={LINKS.WHATSAPP}
            icon={<Smartphone className="w-6 h-6" />}
            label={TEXTS.CTA_WHATSAPP}
            variant="primary"
          />
        </div>

        {/* Location / Footer teaser */}
        <div className="mt-24 opacity-0 animate-fade-in-up" style={{ animationDelay: '1.5s' }}>
           <p className="flex items-center gap-2 text-terracotta-800/60 font-medium tracking-wider text-sm">
             <MapPin className="w-4 h-4" />
             PIRASSUNUNGA & REGIÃO
           </p>
        </div>

      </main>

      {/* Decorative Geometry */}
      <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-terracotta-200 to-transparent opacity-50 -z-10" />
      <div className="absolute top-0 left-1/2 w-[1px] h-full bg-gradient-to-b from-transparent via-terracotta-200 to-transparent opacity-50 -z-10" />

    </div>
  );
}