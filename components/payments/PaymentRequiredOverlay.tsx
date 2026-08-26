import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  cancelInlinePayment,
  completeInlinePayment,
  getInlinePaymentRequirement,
  subscribeInlinePayment,
} from '../../lib/paymentRequiredCoordinator';
import { PaymentCheckoutModal } from './PaymentCheckoutModal';

export function PaymentRequiredOverlay() {
  const [requirement, setRequirement] = useState(getInlinePaymentRequirement());

  useEffect(() => subscribeInlinePayment(setRequirement), []);

  const product = requirement?.product || {};
  const amountCents = Number.isFinite(Number(product?.effectivePriceCents))
    ? Number(product.effectivePriceCents)
    : Number.isFinite(Number(product?.priceCents))
      ? Number(product.priceCents)
      : null;

  return (
    <PaymentCheckoutModal
      key={requirement?.key || 'no-inline-payment'}
      open={Boolean(requirement)}
      onClose={cancelInlinePayment}
      title={product?.name || 'Continuar com este recurso'}
      description={requirement?.message || product?.description || 'Conclua o pagamento e a ação que você tentou será retomada automaticamente.'}
      amountCents={amountCents}
      confirmLabel="Gerar Pix e continuar"
      createCheckout={() => api.post('/payments/pix', { productCode: requirement?.productCode })}
      onCompleted={async () => {
        window.dispatchEvent(new Event('piranegocios:payment-completed'));
        completeInlinePayment();
      }}
    />
  );
}

export default PaymentRequiredOverlay;
