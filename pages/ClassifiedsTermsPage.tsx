import React from 'react';
import { Link } from 'react-router-dom';
import { Gavel, MessageCircle, ShieldCheck, Store, User } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { SeoHead } from '../components/SeoHead';

const VERSION = '25 de agosto de 2026';

export default function ClassifiedsTermsPage() {
  return (
    <div className="min-h-screen bg-[#f7f5f2] text-stone-900">
      <SeoHead
        title="Termos de Uso dos Classificados | PiraNegócios"
        description="Regras específicas para compra, venda, prestação de serviços, ofertas, leilões e negociação nos Classificados PiraNegócios."
        canonical={`${window.location.origin}/classificados/termos`}
      />
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-black/[.06] sm:p-10">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">PiraNegócios Classificados</p>
          <h1 className="mt-2 font-serif text-4xl font-black tracking-[-.035em] sm:text-5xl">Termos de Uso</h1>
          <p className="mt-3 text-sm leading-6 text-stone-500">Versão vigente: {VERSION}. Estes termos complementam os Termos de Uso gerais do PiraNegócios e tratam especificamente do marketplace de produtos e serviços.</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            <InfoCard icon={<User className="h-5 w-5" />} title="Personal" text="Anúncios e negociações feitos em nome da pessoa usuária." />
            <InfoCard icon={<Store className="h-5 w-5" />} title="Business" text="Publicações empresariais exigem empresa elegível, verificada e adesão própria." />
            <InfoCard icon={<MessageCircle className="h-5 w-5" />} title="Chat interno" text="Negociações podem ficar registradas na plataforma para continuidade e segurança." />
            <InfoCard icon={<Gavel className="h-5 w-5" />} title="Leilões" text="Empresas podem abrir disputas por tempo com regras próprias de lance." />
          </div>

          <div className="mt-9 space-y-8 text-sm leading-7 text-stone-700">
            <Term number="1" title="Papel do PiraNegócios">
              O PiraNegócios disponibiliza tecnologia para publicação, descoberta e comunicação entre pessoas e empresas. Salvo quando uma funcionalidade indicar expressamente o contrário, o PiraNegócios não é comprador, vendedor, prestador do serviço, transportador, garantidor ou parte da negociação realizada entre os usuários.
            </Term>
            <Term number="2" title="Identidade Personal e Business">
              A mesma conta pode possuir um espaço Personal e, quando elegível, um espaço Business. Anúncios, configurações e conversas são vinculados à identidade utilizada. O uso como Business depende das permissões da empresa, da verificação exigida pela plataforma e do aceite destes termos em nome da empresa por pessoa autorizada.
            </Term>
            <Term number="3" title="Responsabilidade pelo anúncio">
              Quem publica é responsável pela veracidade de título, descrição, imagens, preço, condição, disponibilidade, localização, características e demais informações. Produtos devem informar preço conforme as regras da plataforma. Serviços podem utilizar preço fixo, negociável, valor inicial ou solicitação de orçamento quando essa opção estiver disponível.
            </Term>
            <Term number="4" title="Produtos, serviços e conteúdo proibido">
              Não é permitido anunciar itens, serviços ou conteúdos cuja oferta, posse, comercialização ou divulgação viole a legislação aplicável, direitos de terceiros ou políticas do PiraNegócios. Também são proibidos anúncios fraudulentos, enganosos, falsificados, discriminatórios, que promovam golpes ou tentem contornar medidas de segurança da plataforma. O PiraNegócios pode remover, limitar, suspender ou encaminhar para revisão conteúdo suspeito.
            </Term>
            <Term number="5" title="Empresas verificadas">
              A verificação identifica que a empresa passou pelo processo de validação adotado pelo PiraNegócios. O selo não representa garantia de qualidade do produto ou serviço, solvência, entrega, preço, cumprimento contratual ou resultado da negociação. Cada parte continua responsável por avaliar a oferta antes de concluir o negócio.
            </Term>
            <Term number="6" title="Negociação e chat em tempo real">
              O chat interno pode ser usado para dúvidas, propostas, combinação de retirada, entrega, orçamento e demais tratativas relacionadas ao anúncio. As mensagens ficam vinculadas à negociação e podem ser armazenadas para histórico, continuidade, prevenção de abuso, suporte e segurança. Em uma identidade Business, administradores autorizados da empresa podem ter acesso às conversas empresariais. Não compartilhe senhas, códigos de autenticação, credenciais bancárias ou outros segredos pelo chat.
            </Term>
            <Term number="7" title="Contatos externos">
              Telefone e WhatsApp são opcionais. Quando informados no anúncio, tornam-se dados públicos daquele anúncio. O chat do PiraNegócios permanece disponível como canal interno quando a funcionalidade estiver habilitada. A decisão de migrar uma conversa para canal externo é responsabilidade das partes.
            </Term>
            <Term number="8" title="Ofertas, preço, pagamento e entrega">
              Uma oferta enviada por um interessado pode ter prazo próprio para aceite. Quando aceita, ela registra o valor que as partes concordaram em negociar, mas não representa confirmação de pagamento, entrega ou transferência de propriedade. Enquanto o PiraNegócios não indicar expressamente a ativação de pagamento protegido, as condições de pagamento, retirada, entrega e verificação do item são combinadas diretamente entre as partes.
            </Term>
            <Term number="9" title="Leilões empresariais">
              Empresas elegíveis podem disponibilizar produtos publicados em leilão, definindo lance inicial, incremento mínimo e horário de encerramento. Lances registrados representam intenção séria de compra pelo valor ofertado. O maior lance válido ao encerramento é identificado como vencedor. Para preservar a confiança da disputa, um leilão que já recebeu lance não pode ser cancelado pela empresa por meio da funcionalidade normal. Nesta versão, vencer um leilão não movimenta dinheiro pelo PiraNegócios: vencedor e anunciante recebem o registro do resultado e devem combinar pagamento e entrega diretamente.
            </Term>
            <Term number="10" title="Página pública da empresa">
              Empresas podem escolher exibir determinados anúncios nos Classificados, na própria página pública ou em ambos. A alteração do canal de exibição não transfere a titularidade do anúncio e não altera a responsabilidade da empresa pelo conteúdo publicado.
            </Term>
            <Term number="11" title="Moderação, denúncias e segurança">
              O PiraNegócios pode analisar denúncias e sinais de risco, solicitar informações, restringir alcance, pausar ou remover anúncios e limitar contas quando necessário para aplicar estes termos, cumprir obrigações legais ou proteger a comunidade. Medidas automatizadas podem ser complementadas por revisão humana quando aplicável.
            </Term>
            <Term number="12" title="Atualizações destes termos">
              Estes termos podem ser atualizados. Quando uma nova versão exigir novo consentimento, o PiraNegócios poderá solicitar outro aceite antes de permitir novas publicações ou outras ações do marketplace. O sistema registra a versão aceita e a data do consentimento.
            </Term>
          </div>

          <div className="mt-10 rounded-[24px] bg-stone-950 p-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><p className="text-sm font-black">Estes termos são específicos dos Classificados</p><p className="mt-1 text-xs leading-5 text-white/55">Os termos gerais e demais políticas do PiraNegócios continuam aplicáveis.</p></div></div>
            <Link to="/termos" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2.5 text-xs font-black text-stone-950 sm:mt-0">Ver termos gerais</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-stone-700 shadow-sm">{icon}</span><p className="mt-3 text-sm font-black">{title}</p><p className="mt-1 text-xs leading-5 text-stone-500">{text}</p></div>;
}

function Term({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <section><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fff0e8] text-xs font-black text-[#a84f34]">{number}</span><div><h2 className="text-base font-black text-stone-900">{title}</h2><p className="mt-1">{children}</p></div></div></section>;
}
