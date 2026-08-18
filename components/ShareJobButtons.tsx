import React, { useState } from 'react';
import { Share2, Link as LinkIcon, Check, Code } from 'lucide-react';

type ShareProps = {
  title: string;
  url: string;
  companyName?: string;
  location?: string;
  salary?: string;
  workModel?: string;
  acceptsPlatformApplications?: boolean;
};

export function ShareJobButtons({ 
  title, 
  url, 
  companyName,
  location,
  salary,
  workModel,
  acceptsPlatformApplications 
}: ShareProps) {
  const [copied, setCopied] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [embedWidth, setEmbedWidth] = useState('100%');
  const [embedHeight, setEmbedHeight] = useState('600px');

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Montando o texto rico para o WhatsApp e Compartilhamento Nativo
  const buildRichText = () => {
    let text = `*Vaga:* ${title}\n`;
    if (companyName) text += `*Empresa:* ${companyName}\n`;
    if (location) text += `📍 ${location}\n`;
    if (workModel) text += `💼 ${workModel}\n`;
    if (salary) text += `💰 ${salary}\n`;
    
    text += `\n`;
    
    if (acceptsPlatformApplications) {
      text += `✅ *Candidate-se diretamente pelo site!*\n`;
    }
    
    text += `Veja mais detalhes e envie seu currículo no link abaixo:\n${url}`;
    
    return text;
  };

  const richText = buildRichText();
  const encodedText = encodeURIComponent(richText);
  const encodedUrl = encodeURIComponent(url);

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: richText,
          // Não passo a URL separada aqui pois ela já está no final do richText
        });
      } catch (err) {
        console.log("Erro ao compartilhar", err);
      }
    }
  };
  
  // Widget URL
  const widgetUrl = `${window.location.origin}/embed/vagas`;
  const embedCode = `<iframe src="${widgetUrl}" width="${embedWidth}" height="${embedHeight}" frameborder="0" style="border-radius: 12px; border: 1px solid #e5e7eb;"></iframe>`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mt-6">
        {!!navigator.share && (
          <button
            onClick={shareNative}
            className="flex items-center justify-center w-10 h-10 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full transition-colors shadow-sm shrink-0"
            title="Compartilhar"
          >
            <Share2 className="w-4 h-4" />
          </button>
        )}
        
        <a
          href={`https://api.whatsapp.com/send?text=${encodedText}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center w-10 h-10 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full transition-colors shadow-sm shrink-0"
          title="Compartilhar no WhatsApp"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
        </a>

        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center w-10 h-10 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-full transition-colors shadow-sm shrink-0"
          title="Compartilhar no Facebook"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        </a>

        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center w-10 h-10 bg-[#0A66C2] hover:bg-[#084e96] text-white rounded-full transition-colors shadow-sm shrink-0"
          title="Compartilhar no LinkedIn"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        </a>

        <div className="flex items-center gap-2 border-l border-stone-200 pl-3 ml-1 sm:ml-2">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center w-10 h-10 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full transition-colors shadow-sm shrink-0"
            title={copied ? 'Copiado!' : 'Copiar Link'}
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <LinkIcon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowEmbedModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-full text-sm font-bold transition-colors shadow-sm shrink-0"
          >
            <Code className="w-4 h-4" />
            <span className="hidden sm:inline">Incorporar</span>
          </button>
        </div>
      </div>

      {showEmbedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
              <h3 className="font-serif font-bold text-xl text-stone-800 flex items-center gap-2">
                <Code className="w-5 h-5 text-terracotta-600" /> Incorporar no seu site
              </h3>
              <button onClick={() => setShowEmbedModal(false)} className="text-stone-400 hover:text-stone-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-stone-600 text-sm mb-4">
                Configure o tamanho do painel e copie o código HTML para exibir as <strong>últimas vagas do PiraNegócios</strong> dentro do seu site.
              </p>
              
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-stone-500 mb-1">Largura</label>
                  <input 
                    type="text" 
                    value={embedWidth} 
                    onChange={e => setEmbedWidth(e.target.value)}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terracotta-500 focus:border-terracotta-500"
                    placeholder="ex: 100%, 300px"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-stone-500 mb-1">Altura</label>
                  <input 
                    type="text" 
                    value={embedHeight} 
                    onChange={e => setEmbedHeight(e.target.value)}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terracotta-500 focus:border-terracotta-500"
                    placeholder="ex: 600px, 800px"
                  />
                </div>
              </div>

              <div className="relative group">
                <textarea 
                  readOnly 
                  value={embedCode}
                  className="w-full h-24 bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-mono text-stone-600 resize-none focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(embedCode);
                    alert("Código copiado!");
                  }}
                  className="absolute top-2 right-2 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 p-2 rounded-lg text-xs font-bold shadow-sm transition-colors"
                >
                  Copiar Código
                </button>
              </div>

              <div className="mt-6 border-t border-stone-100 pt-6">
                <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Pré-visualização</h4>
                <div className="w-full bg-stone-100 border border-stone-200 border-dashed rounded-xl p-4 flex items-center justify-center overflow-auto" style={{ maxHeight: '400px' }}>
                  <div dangerouslySetInnerHTML={{ __html: embedCode }} />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end">
              <button 
                onClick={() => setShowEmbedModal(false)}
                className="px-5 py-2 bg-terracotta-600 hover:bg-terracotta-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
