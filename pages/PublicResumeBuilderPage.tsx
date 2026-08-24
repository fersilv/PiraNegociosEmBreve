import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  LockKeyhole,
  Mail,
  Palette,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react';
import { SeoHead } from '../components/SeoHead';
import { api } from '../lib/api';
import type { AcademicEducation, ProfessionalExperience, UserProfile } from '../contexts/AuthContext';
import { ModernTemplate } from '../components/resume-templates/ModernTemplate';
import { ClassicTemplate } from '../components/resume-templates/ClassicTemplate';
import { CreativeTemplate } from '../components/resume-templates/CreativeTemplate';
import { MinimalistTemplate } from '../components/resume-templates/MinimalistTemplate';

const SESSION_KEY = 'pira-public-resume-session-v1';
const DRAFT_KEY = 'pira-public-resume-draft-v1';
const SESSION_CREATED_KEY = 'pira-public-resume-created-v1';

type TemplateName = 'modern' | 'classic' | 'creative' | 'minimalist';
type PublicProductCode =
  | 'PUBLIC_RESUME_AI_REVIEW'
  | 'PUBLIC_RESUME_AI_IMPROVEMENT'
  | 'PUBLIC_RESUME_REMOVE_WATERMARK';

type PublicSession = {
  id: string;
  token: string;
  watermarkUnlocked?: boolean;
};

type PublicProduct = {
  code: PublicProductCode;
  name: string;
  description?: string;
  priceCents: number;
  effectivePriceCents: number;
  promotionActive?: boolean;
};

type PublicOrder = {
  id: string;
  productCode: PublicProductCode;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELED' | 'REFUNDED';
  amountCents: number;
  provider?: string | null;
  pixCopyPaste?: string | null;
  qrCodeBase64?: string | null;
  expiresAt?: string | null;
  watermarkUnlocked?: boolean;
  devSimulation?: boolean;
};

type ImprovementChange = {
  id: string;
  type: 'BIO' | 'HEADLINE' | 'GLOBAL_SKILLS' | 'EXPERIENCE_DESCRIPTION' | 'STAGE_DESCRIPTION';
  label: string;
  before: string | string[];
  after: string | string[];
  reason?: string;
  experienceIndex?: number;
  stageIndex?: number;
};

type ImprovementProposal = {
  summary?: string;
  changes?: ImprovementChange[];
};

const TEMPLATE_COMPONENTS: Record<TemplateName, React.ComponentType<any>> = {
  modern: ModernTemplate,
  classic: ClassicTemplate,
  creative: CreativeTemplate,
  minimalist: MinimalistTemplate,
};

const TEMPLATE_LABELS: Record<TemplateName, { name: string; description: string }> = {
  modern: { name: 'Moderno', description: 'Limpo e versátil' },
  classic: { name: 'Clássico', description: 'Formal e tradicional' },
  creative: { name: 'Criativo', description: 'Visual com personalidade' },
  minimalist: { name: 'Minimalista', description: 'Direto ao ponto' },
};

const EMPTY_PROFILE: UserProfile = {
  type: 'CANDIDATE',
  treatment: '',
  fullName: '',
  phone: '',
  email: '',
  city: '',
  state: 'SP',
  address: '',
  linkedinURL: '',
  bio: '',
  experiences: [],
  education: [],
  skills: [],
  courses: [],
  languages: [],
  resumePhotoURL: '',
  resumePreferences: {
    template: 'modern',
    color: '#b4533c',
    showPhoto: false,
    showHeadline: true,
    headline: '',
    nameMode: 'CIVIL',
  },
};

function randomId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);
}

function apiMessage(error: any, fallback: string) {
  const raw = error?.response?.data?.message;
  if (Array.isArray(raw)) return raw.join(' · ');
  return String(raw || error?.response?.data?.error || error?.message || fallback);
}

function loadDraft(): UserProfile {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_PROFILE;
    const stored = JSON.parse(raw);
    const profile = stored?.profile && typeof stored.profile === 'object' ? stored.profile : stored;
    return {
      ...EMPTY_PROFILE,
      ...profile,
      experiences: Array.isArray(profile?.experiences) ? profile.experiences : [],
      education: Array.isArray(profile?.education) ? profile.education : [],
      skills: Array.isArray(profile?.skills) ? profile.skills : [],
      courses: Array.isArray(profile?.courses) ? profile.courses : [],
      languages: Array.isArray(profile?.languages) ? profile.languages : [],
      resumePreferences: { ...EMPTY_PROFILE.resumePreferences, ...(profile?.resumePreferences || {}) },
    } as UserProfile;
  } catch {
    return EMPTY_PROFILE;
  }
}

export default function PublicResumeBuilderPage() {
  const [profile, setProfile] = useState<UserProfile>(() => loadDraft());
  const [session, setSession] = useState<PublicSession | null>(null);
  const [catalog, setCatalog] = useState<PublicProduct[]>([]);
  const [started, setStarted] = useState(() => Boolean(localStorage.getItem(DRAFT_KEY)));
  const [sessionLoading, setSessionLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [checkoutProduct, setCheckoutProduct] = useState<PublicProductCode | null>(null);
  const [checkoutEmail, setCheckoutEmail] = useState(profile.email || '');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [proposal, setProposal] = useState<ImprovementProposal | null>(null);
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
  const [aiBusy, setAiBusy] = useState(false);
  const editorTracked = useRef(false);
  const createdTracked = useRef(false);

  const template = (profile.resumePreferences?.template || 'modern') as TemplateName;
  const color = profile.resumePreferences?.color || '#b4533c';
  const Template = TEMPLATE_COMPONENTS[template] || ModernTemplate;
  const watermarkUnlocked = Boolean(session?.watermarkUnlocked);

  const completion = useMemo(() => {
    const checks = [
      Boolean(profile.fullName?.trim()),
      Boolean(profile.email?.trim() || profile.phone?.trim()),
      Boolean(profile.bio?.trim()),
      Boolean(profile.resumePreferences?.headline?.trim()),
      Boolean(profile.experiences?.length || profile.education?.length),
      Boolean(profile.skills?.length),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile]);

  const readyAsResume = Boolean(
    profile.fullName?.trim()
    && (profile.email?.trim() || profile.phone?.trim())
    && (profile.experiences?.length || profile.education?.length)
    && profile.skills?.length,
  );

  const product = useCallback((code: PublicProductCode) => catalog.find((item) => item.code === code), [catalog]);

  const authHeaders = useCallback(() => session ? { 'X-Public-Resume-Token': session.token } : {}, [session]);

  const track = useCallback(async (type: string, metadata: Record<string, unknown> = {}) => {
    if (!session) return;
    try {
      await api.post(`/public-resume/${session.id}/events`, { type, metadata }, { headers: authHeaders() });
    } catch {
      // Métricas nunca devem bloquear a criação do currículo.
    }
  }, [authHeaders, session]);

  useEffect(() => {
    let active = true;
    const boot = async () => {
      setSessionLoading(true);
      try {
        let stored: PublicSession | null = null;
        try {
          stored = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        } catch {
          stored = null;
        }
        if (stored?.id && stored?.token) {
          try {
            const current = await api.get(`/public-resume/${stored.id}`, {
              headers: { 'X-Public-Resume-Token': stored.token },
            });
            stored = { ...stored, watermarkUnlocked: Boolean(current.data?.watermarkUnlocked) };
          } catch {
            stored = null;
          }
        }
        if (!stored) {
          const params = new URLSearchParams(window.location.search);
          const response = await api.post('/public-resume/session', {
            utmSource: params.get('utm_source') || undefined,
            utmMedium: params.get('utm_medium') || undefined,
            utmCampaign: params.get('utm_campaign') || undefined,
            utmContent: params.get('utm_content') || undefined,
            utmTerm: params.get('utm_term') || undefined,
          });
          stored = response.data as PublicSession;
          localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
        }
        if (active) setSession(stored);
        const catalogResponse = await api.get('/public-resume/catalog').catch(() => ({ data: [] }));
        if (active) setCatalog(Array.isArray(catalogResponse.data) ? catalogResponse.data : []);
      } catch (bootError) {
        console.error(bootError);
        if (active) setError('O editor está disponível, mas os recursos online não puderam ser carregados agora.');
      } finally {
        if (active) setSessionLoading(false);
      }
    };
    void boot();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ profile, updatedAt: new Date().toISOString() }));
  }, [profile]);

  useEffect(() => {
    if (!session || !started || editorTracked.current) return;
    editorTracked.current = true;
    void track('EDITOR_STARTED', { completion });
  }, [completion, session, started, track]);

  useEffect(() => {
    if (!session || !readyAsResume || createdTracked.current) return;
    const key = `${SESSION_CREATED_KEY}:${session.id}`;
    if (localStorage.getItem(key) === '1') {
      createdTracked.current = true;
      return;
    }
    createdTracked.current = true;
    localStorage.setItem(key, '1');
    void track('RESUME_CREATED', {
      template,
      completion,
      experienceCount: profile.experiences?.length || 0,
      educationCount: profile.education?.length || 0,
      skillCount: profile.skills?.length || 0,
    });
  }, [completion, profile.education?.length, profile.experiences?.length, profile.skills?.length, readyAsResume, session, template, track]);

  useEffect(() => {
    if (!order || order.status !== 'PENDING' || !session) return;
    let active = true;
    const poll = async () => {
      try {
        const response = await api.get(`/public-resume/${session.id}/orders/${order.id}`, { headers: authHeaders() });
        if (!active) return;
        const next = response.data as PublicOrder;
        setOrder(next);
        if (next.watermarkUnlocked) {
          setSession((current) => current ? { ...current, watermarkUnlocked: true } : current);
        }
      } catch {
        // O próximo ciclo tenta novamente.
      }
    };
    const timer = window.setInterval(() => void poll(), 3000);
    void poll();
    return () => { active = false; window.clearInterval(timer); };
  }, [authHeaders, order?.id, order?.status, session]);

  useEffect(() => {
    if (!order || order.status !== 'PAID' || !session || aiBusy) return;
    const runPurchasedAction = async () => {
      try {
        if (order.productCode === 'PUBLIC_RESUME_REMOVE_WATERMARK') {
          await api.post(`/public-resume/${session.id}/orders/${order.id}/unlock-watermark`, {}, { headers: authHeaders() });
          setSession((current) => current ? { ...current, watermarkUnlocked: true } : current);
          setMessage('Pronto. A marca do rodapé foi removida para esta sessão.');
          setCheckoutProduct(null);
          setOrder(null);
          return;
        }
        setAiBusy(true);
        if (order.productCode === 'PUBLIC_RESUME_AI_REVIEW') {
          const response = await api.post(`/public-resume/${session.id}/ai/review`, { orderId: order.id, profile }, { headers: authHeaders(), timeout: 180000 });
          setAnalysis(response.data);
          setMessage('Análise concluída. Veja sua pontuação e as recomendações abaixo.');
        } else if (order.productCode === 'PUBLIC_RESUME_AI_IMPROVEMENT') {
          const response = await api.post(`/public-resume/${session.id}/ai/improve`, { orderId: order.id, profile }, { headers: authHeaders(), timeout: 180000 });
          const nextProposal = response.data as ImprovementProposal;
          setProposal(nextProposal);
          setSelectedChanges(new Set((nextProposal.changes || []).map((change) => change.id)));
          setMessage('A IA preparou melhorias sem inventar informações. Escolha o que deseja aplicar.');
        }
        setCheckoutProduct(null);
        setOrder(null);
      } catch (actionError) {
        setError(apiMessage(actionError, 'O pagamento foi confirmado, mas não foi possível executar o recurso agora. Tente novamente.'));
      } finally {
        setAiBusy(false);
      }
    };
    void runPurchasedAction();
  }, [aiBusy, authHeaders, order, profile, session]);

  const updateProfile = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const updatePreferences = (next: Partial<NonNullable<UserProfile['resumePreferences']>>) => {
    setProfile((current) => ({
      ...current,
      resumePreferences: { ...(current.resumePreferences || {}), ...next },
    }));
  };

  const start = () => {
    setStarted(true);
    window.setTimeout(() => document.getElementById('editor-publico')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  const addExperience = () => {
    const next: ProfessionalExperience = {
      id: randomId('exp'), company: '', role: '', startDate: '', endDate: '', current: false, description: '', skills: [],
    };
    updateProfile('experiences', [...(profile.experiences || []), next]);
  };

  const updateExperience = (index: number, patch: Partial<ProfessionalExperience>) => {
    const next = [...(profile.experiences || [])];
    next[index] = { ...next[index], ...patch };
    updateProfile('experiences', next);
  };

  const removeExperience = (index: number) => updateProfile('experiences', (profile.experiences || []).filter((_, itemIndex) => itemIndex !== index));

  const addEducation = () => {
    const next: AcademicEducation = {
      id: randomId('edu'), institution: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '', current: false, status: 'CONCLUIDO', description: '', skills: [],
    };
    updateProfile('education', [...(profile.education || []), next]);
  };

  const updateEducation = (index: number, patch: Partial<AcademicEducation>) => {
    const next = [...(profile.education || [])];
    next[index] = { ...next[index], ...patch };
    updateProfile('education', next);
  };

  const removeEducation = (index: number) => updateProfile('education', (profile.education || []).filter((_, itemIndex) => itemIndex !== index));

  const choosePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) {
      setError('Escolha uma foto JPG, PNG ou WebP de até 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateProfile('resumePhotoURL', String(reader.result || ''));
      updatePreferences({ showPhoto: true });
    };
    reader.readAsDataURL(file);
  };

  const changeTemplate = (next: TemplateName) => {
    updatePreferences({ template: next });
    void track('TEMPLATE_CHANGED', { template: next, completion });
  };

  const exportPdf = () => {
    setMessage('');
    if (!readyAsResume) {
      setError('Preencha pelo menos nome, contato, trajetória e habilidades antes de gerar o currículo.');
      return;
    }
    void track(watermarkUnlocked ? 'EXPORT_CLEAN' : 'EXPORT_WATERMARKED', { template, completion });
    window.print();
  };

  const openCheckout = (code: PublicProductCode) => {
    if (!session) {
      setError('A sessão de pagamento ainda está sendo preparada.');
      return;
    }
    if ((code === 'PUBLIC_RESUME_AI_REVIEW' || code === 'PUBLIC_RESUME_AI_IMPROVEMENT') && !readyAsResume) {
      setError('Complete nome, contato, trajetória e habilidades para a IA ter conteúdo suficiente para trabalhar.');
      return;
    }
    setCheckoutProduct(code);
    setCheckoutEmail(profile.email || checkoutEmail);
    setOrder(null);
    setError('');
  };

  const createCheckout = async () => {
    if (!session || !checkoutProduct || checkoutBusy) return;
    const email = checkoutEmail.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Informe um e-mail válido para gerar e identificar o pagamento Pix.');
      return;
    }
    setCheckoutBusy(true);
    setError('');
    try {
      const response = await api.post(`/public-resume/${session.id}/checkout`, {
        productCode: checkoutProduct,
        payer: { email, name: profile.fullName || 'Cliente PiraNegócios' },
      }, { headers: authHeaders(), timeout: 30000 });
      const next = response.data as PublicOrder;
      setOrder(next);
      if (next.status === 'PAID' || next.devSimulation) setMessage('Pagamento confirmado. Liberando o recurso...');
    } catch (checkoutError) {
      setError(apiMessage(checkoutError, 'Não foi possível gerar o Pix agora.'));
    } finally {
      setCheckoutBusy(false);
    }
  };

  const copyPix = async () => {
    if (!order?.pixCopyPaste) return;
    await navigator.clipboard.writeText(order.pixCopyPaste).catch(() => undefined);
    setMessage('Código Pix copiado.');
  };

  const accountCta = () => {
    void track('ACCOUNT_CTA', { cta: 'save_and_talent_bank', completion });
    void track('SIGNUP_REDIRECT', { source: 'public_resume_builder' });
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ profile, updatedAt: new Date().toISOString(), pendingAccountImport: true }));
    window.location.href = `/login?mode=register&returnTo=${encodeURIComponent('/user/curriculo')}`;
  };

  const toggleChange = (id: string) => {
    setSelectedChanges((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const applyImprovement = () => {
    if (!proposal?.changes?.length) return;
    let nextProfile: UserProfile = JSON.parse(JSON.stringify(profile));
    for (const change of proposal.changes) {
      if (!selectedChanges.has(change.id)) continue;
      if (change.type === 'BIO' && typeof change.after === 'string') nextProfile.bio = change.after;
      if (change.type === 'HEADLINE' && typeof change.after === 'string') {
        nextProfile.resumePreferences = { ...(nextProfile.resumePreferences || {}), headline: change.after, showHeadline: true };
      }
      if (change.type === 'GLOBAL_SKILLS' && Array.isArray(change.after)) nextProfile.skills = change.after.map(String);
      if (change.type === 'EXPERIENCE_DESCRIPTION' && typeof change.after === 'string' && change.experienceIndex !== undefined && nextProfile.experiences?.[change.experienceIndex]) {
        nextProfile.experiences[change.experienceIndex].description = change.after;
      }
      if (change.type === 'STAGE_DESCRIPTION' && typeof change.after === 'string' && change.experienceIndex !== undefined && change.stageIndex !== undefined) {
        const timeline = nextProfile.experiences?.[change.experienceIndex]?.timeline;
        if (timeline?.[change.stageIndex]) timeline[change.stageIndex].description = change.after;
      }
    }
    setProfile(nextProfile);
    setProposal(null);
    setSelectedChanges(new Set());
    setMessage('Melhorias escolhidas aplicadas ao seu currículo.');
  };

  const resetDraft = () => {
    if (!window.confirm('Limpar todo o rascunho salvo neste navegador? Esta ação não pode ser desfeita.')) return;
    setProfile(EMPTY_PROFILE);
    localStorage.removeItem(DRAFT_KEY);
    setAnalysis(null);
    setProposal(null);
    setMessage('Rascunho local limpo.');
  };

  const seoData = useMemo(() => ({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': 'https://piranegocios.com.br/criador-de-curriculo#app',
        name: 'Criador de Currículo Grátis PiraNegócios',
        url: 'https://piranegocios.com.br/criador-de-curriculo',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        inLanguage: 'pt-BR',
        isAccessibleForFree: true,
        description: 'Crie um currículo profissional online gratuitamente, escolha um modelo e salve em PDF sem precisar criar conta.',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
        provider: { '@type': 'Organization', name: 'PiraNegócios', url: 'https://piranegocios.com.br' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          ['Preciso criar conta para fazer meu currículo?', 'Não. O criador público funciona sem login. Criar uma conta é opcional e permite levar o currículo para o Banco de Talentos.'],
          ['O criador de currículo é grátis?', 'Sim. Criar, editar e gerar o currículo com a identificação do PiraNegócios no rodapé é gratuito. Recursos de IA e remoção da marca são opcionais e pagos.'],
          ['Posso baixar meu currículo em PDF?', 'Sim. O currículo usa formato A4 e pode ser salvo em PDF pelo navegador.'],
          ['Onde meu currículo fica salvo?', 'Enquanto você usa o modo público, o conteúdo do rascunho fica salvo no seu próprio navegador.'],
        ].map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })),
      },
    ],
  }), []);

  return (
    <div className="public-resume-page min-h-screen bg-[#f7f2ec] text-stone-900">
      <SeoHead
        title="Criador de Currículo Grátis | Faça seu Currículo Online | PiraNegócios"
        description="Crie um currículo profissional grátis e online. Escolha modelos, edite em tempo real e salve em PDF sem cadastro obrigatório. Recursos de IA opcionais."
        canonical="https://piranegocios.com.br/criador-de-curriculo"
        structuredData={seoData}
      />
      <style>{`
        .public-resume-unbranded .resume-brand-footer { display:none!important; }
        @media print {
          body { background:#fff!important; }
          body > * { visibility:hidden!important; }
          #public-resume-print-root, #public-resume-print-root * { visibility:visible!important; }
          #public-resume-print-root { position:absolute!important; inset:0 auto auto 0!important; width:100%!important; background:#fff!important; }
          .public-resume-no-print { display:none!important; }
        }
      `}</style>

      <header className="public-resume-no-print sticky top-0 z-40 border-b border-stone-200/80 bg-[#fffaf5]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src="/brand/symbol-terracotta.png" alt="" className="h-8 w-8" />
            <span className="font-serif text-lg font-black">PiraNegócios</span>
          </Link>
          <span className="hidden h-5 w-px bg-stone-200 sm:block" />
          <span className="hidden text-xs font-bold text-stone-500 sm:block">Criador de Currículo</span>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/login" className="rounded-xl px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100">Entrar</Link>
            <button type="button" onClick={accountCta} className="hidden rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-black text-white sm:inline-flex">Salvar na minha conta</button>
          </div>
        </div>
      </header>

      <section className="public-resume-no-print overflow-hidden border-b border-[#e4d7cc] bg-[#2b211c] text-white">
        <div className="mx-auto grid max-w-7xl gap-9 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.15em] text-[#f0c2a8]">
              <Zap className="h-3.5 w-3.5" /> Sem cadastro obrigatório
            </div>
            <h1 className="mt-5 max-w-3xl font-serif text-4xl font-black leading-[1.04] sm:text-5xl lg:text-6xl">Criador de currículo grátis, profissional e pronto para PDF.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">Monte seu currículo online em poucos minutos, escolha o visual e veja o resultado enquanto escreve. Seu rascunho fica no seu navegador e você decide se quer criar uma conta depois.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={start} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d86f50] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-black/15 hover:bg-[#e27a5a]">Criar meu currículo grátis <ArrowRight className="h-4 w-4" /></button>
              <button type="button" onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3.5 text-sm font-bold text-white/80">Como funciona</button>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-white/55">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Modelos profissionais</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Formato A4</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Salve em PDF</span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-10 rounded-full bg-[#d86f50]/15 blur-3xl" />
            <div className="relative rounded-[28px] border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur">
              <div className="rounded-[22px] bg-[#fffdf9] p-5 text-stone-900">
                <div className="flex items-center gap-3 border-b border-stone-100 pb-4"><div className="h-12 w-12 rounded-full bg-stone-200" /><div><div className="h-3 w-36 rounded bg-stone-800" /><div className="mt-2 h-2 w-24 rounded bg-[#d86f50]/60" /></div></div>
                <div className="mt-5 grid grid-cols-[1fr_.38fr] gap-5"><div className="space-y-4"><div><div className="h-2.5 w-24 rounded bg-stone-700" /><div className="mt-2 h-2 w-full rounded bg-stone-200" /><div className="mt-1.5 h-2 w-[88%] rounded bg-stone-200" /></div><div><div className="h-2.5 w-32 rounded bg-stone-700" /><div className="mt-2 h-2 w-[72%] rounded bg-stone-200" /><div className="mt-1.5 h-2 w-full rounded bg-stone-200" /><div className="mt-1.5 h-2 w-[82%] rounded bg-stone-200" /></div></div><div className="space-y-3"><div className="h-2.5 w-20 rounded bg-stone-700" />{[60,80,52,72].map((width) => <div key={width} className="h-5 rounded-full bg-[#d86f50]/10" style={{ width: `${width}%` }} />)}</div></div>
                <div className="mt-5 border-t border-stone-100 pt-3 text-center text-[8px] font-bold text-stone-300">Currículo criado em piranegocios.com.br</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="public-resume-no-print mx-auto max-w-7xl px-4 py-9 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['1', 'Preencha seus dados', 'Escreva sua trajetória com campos guiados e veja a prévia ao lado.'],
            ['2', 'Escolha o modelo', 'Troque layout e cor sem perder nenhuma informação do currículo.'],
            ['3', 'Salve em PDF', 'Gere gratuitamente com a identificação do PiraNegócios ou remova a marca por R$ 1,99.'],
          ].map(([number, title, text]) => <div key={number} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f7dfd4] text-xs font-black text-[#a84631]">{number}</span><h2 className="mt-4 font-serif text-xl font-black">{title}</h2><p className="mt-2 text-sm leading-6 text-stone-500">{text}</p></div>)}
        </div>
      </section>

      <main id="editor-publico" className="mx-auto max-w-[1500px] scroll-mt-20 px-3 pb-16 sm:px-5">
        <div className="public-resume-no-print mb-4 flex flex-col gap-3 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f7dfd4] text-[#a84631]"><FileText className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#b6533d]">Seu rascunho</p><h2 className="font-serif text-xl font-black">Currículo público</h2><p className="text-xs text-stone-400">Salvo automaticamente neste navegador.</p></div></div>
          <div className="flex items-center gap-3"><div className="min-w-32"><div className="mb-1 flex justify-between text-[10px] font-bold text-stone-400"><span>Completude</span><span>{completion}%</span></div><div className="h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completion}%` }} /></div></div><button type="button" onClick={resetDraft} className="rounded-xl border border-stone-200 p-2.5 text-stone-400 hover:border-red-200 hover:text-red-600" title="Limpar rascunho"><Trash2 className="h-4 w-4" /></button></div>
        </div>

        {error && <div className="public-resume-no-print mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        {message && <div className="public-resume-no-print mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(420px,.78fr)_minmax(650px,1.22fr)]">
          <div className="public-resume-no-print space-y-4">
            <EditorSection icon={<UserRound className="h-4 w-4" />} title="Identificação" subtitle="O básico para o recrutador saber quem você é.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome completo" value={profile.fullName || ''} onChange={(value) => updateProfile('fullName', value)} placeholder="Seu nome" />
                <Field label="Título profissional" value={profile.resumePreferences?.headline || ''} onChange={(value) => updatePreferences({ headline: value })} placeholder="Ex.: Assistente Administrativo" />
                <Field label="E-mail" type="email" value={profile.email || ''} onChange={(value) => updateProfile('email', value)} placeholder="voce@email.com" />
                <Field label="Telefone" value={profile.phone || ''} onChange={(value) => updateProfile('phone', value)} placeholder="(19) 99999-9999" />
                <Field label="Cidade" value={profile.city || ''} onChange={(value) => updateProfile('city', value)} placeholder="Pirassununga" />
                <Field label="Estado" value={profile.state || ''} onChange={(value) => updateProfile('state', value.toUpperCase().slice(0, 2))} placeholder="SP" />
                <div className="sm:col-span-2"><Field label="LinkedIn (opcional)" value={profile.linkedinURL || ''} onChange={(value) => updateProfile('linkedinURL', value)} placeholder="linkedin.com/in/seu-perfil" /></div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-600"><UserRound className="h-4 w-4" /> {profile.resumePhotoURL ? 'Trocar foto' : 'Adicionar foto'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} className="hidden" /></label>{profile.resumePhotoURL && <button type="button" onClick={() => { updateProfile('resumePhotoURL', ''); updatePreferences({ showPhoto: false }); }} className="text-xs font-bold text-red-600">Remover foto</button>}<span className="text-[10px] text-stone-400">A foto fica somente neste navegador.</span></div>
            </EditorSection>

            <EditorSection icon={<FileText className="h-4 w-4" />} title="Resumo profissional" subtitle="Conte em poucas linhas sua experiência, foco e pontos fortes.">
              <textarea value={profile.bio || ''} onChange={(event) => updateProfile('bio', event.target.value)} rows={6} maxLength={4000} placeholder="Ex.: Profissional com experiência em atendimento ao cliente, rotinas administrativas e organização de documentos..." className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#c5684d] focus:ring-2 focus:ring-[#c5684d]/10" />
            </EditorSection>

            <EditorSection icon={<BriefcaseBusiness className="h-4 w-4" />} title="Experiência profissional" subtitle="Adicione seus trabalhos mais relevantes." action={<button type="button" onClick={addExperience} className="inline-flex items-center gap-1 rounded-xl bg-stone-900 px-3 py-2 text-[11px] font-black text-white"><Plus className="h-3.5 w-3.5" /> Experiência</button>}>
              {(profile.experiences || []).length === 0 && <EmptyLine text="Nenhuma experiência adicionada. Se este é seu primeiro emprego, você pode deixar esta seção vazia e reforçar formação e habilidades." />}
              <div className="space-y-3">{(profile.experiences || []).map((experience, index) => <div key={experience.id || index} className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4"><div className="mb-3 flex items-center justify-between"><strong className="text-xs text-stone-700">Experiência {index + 1}</strong><button type="button" onClick={() => removeExperience(index)} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Empresa" value={experience.company || ''} onChange={(value) => updateExperience(index, { company: value })} /><Field label="Cargo" value={experience.role || ''} onChange={(value) => updateExperience(index, { role: value })} /><Field label="Início" value={experience.startDate || ''} onChange={(value) => updateExperience(index, { startDate: value })} placeholder="MM/AAAA" /><Field label="Fim" value={experience.current ? 'Atual' : experience.endDate || ''} disabled={experience.current} onChange={(value) => updateExperience(index, { endDate: value })} placeholder="MM/AAAA" /></div><label className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-stone-600"><input type="checkbox" checked={Boolean(experience.current)} onChange={(event) => updateExperience(index, { current: event.target.checked, endDate: event.target.checked ? 'Atual' : '' })} /> Trabalho aqui atualmente</label><textarea value={experience.description || ''} onChange={(event) => updateExperience(index, { description: event.target.value })} rows={4} placeholder="Principais atividades, responsabilidades e resultados..." className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#c5684d]" /></div>)}</div>
            </EditorSection>

            <EditorSection icon={<GraduationCap className="h-4 w-4" />} title="Formação" subtitle="Ensino técnico, superior, médio ou outras formações relevantes." action={<button type="button" onClick={addEducation} className="inline-flex items-center gap-1 rounded-xl bg-stone-900 px-3 py-2 text-[11px] font-black text-white"><Plus className="h-3.5 w-3.5" /> Formação</button>}>
              {(profile.education || []).length === 0 && <EmptyLine text="Nenhuma formação adicionada ainda." />}
              <div className="space-y-3">{(profile.education || []).map((education, index) => <div key={education.id || index} className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4"><div className="mb-3 flex items-center justify-between"><strong className="text-xs text-stone-700">Formação {index + 1}</strong><button type="button" onClick={() => removeEducation(index)} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Instituição" value={education.institution || ''} onChange={(value) => updateEducation(index, { institution: value })} /><Field label="Curso / grau" value={education.degree || ''} onChange={(value) => updateEducation(index, { degree: value })} /><Field label="Área" value={education.fieldOfStudy || ''} onChange={(value) => updateEducation(index, { fieldOfStudy: value })} /><Field label="Conclusão" value={education.current ? 'Em andamento' : education.endYear || ''} disabled={education.current} onChange={(value) => updateEducation(index, { endYear: value })} placeholder="2026" /></div><label className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-stone-600"><input type="checkbox" checked={Boolean(education.current)} onChange={(event) => updateEducation(index, { current: event.target.checked })} /> Cursando atualmente</label></div>)}</div>
            </EditorSection>

            <EditorSection icon={<BadgeCheck className="h-4 w-4" />} title="Habilidades" subtitle="Separe por vírgulas. Use competências que você realmente possui.">
              <textarea value={(profile.skills || []).join(', ')} onChange={(event) => updateProfile('skills', event.target.value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 60))} rows={4} placeholder="Atendimento ao cliente, Excel, organização, vendas, comunicação..." className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#c5684d]" />
            </EditorSection>

            <EditorSection icon={<Palette className="h-4 w-4" />} title="Visual" subtitle="Mude o estilo sem alterar o conteúdo.">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(Object.keys(TEMPLATE_LABELS) as TemplateName[]).map((name) => <button type="button" key={name} onClick={() => changeTemplate(name)} className={`rounded-2xl border p-3 text-left transition ${template === name ? 'border-[#b6533d] bg-[#fff4ee] ring-2 ring-[#b6533d]/10' : 'border-stone-200 bg-white hover:border-stone-300'}`}><strong className="block text-xs">{TEMPLATE_LABELS[name].name}</strong><span className="mt-1 block text-[10px] text-stone-400">{TEMPLATE_LABELS[name].description}</span></button>)}</div>
              <div className="mt-4 flex items-center gap-3"><label className="text-xs font-bold text-stone-600">Cor de destaque</label><input type="color" value={color} onChange={(event) => updatePreferences({ color: event.target.value })} className="h-10 w-14 cursor-pointer rounded-lg border border-stone-200 bg-white p-1" /><span className="font-mono text-[10px] text-stone-400">{color}</span></div>
            </EditorSection>

            <section className="rounded-3xl border border-violet-200 bg-violet-50/70 p-5">
              <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-violet-600">Opcional</p><h3 className="font-serif text-xl font-black text-stone-950">Quer uma segunda opinião da IA?</h3><p className="mt-1 text-xs leading-5 text-stone-500">Sem assinatura. Você paga somente pelo recurso que decidir usar.</p></div></div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2"><PaidAction title="Analisar currículo" description="Pontuação e recomendações profissionais." price={money(product('PUBLIC_RESUME_AI_REVIEW')?.effectivePriceCents ?? 199)} icon={<Sparkles className="h-4 w-4" />} onClick={() => openCheckout('PUBLIC_RESUME_AI_REVIEW')} /><PaidAction title="Melhorar com IA" description="Sugestões antes e depois para você escolher." price={money(product('PUBLIC_RESUME_AI_IMPROVEMENT')?.effectivePriceCents ?? 499)} icon={<WandSparkles className="h-4 w-4" />} onClick={() => openCheckout('PUBLIC_RESUME_AI_IMPROVEMENT')} /></div>
            </section>

            {analysis && <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-xl font-black text-emerald-700">{Math.round(Number(analysis.score || 0))}</span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-600">Análise profissional</p><h3 className="font-serif text-xl font-black">Sua pontuação atual</h3></div></div>{Array.isArray(analysis.strengths) && analysis.strengths.length > 0 && <div className="mt-4"><strong className="text-xs">Pontos fortes</strong><ul className="mt-2 space-y-1.5 text-xs leading-5 text-stone-600">{analysis.strengths.map((item: string) => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{item}</li>)}</ul></div>}{Array.isArray(analysis.suggestions) && analysis.suggestions.length > 0 && <div className="mt-4"><strong className="text-xs">Onde melhorar</strong><ul className="mt-2 space-y-1.5 text-xs leading-5 text-stone-600">{analysis.suggestions.map((item: string) => <li key={item} className="flex gap-2"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b6533d]" />{item}</li>)}</ul></div>}</section>}

            {proposal && <section className="rounded-3xl border border-violet-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-violet-600">Melhorias preparadas</p><h3 className="mt-1 font-serif text-xl font-black">Escolha o que aplicar</h3><p className="mt-1 text-xs leading-5 text-stone-500">{proposal.summary || 'A IA preparou alterações pontuais sem inventar fatos.'}</p></div><button type="button" onClick={() => setProposal(null)} className="rounded-xl p-2 text-stone-400 hover:bg-stone-100"><X className="h-4 w-4" /></button></div><div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">{(proposal.changes || []).map((change) => <label key={change.id} className={`block cursor-pointer rounded-2xl border p-3 ${selectedChanges.has(change.id) ? 'border-violet-300 bg-violet-50/60' : 'border-stone-200'}`}><div className="flex items-start gap-2"><input type="checkbox" checked={selectedChanges.has(change.id)} onChange={() => toggleChange(change.id)} className="mt-1" /><div className="min-w-0"><strong className="text-xs text-stone-800">{change.label}</strong>{change.reason && <p className="mt-1 text-[11px] leading-4 text-stone-400">{change.reason}</p>}<div className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2"><div className="rounded-xl bg-red-50 p-2 text-red-800"><span className="block text-[9px] font-black uppercase text-red-400">Antes</span>{Array.isArray(change.before) ? change.before.join(', ') : change.before}</div><div className="rounded-xl bg-emerald-50 p-2 text-emerald-800"><span className="block text-[9px] font-black uppercase text-emerald-500">Depois</span>{Array.isArray(change.after) ? change.after.join(', ') : change.after}</div></div></div></div></label>)}</div><button type="button" disabled={selectedChanges.size === 0} onClick={applyImprovement} className="mt-4 w-full rounded-2xl bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Aplicar {selectedChanges.size} melhoria(s) escolhida(s)</button></section>}
          </div>

          <div className="xl:sticky xl:top-20">
            <div className="public-resume-no-print mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm"><button type="button" onClick={() => { void track('PREVIEW_VIEWED', { template, completion }); document.getElementById('public-resume-print-root')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600">Ver prévia</button><button type="button" onClick={exportPdf} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-black text-white"><Printer className="h-4 w-4" /> Salvar em PDF</button>{!watermarkUnlocked ? <button type="button" onClick={() => openCheckout('PUBLIC_RESUME_REMOVE_WATERMARK')} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#b6533d] px-4 py-2.5 text-xs font-black text-white"><ShieldCheck className="h-4 w-4" /> Remover marca · {money(product('PUBLIC_RESUME_REMOVE_WATERMARK')?.effectivePriceCents ?? 199)}</button> : <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-black text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Sem marca</span>}</div>
            <div className="overflow-auto rounded-[28px] border border-stone-200 bg-[#dfd8d1] p-3 shadow-inner sm:p-5"><div id="public-resume-print-root" className={watermarkUnlocked ? 'public-resume-unbranded' : ''}><Template profile={profile} color={color} showPhoto={Boolean(profile.resumePreferences?.showPhoto)} address={[profile.city, profile.state].filter(Boolean).join(' - ')} isFirstJob={!profile.experiences?.length} /></div></div>
            <div className="public-resume-no-print mt-4 rounded-3xl border border-[#dfc7b8] bg-[#fffaf5] p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f7dfd4] text-[#a84631]"><BriefcaseBusiness className="h-5 w-5" /></span><div className="min-w-0"><h3 className="font-serif text-lg font-black">Quer que empresas encontrem você?</h3><p className="mt-1 text-xs leading-5 text-stone-500">Criar uma conta é opcional. Ao entrar no PiraNegócios, você pode levar este currículo para seu perfil e decidir quando publicá-lo no Banco de Talentos.</p><button type="button" onClick={accountCta} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#2b211c] px-4 py-2.5 text-xs font-black text-white">Criar conta grátis <ArrowRight className="h-3.5 w-3.5" /></button></div></div></div>
          </div>
        </div>
      </main>

      <section className="public-resume-no-print border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="text-center"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b6533d]">Dúvidas frequentes</p><h2 className="mt-2 font-serif text-3xl font-black">Criar currículo online sem complicação</h2></div><div className="mt-7 grid gap-3 sm:grid-cols-2"><Faq title="Preciso criar conta para fazer meu currículo?">Não. O criador público funciona sem login. A conta é opcional e serve para levar o currículo ao seu perfil e ao Banco de Talentos.</Faq><Faq title="O criador de currículo é grátis?">Sim. Criar, editar e salvar o currículo com a identificação do PiraNegócios no rodapé é grátis. IA e remoção da marca são recursos opcionais.</Faq><Faq title="Posso baixar meu currículo em PDF?">Sim. Os modelos são preparados para A4 e podem ser salvos em PDF usando a opção de impressão do navegador.</Faq><Faq title="Onde meus dados ficam salvos?">No modo público, o conteúdo do rascunho fica no armazenamento local deste navegador. O analytics registra apenas etapas do uso e nunca o texto do seu currículo.</Faq></div></div>
      </section>

      <footer className="public-resume-no-print bg-[#2b211c] text-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><strong className="text-white/80">PiraNegócios</strong><p className="mt-1">Conexão que acontece.</p></div><div className="flex gap-4"><Link to="/vagas" className="hover:text-white">Vagas</Link><Link to="/termos" className="hover:text-white">Termos</Link><Link to="/login" className="hover:text-white">Entrar</Link></div></div></footer>

      {checkoutProduct && <div className="public-resume-no-print fixed inset-0 z-[120] flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm" onClick={() => !checkoutBusy && !aiBusy && setCheckoutProduct(null)}><section className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f7dfd4] text-[#a84631]">{checkoutProduct === 'PUBLIC_RESUME_REMOVE_WATERMARK' ? <ShieldCheck className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}</span><button type="button" disabled={checkoutBusy || aiBusy} onClick={() => setCheckoutProduct(null)} className="rounded-xl p-2 text-stone-400 hover:bg-stone-100"><X className="h-4 w-4" /></button></div><h2 className="mt-4 font-serif text-2xl font-black">{product(checkoutProduct)?.name || (checkoutProduct === 'PUBLIC_RESUME_REMOVE_WATERMARK' ? 'Remover marca do currículo' : 'Recurso profissional')}</h2><p className="mt-2 text-sm leading-6 text-stone-500">{product(checkoutProduct)?.description}</p>{!order ? <><div className="mt-5"><label className="text-[10px] font-black uppercase tracking-[.12em] text-stone-400">E-mail para o pagamento</label><div className="mt-1 flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3"><Mail className="h-4 w-4 text-stone-400" /><input type="email" value={checkoutEmail} onChange={(event) => setCheckoutEmail(event.target.value)} placeholder="voce@email.com" className="w-full bg-transparent py-3 text-sm outline-none" /></div><p className="mt-2 text-[10px] leading-4 text-stone-400">Não cria conta. O e-mail é usado somente para identificar o checkout no provedor de pagamento.</p></div><div className="mt-5 flex items-end justify-between rounded-2xl bg-stone-50 p-4"><div><p className="text-[10px] font-bold uppercase text-stone-400">Pagamento único</p><strong className="mt-1 block text-2xl">{money(product(checkoutProduct)?.effectivePriceCents ?? (checkoutProduct === 'PUBLIC_RESUME_AI_IMPROVEMENT' ? 499 : 199))}</strong></div><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-700">Pix</span></div><button type="button" disabled={checkoutBusy || sessionLoading} onClick={() => void createCheckout()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2b211c] px-4 py-3.5 text-sm font-black text-white disabled:opacity-50">{checkoutBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />} Gerar Pix</button></> : <div className="mt-5">{order.status === 'PENDING' ? <><div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-center">{order.qrCodeBase64 && <img src={order.qrCodeBase64.startsWith('data:') ? order.qrCodeBase64 : `data:image/png;base64,${order.qrCodeBase64}`} alt="QR Code Pix" className="mx-auto h-48 w-48 rounded-xl bg-white p-2" />}<p className="mt-3 text-xs font-bold text-stone-600">Escaneie o QR Code ou use o Pix copia e cola.</p>{order.pixCopyPaste && <button type="button" onClick={() => void copyPix()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-stone-700 shadow-sm"><Copy className="h-3.5 w-3.5" /> Copiar Pix</button>}</div><div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-amber-700"><Loader2 className="h-4 w-4 animate-spin" /> Aguardando confirmação do pagamento</div></> : order.status === 'PAID' ? <div className="rounded-2xl bg-emerald-50 p-5 text-center text-emerald-800"><CheckCircle2 className="mx-auto h-8 w-8" /><strong className="mt-2 block">Pagamento confirmado</strong><span className="text-xs">Liberando seu recurso...</span></div> : <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">Este pagamento foi {order.status === 'EXPIRED' ? 'expirado' : 'cancelado'}. Feche e gere um novo Pix.</div>}</div>}</section></div>}

      {aiBusy && <div className="public-resume-no-print fixed inset-0 z-[140] flex items-center justify-center bg-stone-950/65 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center shadow-2xl"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles className="h-7 w-7 animate-pulse" /></span><h3 className="mt-4 font-serif text-2xl font-black">IA trabalhando no seu currículo</h3><p className="mt-2 text-sm leading-6 text-stone-500">Ela está lendo somente os dados profissionais que você acabou de enviar para este recurso.</p><Loader2 className="mx-auto mt-5 h-5 w-5 animate-spin text-violet-700" /></div></div>}
    </div>
  );
}

function EditorSection({ icon, title, subtitle, action, children }: { icon: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">{icon}</span><div className="min-w-0 flex-1"><h3 className="font-serif text-lg font-black">{title}</h3><p className="mt-0.5 text-[11px] leading-4 text-stone-400">{subtitle}</p></div>{action}</div>{children}</section>;
}

function Field({ label, value, onChange, placeholder = '', type = 'text', disabled = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; disabled?: boolean }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-[.11em] text-stone-400">{label}</span><input type={type} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#c5684d] focus:ring-2 focus:ring-[#c5684d]/10 disabled:bg-stone-100 disabled:text-stone-400" /></label>;
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-4 text-xs leading-5 text-stone-400">{text}</div>;
}

function PaidAction({ title, description, price, icon, onClick }: { title: string; description: string; price: string; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-2xl border border-violet-200 bg-white p-4 text-left transition hover:border-violet-300 hover:shadow-sm"><div className="flex items-center justify-between gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700">{icon}</span><strong className="text-sm text-violet-800">{price}</strong></div><strong className="mt-3 block text-xs text-stone-900">{title}</strong><span className="mt-1 block text-[10px] leading-4 text-stone-400">{description}</span></button>;
}

function Faq({ title, children }: { title: string; children: React.ReactNode }) {
  return <article className="rounded-2xl border border-stone-200 bg-[#fffdfa] p-5"><h3 className="font-serif text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-stone-500">{children}</p></article>;
}
