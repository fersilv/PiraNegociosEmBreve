import React, { useEffect, useId } from 'react';
import { CheckCircle2, ExternalLink, ShieldCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CLASSIFIEDS_PAYMENT_TERMS_VERSION = '2026-08-26';

export function ClassifiedMarketplaceTermsModal({
  open,
  mode,
  working = false,
  accepted = false,
  onClose,
  onAccept,
}: {
  open: boolean;
  mode: 'BUYER' | 'SELLER';
  working?: boolean;
  accepted?: boolean;
  onClose: () => void;
  onAccept?: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !working) onClose(); };
    window.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', close);
    };
  }, [open, working, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation">
      <button type="button" aria-label="Fechar termos" onClick={() => !working && onClose()} className="absolute inset-0" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[30px] bg-white shadow-2xl sm:rounded-[30px]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-5 sm:px-7">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff0e8] text-[#a84f34]"><ShieldCheck className="h-5 w-5" /></span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.16em] text-[#b06448]">Classificados + pagamentos online</p>
              <h2 id={titleId} className="mt-1 font-serif text-2xl font-black text-stone-950">Termos da compra e venda no marketplace</h2>
              <p id={descriptionId} className="mt-1 text-xs leading-5 text-stone-500">Versão {CLASSIFIEDS_PAYMENT_TERMS_VERSION}. Leia antes de {mode === 'SELLER' ? 'habilitar recebimentos online' : 'concluir o pagamento'}.</p>
            </div>
          </div>
          <button type="button" disabled={working} onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 disabled:opacity-50" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </header>

        <div className="overflow-y-auto px-5 py-5 text-sm leading-6 text-stone-700 sm:px-7">
          <div className="space-y-5">
            <Term title="O papel do PiraNegócios">O PiraNegócios fornece a tecnologia do marketplace, registro da negociação e integração de pagamento. O produto ou serviço é ofertado pelo anunciante. O PiraNegócios não se torna fabricante, vendedor, transportador ou prestador apenas por disponibilizar o checkout.</Term>
            <Term title="Responsabilidade de quem vende">O anunciante responde pela legitimidade da oferta, propriedade ou autorização para vender, descrição, preço, estoque, qualidade, tributos, nota fiscal quando aplicável, retirada, entrega, garantia e cumprimento das obrigações legais perante o comprador.</Term>
            <Term title="Responsabilidade de quem compra">O comprador deve conferir descrição, quantidade, forma de recebimento e dados informados antes de pagar. Em retirada presencial, deve verificar o item quando isso for razoavelmente possível.</Term>
            <Term title="Pagamento e comissão da plataforma">O pagamento online é processado pelo provedor indicado na tela, atualmente Mercado Pago quando habilitado pela empresa. A conta recebedora pertence ao vendedor e o PiraNegócios pode receber uma comissão de plataforma por meio do split previsto na integração. Isso não transforma automaticamente o pagamento em escrow, custódia ou garantia de entrega.</Term>
            <Term title="Entrega, retirada e frete">A modalidade exibida no anúncio pode ser A combinar, Retirada, Entrega ou uma combinação dessas opções. Enquanto não houver cálculo de frete dentro da plataforma, custo, área atendida, prazo e demais condições de entrega devem ser informados e combinados pelo vendedor com o comprador.</Term>
            <Term title="Cancelamento, estorno e disputa">Cancelamentos, estornos, chargebacks e disputas podem envolver o vendedor, o comprador, o provedor de pagamento e o PiraNegócios conforme o estágio da transação e a legislação aplicável. Nenhuma cláusula destes termos elimina direitos obrigatórios previstos em lei.</Term>
            <Term title="Prevenção a fraude e segurança">O PiraNegócios pode limitar anúncios, pagamentos, leilões, contas ou recursos quando houver sinais de fraude, abuso, inconsistência, risco operacional ou obrigação legal, inclusive para preservar evidências e permitir análise.</Term>
            <Term title="Dados usados na negociação">Dados de contato e informações necessárias ao pedido podem ser disponibilizados entre as partes na medida necessária para pagamento, retirada, entrega, suporte e resolução da negociação. Endereço exato usado apenas para proximidade não é publicado no anúncio Personal.</Term>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
            Estes termos delimitam os papéis de cada participante, mas não afastam obrigações legais que sejam obrigatórias para o PiraNegócios, para o anunciante ou para o provedor de pagamento.
          </div>
          <Link to="/classificados/termos#pagamentos-online" target="_blank" className="mt-5 inline-flex items-center gap-2 text-xs font-black text-[#a84f34] underline">Abrir termos completos em outra aba <ExternalLink className="h-3.5 w-3.5" /></Link>
        </div>

        <footer className="border-t border-stone-100 bg-[#fffdfa] p-4 sm:px-7 sm:py-5">
          {accepted ? <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Termos aceitos nesta versão</div> : onAccept ? <button type="button" disabled={working} onClick={onAccept} className="flex h-12 w-full items-center justify-center rounded-2xl bg-stone-950 px-5 text-sm font-black text-white disabled:opacity-50">{working ? 'Registrando aceite...' : mode === 'SELLER' ? 'Li e aceito para vender online' : 'Li e aceito para comprar online'}</button> : null}
        </footer>
      </section>
    </div>
  );
}

function Term({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="font-black text-stone-950">{title}</h3><p className="mt-1">{children}</p></section>;
}
