import React from 'react';

type ClassifiedMediaFrameProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
  empty?: React.ReactNode;
};

/**
 * Preserva a foto inteira. Quando a proporção não encaixa no card, a própria
 * imagem preenche o fundo com cover + blur, sem cortar o conteúdo principal.
 */
export function ClassifiedMediaFrame({ src, alt = '', className = '', imageClassName = '', empty = null }: ClassifiedMediaFrameProps) {
  return (
    <div className={`relative isolate overflow-hidden bg-stone-100 ${className}`}>
      {src ? <>
        <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl saturate-75" />
        <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]" />
        <img src={src} alt={alt} className={`relative z-[1] h-full w-full object-contain ${imageClassName}`} />
      </> : empty}
    </div>
  );
}
