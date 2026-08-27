const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const requiredFiles = [
  'App.tsx',
  'components/WorkspaceLayout.tsx',
  'components/payments/PaymentCheckoutModal.tsx',
  'pages/UserPaymentsPage.tsx',
  'pages/AdminPaymentsPage.tsx',
  'pages/ClassifiedsWorkspacePage.tsx',
  'backend/src/classifieds/classifieds-auction.service.ts',
  'backend/src/classifieds/classifieds-checkout.service.ts',
  'backend/src/payments/payments.controller.ts',
  'backend/src/payments/payment-provider-public.controller.ts',
  'backend/src/payments/payment-provider-manager.service.ts',
  'backend/src/payments/commercial-payments.controller.ts',
  'backend/src/payments/commercial-payments.service.ts',
  'backend/src/payments/payment-checkout-status.controller.ts',
  'backend/src/payments/payment-checkout-status.service.ts',
  'backend/migrations/20260827_payment_commercial_modes.sql',
  'backend/src/chat/chat.gateway.ts',
];

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Build input ausente: ${relativePath}`);
  }
}

const auctionService = fs.readFileSync(
  path.join(root, 'backend/src/classifieds/classifieds-auction.service.ts'),
  'utf8',
);
const softCloseDeclarations = auctionService.match(
  /const\s+SOFT_CLOSE_SECONDS\s*=/g,
)?.length;
if (softCloseDeclarations !== 1) {
  throw new Error(
    `SOFT_CLOSE_SECONDS deve possuir uma declaração; encontradas ${softCloseDeclarations || 0}.`,
  );
}

const paymentModal = fs.readFileSync(
  path.join(root, 'components/payments/PaymentCheckoutModal.tsx'),
  'utf8',
);
if (!paymentModal.includes("createPortal(modal, document.body)")) {
  throw new Error('PaymentCheckoutModal precisa renderizar por Portal no document.body.');
}

const tracksCheckoutId = paymentModal.includes('/payments/${checkout.id}/status');
const tracksNormalizedPaymentId =
  paymentModal.includes("const paymentId = String(checkout?.paymentId || checkout?.id || '').trim()")
  && paymentModal.includes('/payments/${paymentId}/status');

if (!tracksCheckoutId && !tracksNormalizedPaymentId) {
  throw new Error('PaymentCheckoutModal precisa acompanhar a mesma cobrança pelo endpoint de status.');
}
if (!paymentModal.includes("socket.on('payment:updated'")) {
  throw new Error('PaymentCheckoutModal precisa receber atualizações de pagamento em tempo real.');
}

const paymentStatusController = fs.readFileSync(
  path.join(root, 'backend/src/payments/payment-checkout-status.controller.ts'),
  'utf8',
);
if (!paymentStatusController.includes("@Get(':paymentId/status')")) {
  throw new Error('Endpoint autenticado de status do checkout não encontrado.');
}

const paymentsController = fs.readFileSync(
  path.join(root, 'backend/src/payments/payments.controller.ts'),
  'utf8',
);
if (!paymentsController.includes('paymentId,') || !paymentsController.includes('checkoutStatus.watchForUser')) {
  throw new Error('Checkout Pix legado precisa devolver paymentId explícito e iniciar o acompanhamento realtime.');
}
if (!paymentsController.includes("@Get('provider')") || !paymentsController.includes('publicRoutes()')) {
  throw new Error('/payments/provider precisa devolver as rotas públicas por tipo de pagamento.');
}

const providerPublicController = fs.readFileSync(
  path.join(root, 'backend/src/payments/payment-provider-public.controller.ts'),
  'utf8',
);
if (providerPublicController.includes("@Get('provider')")) {
  throw new Error('Não pode existir um segundo GET /payments/provider concorrendo com o endpoint de rotas.');
}
if (!providerPublicController.includes("@Get('provider-summary')")) {
  throw new Error('Resumo dos provedores ativos precisa usar /payments/provider-summary.');
}

const providerManager = fs.readFileSync(
  path.join(root, 'backend/src/payments/payment-provider-manager.service.ts'),
  'utf8',
);
if (!providerManager.includes("paymentType === 'PIX_AUTOMATICO' && !this.isNativeAutomaticPixProvider(active)")) {
  throw new Error('Checkout precisa bloquear provedor sem Pix Automático nativo.');
}
if (providerManager.includes('this.mercadoPago.createRecurringCheckout(')) {
  throw new Error('Mercado Pago Assinaturas não pode ser usado como implementação de PIX_AUTOMATICO.');
}
if (!providerManager.includes("Mercado Pago Assinaturas não é Pix Automático")) {
  throw new Error('Ativação administrativa precisa recusar Mercado Pago na rota Pix Automático.');
}

const commercialController = fs.readFileSync(
  path.join(root, 'backend/src/payments/commercial-payments.controller.ts'),
  'utf8',
);
if (!commercialController.includes("@Get('catalog')") || !commercialController.includes("@Post('checkout')")) {
  throw new Error('API comercial precisa expor catálogo e checkout por modalidade.');
}
if (!commercialController.includes("@Controller('admin/payments/commercial-products')")) {
  throw new Error('Admin precisa possuir endpoint próprio para preços por modalidade.');
}

const commercialService = fs.readFileSync(
  path.join(root, 'backend/src/payments/commercial-payments.service.ts'),
  'utf8',
);
if (!commercialService.includes("purchaseMode === 'SUBSCRIPTION' ? 'RECURRING' : 'ONE_TIME'")) {
  throw new Error('Checkout comercial precisa derivar a rota de pagamento da modalidade escolhida.');
}
if (!commercialService.includes('subscriptionPriceCents') || !commercialService.includes('oneTimePriceCents')) {
  throw new Error('Produtos precisam possuir preços independentes de assinatura e compra avulsa.');
}

const userPayments = fs.readFileSync(path.join(root, 'pages/UserPaymentsPage.tsx'), 'utf8');
if (!userPayments.includes("api.get('/payments/commercial/catalog')") || !userPayments.includes("api.post('/payments/commercial/checkout'")) {
  throw new Error('Área financeira do usuário precisa usar o catálogo/checkout comercial por modalidade.');
}
if (!userPayments.includes("'SUBSCRIPTION'") || !userPayments.includes("'ONE_TIME'")) {
  throw new Error('Usuário precisa poder escolher assinatura ou compra avulsa.');
}

const adminPayments = fs.readFileSync(path.join(root, 'pages/AdminPaymentsPage.tsx'), 'utf8');
if (!adminPayments.includes('/admin/payments/commercial-products')) {
  throw new Error('Admin financeiro precisa configurar preços comerciais separados.');
}

const commercialMigration = fs.readFileSync(
  path.join(root, 'backend/migrations/20260827_payment_commercial_modes.sql'),
  'utf8',
);
if (!commercialMigration.includes('"purchaseMode"') || !commercialMigration.includes('"subscriptionPriceCents"') || !commercialMigration.includes('"oneTimePriceCents"')) {
  throw new Error('Migração comercial precisa persistir modalidade e os dois preços.');
}
if (!commercialMigration.includes('"paymentType" = \'PIX_AUTOMATICO\'') || !commercialMigration.includes('"providerCode" = \'MERCADO_PAGO\'')) {
  throw new Error('Migração precisa remover a rota legado Mercado Pago -> Pix Automático.');
}

const paymentStatusService = fs.readFileSync(
  path.join(root, 'backend/src/payments/payment-checkout-status.service.ts'),
  'utf8',
);
if (!paymentStatusService.includes("publishPaymentUpdate") || !paymentStatusService.includes('watchForUser')) {
  throw new Error('Serviço de checkout precisa publicar atualizações realtime da cobrança.');
}
if (!paymentStatusService.includes("payment.purchaseMode === 'SUBSCRIPTION'")) {
  throw new Error('Status do checkout precisa respeitar a modalidade escolhida na transação.');
}

const chatGateway = fs.readFileSync(
  path.join(root, 'backend/src/chat/chat.gateway.ts'),
  'utf8',
);
if (!chatGateway.includes("emit('payment:updated'")) {
  throw new Error('Gateway autenticado precisa publicar o evento payment:updated.');
}

console.log('Build inputs verified (read-only).');
