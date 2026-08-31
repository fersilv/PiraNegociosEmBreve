import React from "react";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  FileText,
  Gavel,
  MessageCircle,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { SeoHead } from "../components/SeoHead";
import { useAuth } from "../contexts/AuthContext";

const capabilities = [
  {
    icon: <BriefcaseBusiness className="h-5 w-5" />,
    eyebrow: "Recrutamento",
    title: "Encontre pessoas para o próximo passo da empresa.",
    text: "Publique oportunidades, organize o recrutamento e conecte as vagas à presença da sua empresa no PiraNegócios.",
    points: ["Publicação e gestão de vagas", "Banco e descoberta de talentos", "Página pública com oportunidades da empresa"],
  },
  {
    icon: <Store className="h-5 w-5" />,
    eyebrow: "Presença",
    title: "Tenha uma página que represente o seu negócio.",
    text: "A empresa pode ter presença pública própria dentro da plataforma, com identidade, informações e coleções ligadas ao que ela oferece.",
    points: ["Página pública da empresa", "Produtos e vagas em coleções próprias", "Experiência integrada ao ecossistema PiraNegócios"],
  },
  {
    icon: <ShoppingBag className="h-5 w-5" />,
    eyebrow: "Classificados",
    title: "Leve produtos e serviços para a vitrine regional.",
    text: "Use os classificados para publicar ofertas e administrar os fluxos comerciais disponíveis no workspace da empresa.",
    points: ["Anúncios de produtos e serviços", "Gestão de vendas, estoque e avaliações", "Conversas e acompanhamento comercial"],
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    eyebrow: "Operação",
    title: "Centralize mais do que a publicação do anúncio.",
    text: "O workspace reúne áreas de gestão para acompanhar a operação dos classificados sem espalhar o trabalho por várias telas desconectadas.",
    points: ["Analytics dos classificados", "Recebimentos e gestão comercial", "Logística, pedidos e pós-venda conforme o fluxo disponível"],
  },
];

export default function ForCompaniesPage() {
  const { user, profile } = useAuth();
  const workspacePath = profile?.type === "ADMIN" ? "/admin" : profile?.companyId ? "/company" : "/company";
  const primaryCta = user ? workspacePath : "/login?returnTo=%2Fcompany";

  return (
    <div className="min-h-screen bg-[#fffaf5] text-[#2d211c] selection:bg-[#e8b29b] selection:text-[#2d211c]">
      <SeoHead
        title="Para empresas | PiraNegócios"
        description="Conheça as soluções do PiraNegócios para empresas: presença pública, recrutamento, classificados e gestão comercial."
        canonical={`${window.location.origin}/para-empresas`}
      />
      <Navbar />

      <main>
        <section className="relative overflow-hidden border-b border-[#4b3328]/10 bg-[#2d211c] text-white">
          <div className="pointer-events-none absolute -left-24 top-8 h-80 w-80 rounded-full bg-[#c96847]/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-28 bottom-[-150px] h-[430px] w-[430px] rounded-full bg-[#f0bf9f]/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[.035] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />

          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.055] px-3.5 py-2 text-[10px] font-black uppercase tracking-[.18em] text-[#f0bf9f]">
                <Building2 className="h-3.5 w-3.5" /> PiraNegócios para empresas
              </div>
              <h1 className="mt-6 max-w-4xl font-serif text-5xl font-bold leading-[.97] tracking-[-.04em] text-white sm:text-6xl lg:text-7xl">
                Seu negócio não precisa caber
                <span className="block text-[#e7a283]">em uma única ferramenta.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/58 sm:text-lg sm:leading-8">
                Recrutamento, presença pública e operação no marketplace podem viver no mesmo ecossistema, conectados às pessoas e aos negócios da região.
              </p>
              <div className="mt-8 flex flex-wrap gap-2.5">
                <Link to={primaryCta} className="inline-flex items-center gap-2 rounded-2xl bg-[#c96847] px-5 py-3.5 text-sm font-black text-white shadow-[0_14px_34px_rgba(201,104,71,.25)] transition hover:-translate-y-0.5 hover:bg-[#b85c3d]">
                  {user ? "Ir para meu espaço" : "Entrar como empresa"} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/como-funciona" className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[.06] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/[.1]">Entender a plataforma</Link>
              </div>
            </div>

            <div className="rounded-[34px] border border-white/10 bg-white/[.055] p-6 shadow-[0_28px_80px_rgba(0,0,0,.18)] backdrop-blur-xl sm:p-7">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#e7a283]">Uma conta, várias frentes</p>
              <h2 className="mt-2 font-serif text-3xl font-bold">A empresa participa do marketplace inteiro.</h2>
              <div className="mt-6 space-y-3">
                <HeroPoint icon={<BriefcaseBusiness className="h-4 w-4" />} title="Contratar" text="Publique e administre oportunidades." />
                <HeroPoint icon={<Store className="h-4 w-4" />} title="Apresentar" text="Construa uma presença pública própria." />
                <HeroPoint icon={<ShoppingBag className="h-4 w-4" />} title="Vender" text="Leve produtos e serviços aos classificados." />
                <HeroPoint icon={<BarChart3 className="h-4 w-4" />} title="Gerenciar" text="Use as áreas comerciais do workspace." />
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#4b3328]/8 bg-[#f6eee7]">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
            <Metric icon={<UsersRound className="h-4 w-4" />} title="Talentos" text="Recrutamento regional" />
            <Metric icon={<Store className="h-4 w-4" />} title="Marca" text="Presença pública" />
            <Metric icon={<PackageCheck className="h-4 w-4" />} title="Ofertas" text="Produtos e serviços" />
            <Metric icon={<MessageCircle className="h-4 w-4" />} title="Relacionamento" text="Conversas e operação" />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-4xl">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b96345]">O que sua empresa pode fazer</p>
            <h2 className="mt-2 font-serif text-4xl font-bold tracking-[-.025em] sm:text-5xl">Quatro frentes que trabalham melhor quando não vivem isoladas.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#735f54]">O PiraNegócios aproxima a parte institucional, a contratação e a atividade comercial em torno da mesma empresa.</p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {capabilities.map((capability) => (
              <article key={capability.eyebrow} className="rounded-[30px] border border-[#4b3328]/10 bg-white p-6 shadow-[0_16px_50px_rgba(66,43,31,.045)] sm:p-8">
                <div className="flex items-start justify-between gap-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#2d211c] text-[#f0bf9f]">{capability.icon}</span>
                  <span className="rounded-full bg-[#f7e9df] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.16em] text-[#a8543a]">{capability.eyebrow}</span>
                </div>
                <h3 className="mt-6 font-serif text-3xl font-bold tracking-[-.02em]">{capability.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#735f54]">{capability.text}</p>
                <div className="mt-6 space-y-3 border-t border-[#4b3328]/8 pt-5">
                  {capability.points.map((point) => (
                    <div key={point} className="flex items-start gap-2.5 text-sm font-semibold text-[#58443a]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#c96847]" />{point}</div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-[#4b3328]/8 bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[.78fr_1.22fr] lg:px-8 lg:py-20">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b96345]">Presença pública</p>
              <h2 className="mt-2 font-serif text-4xl font-bold tracking-[-.025em] sm:text-5xl">Sua página pode ser o ponto de encontro da sua empresa dentro do PiraNegócios.</h2>
              <p className="mt-4 text-sm leading-7 text-[#735f54]">Em vez de tratar empresa como um nome preso a um anúncio, a plataforma já suporta páginas públicas e coleções próprias de produtos e vagas.</p>
            </div>
            <div className="rounded-[30px] bg-[#2d211c] p-6 text-white sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <DarkFeature icon={<Building2 className="h-5 w-5" />} title="Página da empresa" text="Informações e identidade em uma presença pública dedicada." />
                <DarkFeature icon={<ShoppingBag className="h-5 w-5" />} title="Produtos" text="Coleção pública ligada à própria empresa." />
                <DarkFeature icon={<BriefcaseBusiness className="h-5 w-5" />} title="Vagas" text="Oportunidades agrupadas na página da organização." />
                <DarkFeature icon={<FileText className="h-5 w-5" />} title="Termos próprios" text="Rotas públicas de termos e privacidade associadas à empresa." />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div className="rounded-[34px] border border-[#c96847]/20 bg-[#fff0e8] p-7 sm:p-9">
              <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#c96847] text-white"><Gavel className="h-5 w-5" /></span><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#a8543a]">Recursos avançados de classificados</p></div>
              <h2 className="mt-6 font-serif text-4xl font-bold tracking-[-.025em]">Há espaço para operações que vão além do anúncio simples.</h2>
              <p className="mt-4 text-sm leading-7 text-[#735f54]">O produto já contempla áreas dedicadas a leilões, ofertas, estoque, vendas, recebimentos, avaliações, logística e analytics. A disponibilidade de cada recurso depende da configuração e do acesso da empresa.</p>
              <Link to="/classificados" className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#a84f34]">Ver o marketplace <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b96345]">Sem promessas mágicas</p>
              <h2 className="mt-2 font-serif text-4xl font-bold tracking-[-.025em]">A plataforma cresce em módulos, mas a empresa continua sendo uma só.</h2>
              <p className="mt-4 text-sm leading-7 text-[#735f54]">Nem todo negócio precisa de todos os recursos. A proposta é deixar as frentes conectadas e habilitar o que fizer sentido para cada operação, sem transformar o painel em um labirinto.</p>
              <div className="mt-6 space-y-3">
                <SmallPoint icon={<ShieldCheck className="h-4 w-4" />} text="Acesso centralizado pelo workspace da empresa" />
                <SmallPoint icon={<Search className="h-4 w-4" />} text="Presença pública descoberta dentro do ecossistema regional" />
                <SmallPoint icon={<Sparkles className="h-4 w-4" />} text="Carreiras e marketplace com experiências próprias, mas conectadas" />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#2d211c] text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-7 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#e7a283]">Seu próximo passo</p>
              <h2 className="mt-2 font-serif text-4xl font-bold tracking-[-.025em] sm:text-5xl">Entre no espaço da empresa e construa a presença certa para o seu negócio.</h2>
            </div>
            <Link to={primaryCta} className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[#c96847] px-5 py-3.5 text-sm font-black text-white shadow-[0_14px_34px_rgba(201,104,71,.25)]">
              {user ? "Abrir meu espaço" : "Começar"} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function HeroPoint({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-black/10 p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e7a283]/15 text-[#f0bf9f]">{icon}</span><div><p className="text-sm font-bold text-white">{title}</p><p className="mt-1 text-xs leading-5 text-white/42">{text}</p></div></div>;
}

function Metric({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="flex items-center gap-3 border-[#4b3328]/8 px-4 py-5 lg:border-x"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fffaf5] text-[#b96345] ring-1 ring-[#4b3328]/8">{icon}</span><div><p className="text-xs font-black">{title}</p><p className="mt-0.5 text-[10px] font-semibold text-[#8b7569]">{text}</p></div></div>;
}

function DarkFeature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-[22px] border border-white/8 bg-white/[.05] p-5"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e7a283]/15 text-[#f0bf9f]">{icon}</span><h3 className="mt-4 font-serif text-xl font-bold">{title}</h3><p className="mt-2 text-xs leading-5 text-white/42">{text}</p></div>;
}

function SmallPoint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-[#4b3328]/10 bg-white p-4 text-sm font-semibold text-[#58443a]"><span className="mt-0.5 text-[#c96847]">{icon}</span>{text}</div>;
}
