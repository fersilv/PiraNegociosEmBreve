import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAiStatus } from '../../hooks/useAiStatus';
import { PaymentCheckoutModal } from './PaymentCheckoutModal';

const SCORE_BUTTON_TEXT = 'Quero ver minha pontuação';

function scoreButton() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => button.textContent?.trim() === SCORE_BUTTON_TEXT) || null;
}

export function ResumeScorePaymentBridge() {
  const status = useAiStatus();
  const [open, setOpen] = useState(false);
  const bypassNextClick = useRef(false);

  useEffect(() => {
    const capture = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('button') : null;
      if (!(target instanceof HTMLButtonElement)) return;
      if (target.textContent?.trim() !== SCORE_BUTTON_TEXT) return;
      if (bypassNextClick.current) {
        bypassNextClick.current = false;
        return;
      }
      if (!status.resumeScorePaymentRequired) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setOpen(true);
    };

    document.addEventListener('click', capture, true);
    return () => document.removeEventListener('click', capture, true);
  }, [status.resumeScorePaymentRequired]);

  const resumeOriginalAction = async () => {
    window.dispatchEvent(new Event('piranegocios:payment-completed'));

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const response = await api.get('/ai/status');
        if (response.data?.resumeScorePaymentRequired !== true) break;
      } catch {
        // Tenta novamente; a confirmação do pagamento já é persistida no backend.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }

    setOpen(false);
    window.dispatchEvent(new Event('piranegocios:payment-completed'));
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const button = scoreButton();
    if (button) {
      bypassNextClick.current = true;
      button.click();
    }
  };

  return (
    <PaymentCheckoutModal
      open={open}
      onClose={() => setOpen(false)}
      title="Análise profissional do currículo"
      description="Adquira um crédito de análise e continue exatamente de onde parou."
      amountCents={status.resumeReanalysisPriceCents}
      confirmLabel="Gerar Pix e analisar"
      createCheckout={() => api.post('/payments/pix', { productCode: 'RESUME_REANALYSIS' })}
      onCompleted={resumeOriginalAction}
    />
  );
}

export default ResumeScorePaymentBridge;
