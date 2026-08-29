import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Gavel, MapPin, PackageCheck, ShieldCheck, Store, User } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { SeoHead } from '../components/SeoHead';

const VERSION = '28 de agosto de 2026';

export default function ClassifiedsTermsPage() {
  return (
    <div className="min-h-screen bg-[#f7f5f2] text-stone-900">
      <SeoHead
        title="Termos de Uso do Marketplace | PiraNegócios"
        description="Regras para compra, venda, serviços, carrinho, entregas, orçamentos, leilões, pagamentos, verificação cadastral e intermediação no Marketplace PiraNegócios."
        canonical={`${window.location.origin}/classificados/termos`}
      />
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-black/[.06] sm:p-10">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">PiraNegócios Marketplace</p>
          <h1 className="mt-2 font-serif text-4xl font-black tracking-[-.035em] sm:text-5xl">Termos do Marketplace</h1>
          <p className="mt-3 text-sm leading-6 text-stone-500">Versão vigente: {VERSION}. Estes termos complementam os Termos de Uso gerais e disciplinam o Marketplace, inclusive anúncios, carrinho, pagamentos, entregas, propostas de serviços, leilões, avaliações e verificação cadastral.</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-5">
            <InfoCard icon={<User className="h-5 w-5" />} title="Pessoa" text="Compra, salva endereços e acompanha pedidos pela própria conta." />
            <InfoCard icon={<Store className="h-5 w-5" />} title="Empresa" text="Opera catálogo, pagamentos e logística com empresa verificada." />
            <InfoCard icon={<MapPin className="h-5 w-5" />} title="Entrega" text="Frete pode usar retirada, entrega própria ou parceiros habilitados." />
            <InfoCard icon={<PackageCheck className="h-5 w-5" />} title="Histórico" text="Pedido e cotação preservam snapshots financeiros e logísticos." />
            <InfoCard icon={<Gavel className="h-5 w-5" />} title="Leilões" text="Lances têm compromisso e regras próprias de encerramento e pagamento." />
          </div>

          <div className="mt-9 space-y-8 text-sm leading-7 text-stone-700">
            <Term number="1" title="Papel do PiraNegócios">
              O PiraNegócios fornece tecnologia para publicação, descoberta, comunicação, intermediação digital, pagamentos e recursos de logística. Salvo quando uma funcionalidade ou obrigação legal determinar o contrário, o PiraNegócios não é fabricante, proprietário do item, prestador do serviço nem vendedor da oferta publicada por terceiros. Quando houver parceiro de entrega, o PiraNegócios organiza a contratação tecnológica e os registros operacionais sem transformar a plataforma em fabricante ou vendedora do produto transportado.
            </Term>
            <Term number="2" title="Carreira, Recrutamento e Marketplace">
              A conta pessoal pode usar recursos de Carreira e Marketplace. Empresas possuem perfil empresarial único, podendo usar módulos de Recrutamento e Marketplace de acordo com permissões, planos e elegibilidade. Dados empresariais comuns pertencem ao perfil unificado da empresa; configurações específicas de comércio, pagamento e logística permanecem no módulo Marketplace.
            </Term>
            <Term number="3" title="Verificação cadastral para vender">
              Comprar, pesquisar e navegar não exige verificação documental do comprador. Para publicar produtos ou serviços, a pessoa vendedora deve concluir a verificação cadastral exigida pelo PiraNegócios, que pode incluir selfie atual, documento oficial de identificação, comprovante de endereço e outros documentos razoavelmente necessários. A aprovação da identidade não representa garantia de idoneidade, qualidade, solvência ou cumprimento futuro da negociação.
            </Term>
            <Term number="4" title="Verificação empresarial e representante">
              A empresa deve atender às regras de verificação empresarial aplicáveis. O administrador principal responsável pela validação cadastral deve declarar vínculo de sócio ou representante com poderes para agir em nome dela e fornecer os documentos exigidos. Outros sócios e beneficiários finais podem ser declarados para fins de compliance e prevenção a fraude.
            </Term>
            <Term number="5" title="Proteção e finalidade dos dados de verificação">
              Documentos de identidade, comprovantes e elementos de verificação não são publicados no Marketplace. Esses dados são tratados para segurança das intermediações, prevenção e investigação de fraude, controle de acesso, exercício regular de direitos e cumprimento de obrigações aplicáveis. Informações poderão ser preservadas ou fornecidas a autoridades públicas quando houver fundamento jurídico válido, nos limites necessários.
            </Term>
            <Term number="6" title="Responsabilidade pelo anúncio e estoque">
              Quem publica é responsável pela veracidade de título, descrição, imagens, preço, condição, disponibilidade, localização, características, estoque, peso, dimensões e demais informações. O servidor pode revalidar preço, disponibilidade, regras comerciais, estoque e entrega antes de criar um pagamento. A exibição de um item no carrinho não garante reserva até que o fluxo de checkout efetivamente faça a reserva prevista pelo sistema.
            </Term>
            <Term number="7" title="Configuração comercial e herança">
              Empresas podem definir regras comerciais globais para pagamento, retirada, entrega, estoque e outras condições. Produtos podem herdar essas regras ou utilizar exceções explícitas quando a funcionalidade permitir. Alterar a configuração atual não modifica automaticamente pedidos, cotações, corridas ou propostas que já tenham sido registrados com snapshot próprio.
            </Term>
            <Term number="8" title="Carrinho por empresa">
              Um carrinho de compra reúne produtos de uma única empresa. Ao tentar adicionar produto de outra empresa, o comprador deverá concluir, abandonar ou substituir o carrinho atual. Essa limitação existe para preservar uma única origem comercial, regras de estoque, retirada, entrega, pagamento e repasse por pedido.
            </Term>
            <Term number="9" title="Endereços e locais de atendimento">
              O comprador pode cadastrar mais de um endereço, definir um endereço padrão e desativar endereços antigos. Empresas podem cadastrar locais de retirada e origens de entrega. Endereços utilizados em pedido ou cotação podem ser preservados como snapshot histórico mesmo que o cadastro original seja posteriormente alterado ou desativado. Coordenadas e identificadores de local são usados somente quando necessários para logística, segurança ou cálculo de elegibilidade e distância.
            </Term>
            <Term number="10" title="Pagamento online e cobrança única" anchor="pagamentos-online">
              Quando o vendedor habilita pagamento online, o processamento financeiro é realizado pelo provedor conectado, como Mercado Pago. Em pedidos elegíveis, itens, frete e eventual taxa explicitamente apresentada ao comprador integram uma única cobrança. O comprador não deve ser submetido a uma segunda cobrança automática do PiraNegócios apenas para completar o mesmo pedido.
            </Term>
            <Term number="11" title="Comissão, application fee e tarifas do provedor">
              O valor destinado ao PiraNegócios no pagamento pode incluir a comissão de intermediação e, quando aplicável, o valor de frete que a plataforma deverá posteriormente liquidar com o parceiro logístico. Essa parcela de frete constitui obrigação de repasse e não é tratada como receita definitiva da plataforma. Tarifas próprias do provedor de pagamento são independentes da comissão do PiraNegócios. O pedido registra os componentes financeiros em centavos e preserva o snapshot utilizado no momento da cobrança.
            </Term>
            <Term number="12" title="Retirada, entrega própria e parceiros da plataforma">
              A empresa pode disponibilizar retirada, entrega própria e parceiros de entrega habilitados. As opções apresentadas dependem de cidade, origem, destino, peso, dimensões, modalidade, disponibilidade e regras vigentes. Um produto pode ser inelegível para determinado parceiro, inclusive por excesso de peso, tamanho, volume, manuseio especial ou restrição configurada pela empresa.
            </Term>
            <Term number="13" title="Cotação e validade do frete">
              A cotação de entrega é calculada pelo servidor a partir das regras vigentes e possui validade limitada. O preço de frete enviado pelo navegador não é aceito como fonte financeira confiável. Quando uma cotação é escolhida e o pedido é criado, o sistema preserva a versão da regra, o preço e os dados relevantes em snapshot. Alterações futuras na tabela do parceiro não reescrevem o valor histórico daquele pedido.
            </Term>
            <Term number="14" title="Despacho e acompanhamento da corrida">
              Após a operação ficar elegível para despacho, a empresa pode chamar o parceiro e registrar aceite, coleta, trânsito, entrega, cancelamento ou problema. Mensagens por WhatsApp ou outros canais são apoio operacional; o estado oficial da corrida é o registrado no PiraNegócios, com data, ator e trilha de eventos. Dados compartilhados com o parceiro devem se limitar ao necessário para coleta, entrega e suporte da corrida.
            </Term>
            <Term number="15" title="Saldo, fatura e repasse do parceiro">
              Quando o frete não tiver sido incluído no pagamento online, a empresa poderá usar saldo pré-pago ou receber cobrança de logística conforme a modalidade habilitada. Corridas faturadas podem gerar cobrança com vencimento informado pelo sistema, inicialmente prevista para 24 horas. A conclusão de uma corrida cria registros financeiros de obrigação e liquidação. Ajustes devem ocorrer por novos lançamentos, sem apagar ou reescrever o histórico financeiro anterior.
            </Term>
            <Term number="16" title="Orçamentos consultivos de serviços">
              Para serviços habilitados, o cliente pode enviar uma solicitação com escopo e anexos permitidos. A empresa pode criar propostas com valor, itens, prazo, condições e validade. Cada nova proposta é registrada como versão própria. Versões anteriores permanecem no histórico e não são sobrescritas pela negociação posterior.
            </Term>
            <Term number="17" title="Validade e aceite de propostas">
              Proposta expirada não pode ser aprovada sem nova versão válida. O aceite vincula a contratação à versão efetivamente aceita e preserva um snapshot do escopo e das condições. O cliente pode reprovar ou pedir ajuste enquanto o estado da negociação permitir. Pagamentos futuros de serviços deverão referenciar a contratação e sua versão, sem substituir o histórico da proposta.
            </Term>
            <Term number="18" title="Chat, ofertas e histórico de negociação">
              O chat interno pode registrar mensagens, ofertas, aceite, recusa, retirada, negociação de entrega, pedidos de ajuste de orçamento e outros eventos relacionados. Esses registros podem ser mantidos para continuidade da negociação, suporte, segurança e exercício regular de direitos. Em uma empresa, administradores e colaboradores autorizados podem acessar conversas empresariais de acordo com suas permissões.
            </Term>
            <Term number="19" title="Leilões e compromisso do lance">
              Empresas elegíveis podem abrir leilões com lance inicial, incremento mínimo, horário de início e encerramento. Lances válidos representam compromisso sério de compra pelo valor ofertado. Mecanismos de extensão do encerramento podem ser usados para reduzir vantagem artificial de lances enviados nos segundos finais. Taxas e condições aplicáveis ao arremate devem ser informadas no fluxo correspondente.
            </Term>
            <Term number="20" title="Avaliações, moderação e segurança">
              Compradores de operações elegíveis podem avaliar produto, atendimento e empresa. O PiraNegócios pode analisar denúncias e sinais de risco, solicitar informações adicionais, restringir alcance, pausar ou remover anúncios, limitar pagamentos e suspender contas quando necessário para aplicar estes termos, cumprir obrigações aplicáveis ou proteger usuários e a própria plataforma.
            </Term>
            <Term number="21" title="Atualizações destes termos">
              Estes termos podem ser atualizados. Quando uma nova versão alterar de forma relevante pagamentos, taxas, logística, tratamento de endereços ou obrigações de compradores e vendedores, o PiraNegócios poderá exigir novo aceite antes de novas operações. O sistema registra versão e data do consentimento quando aplicável.
            </Term>
          </div>

          <div className="mt-10 rounded-[24px] bg-stone-950 p-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><p className="text-sm font-black">Termos específicos do Marketplace</p><p className="mt-1 text-xs leading-5 text-white/55">Termos gerais, Política de Privacidade e regras do provedor de pagamento continuam aplicáveis.</p></div></div>
            <Link to="/termos" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2.5 text-xs font-black text-stone-950 sm:mt-0">Ver termos gerais e privacidade</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-stone-700 shadow-sm">{icon}</span><p className="mt-3 text-sm font-black">{title}</p><p className="mt-1 text-xs leading-5 text-stone-500">{text}</p></div>;
}

function Term({ number, title, anchor, children }: { number: string; title: string; anchor?: string; children: React.ReactNode }) {
  return <section id={anchor}><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fff0e8] text-xs font-black text-[#a84f34]">{number}</span><div><h2 className="text-base font-black text-stone-900">{title}</h2><p className="mt-1">{children}</p></div></div></section>;
}
