import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicCompanyLike, PublicJobLike } from './CompanySiteRenderer';

interface FullPageCompanySandboxProps {
  company: PublicCompanyLike;
  jobs: PublicJobLike[];
  html?: string;
  css?: string;
  js?: string;
  className?: string;
}

function safeJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function escapeClosingScript(value: string) {
  return value.replace(/<\/script/gi, '<\\/script');
}

export function FullPageCompanySandbox({
  company,
  jobs,
  html = '',
  css = '',
  js = '',
  className = '',
}: FullPageCompanySandboxProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(760);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://piranegocios.com.br';

  const srcDoc = useMemo(() => {
    const companyJson = safeJson(company || {});
    const jobsJson = safeJson(Array.isArray(jobs) ? jobs : []);
    const siteOriginJson = safeJson(origin);

    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; connect-src 'none'; media-src https: data:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'" />
  <style>
    :root{color-scheme:light}
    html,body{margin:0;padding:0;min-height:100%;background:#fff;color:#18181b;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow-x:hidden}
    *,*::before,*::after{box-sizing:border-box}
    img,video,svg{max-width:100%}
    pn-company-name,pn-company-address,pn-verification-badge,pn-jobs,pn-company-logo,pn-company-about,pn-company-phone,pn-company-website,pn-social-links,pn-legal-links{display:block}
    pn-company-name{font:inherit}
    pn-verification-badge .pn-badge{display:inline-flex;align-items:center;gap:.4rem;border:1px solid rgba(16,185,129,.22);background:rgba(16,185,129,.1);color:#047857;border-radius:999px;padding:.38rem .65rem;font-size:.7rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
    pn-jobs .pn-jobs-grid{display:grid;gap:12px}
    pn-jobs .pn-job{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 20px;border:1px solid rgba(24,24,27,.1);border-radius:18px;background:#fff;color:inherit;text-decoration:none;box-shadow:0 10px 35px rgba(24,24,27,.04);transition:transform .18s ease,box-shadow .18s ease}
    pn-jobs .pn-job:hover{transform:translateY(-2px);box-shadow:0 16px 45px rgba(24,24,27,.09)}
    pn-jobs .pn-job-title{font-weight:850;letter-spacing:-.02em}
    pn-jobs .pn-job-meta{margin-top:5px;color:#71717a;font-size:.83rem}
    pn-jobs .pn-job-arrow{font-size:1.2rem;opacity:.55}
    pn-company-logo img{display:block;width:100%;height:100%;object-fit:cover}
    pn-social-links .pn-socials{display:flex;flex-wrap:wrap;gap:8px}
    pn-social-links a,pn-legal-links a{color:inherit;text-decoration:none}
    ${css}
  </style>
</head>
<body>
  <div id="pn-site-root">${html}</div>
  <script>
    const COMPANY = ${companyJson};
    const JOBS = ${jobsJson};
    const SITE_ORIGIN = ${siteOriginJson};

    const text = (value) => value == null ? '' : String(value);
    const cleanUrl = (value) => {
      const raw = text(value).trim();
      if (!raw) return '';
      return /^(https?:|mailto:|tel:)/i.test(raw) ? raw : 'https://' + raw;
    };
    const locationText = () => COMPANY.address || COMPANY.cityState || [COMPANY.city, COMPANY.state].filter(Boolean).join(', ');

    class PNCompanyName extends HTMLElement {
      connectedCallback(){ this.textContent = text(COMPANY.name || 'Sua empresa'); }
    }
    class PNCompanyAddress extends HTMLElement {
      connectedCallback(){ this.textContent = locationText(); }
    }
    class PNVerificationBadge extends HTMLElement {
      connectedCallback(){
        const verified = COMPANY.isVerified || COMPANY.verificationStatus === 'VERIFIED';
        this.innerHTML = '<span class="pn-badge">' + (verified ? '✓ Empresa verificada' : 'Verificação pendente') + '</span>';
      }
    }
    class PNCompanyLogo extends HTMLElement {
      connectedCallback(){
        if (!COMPANY.logoURL) { this.innerHTML = ''; return; }
        const img = document.createElement('img');
        img.src = COMPANY.logoURL;
        img.alt = 'Logo ' + text(COMPANY.name);
        img.referrerPolicy = 'no-referrer';
        this.replaceChildren(img);
      }
    }
    class PNCompanyAbout extends HTMLElement {
      connectedCallback(){ this.textContent = text(COMPANY.description || ''); }
    }
    class PNCompanyPhone extends HTMLElement {
      connectedCallback(){ this.textContent = text(COMPANY.phone || ''); }
    }
    class PNCompanyWebsite extends HTMLElement {
      connectedCallback(){
        const href = cleanUrl(COMPANY.website);
        if (!href) { this.innerHTML = ''; return; }
        const a = document.createElement('a');
        a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = text(COMPANY.website);
        this.replaceChildren(a);
      }
    }
    class PNSocialLinks extends HTMLElement {
      connectedCallback(){
        const entries = [
          ['Instagram', COMPANY.socialInstagram], ['LinkedIn', COMPANY.socialLinkedin], ['Facebook', COMPANY.socialFacebook]
        ].filter((entry) => entry[1]);
        const wrap = document.createElement('div'); wrap.className = 'pn-socials';
        entries.forEach(([label, value]) => { const a=document.createElement('a'); a.href=cleanUrl(value); a.target='_blank'; a.rel='noopener noreferrer'; a.textContent=label; wrap.appendChild(a); });
        this.replaceChildren(wrap);
      }
    }
    class PNJobs extends HTMLElement {
      connectedCallback(){
        const wrap = document.createElement('div'); wrap.className = 'pn-jobs-grid';
        if (!JOBS.length) {
          const empty=document.createElement('div'); empty.className='pn-jobs-empty'; empty.textContent='Nenhuma vaga aberta neste momento.'; wrap.appendChild(empty);
        } else {
          JOBS.forEach((job) => {
            const a=document.createElement('a'); a.className='pn-job'; a.href=job.slug ? SITE_ORIGIN + '/vagas/' + encodeURIComponent(job.slug) : SITE_ORIGIN + '/vagas'; a.target='_blank'; a.rel='noopener noreferrer';
            const info=document.createElement('div');
            const title=document.createElement('div'); title.className='pn-job-title'; title.textContent=text(job.title || 'Oportunidade');
            const meta=document.createElement('div'); meta.className='pn-job-meta'; meta.textContent=text(job.location || [job.city,job.state].filter(Boolean).join(', ') || 'Local a combinar');
            const arrow=document.createElement('span'); arrow.className='pn-job-arrow'; arrow.textContent='↗';
            info.append(title,meta); a.append(info,arrow); wrap.appendChild(a);
          });
        }
        this.replaceChildren(wrap);
      }
    }
    class PNLegalLinks extends HTMLElement {
      connectedCallback(){ this.innerHTML=''; }
    }

    [
      ['pn-company-name', PNCompanyName], ['pn-company-address', PNCompanyAddress], ['pn-verification-badge', PNVerificationBadge],
      ['pn-company-logo', PNCompanyLogo], ['pn-company-about', PNCompanyAbout], ['pn-company-phone', PNCompanyPhone],
      ['pn-company-website', PNCompanyWebsite], ['pn-social-links', PNSocialLinks], ['pn-jobs', PNJobs], ['pn-legal-links', PNLegalLinks]
    ].forEach(([name, ctor]) => { if (!customElements.get(name)) customElements.define(name, ctor); });

    try { ${escapeClosingScript(js)} } catch (error) { console.error('[Minha Página]', error); }

    const reportHeight = () => {
      const next = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 480);
      parent.postMessage({ type: 'PN_FULL_COMPANY_PAGE_HEIGHT', height: next }, '*');
    };
    new ResizeObserver(reportHeight).observe(document.documentElement);
    addEventListener('load', reportHeight);
    setTimeout(reportHeight, 80);
    setTimeout(reportHeight, 350);
  <\/script>
</body>
</html>`;
  }, [company, css, html, jobs, js, origin]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type !== 'PN_FULL_COMPANY_PAGE_HEIGHT') return;
      const next = Number(event.data.height);
      if (Number.isFinite(next)) setHeight(Math.max(520, Math.min(12000, Math.ceil(next))));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <iframe
      ref={frameRef}
      title="Site personalizado da empresa"
      sandbox="allow-scripts allow-popups"
      srcDoc={srcDoc}
      className={`block w-full border-0 bg-white ${className}`}
      style={{ height }}
      referrerPolicy="no-referrer"
    />
  );
}
