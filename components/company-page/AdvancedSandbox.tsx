import React, { useEffect, useMemo, useRef, useState } from 'react';

interface AdvancedSandboxProps {
  html?: string;
  css?: string;
  js?: string;
  className?: string;
}

function escapeClosingScript(value: string) {
  return value.replace(/<\/script/gi, '<\\/script');
}

export function AdvancedSandbox({ html = '', css = '', js = '', className = '' }: AdvancedSandboxProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(360);

  const srcDoc = useMemo(() => `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; connect-src 'none'; media-src https: data:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'" />
  <style>
    html,body{margin:0;padding:0;background:transparent;color:inherit;font-family:Arial,sans-serif;overflow-x:hidden}
    *,*::before,*::after{box-sizing:border-box}
    img,video{max-width:100%;height:auto}
    ${css}
  </style>
</head>
<body>
  <div id="company-custom-root">${html}</div>
  <script>
    try { ${escapeClosingScript(js)} } catch (error) { console.error('[Minha Página]', error); }
    const reportHeight = () => {
      const h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 180);
      parent.postMessage({ type: 'PN_COMPANY_PAGE_HEIGHT', height: h }, '*');
    };
    new ResizeObserver(reportHeight).observe(document.documentElement);
    addEventListener('load', reportHeight);
    setTimeout(reportHeight, 80);
  <\/script>
</body>
</html>`, [css, html, js]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type !== 'PN_COMPANY_PAGE_HEIGHT') return;
      const next = Number(event.data.height);
      if (Number.isFinite(next)) setHeight(Math.max(180, Math.min(2400, Math.ceil(next))));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <iframe
      ref={frameRef}
      title="Conteúdo personalizado da empresa"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className={`block w-full border-0 bg-transparent ${className}`}
      style={{ height }}
      referrerPolicy="no-referrer"
    />
  );
}
