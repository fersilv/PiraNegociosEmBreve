import express from "express";
import "dotenv/config";
import path from "path";
import { readFileSync } from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

type AuthenticatedRequest = express.Request & {
  firebaseUser?: { uid: string; email?: string };
};

const publicApiOrigin = (
  process.env.PUBLIC_API_ORIGIN || "http://127.0.0.1:3888/api"
).replace(/\/$/, "");
const publicSiteUrl = (
  process.env.PUBLIC_SITE_URL || "https://piranegocios.com.br"
).replace(/\/$/, "");
const publicRouteReserved = new Set([
  "api",
  "dashboard",
  "login",
  "termos",
  "vagas",
  "uploads",
  "assets",
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
  "icon.svg",
  "apple-touch-icon.svg",
]);

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
}: {
  title: string;
  description: string;
  canonical: string;
  body: string;
  structuredData?: Record<string, unknown>;
}) {
  const jsonLd = structuredData
    ? `<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>`
    : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:site_name" content="PiraNegócios">${jsonLd}<style>body{margin:0;background:#fafaf9;color:#292524;font-family:Arial,sans-serif;line-height:1.6}.wrap{max-width:880px;margin:auto;padding:32px 20px}nav{background:#fff;border-bottom:1px solid #e7e5e4;padding:15px 0}nav .wrap{padding-top:0;padding-bottom:0;display:flex;justify-content:space-between;align-items:center}a{color:#a63f2d;text-decoration:none}a:hover{text-decoration:underline}.brand,h1,h2{font-family:Georgia,serif}.brand{font-size:22px;font-weight:700}.card{background:#fff;border:1px solid #e7e5e4;border-radius:20px;padding:32px;box-shadow:0 1px 4px #0000000a}.meta{display:flex;flex-wrap:wrap;gap:10px 20px;color:#57534e;margin:22px 0;padding:16px 0;border-top:1px solid #eee;border-bottom:1px solid #eee}.button{display:inline-block;background:#a63f2d;color:white;padding:13px 20px;border-radius:10px;font-weight:bold}.company{font-weight:bold;font-size:18px}.jobs{display:grid;gap:12px;margin-top:20px}.job{display:block;border:1px solid #e7e5e4;border-radius:14px;padding:18px;color:#292524}.job:hover{border-color:#cc5843;text-decoration:none}.muted{color:#78716c}.logo{width:72px;height:72px;object-fit:cover;border-radius:16px;background:#fdf6f5}.head{display:flex;gap:18px;align-items:center}@media(max-width:600px){.card{padding:22px}.wrap{padding:24px 16px}}</style></head><body><nav><div class="wrap"><a class="brand" href="/">PiraNegócios</a><a href="/vagas">Ver vagas</a></div></nav><main class="wrap">${body}</main></body></html>`;
}

function initializeFirebaseAdmin() {
  if (getApps().length > 0) return true;
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const credentialPath = process.env.FIREBASE_CREDENTIALS;
    const credential = serviceAccount
      ? cert(JSON.parse(serviceAccount))
      : credentialPath
        ? cert(JSON.parse(readFileSync(credentialPath, "utf8")))
        : applicationDefault();
    initializeApp({ credential });
    return true;
  } catch (error) {
    console.error(
      "Firebase Admin não foi configurado para proteger as rotas de IA.",
      error,
    );
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3001;
  const isBuiltServer = /[\\/]dist[\\/]server\.cjs$/i.test(
    process.argv[1] || "",
  );
  const isProduction = process.env.NODE_ENV === "production" || isBuiltServer;

  // Configure body parsing for base64 resumes and images
  app.use(express.json({ limit: "16mb" }));
  app.use(express.urlencoded({ limit: "16mb", extended: true }));

  const firebaseReady = initializeFirebaseAdmin();
  const aiRequests = new Map<string, number[]>();

  const requireFirebaseUser: express.RequestHandler = async (
    req: AuthenticatedRequest,
    res,
    next,
  ) => {
    if (!firebaseReady) {
      return res
        .status(503)
        .json({ error: "Serviço de autenticação indisponível." });
    }
    const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token)
      return res.status(401).json({ error: "Autenticação obrigatória." });
    try {
      const decoded = await getAuth().verifyIdToken(token);
      req.firebaseUser = { uid: decoded.uid, email: decoded.email };
      next();
    } catch {
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }
  };

  const limitAiRequests =
    (maximumPerHour: number): express.RequestHandler =>
    (req: AuthenticatedRequest, res, next) => {
      const uid = req.firebaseUser?.uid;
      if (!uid)
        return res.status(401).json({ error: "Autenticação obrigatória." });
      const now = Date.now();
      const recent = (aiRequests.get(uid) || []).filter(
        (time) => now - time < 60 * 60 * 1000,
      );
      if (recent.length >= maximumPerHour) {
        return res.status(429).json({
          error:
            "Limite temporário de análises atingido. Tente novamente mais tarde.",
        });
      }
      recent.push(now);
      aiRequests.set(uid, recent);
      next();
    };

  // Shared server-side Gemini client
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // REST API Endpoint for AI resume analysis & parsing
  app.post(
    "/api/gemini/analyze-resume",
    requireFirebaseUser,
    limitAiRequests(10),
    async (req, res) => {
      try {
        const { base64File, mimeType } = req.body;
        if (typeof base64File !== "string" || !base64File) {
          return res
            .status(400)
            .json({ error: "Nenhum arquivo de currículo enviado." });
        }

        if (!process.env.GEMINI_API_KEY) {
          return res.status(500).json({
            error:
              "A chave de API de Inteligência Artificial não está configurada neste ambiente.",
          });
        }

        // Cleanup base64 string prefix
        let cleanBase64 = base64File;
        let cleanMimeType = mimeType || "application/pdf";

        if (base64File.startsWith("data:")) {
          const parts = base64File.split(";base64,");
          if (parts.length === 2) {
            cleanMimeType = parts[0].split(":")[1];
            cleanBase64 = parts[1];
          }
        }

        const allowedMimeTypes = new Set([
          "application/pdf",
          "image/png",
          "image/jpeg",
        ]);
        if (
          !allowedMimeTypes.has(cleanMimeType) ||
          cleanBase64.length > 14 * 1024 * 1024
        ) {
          return res
            .status(400)
            .json({ error: "Envie um PDF, PNG ou JPEG de até 10 MB." });
        }

        const filePart = {
          inlineData: {
            mimeType: cleanMimeType,
            data: cleanBase64,
          },
        };

        const systemInstruction = `Você é um Recrutador Técnico e Especialista em Recolocação Profissional do Brasil.
Sua missão é ler e analisar minuciosamente o documento ou imagem do currículo enviado pelo candidato.
Você deve extrair os dados profissionais de forma precisa e devolver no formato JSON indicado.
Além de preencher os dados do candidato (experiência, escolaridade, competências, etc.), você deve fornecer uma crítica light, construtiva e realista contendo conselhos práticos de melhorias no currículo do candidato (sugestões acionáveis e feedback de texto).`;

        const prompt = `Analise detalhadamente o arquivo de currículo fornecido.
Extraia e retorne as informações estritamente estruturadas no seguinte formato JSON:

1. name: Nome completo do candidato
2. treatment: Como o candidato prefere ser chamado ou abreviação honorífica (Ex: "Sr.", "Sra.", "Dr.", "Eng.") ou vazio "" se não especificado.
3. phone: Telefone principal ou WhatsApp formatado como (DD) XXXXX-XXXX
4. additionalPhones: Array de outras strings contendo outros números de contato telefônico encontrados, se houver.
5. bio: Um resumo profissional curto e refinado, escrito em português impecável com 2 a 3 frases cativantes sobre a carreira e áreas de atuação do candidato. IMPORTANTE: Escreva o resumo profissional estritamente na PRIMEIRA PESSOA do singular ("Eu sou...", "Tenho experiência...", "Atuo com...", "Busco..."), nunca em terceira pessoa ("Fulano é...", "Ele atua..."). Deve soar natural e humano, como se o candidato estivesse se descrevendo.
6. experiences: Lista de experiências de trabalho relevantes. Cada item deve conter:
   - company: Nome da empresa
   - role: Cargo exercido
   - startDate: Data de início (Ex: "02/2020", "2019" ou "Mar/2018")
   - endDate: Data de término (Ex: "06/2023", "Atual", "Presente")
   - current: boolean (true se for o emprego atual ou se endDate for "Atual"/"Presente", false caso contrário)
   - description: 1 a 2 frases curtas com principais atividades exercidas ou tecnologias usadas.
   - skills: Array de strings contendo competências e habilidades associadas especificamente a esta experiência de trabalho ou cargo.
7. skills: Lista simples de competências/habilidades (strings). Ex: ["JavaScript", "Atendimento ao Cliente", "Gestão de Projetos"]. 
   CRÍTICO: NÃO INVENTE NEM HALUCINE habilidades que não estejam expressamente mencionadas ou fortemente evidentes no currículo do candidato. Se o candidato não sabe Python e isso não está no currículo, NUNCA adicione "Python". Extraia estritamente competências reais contidas no currículo do candidato. Limite a no máximo 15 itens.
8. courses: Lista de cursos extras, workshops, certificações ou licenças. Cada item contendo:
   - name: Nome do curso ou certificação
   - institution: Instituição de ensino ou certificadora
   - year: Ano de conclusão (Ex: "2022") ou "Em andamento"
9. education: Lista de escolaridade/formação acadêmica. Cada item contendo:
   - institution: Nome da escola, faculdade ou universidade
   - degree: Nível do curso (Ex: "Ensino Médio", "Graduação", "Tecnólogo", "Pós-graduação", "Mestrado", "Doutorado")
   - fieldOfStudy: Área de estudos (Ex: "Administração", "Análise de Sistemas", "Direito") ou vazio se não houver
   - startYear: Ano de início (Ex: "2018")
   - endYear: Ano de término (Ex: "2022") ou "Em andamento"
   - current: boolean (true se ainda estiver cursando, false caso contrário)
   - status: O status atual da formação. DEVE ser estritamente um dos seguintes valores em letras maiúsculas: "CONCLUIDO", "EM_ANDAMENTO", "TRANCADO", "INTERROMPIDO". Classifique com base nas informações do currículo.
10. aiAnalysis: Análise construtiva rápida com:
   - suggestions: Lista com 3 a 5 sugestões de melhorias acionáveis e práticas específicas para melhorar este currículo analisado (Ex: "Destaque mais as tecnologias de frontend usadas", "Adicione a carga horária de seus cursos livres", etc.)
   - feedbackText: Um parágrafo avaliativo inspirador e pontual sobre o potencial profissional do candidato.

Certifique-se de que todas as datas e nomes próprios estejam capitalizados de forma correta e o JSON seja estritamente válido de acordo com o esquema requerido.`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [filePart, { text: prompt }],
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                treatment: { type: Type.STRING },
                phone: { type: Type.STRING },
                additionalPhones: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                bio: { type: Type.STRING },
                experiences: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      company: { type: Type.STRING },
                      role: { type: Type.STRING },
                      startDate: { type: Type.STRING },
                      endDate: { type: Type.STRING },
                      current: { type: Type.BOOLEAN },
                      description: { type: Type.STRING },
                      skills: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                    required: [
                      "company",
                      "role",
                      "startDate",
                      "endDate",
                      "current",
                    ],
                  },
                },
                skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                courses: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      institution: { type: Type.STRING },
                      year: { type: Type.STRING },
                    },
                    required: ["name"],
                  },
                },
                education: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      institution: { type: Type.STRING },
                      degree: { type: Type.STRING },
                      fieldOfStudy: { type: Type.STRING },
                      startYear: { type: Type.STRING },
                      endYear: { type: Type.STRING },
                      current: { type: Type.BOOLEAN },
                      status: { type: Type.STRING },
                    },
                    required: ["institution", "degree"],
                  },
                },
                aiAnalysis: {
                  type: Type.OBJECT,
                  properties: {
                    suggestions: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    feedbackText: { type: Type.STRING },
                  },
                  required: ["suggestions", "feedbackText"],
                },
              },
              required: [
                "name",
                "phone",
                "bio",
                "experiences",
                "skills",
                "courses",
                "education",
                "aiAnalysis",
              ],
            },
          },
        });

        const textOutput = response.text || "{}";
        const parsedResume = JSON.parse(textOutput.trim());
        return res.json(parsedResume);
      } catch (err: any) {
        console.error("AI Resume parsing error:", err);
        return res.status(500).json({
          error:
            "Não foi possível analisar o currículo agora. Tente novamente.",
        });
      }
    },
  );

  // REST API Endpoint for AI job matching
  app.post(
    "/api/gemini/job-match",
    requireFirebaseUser,
    limitAiRequests(20),
    async (req, res) => {
      try {
        const { profile, jobs, applications } = req.body;

        if (
          !profile ||
          !Array.isArray(jobs) ||
          jobs.length === 0 ||
          jobs.length > 100
        ) {
          return res.status(400).json({
            error: "Perfil do candidato e lista de vagas são obrigatórios.",
          });
        }

        if (!process.env.GEMINI_API_KEY) {
          return res.status(500).json({
            error:
              "A chave de API de Inteligência Artificial não está configurada neste ambiente.",
          });
        }

        const systemInstruction = `Você é um Recrutador Técnico de Elite e um especialista em Career Matching.
Sua missão é analisar o perfil do candidato (habilidades, experiências, objetivos) e combiná-lo com as vagas abertas, retornando uma lista pontuada das melhores oportunidades para ele.`;

        const prompt = `Analise o perfil do candidato e as vagas disponíveis. Para cada vaga, atribua um score de 0 a 100 de compatibilidade com base na experiência, habilidades (skills) listadas, bio e cargos ocupados anteriormente. Além disso, as candidaturas passadas do usuário (${JSON.stringify(applications || [])}) indicam seus interesses.
      
Retorne as vagas ordenadas do maior score para o menor. Para as 3 ou 5 vagas mais compatíveis, forneça também uma pequena justificativa (1-2 frases) de por que aquela vaga é ideal para o candidato.

Perfil do Candidato:
${JSON.stringify(
  {
    bio: profile.bio,
    skills: profile.skills,
    experiences: profile.experiences,
    education: profile.education,
  },
  null,
  2,
)}

Vagas Disponíveis:
${JSON.stringify(
  jobs.map((j: any) => ({
    id: j.id,
    title: j.title,
    companyName: j.companyName,
    description: j.description,
    type: j.type,
  })),
  null,
  2,
)}

Retorne ESTRITAMENTE um JSON no seguinte formato:
{
  "matches": [
    {
      "jobId": "id-da-vaga",
      "score": 95,
      "reason": "Justificativa curta e direta de por que esta vaga é um ótimo match."
    }
  ]
}
`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                matches: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      jobId: { type: Type.STRING },
                      score: { type: Type.NUMBER },
                      reason: { type: Type.STRING },
                    },
                    required: ["jobId", "score", "reason"],
                  },
                },
              },
              required: ["matches"],
            },
          },
        });

        const textOutput = response.text || "{}";
        const parsedMatch = JSON.parse(textOutput.trim());
        return res.json(parsedMatch);
      } catch (err: any) {
        console.error("AI Job Match error:", err);
        return res.status(500).json({
          error: "Não foi possível gerar recomendações agora. Tente novamente.",
        });
      }
    },
  );

  // Serve static assets or run Vite middleware
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    const getPublicData = async (pathName: string) => {
      const response = await fetch(`${publicApiOrigin}${pathName}`, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) return null;
      return response.json() as Promise<any>;
    };

    app.get("/robots.txt", (_req, res) => {
      res
        .type("text/plain")
        .send(
          `User-agent: *\nAllow: /\nDisallow: /dashboard/\nDisallow: /login\nDisallow: /api/\nDisallow: /uploads/\n\nSitemap: ${publicSiteUrl}/sitemap.xml\n`,
        );
    });

    app.get("/sitemap.xml", async (_req, res) => {
      try {
        const response = await fetch(`${publicApiOrigin}/seo/sitemap`, {
          headers: { accept: "application/xml" },
        });
        if (!response.ok)
          return res
            .status(502)
            .type("text/plain")
            .send("Sitemap temporarily unavailable");
        return res.type("application/xml").send(await response.text());
      } catch {
        return res
          .status(502)
          .type("text/plain")
          .send("Sitemap temporarily unavailable");
      }
    });

    // A listagem é uma rota da SPA. Mantê-la explícita evita "Cannot GET"
    // quando a build é iniciada sem NODE_ENV=production pelo PM2.
    app.get(["/vagas", "/vagas/"], (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });

    app.get("/vagas/:slug", async (req, res) => {
      const job = await getPublicData(
        `/public/jobs/${encodeURIComponent(req.params.slug)}`,
      );
      if (!job)
        return res.status(404).send(
          pageHtml({
            title: "Vaga não encontrada | PiraNegócios",
            description: "Esta vaga não está mais disponível.",
            canonical: `${publicSiteUrl}/vagas/${encodeURIComponent(req.params.slug)}`,
            body: '<div class="card"><h1>Esta vaga não está mais disponível</h1><p class="muted">Veja outras oportunidades abertas na região.</p><a class="button" href="/vagas">Ver vagas</a></div>',
          }),
        );
      const canonical = `${publicSiteUrl}/vagas/${job.slug}`;
      const companyName = job.company?.name || "Empresa";
      const description = `${job.title} em ${companyName}${job.location ? `, ${job.location}` : ""}. Veja os requisitos e candidate-se pelo PiraNegócios.`;
      const jobPosting: Record<string, unknown> = {
        "@context": "https://schema.org/",
        "@type": "JobPosting",
        title: job.title,
        description: [
          job.description,
          job.requirements ? `Requisitos:\n${job.requirements}` : "",
        ]
          .filter(Boolean)
          .join("\n")
          .split(/\n+/)
          .filter(Boolean)
          .map((part) => `<p>${escapeHtml(part)}</p>`)
          .join(""),
        identifier: {
          "@type": "PropertyValue",
          name: "PiraNegócios",
          value: job.id,
        },
        datePosted: new Date(job.createdAt).toISOString(),
        employmentType: job.type || undefined,
        hiringOrganization: {
          "@type": "Organization",
          name: companyName,
          sameAs: `${publicSiteUrl}/${job.company?.slug}`,
          ...(safeUrl(job.company?.logoURL)
            ? { logo: safeUrl(job.company.logoURL) }
            : {}),
        },
      };
      if (job.deadlineDate)
        jobPosting.validThrough = `${job.deadlineDate}T23:59:59-03:00`;
      if (String(job.workModel || "").toLowerCase() === "remoto") {
        jobPosting.jobLocationType = "TELECOMMUTE";
        jobPosting.applicantLocationRequirements = {
          "@type": "Country",
          name: "BR",
        };
      } else if (job.location) {
        jobPosting.jobLocation = {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressLocality: job.location,
            addressCountry: "BR",
          },
        };
      }
      const logo = safeUrl(job.company?.logoURL);
      const body = `<article class="card"><div class="head">${logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="Logo ${escapeHtml(companyName)}">` : ""}<div><h1>${escapeHtml(job.title)}</h1><a class="company" href="/${encodeURIComponent(job.company?.slug || "")}">${escapeHtml(companyName)}</a></div></div><div class="meta">${job.location ? `<span>📍 ${escapeHtml(job.location)}</span>` : ""}${job.type ? `<span>💼 ${escapeHtml(job.type)}</span>` : ""}${job.workModel ? `<span>💻 ${escapeHtml(job.workModel)}</span>` : ""}<span>💰 ${escapeHtml(job.salary || "Salário a combinar")}</span></div><h2>Sobre a vaga</h2><div>${String(
        job.description || "",
      )
        .split(/\n+/)
        .filter(Boolean)
        .map((part) => `<p>${escapeHtml(part)}</p>`)
        .join("")}</div>${
        job.requirements
          ? `<h2>Requisitos</h2><div>${String(job.requirements)
              .split(/\n+/)
              .filter(Boolean)
              .map((part) => `<p>${escapeHtml(part)}</p>`)
              .join("")}</div>`
          : ""
      }<hr style="border:0;border-top:1px solid #eee;margin:28px 0"><h2>Como se candidatar</h2>${job.acceptsPlatformApplications === false ? `<p>${escapeHtml(job.externalApplicationInstructions || "Entre em contato com a empresa para enviar seu currículo.")}</p>` : `<a class="button" href="/vagas?applyTo=${encodeURIComponent(job.id)}">Candidatar-se à vaga</a>`}</article>`;
      return res.type("html").send(
        pageHtml({
          title: `${job.title} em ${companyName} | Vagas em Pirassununga | PiraNegócios`,
          description,
          canonical,
          body,
          structuredData: jobPosting,
        }),
      );
    });

    app.get("/:companySlug", async (req, res, next) => {
      const slug = req.params.companySlug.toLowerCase();
      if (publicRouteReserved.has(slug)) return next();
      const data = await getPublicData(
        `/public/companies/${encodeURIComponent(slug)}`,
      );
      if (!data?.company) {
        return res.status(404).send(
          pageHtml({
            title: "Empresa não encontrada | PiraNegócios",
            description: "Este perfil não está disponível.",
            canonical: `${publicSiteUrl}/${encodeURIComponent(slug)}`,
            body: '<div class="card"><h1>Empresa não encontrada</h1><p class="muted">Este perfil não está disponível publicamente.</p><a class="button" href="/vagas">Explorar vagas</a></div>',
          }),
        );
      }
      const company = data.company;
      if (data.resolvedFromAlias && company.slug !== slug) {
        return res.redirect(301, `/${encodeURIComponent(company.slug)}`);
      }
      const canonical = `${publicSiteUrl}/${company.slug}`;
      const companyDescription =
        company.description ||
        `Conheça ${company.name} e suas oportunidades no PiraNegócios.`;
      const organization: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: company.name,
        url: canonical,
        ...(safeUrl(company.logoURL) ? { logo: safeUrl(company.logoURL) } : {}),
        ...(safeUrl(company.website)
          ? { sameAs: [safeUrl(company.website)] }
          : {}),
        ...(company.phone ? { telephone: company.phone } : {}),
      };
      const logo = safeUrl(company.logoURL);
      const website = safeUrl(company.website);
      const jobs =
        (data.jobs || [])
          .map(
            (job: any) =>
              `<a class="job" href="/vagas/${encodeURIComponent(job.slug)}"><strong>${escapeHtml(job.title)}</strong><div class="muted">${[job.location, job.type, job.salary].filter(Boolean).map(escapeHtml).join(" · ")}</div></a>`,
          )
          .join("") ||
        '<p class="muted">Esta empresa não possui vagas abertas no momento.</p>';
      const body = `<article class="card"><div class="head">${logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="Logo ${escapeHtml(company.name)}">` : ""}<div><p class="muted">EMPRESA EM PIRASSUNUNGA E REGIÃO</p><h1>${escapeHtml(company.name)}</h1>${company.cityState ? `<p class="muted">📍 ${escapeHtml(company.cityState)}</p>` : ""}</div></div><hr style="border:0;border-top:1px solid #eee;margin:28px 0"><h2>Sobre a empresa</h2>${String(
        companyDescription,
      )
        .split(/\n+/)
        .filter(Boolean)
        .map((part) => `<p>${escapeHtml(part)}</p>`)
        .join(
          "",
        )}${website ? `<p><a href="${escapeHtml(website)}" rel="noopener noreferrer" target="_blank">Visitar site da empresa</a></p>` : ""}${company.phone ? `<p class="muted">☎ ${escapeHtml(company.phone)}</p>` : ""}</article><section><h2>Vagas em aberto</h2><div class="jobs">${jobs}</div></section>`;
      return res.type("html").send(
        pageHtml({
          title: `${company.name} | Empresas de Pirassununga | PiraNegócios`,
          description: `${company.name}${company.cityState ? ` em ${company.cityState}` : ", Pirassununga e região"}. ${companyDescription.slice(0, 130)}`,
          canonical,
          body,
          structuredData: organization,
        }),
      );
    });

    app.use(express.static(distPath));
    // Catch-all para rotas da SPA (dashboard, páginas institucionais, etc.)
    // app.use() é compatível com Express 5 (RegExp em app.get() não é suportado).
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
