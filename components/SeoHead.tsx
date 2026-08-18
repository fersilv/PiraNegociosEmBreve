import { useEffect } from 'react';

type SeoHeadProps = {
  title: string;
  description: string;
  canonical: string;
  structuredData?: Record<string, unknown>;
  noIndex?: boolean;
};

function upsertMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function SeoHead({ title, description, canonical, structuredData, noIndex = false }: SeoHeadProps) {
  useEffect(() => {
    document.title = title;
    upsertMeta('meta[name="description"]', 'name', 'description', description);
    upsertMeta('meta[name="robots"]', 'name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonical);

    let canonicalElement = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalElement) {
      canonicalElement = document.createElement('link');
      canonicalElement.rel = 'canonical';
      document.head.appendChild(canonicalElement);
    }
    canonicalElement.href = canonical;

    const scriptId = 'page-structured-data';
    document.getElementById(scriptId)?.remove();
    if (structuredData) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      // Avoid ending the script tag when a user-entered description contains HTML.
      script.textContent = JSON.stringify(structuredData).replace(/</g, '\\u003c');
      document.head.appendChild(script);
    }

    return () => document.getElementById(scriptId)?.remove();
  }, [title, description, canonical, structuredData, noIndex]);

  return null;
}
