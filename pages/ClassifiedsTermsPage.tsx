import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Gavel, ShieldCheck, Store, User } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { SeoHead } from '../components/SeoHead';

const VERSION = '26 de agosto de 2026';

export default function ClassifiedsTermsPage() {
  return (
    <div className="min-h-screen bg-[#f7f5f2] text-stone-900">
      <SeoHead
        title="Termos de Uso do Marketplace | PiraNegócios"
        description="Regras para compra, venda, serviços, ofertas, leilões, pagamentos, verificação cadastral e intermediação no Marketplace PiraNegócios."
        canonical={`${window.location.origin}/classificados/termos`}
      />
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-black/[.06] sm:p-10">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">PiraNegócios Marketplace</p>
          <h1 className="mt-2 font-serif text-4xl font-black tracking-[-.035em] sm:text-5xl">Termos do Marketplace</h1>
          <p className="mt-3 text-sm leading-6 text-stone-500">Versão vigente: {VERSION}. Estes termos complementam os Termos de Uso gerais e disciplinam o Marketplace, inclusive anúncios, leilões, pagamentos online, avaliações e verificação cadastral.</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            <InfoCard icon={<User className="h-5 w-5" />} title="Pessoa" text="Comprar é livre; publicar exige identidade cadastral aprovada." />
            <InfoCard icon={<Store className="h-5 w-5" />} title="Empresa" text="Marketplace empresarial usa empresa verificada e vínculo autorizado." />
            <InfoCard icon={<BadgeCheck className="h-5 w-5" />} title="Verificação" text="Selfie, documento e endereço são analisados para reduzir fraude e abuso." />
            <InfoCard icon={<Gavel className="h-5 w-5" />} title="Leilões" text="Lances têm compromisso e regras próprias de encerramento e pagamento." />
          </div>

          <div className="mt-9 space-y-8 text-sm leading-7 text-stone-700">
            <Term number="1" title="Papel do PiraNegócios">
              O PiraNegócios fornece tecnologia para publicação, descoberta, comunicação, intermediação digital e, quando habilitado, integração de pagamentos entre compradores e vendedores. Salvo quando uma funcionalidade ou obrigação legal determinar o contrário, o PiraNegócios não é fabricante, proprietário do item, prestador do serviço, transportador ou garantidor do cumprimento material da oferta pelo vendedor.
            </Term>
            <Term number="2" title="Carreira, Recrutamento e Marketplace">
              A conta pessoal pode usar recursos de Carreira e Marketplace. Empresas possuem perfil empresarial único, podendo usar módulos de Recrutamento e Marketplace de acordo com permissões, planos e elegibilidade. Dados empresariais comuns, como nome, endereço e contatos, pertencem ao perfil unificado da empresa; configurações específicas de pagamento permanecem no módulo Marketplace.
            </Term>
            <Term number="3" title="Verificação cadastral para vender">
              Comprar, pesquisar e navegar não exige verificação documental do comprador. Para publicar produtos ou serviços, a pessoa vendedora deve concluir a verificação cadastral exigida pelo PiraNegócios, que pode incluir selfie atual, documento oficial de identificação, comprovante de endereço e outros documentos razoavelmente necessários. A análise inicial é manual e pode levar até 48 horas. A aprovação da identidade não representa garantia de idoneidade, qualidade, solvência ou cumprimento futuro da negociação.
            </Term>
            <Term number="4" title="Verificação empresarial e representante">
              A empresa deve atender às regras de verificação empresarial aplicáveis. O administrador principal responsável pela validação cadastral da empresa deve declarar vínculo de sócio ou representante com poderes para agir em nome dela e fornecer os documentos exigidos. Outros sócios e beneficiários finais podem ser declarados para fins de compliance e prevenção a fraude. Confirmação documental individual de outros sócios poderá ser solicitada quando houver fundamento legal, regulatório, contratual com o provedor de pagamentos ou risco específico que justifique a medida.
            </Term>
            <Term number="5" title="Prazo de regularização empresarial">
              Empresa já verificada pode receber prazo de até 15 dias para que o administrador principal envie sua validação pessoal e de vínculo. O envio dentro do prazo mantém a operação enquanto a análise estiver pendente. Se o prazo terminar sem regularização, a empresa poderá ser suspensa, e anúncios, vagas e página pública poderão ser retirados do ar até a regularização. A restauração preservará, quando tecnicamente possível, apenas conteúdos que tenham sido suspensos pelo próprio mecanismo de compliance e que continuem elegíveis.
            </Term>
            <Term number="6" title="Proteção dos documentos de verificação">
              Documentos de identidade e comprovantes utilizados na verificação não são publicados no Marketplace. O PiraNegócios aplica controles de acesso, criptografia em repouso e transmissão protegida, trilha de auditoria e armazenamento separado das áreas públicas do site. Selfie ou outros elementos biométricos, quando tratados para identificação, recebem proteção compatível com dados pessoais sensíveis. Nenhum sistema é absolutamente imune a incidentes; por isso aplicamos medidas técnicas e administrativas proporcionais ao risco e mantemos políticas de resposta a incidentes.
            </Term>
            <Term number="7" title="Finalidade, retenção e atendimento de autoridades">
              Os dados de verificação são tratados para segurança das intermediações, prevenção e investigação de fraude, controle de acesso, exercício regular de direitos, cumprimento de obrigações legais ou regulatórias aplicáveis e defesa em procedimentos administrativos, arbitrais ou judiciais. Informações poderão ser preservadas ou fornecidas a autoridades públicas quando houver obrigação legal, ordem válida ou outra base jurídica aplicável, sempre nos limites necessários. O aceite destes termos não autoriza divulgação indiscriminada dos documentos.
            </Term>
            <Term number="8" title="Responsabilidade pelo anúncio">
              Quem publica é responsável pela veracidade de título, descrição, imagens, preço, condição, disponibilidade, localização, características, estoque e demais informações. Empresas que oferecem retirada podem exibir ao comprador o endereço comercial cadastrado. Para vendedores particulares, endereço completo e coordenadas exatas podem permanecer privados e ser usados somente para segurança, logística e recursos de proximidade.
            </Term>
            <Term number="9" title="Produtos, serviços e conteúdo proibido">
              Não é permitido anunciar itens, serviços ou conteúdos cuja oferta, posse, comercialização ou divulgação viole a legislação aplicável, direitos de terceiros ou políticas do PiraNegócios. Também são proibidos anúncios fraudulentos, enganosos, falsificados, discriminatórios, que promovam golpes ou tentem contornar medidas de segurança. O PiraNegócios pode remover, limitar, suspender ou encaminhar conteúdo e contas para revisão.
            </Term>
            <Term number="10" title="Chat, ofertas e histórico de negociação">
              O chat interno pode registrar mensagens, ofertas, aceite, recusa, retirada, negociação de entrega e demais eventos relacionados ao anúncio. Esses registros podem ser mantidos para continuidade da negociação, suporte, segurança e exercício regular de direitos. Em uma empresa, administradores e colaboradores autorizados podem acessar conversas empresariais de acordo com suas permissões.
            </Term>
            <Term number="11" title="Pagamento online e taxa de intermediação">
              Quando o vendedor habilita pagamento online, o processamento financeiro é realizado pelo provedor de pagamento conectado, como Mercado Pago, sob as regras e disponibilidade técnica daquele provedor. O PiraNegócios pode cobrar taxa de intermediação configurada por plano, contrato ou modalidade. A taxa de intermediação do pagamento de uma venda normal e a taxa de intermediação aplicável a um arremate podem ter percentuais distintos. O valor, percentual ou critério aplicável deve ser informado antes da conclusão do pagamento. Tarifas próprias do provedor de pagamento são independentes da taxa de intermediação do PiraNegócios.
            </Term>
            <Term number="12" title="Leilões e compromisso do lance">
              Empresas elegíveis podem abrir leilões com lance inicial, incremento mínimo, horário de início e encerramento. O período programado deve respeitar a duração mínima definida pela plataforma. Lances válidos representam compromisso sério de compra pelo valor ofertado. Mecanismos de extensão do encerramento podem ser usados para impedir vantagem artificial de lances enviados nos segundos finais. Descumprimento injustificado de arremate pode gerar restrições de conta conforme as regras vigentes.
            </Term>
            <Term number="13" title="Taxa de intermediação em leilões">
              Quando a empresa optar por repassar ao arrematante a taxa de intermediação do leilão, a sala deve informar previamente, de forma discreta e acessível, que ao valor final do arremate será acrescida a taxa percentual vigente conforme estes termos. Durante os lances, o PiraNegócios não precisa recalcular e exibir em tempo real o valor monetário da taxa. O cálculo em reais é apresentado ao vencedor após o encerramento, antes da finalização do pagamento. Eventual frete ou entrega negociada não integra a base da taxa de intermediação do arremate, salvo regra expressa diferente devidamente informada.
            </Term>
            <Term number="14" title="Entrega, retirada e endereço comercial">
              O vendedor pode oferecer entrega, retirada, ambas ou condição a combinar. O PiraNegócios não calcula automaticamente frete nesta versão. Empresas que habilitam retirada autorizam a exibição do endereço comercial cadastrado ao comprador quando necessário para a operação. Em caso de entrega, as partes devem confirmar valor, prazo, responsável e demais condições antes da conclusão da negociação.
            </Term>
            <Term number="15" title="Avaliações verificadas">
              Compradores de operações elegíveis podem avaliar produto, atendimento e empresa. Avaliações podem conter comentário e fotos opcionais, passam por moderação automatizada e/ou humana e podem ser publicadas somente após o período de retenção definido pela plataforma. A identidade pública do avaliador pode permanecer oculta, sendo exibida apenas a indicação de compra verificada. Críticas legítimas não são proibidas; conteúdo abusivo, ameaçador, discriminatório, que exponha dados pessoais ou viole as políticas pode ser rejeitado.
            </Term>
            <Term number="16" title="Moderação, denúncias e segurança">
              O PiraNegócios pode analisar denúncias e sinais de risco, solicitar informações adicionais, restringir alcance, pausar ou remover anúncios, limitar pagamentos e suspender contas quando necessário para aplicar estes termos, cumprir obrigações legais ou proteger usuários e a própria plataforma. Medidas automatizadas podem ser complementadas por revisão humana.
            </Term>
            <Term number="17" title="Atualizações destes termos">
              Estes termos podem ser atualizados. Quando uma nova versão alterar de forma relevante a verificação, pagamentos, taxas ou obrigações de vendedores, o PiraNegócios poderá exigir novo aceite antes de permitir novas publicações ou operações. O sistema registra versão e data do consentimento quando aplicável.
            </Term>
          </div>

          <div className="mt-10 rounded-[24px] bg-stone-950 p-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><p className="text-sm font-black">Termos específicos do Marketplace</p><p className="mt-1 text-xs leading-5 text-white/55">Termos gerais, Política de Privacidade e regras do provedor de pagamento continuam aplicáveis.</p></div></div>
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
