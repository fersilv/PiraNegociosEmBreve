const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
process.chdir(repoRoot);

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, source) { fs.writeFileSync(file, source); console.log(`updated ${file}`); }
function must(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Company subscription trial v2 missing ${label || needle.slice(0, 100)}`);
  return source.replace(needle, replacement);
}
function patchInside(source, marker, transform, label) {
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`Company subscription trial v2 missing method ${label || marker}`);
  const head = source.slice(0, index);
  const tail = transform(source.slice(index));
  return head + tail;
}

function patchPaymentsService() {
  const file = 'backend/src/payments/payments.service.ts';
  let source = read(file);
  if (source.includes('async activateCompanyPlanTrial(')) return;
  const method = `  async activateCompanyPlanTrial(\n    paymentId: string,\n    input: { provider?: string; providerSubscriptionId?: string | null } = {},\n  ) {\n    const rows = await this.dataSource.query(\`SELECT * FROM payments WHERE id = $1 LIMIT 1\`, [paymentId]);\n    const payment = rows[0];\n    if (!payment) throw new NotFoundException('Pagamento da assinatura não encontrado.');\n    if (!['COMPANY_PLUS_MONTHLY', 'COMPANY_ELITE_MONTHLY'].includes(String(payment.productCode))) return null;\n    const metadata = typeof payment.metadata === 'object' && payment.metadata\n      ? payment.metadata\n      : (() => { try { return JSON.parse(String(payment.metadata || '{}')); } catch { return {}; } })();\n    const companyId = String(metadata.companyId || '').trim();\n    const trialDays = Math.max(0, Math.min(30, Math.round(Number(metadata.companyEliteTrialDays || 0))));\n    const targetPlan = String(metadata.companyPlan || '').toUpperCase() === 'ELITE' ? 'ELITE' : 'PLUS';\n    if (!companyId || trialDays <= 0) return null;\n\n    const inserted = await this.dataSource.query(\n      \`INSERT INTO company_plan_trials\n        (\"companyId\", \"startedBy\", \"targetPlan\", status, \"startedAt\", \"endsAt\", provider,\n         \"providerSubscriptionId\", \"paymentId\", \"createdAt\", \"updatedAt\")\n       VALUES ($1, $2, $3, 'ACTIVE', now(), now() + make_interval(days => $4::int), $5, $6, $7, now(), now())\n       ON CONFLICT (\"companyId\") DO NOTHING RETURNING *\`,\n      [companyId, payment.userId, targetPlan, trialDays, String(input.provider || payment.provider || '') || null, input.providerSubscriptionId || null, payment.id],\n    );\n    const trial = inserted[0] || (await this.dataSource.query(\n      \`SELECT * FROM company_plan_trials WHERE \"companyId\" = $1 LIMIT 1\`, [companyId],\n    ))[0] || null;\n    if (trial?.status === 'ACTIVE') {\n      await this.dataSource.query(\n        \`INSERT INTO company_ad_highlight_eligibility\n          (\"companyId\", eligible, channels, \"eligibleUntil\", source, \"updatedAt\")\n         VALUES ($1, false, '[\"META\",\"GOOGLE\"]'::jsonb, NULL, 'ELITE_TRIAL', now())\n         ON CONFLICT (\"companyId\") DO UPDATE SET eligible = false, \"eligibleUntil\" = NULL, source = 'ELITE_TRIAL', \"updatedAt\" = now()\`,\n        [companyId],\n      ).catch(() => undefined);\n      await this.dataSource.query(\n        \`UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, \"updatedAt\" = now() WHERE id = $1\`,\n        [payment.id, JSON.stringify({ companyEliteTrialPending: false, companyEliteTrialActivated: true, companyEliteTrialStartedAt: trial.startedAt, companyEliteTrialEndsAt: trial.endsAt })],\n      );\n    }\n    return trial;\n  }\n\n`;
  source = must(source, '  async confirmPayment(', `${method}  async confirmPayment(`, 'PaymentsService trial method');
  write(file, source);
}

function patchProviderManager() {
  const file = 'backend/src/payments/payment-provider-manager.service.ts';
  let source = read(file);
  if (source.includes('options: { trialDays?: number } = {}')) return;
  source = patchInside(source, '  async createCheckout(', (tail) => {
    tail = must(tail,
      '    payerInput: PaymentCheckoutPayer = {},\n  ) {',
      '    payerInput: PaymentCheckoutPayer = {},\n    options: { trialDays?: number } = {},\n  ) {',
      'provider manager options');
    tail = must(tail,
      "    const paymentType: PaymentType = payment.product?.billingType === 'RECURRING'",
      "    const trialDays = Math.max(0, Math.min(30, Math.round(Number(options.trialDays || 0))));\n    const paymentType: PaymentType = payment.product?.billingType === 'RECURRING'",
      'provider manager trialDays');
    tail = must(tail,
      '            payer,\n          )\n        : this.efi.createImmediateCharge(',
      '            payer,\n            trialDays,\n          )\n        : this.efi.createImmediateCharge(',
      'Efí trial arg');
    tail = must(tail,
      '            payer,\n          )\n        : this.mercadoPago.createImmediateCharge(',
      '            payer,\n            trialDays,\n          )\n        : this.mercadoPago.createImmediateCharge(',
      'MP trial arg');
    return tail;
  }, 'PaymentProviderManager.createCheckout');
  write(file, source);
}

function patchEfi() {
  const file = 'backend/src/payments/efi-pix.service.ts';
  let source = read(file);
  if (!source.includes('private addCalendarDays(')) {
    source = must(source,
      '  private addCalendarMonths(dateValue: string, months = 1) {',
      `  private addCalendarDays(dateValue: string, days: number) {\n    const match = String(dateValue || '').match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);\n    if (!match) throw new BadRequestException('Data inválida para o Pix Automático.');\n    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));\n    date.setUTCDate(date.getUTCDate() + Math.max(0, Math.round(days)));\n    return date.toISOString().slice(0, 10);\n  }\n\n  private addCalendarMonths(dateValue: string, months = 1) {`,
      'Efí addCalendarDays');
  }
  if (!source.includes('payer: EfiPayerInput, trialDays = 0')) {
    source = patchInside(source, '  async createMonthlyAutomaticCharge(', (tail) => {
      tail = must(tail,
        'async createMonthlyAutomaticCharge(amountCents: number, paymentId: string, productName: string, payer: EfiPayerInput) {',
        'async createMonthlyAutomaticCharge(amountCents: number, paymentId: string, productName: string, payer: EfiPayerInput, trialDays = 0) {',
        'Efí recurring signature');
      const branch = `    const safeTrialDays = Math.max(0, Math.min(30, Math.round(Number(trialDays || 0))));\n    if (safeTrialDays > 0) {\n      const dataInicial = this.addCalendarDays(new Date().toISOString().slice(0, 10), safeTrialDays);\n      const recurrence = await this.api<EfiRecurrenceResponse>(config, 'POST', '/v2/rec', {\n        vinculo: { contrato: paymentId.replace(/-/g, '').slice(0, 35), devedor: { cpf, nome: name }, objeto: 'Plano empresarial PiraNegócios' },\n        calendario: { dataInicial, periodicidade: 'MENSAL' },\n        valor: { valorRec: this.amount(amountCents) },\n        politicaRetentativa: 'PERMITE_3R_7D', loc: loc.id,\n      });\n      if (!recurrence.idRec) throw new ServiceUnavailableException('A Efí não retornou o identificador da recorrência.');\n      const detail = await this.api<EfiRecurrenceResponse>(config, 'GET', \`/v2/rec/\${encodeURIComponent(recurrence.idRec)}\`).catch(() => recurrence);\n      return {\n        provider: 'EFI', providerPaymentId: recurrence.idRec,\n        pixCopyPaste: detail.dadosQR?.pixCopiaECola || null, qrCodeBase64: null, expiresAt: null,\n        metadata: {\n          efiAutomaticPix: true, efiJourney: 'JORNADA_2', efiRecurrenceId: recurrence.idRec,\n          efiRecurrenceStatus: detail.status || recurrence.status || 'CRIADA', efiRecurrenceLocationId: loc.id,\n          efiRecurrenceLocation: loc.location || null, efiNextChargeDate: dataInicial, efiTrialDays: safeTrialDays,\n          requiresAuthorization: true, efiSandbox: this.sandbox(config),\n        },\n      };\n    }\n`;
      tail = must(tail,
        '    const expiration = this.expirationSeconds(config);\n    const firstCharge = await this.api<EfiChargeResponse>',
        `${branch}    const expiration = this.expirationSeconds(config);\n    const firstCharge = await this.api<EfiChargeResponse>`,
        'Efí journey 2');
      return tail;
    }, 'EfiPixService.createMonthlyAutomaticCharge');
  }
  if (!source.includes('companyEliteTrialAuthorizedAt')) {
    source = must(source,
      "      const subscription = await this.markRecurrenceStatus(idRec, status);\n      const nextCharge = status === 'APROVADA' ? await this.ensureNextAutomaticCharge(idRec).catch((error) => ({ created: false, error: error instanceof Error ? error.message : String(error) })) : null;\n      updated.push({ idRec, status, subscription, nextCharge });",
      `      const subscription = await this.markRecurrenceStatus(idRec, status);\n      let trial: any = null;\n      if (status === 'APROVADA') {\n        const paymentRows = await this.dataSource.query(\n          \`SELECT * FROM payments WHERE provider = 'EFI' AND metadata->>'efiRecurrenceId' = $1 ORDER BY \"createdAt\" ASC LIMIT 1\`, [idRec],\n        );\n        const firstPayment = paymentRows[0];\n        const firstMeta = this.parseMetadata(firstPayment?.metadata);\n        const trialDays = Math.max(0, Math.min(30, Math.round(Number(firstMeta.companyEliteTrialDays || firstMeta.efiTrialDays || 0))));\n        if (firstPayment && trialDays > 0) {\n          const dueDate = this.addCalendarDays(new Date().toISOString().slice(0, 10), trialDays);\n          await this.api<EfiRecurrenceResponse>(config, 'PATCH', \`/v2/rec/\${encodeURIComponent(idRec)}\`, { calendario: { dataInicial: dueDate } }).catch(() => undefined);\n          await this.dataSource.query(\n            \`UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, \"updatedAt\" = now() WHERE id = $1\`,\n            [firstPayment.id, JSON.stringify({ efiNextChargeDate: dueDate, companyEliteTrialAuthorizedAt: new Date().toISOString() })],\n          );\n          trial = await this.payments.activateCompanyPlanTrial(firstPayment.id, { provider: 'EFI', providerSubscriptionId: idRec });\n        }\n      }\n      const nextCharge = status === 'APROVADA' ? await this.ensureNextAutomaticCharge(idRec).catch((error) => ({ created: false, error: error instanceof Error ? error.message : String(error) })) : null;\n      updated.push({ idRec, status, subscription, trial, nextCharge });`,
      'Efí approval hook');
  }
  if (!source.includes("reason: 'trial_first_charge_created'")) {
    source = must(source,
      "      const first = metaRows.find((item) => !item.metadata.efiAutomaticRenewal)?.row || rows[0];\n      if (first.status !== 'PAID') return { created: false, reason: 'initial_payment_pending' } as any;\n      const recurrenceStatus = String([...metaRows].reverse().find((item) => item.metadata.efiRecurrenceStatus)?.metadata.efiRecurrenceStatus || '').toUpperCase();\n      if (recurrenceStatus !== 'APROVADA') return { created: false, reason: `recurrence_${recurrenceStatus || 'unknown'}` } as any;",
      `      const first = metaRows.find((item) => !item.metadata.efiAutomaticRenewal)?.row || rows[0];\n      const recurrenceStatus = String([...metaRows].reverse().find((item) => item.metadata.efiRecurrenceStatus)?.metadata.efiRecurrenceStatus || '').toUpperCase();\n      if (recurrenceStatus !== 'APROVADA') return { created: false, reason: \`recurrence_\${recurrenceStatus || 'unknown'}\` } as any;\n      if (first.status !== 'PAID') {\n        const firstMeta = this.parseMetadata(first.metadata);\n        const trialDays = Math.max(0, Number(firstMeta.companyEliteTrialDays || firstMeta.efiTrialDays || 0));\n        const dueDate = String(firstMeta.efiNextChargeDate || '');\n        if (first.status === 'PENDING' && trialDays > 0 && dueDate) {\n          const currentProviderId = String(first.providerPaymentId || '');\n          if (currentProviderId && currentProviderId !== idRec) return { created: false, reason: 'trial_first_charge_exists', payment: first } as any;\n          const charge = await this.createAutomaticProviderCharge(config, first, idRec, dueDate);\n          const stored = await this.payments.attachProviderCheckout(first.id, {\n            provider: 'EFI', providerPaymentId: charge.txid, expiresAt: null,\n            metadata: { efiAutomaticChargeStatus: charge.status || 'CRIADA', efiRecurrenceId: idRec, efiTrialFirstCharge: true, automaticCycleDueDate: dueDate },\n          });\n          return { created: true, reason: 'trial_first_charge_created', dueDate, payment: stored, providerStatus: charge.status || null } as any;\n        }\n        return { created: false, reason: 'initial_payment_pending' } as any;\n      }`,
      'Efí first post-trial charge');
  }
  write(file, source);
}

function patchMercadoPago() {
  const file = 'backend/src/payments/mercado-pago.service.ts';
  let source = read(file);
  if (!source.includes('mercadoPagoTrialDays: safeTrialDays')) {
    source = patchInside(source, '  async createRecurringCheckout(', (tail) => {
      tail = must(tail,
        '    payer: MercadoPagoPayerInput,\n  ) {\n    const config = await this.config();',
        '    payer: MercadoPagoPayerInput,\n    trialDays = 0,\n  ) {\n    const config = await this.config();',
        'MP recurring signature');
      tail = must(tail,
        '    const subscription: any = await this.request<any>(',
        `    const safeTrialDays = Math.max(0, Math.min(30, Math.round(Number(trialDays || 0))));\n    const trialStartDate = safeTrialDays > 0\n      ? new Date(Date.now() + safeTrialDays * 24 * 60 * 60 * 1000).toISOString()\n      : undefined;\n\n    const subscription: any = await this.request<any>(`,
        'MP trial date');
      tail = must(tail,
        "          frequency_type: 'months',\n          transaction_amount:",
        "          frequency_type: 'months',\n          start_date: trialStartDate,\n          transaction_amount:",
        'MP start_date');
      tail = must(tail,
        "        requiresAuthorization: true,\n      },",
        "        requiresAuthorization: true,\n        mercadoPagoTrialDays: safeTrialDays,\n        mercadoPagoTrialStartDate: trialStartDate || null,\n      },",
        'MP trial metadata');
      return tail;
    }, 'MercadoPagoService.createRecurringCheckout');
  }
  if (!source.includes('companyEliteTrialSubscriptionAuthorized')) {
    source = patchInside(source, '  private async handleSubscription(', (tail) => {
      tail = must(tail,
        "    const localSubscriptionStatus = status === 'cancelled' || status === 'canceled'",
        `    if (status === 'authorized') {\n      await this.payments.activateCompanyPlanTrial(local.id, { provider: 'MERCADO_PAGO', providerSubscriptionId: dataId }).catch(() => undefined);\n      await this.dataSource.query(\n        \`UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, \"updatedAt\" = now() WHERE id = $1\`,\n        [local.id, JSON.stringify({ companyEliteTrialSubscriptionAuthorized: true })],\n      ).catch(() => undefined);\n    }\n\n    const localSubscriptionStatus = status === 'cancelled' || status === 'canceled'`,
        'MP authorization hook');
      return tail;
    }, 'MercadoPagoService.handleSubscription');
  }
  write(file, source);
}

function patchWhatsappOnlyGates() {
  const premiumFile = 'backend/src/company-plans/company-whatsapp-premium.service.ts';
  let premium = read(premiumFile);
  premium = premium.replaceAll('this.plans.assertFeature(', 'this.plans.assertWhatsAppFeature(');
  write(premiumFile, premium);

  const conciergeFile = 'backend/src/whatsapp/whatsapp-concierge.service.ts';
  let concierge = read(conciergeFile);
  concierge = concierge.replaceAll('this.companyPlans.assertFeature(', 'this.companyPlans.assertWhatsAppFeature(');
  concierge = concierge.replaceAll("payload.code === 'COMPANY_PLAN_REQUIRED'", "payload.code === 'COMPANY_WHATSAPP_PLAN_REQUIRED'");
  concierge = concierge.replaceAll('Esse recurso faz parte do plano ${requiredPlan}.', 'Esse comando pelo WhatsApp faz parte do plano ${requiredPlan}.');
  write(conciergeFile, concierge);
}

function patchPlansPage() {
  const file = 'pages/CompanyPlansPage.tsx';
  let source = read(file);
  if (source.includes('eligibleOnSubscription') && source.includes('Assine e ganhe 15 dias do Elite')) return;
  // Refuse the obsolete standalone-trial version instead of layering a second UI on it.
  if (source.includes('const startTrial = async')) {
    throw new Error('CompanyPlansPage still contains the obsolete standalone trial patch. Restore pages/CompanyPlansPage.tsx from Git before building.');
  }
  source = must(source, '  features: string[];\n  current?: boolean;\n};', '  features: string[];\n  current?: boolean;\n  includesEliteTrial?: boolean;\n  eliteTrialDays?: number;\n};', 'plan trial fields');
  source = must(source, '  advertisingEligible?: boolean;\n};', '  advertisingEligible?: boolean;\n  jobHighlightEligible?: boolean;\n  isTrial?: boolean;\n  trialEndsAt?: string | null;\n  trialTargetPlan?: PlanId | null;\n  basePlan?: PlanId;\n  hasPaidSubscription?: boolean;\n};', 'current trial fields');
  source = must(source, '    current?: CurrentPlan;\n    plans?: Plan[];\n  }>({});', '    current?: CurrentPlan;\n    plans?: Plan[];\n    trial?: { days: number; active: boolean; eligibleOnSubscription: boolean; used: boolean; targetPlan?: PlanId | null; startedAt?: string | null; endsAt?: string | null; restrictions?: string[] };\n  }>({});', 'trial response');
  source = source.replace('        setMessage(`Plano ${selected} ativado em modo DEV.`);', '        setMessage(response.data?.trialActivated ? `Assinatura ${selected} autorizada. Seus 15 dias de Elite grátis começaram agora.` : `Plano ${selected} ativado em modo DEV.`);');
  source = source.replace('        setMessage("Checkout criado. Conclua a autorização/pagamento para ativar o plano da empresa.");', '        setMessage(response.data?.trialDays > 0 ? "Assinatura criada. Conclua a autorização da recorrência para começar seus 15 dias de Elite grátis. A primeira cobrança ocorre após o período gratuito." : "Checkout criado. Conclua a autorização/pagamento para ativar o plano da empresa.");');
  source = must(source, '  const current = data.current?.plan || "FREE";\n  const subscriptionUrl', '  const current = data.current?.plan || "FREE";\n  const basePlan = data.current?.basePlan || current;\n  const subscriptionUrl', 'basePlan');
  source = source.replace('Comece no Free e transforme o WhatsApp em uma central de recrutamento conforme sua operação cresce.', 'Os planos ampliam o que a assistente pode fazer pelo WhatsApp. As funções já existentes no painel web da empresa continuam intactas.');
  source = source.replace('<BadgeCheck className="h-5 w-5" /> {current}', '<BadgeCheck className="h-5 w-5" /> {data.current?.isTrial ? "ELITE • 15 DIAS GRÁTIS" : current}');
  source = source.replace('Vigente até {new Date(data.current.currentPeriodEnd).toLocaleDateString("pt-BR")}', '{data.current?.isTrial ? "Teste gratuito até" : "Vigente até"} {new Date(data.current.currentPeriodEnd).toLocaleDateString("pt-BR")}');
  const banner = `\n      {data.current?.isTrial && (\n        <section className=\"rounded-[30px] border border-violet-200 bg-violet-950 p-6 text-white shadow-lg sm:p-7\">\n          <div className=\"flex gap-4\"><Crown className=\"mt-1 h-6 w-6 shrink-0 text-violet-200\" /><div><p className=\"text-[10px] font-black uppercase tracking-[0.18em] text-violet-200\">Elite gratuito da assinatura</p><h2 className=\"mt-2 font-serif text-3xl font-black\">Seu teste de 15 dias está ativo</h2><p className=\"mt-2 max-w-3xl text-sm leading-6 text-white/65\">Todos os recursos operacionais do Elite ficam liberados pelo WhatsApp. O trial não inclui destaque/impulsionamento de vagas nem elegibilidade para Meta ou Google. O painel web continua funcionando normalmente.</p>{data.current.trialEndsAt && <p className=\"mt-3 text-xs font-bold text-violet-200\">Termina em {new Date(data.current.trialEndsAt).toLocaleDateString(\"pt-BR\")}.</p>}</div></div>\n        </section>\n      )}\n`;
  source = must(source, '\n      <div className="grid gap-5 lg:grid-cols-3">', `${banner}\n      <div className="grid gap-5 lg:grid-cols-3">`, 'trial banner');
  source = source.replace('          const active = current === plan.id;', '          const active = !data.current?.isTrial && basePlan === plan.id;\n          const trialSubscription = Boolean(data.current?.isTrial && data.current?.trialTargetPlan === plan.id);');
  source = source.replace('<p className="mt-3 min-h-12 text-sm leading-6 text-stone-500">{plan.description}</p>', '<p className="mt-3 min-h-12 text-sm leading-6 text-stone-500">{plan.description}</p>\n              {plan.includesEliteTrial && <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 px-3.5 py-3 text-xs font-black text-violet-800"><Sparkles className="mr-1.5 inline h-3.5 w-3.5" /> Assine e ganhe 15 dias do Elite no WhatsApp antes da primeira cobrança.</div>}');
  source = source.replace('disabled={active || plan.id === "FREE"}', 'disabled={active || trialSubscription || plan.id === "FREE"}');
  source = source.replace('active || plan.id === "FREE"', 'active || trialSubscription || plan.id === "FREE"');
  source = source.replace('{active ? "Plano atual" : plan.id === "FREE" ? "Incluído" : `Assinar ${plan.name}`}', '{trialSubscription ? "Assinatura em teste" : active ? "Plano atual" : plan.id === "FREE" ? "Incluído" : `Assinar ${plan.name}`}');
  source = source.replace('<p className="mt-2 text-sm text-stone-500">{money(chosen.priceCents)} por mês via método recorrente habilitado no PiraNegócios.</p>', '<p className="mt-2 text-sm text-stone-500">{money(chosen.priceCents)} por mês via método recorrente habilitado no PiraNegócios.</p>\n              {chosen.includesEliteTrial && <p className="mt-2 max-w-2xl text-xs font-bold leading-5 text-violet-700">Na primeira assinatura, a autorização inicia 15 dias de Elite grátis. A cobrança começa depois do período gratuito. Impulsos, destaque de vagas e elegibilidade Meta/Google não fazem parte do trial.</p>}');
  source = source.replace('{data.current?.active && !data.current.cancelAtPeriodEnd && (', '{data.current?.hasPaidSubscription && !data.current.cancelAtPeriodEnd && (');
  write(file, source);
}

patchPaymentsService();
patchProviderManager();
patchEfi();
patchMercadoPago();
patchWhatsappOnlyGates();
patchPlansPage();
console.log('Company subscription-only Elite trial v2 verified.');
