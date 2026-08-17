import express from 'express';
import 'dotenv/config';
import path from 'path';
import { readFileSync } from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

type AuthenticatedRequest = express.Request & { firebaseUser?: { uid: string; email?: string } };

function initializeFirebaseAdmin() {
  if (getApps().length > 0) return true;
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const credentialPath = process.env.FIREBASE_CREDENTIALS;
    const credential = serviceAccount
      ? cert(JSON.parse(serviceAccount))
      : credentialPath
        ? cert(JSON.parse(readFileSync(credentialPath, 'utf8')))
        : applicationDefault();
    initializeApp({ credential });
    return true;
  } catch (error) {
    console.error('Firebase Admin não foi configurado para proteger as rotas de IA.', error);
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure body parsing for base64 resumes and images
  app.use(express.json({ limit: '16mb' }));
  app.use(express.urlencoded({ limit: '16mb', extended: true }));

  const firebaseReady = initializeFirebaseAdmin();
  const aiRequests = new Map<string, number[]>();

  const requireFirebaseUser: express.RequestHandler = async (req: AuthenticatedRequest, res, next) => {
    if (!firebaseReady) {
      return res.status(503).json({ error: 'Serviço de autenticação indisponível.' });
    }
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Autenticação obrigatória.' });
    try {
      const decoded = await getAuth().verifyIdToken(token);
      req.firebaseUser = { uid: decoded.uid, email: decoded.email };
      next();
    } catch {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }
  };

  const limitAiRequests = (maximumPerHour: number): express.RequestHandler => (req: AuthenticatedRequest, res, next) => {
    const uid = req.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Autenticação obrigatória.' });
    const now = Date.now();
    const recent = (aiRequests.get(uid) || []).filter(time => now - time < 60 * 60 * 1000);
    if (recent.length >= maximumPerHour) {
      return res.status(429).json({ error: 'Limite temporário de análises atingido. Tente novamente mais tarde.' });
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
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // REST API Endpoint for AI resume analysis & parsing
  app.post('/api/gemini/analyze-resume', requireFirebaseUser, limitAiRequests(10), async (req, res) => {
    try {
      const { base64File, mimeType } = req.body;
      if (typeof base64File !== 'string' || !base64File) {
        return res.status(400).json({ error: 'Nenhum arquivo de currículo enviado.' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ 
          error: 'A chave de API de Inteligência Artificial não está configurada neste ambiente.' 
        });
      }

      // Cleanup base64 string prefix
      let cleanBase64 = base64File;
      let cleanMimeType = mimeType || 'application/pdf';

      if (base64File.startsWith('data:')) {
        const parts = base64File.split(';base64,');
        if (parts.length === 2) {
          cleanMimeType = parts[0].split(':')[1];
          cleanBase64 = parts[1];
        }
      }

      const allowedMimeTypes = new Set(['application/pdf', 'image/png', 'image/jpeg']);
      if (!allowedMimeTypes.has(cleanMimeType) || cleanBase64.length > 14 * 1024 * 1024) {
        return res.status(400).json({ error: 'Envie um PDF, PNG ou JPEG de até 10 MB.' });
      }

      const filePart = {
        inlineData: {
          mimeType: cleanMimeType,
          data: cleanBase64,
        }
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
        model: 'gemini-2.5-flash',
        contents: [filePart, { text: prompt }],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              treatment: { type: Type.STRING },
              phone: { type: Type.STRING },
              additionalPhones: { type: Type.ARRAY, items: { type: Type.STRING } },
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
                    skills: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ['company', 'role', 'startDate', 'endDate', 'current']
                }
              },
              skills: { type: Type.ARRAY, items: { type: Type.STRING } },
              courses: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    institution: { type: Type.STRING },
                    year: { type: Type.STRING }
                  },
                  required: ['name']
                }
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
                    status: { type: Type.STRING }
                  },
                  required: ['institution', 'degree']
                }
              },
              aiAnalysis: {
                type: Type.OBJECT,
                properties: {
                  suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  feedbackText: { type: Type.STRING }
                },
                required: ['suggestions', 'feedbackText']
              }
            },
            required: [
              'name', 'phone', 'bio', 'experiences', 'skills', 'courses', 'education', 'aiAnalysis'
            ]
          }
        }
      });

      const textOutput = response.text || '{}';
      const parsedResume = JSON.parse(textOutput.trim());
      return res.json(parsedResume);

    } catch (err: any) {
      console.error('AI Resume parsing error:', err);
      return res.status(500).json({ error: 'Não foi possível analisar o currículo agora. Tente novamente.' });
    }
  });

  // REST API Endpoint for AI job matching
  app.post('/api/gemini/job-match', requireFirebaseUser, limitAiRequests(20), async (req, res) => {
    try {
      const { profile, jobs, applications } = req.body;
      
      if (!profile || !Array.isArray(jobs) || jobs.length === 0 || jobs.length > 100) {
        return res.status(400).json({ error: 'Perfil do candidato e lista de vagas são obrigatórios.' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ 
          error: 'A chave de API de Inteligência Artificial não está configurada neste ambiente.' 
        });
      }

      const systemInstruction = `Você é um Recrutador Técnico de Elite e um especialista em Career Matching. 
Sua missão é analisar o perfil do candidato (habilidades, experiências, objetivos) e combiná-lo com as vagas abertas, retornando uma lista pontuada das melhores oportunidades para ele.`;

      const prompt = `Analise o perfil do candidato e as vagas disponíveis. Para cada vaga, atribua um score de 0 a 100 de compatibilidade com base na experiência, habilidades (skills) listadas, bio e cargos ocupados anteriormente. Além disso, as candidaturas passadas do usuário (${JSON.stringify(applications || [])}) indicam seus interesses. 
      
Retorne as vagas ordenadas do maior score para o menor. Para as 3 ou 5 vagas mais compatíveis, forneça também uma pequena justificativa (1-2 frases) de por que aquela vaga é ideal para o candidato.

Perfil do Candidato:
${JSON.stringify({
  bio: profile.bio,
  skills: profile.skills,
  experiences: profile.experiences,
  education: profile.education
}, null, 2)}

Vagas Disponíveis:
${JSON.stringify(jobs.map((j: any) => ({
  id: j.id,
  title: j.title,
  companyName: j.companyName,
  description: j.description,
  type: j.type
})), null, 2)}

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
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
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
                    reason: { type: Type.STRING }
                  },
                  required: ['jobId', 'score', 'reason']
                }
              }
            },
            required: ['matches']
          }
        }
      });

      const textOutput = response.text || '{}';
      const parsedMatch = JSON.parse(textOutput.trim());
      return res.json(parsedMatch);

    } catch (err: any) {
      console.error('AI Job Match error:', err);
      return res.status(500).json({ error: 'Não foi possível gerar recomendações agora. Tente novamente.' });
    }
  });

  // Serve static assets or run Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
