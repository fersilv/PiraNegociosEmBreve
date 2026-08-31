import React from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  FileText,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Tags,
  UserRoundSearch,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { SeoHead } from "../components/SeoHead";
import { useAuth } from "../contexts/AuthContext";

const journeys = [
  {
    icon: <ShoppingBag className="h-5 w-5" />,
    eyebrow: "Quero encontrar algo",
    title: "Explore o que a região tem agora.",
    text: "Busque produtos e serviços, filtre por cidade e navegue pelos classificados sem precisar criar uma conta para começar a descobrir.",
    steps: ["Busque por palavra ou categoria", "Priorize sua cidade e região", "Abra o anúncio e siga para a negociação"],
    to: "/classificados",
    cta: "Explorar classificados",
  },
  {
    icon: <Tags className="h-5 w-5" />,
    eyebrow: "Quero anunciar",
    title: "Transforme o que você oferece em vitrine.",
    text: "Publique produtos ou serviços com as informações que ajudam quem está perto a entender a oferta e chegar até você.",
    steps: ["Entre na sua conta", "Crie o anúncio com preço, fotos e localização", "Acompanhe sua operação pelo espaço de classificados"],
    to: "/classificados/publicar",
    cta: "Publicar anúncio",
  },
  {
    icon: <BriefcaseBusiness className="h-5 w-5" />,
    eyebrow: "Quero uma oportunidade",
    title: "Vagas e carreira têm uma casa própria.",
    text: "Pesquise oportunidades da região, monte seu currículo e acompanhe uma experiência pensada para aproximar pessoas e empresas.",
    steps: ["Encontre vagas em /vagas", "Crie ou mantenha seu currículo", "Candidate-se conforme o fluxo de cada oportunidade"],
    to: "/carreiras",
    cta: "Conhecer carreiras",
  },
  {
    icon: <Building2 className="h-5 w-5" />,
    eyebrow: "Tenho uma empresa",
    title: "Contrate, apareça e opere no mesmo ecossistema.",
    text: "Empresas podem usar o PiraNegócios para recrutamento, presença pública e recursos comerciais ligados aos classificados.",
    steps: ["Estruture a presença da empresa", "Publique e gerencie oportunidades", "Use os recursos comerciais disponíveis no workspace"],
    to: "/para-empresas",
    cta: "Ver soluções para empresas",
  },
];

export default function HowItWorksPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#fffaf5] text-[#2d211c] selection:bg-[#e8b29b] selection:text-[#2d211c]">
      <SeoHead
        title="Como funciona | PiraNegócios"
        description="Entenda como comprar, vender, encontrar vagas, criar currículo e usar o PiraNegócios como empresa."
        canonical={`${window.location.origin}/como-funciona`}
      />
      <Navbar />

      <main>
        <section className="relative overflow-hidden border-b border-[#4b3328]/10 bg-[#2d211c] text-white">
          <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#c96847]/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 bottom-[-120px] h-96 w-96 rounded-full bg-[#f0bf9f]/15 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.055] px-3.5 py-2 text-[10px] font-black uppercase tracking-[.18em] text-[#f0bf9f]">
                <Sparkles className="h-3.5 w-3.5" /> Como funciona
              </div>
              <h1 className="mt-6 font-serif text-5xl font-bold leading-[.98] tracking-[-.04em] sm:text-6xl lg:text-7xl">
                Um marketplace regional.
                <span className="block text-[#e7a283]">Vários caminhos, uma só rede.</span>
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-7 text-white/58 sm:text-lg sm:leading-8">
                O PiraNegócios conecta quem procura, quem vende, quem trabalha e quem contrata. Você entra pelo que precisa hoje e continua dentro do mesmo ecossistema local.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-[#4b3328]/8 bg-[#f6eee7]">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
            <QuickPoint icon={<Search className="h-4 w-4" />} title="Descobrir" text="Produtos, serviços e vagas" />
            <QuickPoint icon={<MapPin className="h-4 w-4" />} title="Aproximar" text="Conteúdo regional primeiro" />
            <QuickPoint icon={<Store className="h-4 w-4" />} title="Participar" text="Anuncie ou construa sua presença" />
            <QuickPoint icon={<UserRoundSearch className="h-4 w-4" />} title="Conectar" text="Pessoas e empresas no mesmo lugar" />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b96345]">Escolha seu caminho</p>
            <h2 className="mt-2 font-serif text-4xl font-bold tracking-[-.025em] sm:text-5xl">O começo depende do que você veio resolver.</h2>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {journeys.map((journey) => (
              <article key={journey.eyebrow} className="rounded-[30px] border border-[#4b3328]/10 bg-white p-6 shadow-[0_16px_50px_rgba(66,43,31,.045)] sm:p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2d211c] text-[#f0bf9f]">{journey.icon}</span>
                <p className="mt-6 text-[10px] font-black uppercase tracking-[.18em] text-[#b96345]">{journey.eyebrow}</p>
                <h3 className="mt-2 font-serif text-3xl font-bold tracking-[-.02em]">{journey.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#735f54]">{journey.text}</p>
                <div className="mt-6 space-y-3 border-t border-[#4b3328]/8 pt-5">
                  {journey.steps.map((step, index) => (
                    <div key={step} className="flex items-start gap-3 text-sm font-semibold text-[#58443a]">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f6e8de] text-[10px] font-black text-[#ac593e]">{index + 1}</span>
                      <span className="pt-0.5">{step}</span>
                    </div>
                  ))}
                </div>
                <Link to={journey.to} className="mt-7 inline-flex items-center gap-2 text-sm font-black text-[#a84f34]">{journey.cta} <ArrowRight className="h-4 w-4" /></Link>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-[#4b3328]/8 bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[.85fr_1.15fr] lg:px-8 lg:py-20">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b96345]">Por que a região importa</p>
              <h2 className="mt-2 font-serif text-4xl font-bold tracking-[-.025em] sm:text-5xl">Proximidade não é um filtro escondido. É parte da experiência.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#735f54]">
                Quando existe uma indicação aproximada da sua localização, o PiraNegócios pode priorizar localidades relevantes sem impedir que você explore o restante da região.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard icon={<MapPin className="h-5 w-5" />} title="Contexto local" text="A página inicial pode organizar anúncios e oportunidades considerando sua região aproximada." />
              <InfoCard icon={<Search className="h-5 w-5" />} title="Você continua no controle" text="Busca, cidade e categorias permitem trocar o recorte e explorar além da sugestão inicial." />
              <InfoCard icon={<ShieldCheck className="h-5 w-5" />} title="Sem depender de GPS" text="A experiência pública usa uma indicação aproximada de região e continua funcionando quando ela não está disponível." />
              <InfoCard icon={<MessageCircle className="h-5 w-5" />} title="Tudo conectado" text="Classificados, conversas, carreira e espaços de empresa convivem na mesma plataforma." />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-5 lg:grid-cols-3">
            <FeatureStrip icon={<FileText className="h-5 w-5" />} title="Currículo e carreira" text="Crie seu currículo, descubra vagas e mantenha sua vida profissional dentro do seu espaço." to="/criador-de-curriculo" />
            <FeatureStrip icon={<Tags className="h-5 w-5" />} title="Classificados" text="Explore anúncios, favoritos, conversas e os fluxos de compra e venda disponíveis na plataforma." to="/classificados" />
            <FeatureStrip icon={<Building2 className="h-5 w-5" />} title="Conta de empresa" text="Centralize presença, recrutamento e os recursos de negócio oferecidos pelo PiraNegócios." to="/para-empresas" />
          </div>
        </section>

        <section className="bg-[#2d211c] text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-7 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#e7a283]">Agora é com você</p>
              <h2 className="mt-2 font-serif text-4xl font-bold tracking-[-.025em] sm:text-5xl">Entre pela porta que faz sentido hoje.</h2>
              <p className="mt-3 text-sm leading-6 text-white/48">Amanhã você pode precisar de outra parte da plataforma. Ela já vai estar aqui.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link to="/classificados" className="inline-flex items-center gap-2 rounded-2xl bg-[#c96847] px-5 py-3 text-sm font-black text-white">Explorar marketplace <ArrowRight className="h-4 w-4" /></Link>
              <Link to={user ? "/classificados/publicar" : "/login?returnTo=%2Fclassificados%2Fpublicar"} className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[.06] px-5 py-3 text-sm font-bold text-white">Anunciar</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function QuickPoint({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="flex items-center gap-3 border-[#4b3328]/8 px-4 py-5 lg:border-x"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fffaf5] text-[#b96345] ring-1 ring-[#4b3328]/8">{icon}</span><div><p className="text-xs font-black">{title}</p><p className="mt-0.5 text-[10px] font-semibold text-[#8b7569]">{text}</p></div></div>;
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-[24px] border border-[#4b3328]/10 bg-[#fffaf5] p-5"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f5e5da] text-[#b96345]">{icon}</span><h3 className="mt-4 font-serif text-xl font-bold">{title}</h3><p className="mt-2 text-xs leading-5 text-[#735f54]">{text}</p></div>;
}

function FeatureStrip({ icon, title, text, to }: { icon: React.ReactNode; title: string; text: string; to: string }) {
  return <Link to={to} className="group rounded-[26px] border border-[#4b3328]/10 bg-white p-6 shadow-[0_12px_40px_rgba(66,43,31,.04)] transition hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(66,43,31,.08)]"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2d211c] text-[#f0bf9f]">{icon}</span><h3 className="mt-5 font-serif text-2xl font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#735f54]">{text}</p><span className="mt-5 inline-flex items-center gap-1.5 text-xs font-black text-[#a84f34]">Saiba mais <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span></Link>;
}
