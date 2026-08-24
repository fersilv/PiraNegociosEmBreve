import type { Express, Request, Response } from "express";

type PublicDataGetter = (pathName: string) => Promise<any>;
type SendSpa = (req: Request, res: Response) => void;

type SeoRoutesOptions = {
  app: Express;
  publicSiteUrl: string;
  getPublicData: PublicDataGetter;
  sendSpa: SendSpa;
};

const CRAWLER_UA =
  /googlebot|bingbot|yandex|baiduspider|twitterbot|facebookexternalhit|linkedinbot|slackbot|whatsapp|telegrambot|applebot|duckduckbot|semrush|ahrefs/i;

const RESERVED_COMPANY_SLUGS = new Set([
  "api",
  "dashboard",
  "user",
  "company",
  "admin",
  "login",
  "termos",
  "vagas",
  "vagas-em",
  "criador-de-curriculo",
  "criar-curriculo",
  "curriculo-online",
  "uploads",
  "assets",
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
  "icon.svg",
  "apple-touch-icon.svg",
]);

function isCrawler(req: Request) {
  return CRAWLER_UA.test(req.get("user-agent") || "");
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] || character,
  );
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function pageHtml({
  title,
  description,
  canonical,
  body,
  structuredData,
  robots = "index,follow,max-image-preview:large",
}: {
  title: string;
  description: string;
  canonical: string;
  body: string;
  structuredData?: Record<string, unknown>;
  robots?: string;
}) {
  const jsonLd = structuredData
    ? `<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>`
    : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${escapeHtml(robots)}"><meta name="googlebot" content="${escapeHtml(robots)}"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="website"><meta property="og:locale" content="pt_BR"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:site_name" content="PiraNegócios"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}">${jsonLd}<style>body{margin:0;background:#faf7f2;color:#292524;font-family:Arial,sans-serif;line-height:1.6}.wrap{max-width:980px;margin:auto;padding:32px 20px}nav{background:#2d211c;padding:15px 0}nav .wrap{padding-top:0;padding-bottom:0;display:flex;justify-content:space-between;align-items:center}.brand{color:#fff!important;font-size:22px;font-weight:700}.navlink{color:#f0bf9f!important}a{color:#a63f2d;text-decoration:none}a:hover{text-decoration:underline}.brand,h1,h2{font-family:Georgia,serif}.card{background:#fff;border:1px solid #e7e0d9;border-radius:22px;padding:30px;box-shadow:0 8px 35px #4b33280a}.hero{background:#2d211c;color:#fff;border-radius:26px;padding:34px}.hero a{color:#f0bf9f}.hero .muted{color:#d6c8c0}.meta{display:flex;flex-wrap:wrap;gap:10px 20px;color:#57534e;margin:22px 0;padding:16px 0;border-top:1px solid #eee;border-bottom:1px solid #eee}.button{display:inline-block;background:#a63f2d;color:white;padding:13px 20px;border-radius:10px;font-weight:bold}.company{font-weight:bold;font-size:18px}.jobs,.cities{display:grid;gap:12px;margin-top:20px}.job,.city{display:block;border:1px solid #e7e0d9;background:#fff;border-radius:14px;padding:16px;color:#292524}.job:hover,.city:hover{border-color:#cc5843;text-decoration:none}.muted{color:#78716c}.eyebrow{font-size:11px;font-weight:bold;letter-spacing:.16em;text-transform:uppercase;color:#b96345}.logo{width:72px;height:72px;object-fit:cover;border-radius:16px;background:#fdf6f5}.head{display:flex;gap:18px;align-items:center}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.breadcrumbs{font-size:12px;color:#78716c;margin-bottom:14px}.breadcrumbs a{color:#78716c}@media(max-width:680px){.card,.hero{padding:22px}.wrap{padding:24px 16px}.grid2{grid-template-columns:1fr}}</style></head><body><nav><div class="wrap"><a class="brand" href="/">PiraNegócios</a><a class="navlink" href="/vagas">Ver vagas</a></div></nav><main class="wrap">${body}</main></body></html>`;
}

function jobPlace(job: any) {
  if (job?.city) return `${job.city}${job.state ? `, ${job.state}` : ""}`;
  return String(job?.location || "").trim();
}

function companyPlace(company: any) {
  if (company?.cityState) return company.cityState;
  if (company?.city) return `${company.city}${company.state ? `, ${company.state}` : ""}`;
  return "";
}

function parseLocationParts(job: any) {
  const raw = String(job?.location || "").trim();
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  const postalCode = raw.match(/\b\d{5}-?\d{3}\b/)?.[0] || null;
  const explicitState = typeof job?.state === "string" ? job.state.trim().toUpperCase().slice(0, 2) : "";
  const stateFromText = [...parts].reverse().find((part) => /^[A-Za-z]{2}$/.test(part))?.toUpperCase() || raw.match(/\/\s*([A-Za-z]{2})(?:\s|$)/)?.[1]?.toUpperCase() || "";
  const state = explicitState || stateFromText || null;
  const explicitCity = typeof job?.city === "string" ? job.city.trim() : "";
  let city = explicitCity;
  if (!city && parts.length) {
    const cleanParts = parts.filter((part) => !/^[A-Za-z]{2}$/.test(part) && !/^\d{5}-?\d{3}$/.test(part));
    city = cleanParts.length > 1 ? cleanParts[cleanParts.length - 1] : cleanParts[0] || "";
  }
  if (!city && raw.includes("/")) city = raw.split("/")[0].trim();

  const streetPrefix = /^(?:Rua|R\.?|Avenida|Av\.?|Alameda|Travessa|Praça|Praca|Rodovia|Estrada|Marginal)\b/i;
  let streetAddress: string | null = null;
  if (parts[0] && streetPrefix.test(parts[0])) {
    const first = parts[0];
    const second = parts[1] && !/^[A-Za-z]{2}$/.test(parts[1]) && !/^\d{5}-?\d{3}$/.test(parts[1]) && parts[1] !== city
      ? parts[1]
      : "";
    streetAddress = [first, second].filter(Boolean).join(", ") || null;
  }

  return { raw, city: city || null, state, postalCode, streetAddress };
}

function buildPostalAddress(job: any): Record<string, unknown> | null {
  const parts = parseLocationParts(job);
  if (!parts.city && !parts.state && !parts.streetAddress && !parts.postalCode) return null;
  return {
    "@type": "PostalAddress",
    ...(parts.streetAddress ? { streetAddress: parts.streetAddress } : {}),
    ...(parts.city ? { addressLocality: parts.city } : {}),
    ...(parts.state ? { addressRegion: parts.state } : {}),
    ...(parts.postalCode ? { postalCode: parts.postalCode } : {}),
    addressCountry: "BR",
  };
}

function parseBrazilianMoney(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildBaseSalary(value: unknown): Record<string, unknown> | null {
  const text = String(value || "").trim();
  if (!text || !/(?:R\$|\bBRL\b)/i.test(text)) return null;

  const unitText = /(?:por\s+|\/\s*)hora|hor[áa]rio/i.test(text)
    ? "HOUR"
    : /(?:por\s+|\/\s*)dia|di[áa]ri[oa]/i.test(text)
      ? "DAY"
      : /(?:por\s+|\/\s*)semana|semanal/i.test(text)
        ? "WEEK"
        : /(?:por\s+|\/\s*)ano|anual/i.test(text)
          ? "YEAR"
          : /(?:por\s+|\/\s*)m[eê]s|mensal/i.test(text)
            ? "MONTH"
            : null;
  if (!unitText) return null;

  const values = Array.from(text.matchAll(/(?:R\$|\bBRL\b)\s*([\d.]+(?:,\d{1,2})?)/gi))
    .map((match) => parseBrazilianMoney(match[1]))
    .filter((amount): amount is number => amount !== null);
  if (!values.length) return null;
  const quantitativeValue: Record<string, unknown> = { "@type": "QuantitativeValue", unitText };
  if (values.length >= 2) {
    quantitativeValue.minValue = Math.min(values[0], values[1]);
    quantitativeValue.maxValue = Math.max(values[0], values[1]);
  } else {
    quantitativeValue.value = values[0];
  }
  return {
    "@type": "MonetaryAmount",
    currency: "BRL",
    value: quantitativeValue,
  };
}

function renderJobLinks(jobs: any[], limit = 60) {
  return (jobs || [])
    .filter((job) => job?.slug && job?.title)
    .slice(0, limit)
    .map((job) => {
      const company = job.company?.name || job.companyName || job.sourceName || "Oportunidade";
      const meta = [jobPlace(job), job.type, job.workModel, job.salary].filter(Boolean).map(escapeHtml).join(" · ");
      return `<a class="job" href="/vagas/${encodeURIComponent(job.slug)}"><strong>${escapeHtml(job.title)}</strong><div class="muted">${escapeHtml(company)}${meta ? ` · ${meta}` : ""}</div></a>`;
    })
    .join("");
}

function renderCityLinks(cities: any[], limit = 40) {
  return (cities || [])
    .filter((city) => city?.slug && city?.city)
    .slice(0, limit)
    .map((city) => {
      const place = `${city.city}${city.state ? `, ${city.state}` : ""}`;
      return `<a class="city" href="/vagas-em/${encodeURIComponent(city.slug)}"><strong>Vagas em ${escapeHtml(place)}</strong><div class="muted">${Number(city.count || 0)} ${Number(city.count || 0) === 1 ? "oportunidade ativa" : "oportunidades ativas"}</div></a>`;
    })
    .join("");
}

function websiteGraph(publicSiteUrl: string) {
  return [
    {
      "@type": "Organization",
      "@id": `${publicSiteUrl}/#organization`,
      name: "PiraNegócios",
      alternateName: ["Pira Negócios", "Pira Negócio"],
      url: `${publicSiteUrl}/`,
    },
    {
      "@type": "WebSite",
      "@id": `${publicSiteUrl}/#website`,
      name: "PiraNegócios",
      alternateName: ["Pira Negócios", "Pira Negócio"],
      url: `${publicSiteUrl}/`,
      publisher: { "@id": `${publicSiteUrl}/#organization` },
      inLanguage: "pt-BR",
    },
  ];
}

export function registerSeoRoutes({ app, publicSiteUrl, getPublicData, sendSpa }: SeoRoutesOptions) {
  app.use((req, res, next) => {
    if (/^\/(?:user|company|admin|dashboard|login)(?:\/|$)/i.test(req.path)) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
    }
    next();
  });

  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(
      `User-agent: *\nAllow: /\nDisallow: /dashboard/\nDisallow: /user/\nDisallow: /company/\nDisallow: /admin/\nDisallow: /login\nDisallow: /api/\nDisallow: /uploads/\n\nSitemap: ${publicSiteUrl}/sitemap.xml\n`,
    );
  });

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const publicApiOrigin = (process.env.PUBLIC_API_ORIGIN || "http://127.0.0.1:3888/api").replace(/\/$/, "");
      const response = await fetch(`${publicApiOrigin}/seo/sitemap`, {
        headers: { accept: "application/xml" },
      });
      if (!response.ok) return res.status(502).type("text/plain").send("Sitemap temporarily unavailable");
      res.setHeader("Cache-Control", "public, max-age=900, s-maxage=3600");
      return res.type("application/xml").send(await response.text());
    } catch {
      return res.status(502).type("text/plain").send("Sitemap temporarily unavailable");
    }
  });

  app.get("/", async (req, res, next) => {
    if (!isCrawler(req)) return next();
    const data = await getPublicData("/public/jobs-index");
    const cities = data?.cities || [];
    const jobs = data?.jobs || [];
    const canonical = `${publicSiteUrl}/`;
    const body = `<section class="hero"><p class="eyebrow">Empregos, talentos e negócios da região</p><h1>Vagas de emprego em Pirassununga e região</h1><p class="muted">PiraNegócios, também encontrado como Pira Negócios ou Pira Negócio, reúne oportunidades de emprego, empresas e talentos de Pirassununga e cidades da região em um único lugar.</p><p><a class="button" href="/vagas">Ver vagas abertas</a> <a href="/criador-de-curriculo" style="margin-left:14px">Criar currículo grátis</a></p></section><section><h2>Vagas por cidade</h2><p class="muted">Acesse diretamente as cidades com oportunidades ativas.</p><div class="cities grid2">${renderCityLinks(cities, 30)}</div></section><section><h2>Oportunidades recentes</h2><div class="jobs">${renderJobLinks(jobs, 24)}</div></section>`;
    return res.type("html").send(pageHtml({
      title: "PiraNegócios | Vagas e empregos em Pirassununga e região",
      description: "PiraNegócios, Pira Negócios ou Pira Negócio: encontre vagas de emprego em Pirassununga, Leme, Araras e cidades da região, além de empresas e currículos.",
      canonical,
      body,
      structuredData: {
        "@context": "https://schema.org",
        "@graph": [
          ...websiteGraph(publicSiteUrl),
          {
            "@type": "CollectionPage",
            "@id": `${canonical}#jobs`,
            name: "Vagas de emprego em Pirassununga e região",
            url: canonical,
            isPartOf: { "@id": `${publicSiteUrl}/#website` },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: jobs.length,
              itemListElement: jobs.slice(0, 40).map((job: any, index: number) => ({
                "@type": "ListItem",
                position: index + 1,
                name: job.title,
                url: `${publicSiteUrl}/vagas/${job.slug}`,
              })),
            },
          },
        ],
      },
    }));
  });

  app.get(["/criar-curriculo", "/curriculo-online"], (_req, res) => {
    return res.redirect(301, "/criador-de-curriculo");
  });

  app.get(["/criador-de-curriculo", "/criador-de-curriculo/"], (req, res) => {
    if (!isCrawler(req)) return sendSpa(req, res);
    const canonical = `${publicSiteUrl}/criador-de-curriculo`;
    const description = "Crie um currículo profissional grátis e online. Escolha modelos, edite em tempo real e salve em PDF sem cadastro obrigatório. Recursos de IA são opcionais.";
    const faq = [
      {
        question: "Preciso criar conta para fazer meu currículo?",
        answer: "Não. O criador de currículo público do PiraNegócios funciona sem login. Criar uma conta é opcional e permite levar o currículo ao seu perfil e ao Banco de Talentos.",
      },
      {
        question: "O criador de currículo é grátis?",
        answer: "Sim. Criar, editar e salvar o currículo com a identificação do PiraNegócios no rodapé é gratuito. Recursos de inteligência artificial e remoção da marca são opcionais e pagos.",
      },
      {
        question: "Posso salvar meu currículo em PDF?",
        answer: "Sim. Os modelos são preparados para formato A4 e podem ser salvos em PDF diretamente pelo navegador.",
      },
      {
        question: "Onde o meu currículo fica salvo?",
        answer: "No modo público, o conteúdo do rascunho fica salvo no navegador do visitante. O PiraNegócios registra apenas métricas de uso do produto, sem armazenar o texto do currículo no analytics.",
      },
    ];
    const body = `<div class="breadcrumbs"><a href="/">Início</a> › Criador de currículo</div><section class="hero"><p class="eyebrow">Currículo profissional online</p><h1>Criador de currículo grátis: faça seu currículo online e salve em PDF</h1><p class="muted">Monte um currículo profissional em poucos minutos, escolha entre modelos prontos, veja a prévia enquanto edita e gere seu documento sem cadastro obrigatório.</p><p><a class="button" href="/criador-de-curriculo">Criar meu currículo grátis</a></p></section><section class="card"><h2>Como criar um currículo profissional online</h2><p>Preencha seus dados profissionais, organize experiências, formação e habilidades e escolha o visual que combina com sua área. O editor mostra o resultado em tempo real e mantém o rascunho no seu navegador.</p><div class="grid2"><div><h2>1. Preencha seus dados</h2><p class="muted">Adicione contato, resumo profissional, experiências, formação e competências.</p></div><div><h2>2. Escolha um modelo</h2><p class="muted">Alterne entre layouts moderno, clássico, criativo e minimalista sem perder conteúdo.</p></div><div><h2>3. Revise o currículo</h2><p class="muted">A prévia A4 ajuda a enxergar o documento antes de salvar.</p></div><div><h2>4. Salve em PDF</h2><p class="muted">A versão com identificação do PiraNegócios é gratuita. A remoção da marca é opcional.</p></div></div></section><section><h2>Recursos opcionais de inteligência artificial</h2><p>Quem quiser pode contratar uma análise profissional do currículo por R$ 1,99 ou receber propostas de melhoria de texto por R$ 4,99. A criação manual do currículo continua gratuita e não exige assinatura.</p></section><section class="card"><h2>Quer ser encontrado por empresas?</h2><p>Depois de criar o currículo, você pode abrir uma conta gratuita no PiraNegócios e levar seu rascunho para o perfil. A publicação no Banco de Talentos continua sob sua escolha.</p><p><a class="button" href="/login?mode=register">Criar conta grátis</a></p></section><section><h2>Perguntas frequentes sobre o criador de currículo</h2>${faq.map((item) => `<article><h2>${escapeHtml(item.question)}</h2><p>${escapeHtml(item.answer)}</p></article>`).join("")}</section>`;
    return res.type("html").send(pageHtml({
      title: "Criador de Currículo Grátis | Faça seu Currículo Online | PiraNegócios",
      description,
      canonical,
      body,
      structuredData: {
        "@context": "https://schema.org",
        "@graph": [
          ...websiteGraph(publicSiteUrl),
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Início", item: `${publicSiteUrl}/` },
              { "@type": "ListItem", position: 2, name: "Criador de currículo", item: canonical },
            ],
          },
          {
            "@type": "WebApplication",
            "@id": `${canonical}#app`,
            name: "Criador de Currículo Grátis PiraNegócios",
            url: canonical,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            browserRequirements: "Requires JavaScript",
            inLanguage: "pt-BR",
            isAccessibleForFree: true,
            description,
            offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
            provider: { "@id": `${publicSiteUrl}/#organization` },
          },
          {
            "@type": "FAQPage",
            mainEntity: faq.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
          },
        ],
      },
    }));
  });

  app.get(["/vagas", "/vagas/"], async (req, res) => {
    if (!isCrawler(req)) return sendSpa(req, res);
    const data = await getPublicData("/public/jobs-index");
    const cities = data?.cities || [];
    const jobs = data?.jobs || [];
    const canonical = `${publicSiteUrl}/vagas`;
    const body = `<div class="breadcrumbs"><a href="/">Início</a> › Vagas</div><section class="hero"><p class="eyebrow">Radar regional de oportunidades</p><h1>Vagas em Pirassununga e região</h1><p class="muted">Encontre empregos por cidade, empresa, modalidade e tipo de contrato. O PiraNegócios reúne vagas locais e oportunidades de fontes públicas verificáveis.</p></section><section><h2>Vagas por cidade</h2><div class="cities grid2">${renderCityLinks(cities, 40)}</div></section><section><h2>Vagas abertas agora</h2><div class="jobs">${renderJobLinks(jobs, 80)}</div></section>`;
    return res.type("html").send(pageHtml({
      title: "Vagas em Pirassununga e região | Empregos por cidade | PiraNegócios",
      description: "Pesquise vagas de emprego em Pirassununga, Leme, Araras, Porto Ferreira, São Carlos e outras cidades da região no PiraNegócios.",
      canonical,
      body,
      structuredData: {
        "@context": "https://schema.org",
        "@graph": [
          ...websiteGraph(publicSiteUrl),
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Início", item: `${publicSiteUrl}/` },
              { "@type": "ListItem", position: 2, name: "Vagas", item: canonical },
            ],
          },
          {
            "@type": "CollectionPage",
            name: "Vagas em Pirassununga e região",
            url: canonical,
            isPartOf: { "@id": `${publicSiteUrl}/#website` },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: jobs.length,
              itemListElement: jobs.slice(0, 80).map((job: any, index: number) => ({
                "@type": "ListItem",
                position: index + 1,
                name: job.title,
                url: `${publicSiteUrl}/vagas/${job.slug}`,
              })),
            },
          },
        ],
      },
    }));
  });

  app.get("/vagas-em/:citySlug", async (req, res) => {
    if (!isCrawler(req)) return sendSpa(req, res);
    const citySlug = String(req.params.citySlug || "");
    const data = await getPublicData(`/public/jobs-by-city/${encodeURIComponent(citySlug)}`);
    const canonical = `${publicSiteUrl}/vagas-em/${encodeURIComponent(citySlug)}`;
    if (!data?.city) {
      return res.status(404).type("html").send(pageHtml({
        title: "Vagas na cidade não encontradas | PiraNegócios",
        description: "Não há oportunidades públicas ativas nesta cidade agora.",
        canonical,
        robots: "noindex,follow",
        body: '<div class="card"><h1>Sem vagas ativas nesta cidade agora</h1><p class="muted">Veja outras cidades e oportunidades abertas na região.</p><a class="button" href="/vagas">Ver todas as vagas</a></div>',
      }));
    }
    const place = `${data.city}${data.state ? `, ${data.state}` : ""}`;
    const jobs = data.jobs || [];
    const body = `<div class="breadcrumbs"><a href="/">Início</a> › <a href="/vagas">Vagas</a> › ${escapeHtml(place)}</div><section class="hero"><p class="eyebrow">Empregos e oportunidades locais</p><h1>Vagas em ${escapeHtml(place)}</h1><p class="muted">Encontre vagas de emprego em ${escapeHtml(data.city)} publicadas por empresas, PATs, agências e fontes regionais. Esta página acompanha as oportunidades ativas no PiraNegócios.</p><p><strong>${Number(data.count || jobs.length)}</strong> ${Number(data.count || jobs.length) === 1 ? "oportunidade ativa" : "oportunidades ativas"}</p></section><section><h2>Empregos abertos em ${escapeHtml(data.city)}</h2><div class="jobs">${renderJobLinks(jobs, 100)}</div></section><section class="card"><h2>Procurando emprego em ${escapeHtml(data.city)}?</h2><p>Crie seu currículo no PiraNegócios e informe as cidades onde aceita trabalhar para receber recomendações mais realistas.</p><a class="button" href="/criador-de-curriculo">Criar currículo grátis</a></section>`;
    return res.type("html").send(pageHtml({
      title: `Vagas em ${place} hoje | Empregos em ${data.city} | PiraNegócios`,
      description: `Encontre vagas de emprego em ${place} no PiraNegócios. Veja ${Number(data.count || jobs.length)} oportunidades ativas, empresas contratando e vagas da região.`,
      canonical,
      body,
      structuredData: {
        "@context": "https://schema.org",
        "@graph": [
          ...websiteGraph(publicSiteUrl),
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Início", item: `${publicSiteUrl}/` },
              { "@type": "ListItem", position: 2, name: "Vagas", item: `${publicSiteUrl}/vagas` },
              { "@type": "ListItem", position: 3, name: `Vagas em ${place}`, item: canonical },
            ],
          },
          {
            "@type": "CollectionPage",
            name: `Vagas em ${place}`,
            url: canonical,
            isPartOf: { "@id": `${publicSiteUrl}/#website` },
            about: { "@type": "City", name: data.city },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: jobs.length,
              itemListElement: jobs.map((job: any, index: number) => ({
                "@type": "ListItem",
                position: index + 1,
                name: job.title,
                url: `${publicSiteUrl}/vagas/${job.slug}`,
              })),
            },
          },
        ],
      },
    }));
  });

  app.get("/vagas/:slug", async (req, res) => {
    if (!isCrawler(req)) return sendSpa(req, res);
    const job = await getPublicData(`/public/jobs/${encodeURIComponent(req.params.slug)}`);
    const canonical = `${publicSiteUrl}/vagas/${encodeURIComponent(req.params.slug)}`;
    if (!job) {
      return res.status(404).type("html").send(pageHtml({
        title: "Vaga não encontrada | PiraNegócios",
        description: "Esta vaga não está mais disponível.",
        canonical,
        robots: "noindex,follow",
        body: '<div class="card"><h1>Esta vaga não está mais disponível</h1><p class="muted">Veja outras oportunidades abertas na região.</p><a class="button" href="/vagas">Ver vagas</a></div>',
      }));
    }
    const place = jobPlace(job);
    const remote = String(job.workModel || "").toLowerCase() === "remoto";
    const companyName = job.company?.name || job.companyName || job.sourceName || "Empresa";
    const companyText = companyName ? ` em ${companyName}` : "";
    const locationTitle = remote ? "Vaga remota" : place ? `Vaga em ${place}` : "Oportunidade de emprego";
    const datePostedValue = job.sourcePublishedAt || job.createdAt || job.updatedAt;
    const datePosted = datePostedValue && !Number.isNaN(new Date(datePostedValue).getTime())
      ? new Date(datePostedValue).toISOString()
      : undefined;
    const postalAddress = buildPostalAddress(job);
    const baseSalary = buildBaseSalary(job.salary);
    const jobPosting: Record<string, unknown> = {
      "@type": "JobPosting",
      title: job.title,
      description: [job.description, job.requirements ? `Requisitos:\n${job.requirements}` : ""]
        .filter(Boolean)
        .join("\n")
        .split(/\n+/)
        .filter(Boolean)
        .map((part) => `<p>${escapeHtml(part)}</p>`)
        .join(""),
      identifier: { "@type": "PropertyValue", name: "PiraNegócios", value: job.id },
      ...(datePosted ? { datePosted } : {}),
      ...(job.type ? { employmentType: job.type } : {}),
      ...(baseSalary ? { baseSalary } : {}),
      hiringOrganization: {
        "@type": "Organization",
        name: companyName,
        ...(job.company?.slug ? { sameAs: `${publicSiteUrl}/${job.company.slug}` } : {}),
        ...(safeUrl(job.company?.logoURL) ? { logo: safeUrl(job.company.logoURL) } : {}),
      },
    };
    if (job.deadlineDate) jobPosting.validThrough = `${job.deadlineDate}T23:59:59-03:00`;
    if (remote) {
      jobPosting.jobLocationType = "TELECOMMUTE";
      jobPosting.applicantLocationRequirements = { "@type": "Country", name: "BR" };
    } else if (postalAddress) {
      jobPosting.jobLocation = {
        "@type": "Place",
        address: postalAddress,
      };
    }
    const graph = {
      "@context": "https://schema.org",
      "@graph": [
        ...websiteGraph(publicSiteUrl),
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: `${publicSiteUrl}/` },
            { "@type": "ListItem", position: 2, name: "Vagas", item: `${publicSiteUrl}/vagas` },
            ...(job.city ? [{ "@type": "ListItem", position: 3, name: `Vagas em ${job.city}`, item: `${publicSiteUrl}/vagas-em/${String(job.city).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}` }] : []),
            { "@type": "ListItem", position: job.city ? 4 : 3, name: job.title, item: canonical },
          ],
        },
        jobPosting,
      ],
    };
    const logo = safeUrl(job.company?.logoURL);
    const body = `<div class="breadcrumbs"><a href="/">Início</a> › <a href="/vagas">Vagas</a>${job.city ? ` › <a href="/vagas-em/${String(job.city).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}">${escapeHtml(job.city)}</a>` : ""} › ${escapeHtml(job.title)}</div><article class="card"><div class="head">${logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="Logo ${escapeHtml(companyName)}">` : ""}<div><p class="eyebrow">${escapeHtml(locationTitle)}</p><h1>${escapeHtml(job.title)}</h1><p class="company">${escapeHtml(companyName)}</p></div></div><div class="meta">${place ? `<span>📍 ${escapeHtml(place)}</span>` : ""}${job.type ? `<span>💼 ${escapeHtml(job.type)}</span>` : ""}${job.workModel ? `<span>💻 ${escapeHtml(job.workModel)}</span>` : ""}<span>💰 ${escapeHtml(job.salary || "Salário a combinar")}</span>${job.deadlineDate ? `<span>📅 Candidaturas até ${escapeHtml(job.deadlineDate)}</span>` : ""}</div><h2>Sobre a vaga</h2><div>${String(job.description || "").split(/\n+/).filter(Boolean).map((part) => `<p>${escapeHtml(part)}</p>`).join("")}</div>${job.requirements ? `<h2>Requisitos</h2><div>${String(job.requirements).split(/\n+/).filter(Boolean).map((part) => `<p>${escapeHtml(part)}</p>`).join("")}</div>` : ""}<hr style="border:0;border-top:1px solid #eee;margin:28px 0"><h2>Como se candidatar</h2>${job.acceptsPlatformApplications === false ? `<p>${escapeHtml(job.externalApplicationInstructions || "Consulte a publicação original para se candidatar.")}</p>` : `<a class="button" href="/vagas?applyTo=${encodeURIComponent(job.id)}">Candidatar-se à vaga</a>`}</article>`;
    return res.type("html").send(pageHtml({
      title: `${job.title}${companyText} | ${locationTitle} | PiraNegócios`,
      description: `${job.title}${companyText}${place ? ` em ${place}` : remote ? " para trabalho remoto" : ""}. Veja requisitos, detalhes e como se candidatar pelo PiraNegócios.`,
      canonical,
      body,
      structuredData: graph,
    }));
  });

  app.get("/:companySlug", async (req, res, next) => {
    const slug = String(req.params.companySlug || "").toLowerCase();
    if (RESERVED_COMPANY_SLUGS.has(slug)) return next();
    if (!isCrawler(req)) return sendSpa(req, res);
    const data = await getPublicData(`/public/companies/${encodeURIComponent(slug)}`);
    if (!data?.company) return next();
    const company = data.company;
    if (data.resolvedFromAlias && company.slug !== slug) return res.redirect(301, `/${encodeURIComponent(company.slug)}`);
    const canonical = `${publicSiteUrl}/${company.slug}`;
    const place = companyPlace(company);
    const description = company.description || `Conheça ${company.name} e suas oportunidades no PiraNegócios.`;
    const organization: Record<string, unknown> = {
      "@type": "Organization",
      name: company.name,
      url: canonical,
      ...(safeUrl(company.logoURL) ? { logo: safeUrl(company.logoURL) } : {}),
      ...(safeUrl(company.website) ? { sameAs: [safeUrl(company.website)] } : {}),
      ...(company.phone ? { telephone: company.phone } : {}),
      ...(place ? { address: { "@type": "PostalAddress", addressLocality: company.city || place, ...(company.state ? { addressRegion: company.state } : {}), addressCountry: "BR" } } : {}),
    };
    const body = `<div class="breadcrumbs"><a href="/">Início</a> › Empresas › ${escapeHtml(company.name)}</div><article class="card"><div class="head">${safeUrl(company.logoURL) ? `<img class="logo" src="${escapeHtml(safeUrl(company.logoURL))}" alt="Logo ${escapeHtml(company.name)}">` : ""}<div><p class="eyebrow">Empresa${place ? ` em ${escapeHtml(place)}` : " da região"}</p><h1>${escapeHtml(company.name)}</h1></div></div><h2>Sobre a empresa</h2>${String(description).split(/\n+/).filter(Boolean).map((part) => `<p>${escapeHtml(part)}</p>`).join("")}</article><section><h2>Vagas em aberto</h2><div class="jobs">${renderJobLinks(data.jobs || [], 80) || '<p class="muted">Esta empresa não possui vagas abertas no momento.</p>'}</div></section>`;
    return res.type("html").send(pageHtml({
      title: `${company.name}${place ? ` | Empresa em ${place}` : " | Empresa da região"} | PiraNegócios`,
      description: `${company.name}${place ? ` em ${place}` : ""}. ${description.slice(0, 135)}`,
      canonical,
      body,
      structuredData: {
        "@context": "https://schema.org",
        "@graph": [
          ...websiteGraph(publicSiteUrl),
          { "@type": "BreadcrumbList", itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: `${publicSiteUrl}/` },
            { "@type": "ListItem", position: 2, name: company.name, item: canonical },
          ] },
          organization,
        ],
      },
    }));
  });
}