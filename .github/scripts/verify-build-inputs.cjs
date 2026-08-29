const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const requiredFiles = [
  'App.tsx',
  'components/WorkspaceLayout.tsx',
  'components/payments/PaymentCheckoutModal.tsx',
  'pages/UserPaymentsPage.tsx',
  'pages/CompanyPlansPage.tsx',
  'pages/AdminPaymentsPage.tsx',
  'pages/AdminClassifiedCommercePage.tsx',
  'pages/PaymentMethodsPage.tsx',
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
  'backend/src/company-plans/company-plan-benefits.ts',
  'backend/src/company-plans/company-plan-commerce.service.ts',
  'backend/src/company-plans/company-plans.service.ts',
  'backend/src/company-plans/company-plans.controller.ts',
  'backend/src/company-plans/company-plans-admin.controller.ts',
  'backend/migrations/20260827_payment_commercial_modes.sql',
  'backend/migrations/20260827_company_plan_commercial_modes.sql',
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
if (!paymentModal.includes('createPortal(modal, document.body)')) {
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
if (!providerManager.includes('Mercado Pago Assinaturas não é Pix Automático')) {
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
if (!commercialService.includes('subscriptionBenefits') || !commercialService.includes('oneTimeBenefits')) {
  throw new Error('Produtos precisam persistir benefícios independentes de assinatura e compra avulsa.');
}

const benefitCatalog = fs.readFileSync(
  path.join(root, 'backend/src/company-plans/company-plan-benefits.ts'),
  'utf8',
);
if (!benefitCatalog.includes('COMPANY_PLAN_BENEFIT_CATALOG') || !benefitCatalog.includes('defaultBenefitIdsForPlan')) {
  throw new Error('Planos empresariais precisam ter catálogo central de benefícios comerciais.');
}

const companyPlansService = fs.readFileSync(
  path.join(root, 'backend/src/company-plans/company-plans.service.ts'),
  'utf8',
);
if (!companyPlansService.includes('companyBenefitIds') || !companyPlansService.includes('COMPANY_PLAN_BENEFIT_NOT_INCLUDED')) {
  throw new Error('Autorização do plano precisa respeitar o snapshot de benefícios da modalidade comprada.');
}

const companyCommerce = fs.readFileSync(
  path.join(root, 'backend/src/company-plans/company-plan-commerce.service.ts'),
  'utf8',
);
if (!companyCommerce.includes("purchaseMode === 'SUBSCRIPTION' ? 'PIX_AUTOMATICO' : 'PIX'")) {
  throw new Error('Plano empresarial precisa escolher PIX_AUTOMATICO ou PIX pela modalidade comercial.');
}
if (!companyCommerce.includes("this.commercial.getProduct(PRODUCT_BY_PLAN[plan], false)")) {
  throw new Error('Checkout empresarial precisa usar os preços comerciais configurados para o plano.');
}
if (!companyCommerce.includes('lostComparedToSubscription') || !companyCommerce.includes('companyBenefitIds')) {
  throw new Error('Checkout empresarial precisa comparar e fotografar os benefícios da modalidade escolhida.');
}

const companyPlansController = fs.readFileSync(
  path.join(root, 'backend/src/company-plans/company-plans.controller.ts'),
  'utf8',
);
if (!companyPlansController.includes('purchaseMode?: PurchaseMode') || !companyPlansController.includes('this.commerce.createCheckout')) {
  throw new Error('/company/plans/checkout precisa aceitar assinatura ou compra avulsa.');
}

const companyPlansAdminController = fs.readFileSync(
  path.join(root, 'backend/src/company-plans/company-plans-admin.controller.ts'),
  'utf8',
);
if (!companyPlansAdminController.includes("@Get('benefit-catalog')")) {
  throw new Error('Admin precisa consultar o catálogo de benefícios dos planos.');
}

const companyPlansPage = fs.readFileSync(path.join(root, 'pages/CompanyPlansPage.tsx'), 'utf8');
if (!companyPlansPage.includes('purchaseMode: selection.purchaseMode')) {
  throw new Error('Tela de planos empresariais precisa enviar a modalidade selecionada ao checkout.');
}
if (!companyPlansPage.includes('Comprar avulso') || !companyPlansPage.includes('Assinar ${plan.name}')) {
  throw new Error('Planos empresariais precisam mostrar CTAs distintos para assinatura e compra avulsa.');
}
if (!companyPlansPage.includes('useFeedback') || !companyPlansPage.includes("toast(completedMode")) {
  throw new Error('Notificações da tela de planos precisam usar toast.');
}
if (companyPlansPage.includes('Gateway do Pix Automático') || companyPlansPage.includes('Gateway do Pix avulso')) {
  throw new Error('A tela do cliente não pode expor configuração interna de gateway.');
}
if (!companyPlansPage.includes('Você não leva do recorrente') || !companyPlansPage.includes('lostComparedToSubscription')) {
  throw new Error('Cliente precisa visualizar o que perde ao escolher compra avulsa.');
}

const adminMonetization = fs.readFileSync(path.join(root, 'pages/AdminClassifiedCommercePage.tsx'), 'utf8');
if (!adminMonetization.includes('/admin/company-plans/benefit-catalog')) {
  throw new Error('Central de monetização precisa carregar o catálogo de benefícios.');
}
if (!adminMonetization.includes('subscriptionBenefits') || !adminMonetization.includes('oneTimeBenefits')) {
  throw new Error('Admin precisa escolher benefícios distintos para assinatura e avulso.');
}
if (!adminMonetization.includes('useFeedback') || !adminMonetization.includes("toast(`${PLAN_META[plan].label}")) {
  throw new Error('Central de monetização precisa usar toast para feedback de salvamento.');
}

const paymentMethodsPage = fs.readFileSync(path.join(root, 'pages/PaymentMethodsPage.tsx'), 'utf8');
if (!paymentMethodsPage.includes('Gateway do Pix avulso') || !paymentMethodsPage.includes('Gateway do Pix Automático')) {
  throw new Error('Admin precisa escolher gateways separados para Pix avulso e Pix Automático.');
}
if (!paymentMethodsPage.includes('return provider.code === "EFI" && provider.config?.pixAutomaticEnabled === true')) {
  throw new Error('Tela de gateways não pode oferecer Mercado Pago como Pix Automático nativo.');
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
if (!adminPayments.includes('subscriptionPrice') || !adminPayments.includes('oneTimePrice') || !adminPayments.includes('title="Compra avulsa"')) {
  throw new Error('Admin precisa manter editores independentes para preço avulso e preço da assinatura.');
}

const commercialMigration = fs.readFileSync(
  path.join(root, 'backend/migrations/20260827_payment_commercial_modes.sql'),
  'utf8',
);
if (!commercialMigration.includes('"purchaseMode"') || !commercialMigration.includes('"subscriptionPriceCents"') || !commercialMigration.includes('"oneTimePriceCents"')) {
  throw new Error('Migração comercial precisa persistir modalidade e os dois preços.');
}
if (!commercialMigration.includes('"subscriptionBenefits"') || !commercialMigration.includes('"oneTimeBenefits"')) {
  throw new Error('Migração comercial precisa persistir benefícios por modalidade.');
}
if (!commercialMigration.includes('"paymentType" = \'PIX_AUTOMATICO\'') || !commercialMigration.includes('"providerCode" = \'MERCADO_PAGO\'')) {
  throw new Error('Migração precisa remover a rota legado Mercado Pago -> Pix Automático.');
}

const companyPlanMigration = fs.readFileSync(
  path.join(root, 'backend/migrations/20260827_company_plan_commercial_modes.sql'),
  'utf8',
);
if (!companyPlanMigration.includes("purchase_mode = 'ONE_TIME'") || !companyPlanMigration.includes('"cancelAtPeriodEnd"')) {
  throw new Error('Compra avulsa empresarial precisa ativar acesso sem renovação automática.');
}

const paymentStatusService = fs.readFileSync(
  path.join(root, 'backend/src/payments/payment-checkout-status.service.ts'),
  'utf8',
);
if (!paymentStatusService.includes('publishPaymentUpdate') || !paymentStatusService.includes('watchForUser')) {
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