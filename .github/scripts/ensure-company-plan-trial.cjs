const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
process.chdir(repoRoot);

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, source) {
  fs.writeFileSync(file, source);
  console.log(`updated ${file}`);
}

function replaceOrThrow(source, needle, replacement, label) {
  if (!source.includes(needle)) {
    throw new Error(`Company trial patch missing ${label || needle.slice(0, 100)}`);
  }
  return source.replace(needle, replacement);
}

function patchPlansPage() {
  const file = 'pages/CompanyPlansPage.tsx';
  let source = read(file);
  if (source.includes('Teste o Elite grátis por 15 dias') && source.includes('trialEndsAt')) return;

  source = replaceOrThrow(
    source,
    '  advertisingEligible?: boolean;\n};',
    '  advertisingEligible?: boolean;\n  jobHighlightEligible?: boolean;\n  isTrial?: boolean;\n  trialEndsAt?: string | null;\n  basePlan?: PlanId;\n  hasPaidSubscription?: boolean;\n};',
    'CurrentPlan trial fields',
  );

  source = replaceOrThrow(
    source,
    '    current?: CurrentPlan;\n    plans?: Plan[];\n  }>({});',
    '    current?: CurrentPlan;\n    plans?: Plan[];\n    trial?: {\n      days: number;\n      active: boolean;\n      eligible: boolean;\n      used: boolean;\n      startedAt?: string | null;\n      endsAt?: string | null;\n      restrictions?: string[];\n    };\n  }>({});',
    'trial response type',
  );

  source = replaceOrThrow(
    source,
    '  const cancelRenewal = async () => {',
    `  const startTrial = async () => {\n    setSubmitting(true);\n    setMessage(\"\");\n    try {\n      const response = await api.post(\"/company/plans/trial\");\n      setData(response.data || {});\n      setSelected(null);\n      setCheckout(null);\n      setMessage(\"Elite gratuito ativado por 15 dias. Recursos de impulso e destaque permanecem bloqueados durante o teste.\");\n    } catch (error: any) {\n      setMessage(error?.response?.data?.message || \"Não foi possível ativar o teste gratuito.\");\n    } finally {\n      setSubmitting(false);\n    }\n  };\n\n  const cancelRenewal = async () => {`,
    'start trial action',
  );

  source = replaceOrThrow(
    source,
    '  const current = data.current?.plan || "FREE";\n  const subscriptionUrl',
    '  const current = data.current?.plan || "FREE";\n  const basePlan = data.current?.basePlan || current;\n  const subscriptionUrl',
    'base plan constant',
  );

  source = replaceOrThrow(
    source,
    '<BadgeCheck className="h-5 w-5" /> {current}',
    '<BadgeCheck className="h-5 w-5" /> {data.current?.isTrial ? "ELITE • TESTE GRÁTIS" : current}',
    'trial plan label',
  );

  source = replaceOrThrow(
    source,
    '                Vigente até {new Date(data.current.currentPeriodEnd).toLocaleDateString("pt-BR")}',
    '                {data.current?.isTrial ? "Teste gratuito até" : "Vigente até"} {new Date(data.current.currentPeriodEnd).toLocaleDateString("pt-BR")}',
    'trial validity label',
  );

  const trialBanner = `\n      {(data.trial?.eligible || data.trial?.active) && (\n        <section className=\"rounded-[30px] border border-violet-200 bg-gradient-to-r from-violet-950 to-violet-800 p-6 text-white shadow-lg sm:p-7\">\n          <div className=\"flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between\">\n            <div>\n              <div className=\"inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]\"><Crown className=\"h-3.5 w-3.5\" /> Elite Trial</div>\n              <h2 className=\"mt-3 font-serif text-3xl font-black\">{data.trial?.active ? \"Você está testando o Elite\" : \"Teste o Elite grátis por 15 dias\"}</h2>\n              <p className=\"mt-2 max-w-3xl text-sm leading-6 text-white/65\">\n                Todos os recursos de gestão do Elite ficam disponíveis no período gratuito. O teste não inclui destaque ou impulsionamento de vagas e não gera elegibilidade para campanhas do PiraNegócios na Meta ou Google.\n              </p>\n              {data.trial?.active && data.trial?.endsAt && <p className=\"mt-3 text-xs font-bold text-violet-200\">Teste válido até {new Date(data.trial.endsAt).toLocaleDateString(\"pt-BR\")}.</p>}\n            </div>\n            {data.trial?.eligible && (\n              <button type=\"button\" disabled={submitting} onClick={() => void startTrial()} className=\"inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-xs font-black text-violet-950 disabled:opacity-50\">\n                {submitting ? <Loader2 className=\"h-4 w-4 animate-spin\" /> : <Sparkles className=\"h-4 w-4\" />} Ativar 15 dias grátis\n              </button>\n            )}\n          </div>\n        </section>\n      )}\n`;
  source = replaceOrThrow(
    source,
    '\n      <div className="grid gap-5 lg:grid-cols-3">',
    `${trialBanner}\n      <div className=\"grid gap-5 lg:grid-cols-3\">`,
    'trial banner insertion',
  );

  source = replaceOrThrow(
    source,
    '          const active = current === plan.id;',
    '          const active = !data.current?.isTrial && basePlan === plan.id;',
    'paid plan active state',
  );

  source = replaceOrThrow(
    source,
    '                {active ? "Plano atual" : plan.id === "FREE" ? "Incluído" : `Assinar ${plan.name}`}\n              </button>\n            </article>',
    `                {active ? \"Plano atual\" : plan.id === \"FREE\" ? \"Incluído\" : \`Assinar \${plan.name}\`}\n              </button>\n              {plan.id !== \"FREE\" && data.trial?.eligible && (\n                <button type=\"button\" disabled={submitting} onClick={() => void startTrial()} className=\"mt-2 w-full rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs font-black text-violet-800 transition hover:bg-violet-100 disabled:opacity-50\">\n                  Testar Elite grátis por 15 dias\n                </button>\n              )}\n            </article>`,
    'trial buttons on paid plans',
  );

  source = replaceOrThrow(
    source,
    '{data.current?.active && !data.current.cancelAtPeriodEnd && (',
    '{data.current?.hasPaidSubscription && !data.current.cancelAtPeriodEnd && (',
    'renewal panel paid-only',
  );

  const restrictionPanel = `\n      {data.current?.isTrial && (\n        <section className=\"rounded-[26px] border border-amber-200 bg-amber-50 p-5 text-amber-950\">\n          <div className=\"flex gap-3\"><ShieldCheck className=\"mt-0.5 h-5 w-5 shrink-0\" /><div><p className=\"text-sm font-black\">Elite gratuito, sem impulsos</p><p className=\"mt-1 text-xs leading-5 text-amber-900/75\">Durante os 15 dias gratuitos você usa os recursos de gestão do Elite, mas suas vagas não recebem destaque e a empresa não participa dos destaques publicitários na Meta ou Google. Esses benefícios são exclusivos do Elite pago.</p></div></div>\n        </section>\n      )}\n`;
  source = replaceOrThrow(
    source,
    '\n      {data.current?.advertisingEligible && (',
    `${restrictionPanel}\n      {data.current?.advertisingEligible && (`,
    'trial restriction panel',
  );

  write(file, source);
}

function patchConciergeTrialMessage() {
  const file = 'backend/src/whatsapp/whatsapp-concierge.service.ts';
  let source = read(file);
  if (source.includes('COMPANY_TRIAL_RESTRICTED') && source.includes('Elite gratuito não inclui')) return;

  const oldBlock = `      if (this.isCompanyPlanRequired(error)) {\n        const payload = this.companyPlanPayload(error);\n        const requiredPlan = String(payload?.requiredPlan || 'Plus');\n        const currentPlan = String(payload?.currentPlan || 'Free');\n        await this.sendText(\n          buffer,\n          \`Esse recurso faz parte do plano \${requiredPlan}. Sua empresa está no \${currentPlan}. Para liberar: https://piranegocios.com.br/company/planos\`,\n        ).catch(() => undefined);\n        return;\n      }`;
  const newBlock = `      if (this.isCompanyPlanRequired(error) || this.companyPlanPayload(error)?.code === 'COMPANY_TRIAL_RESTRICTED') {\n        const payload = this.companyPlanPayload(error);\n        if (payload?.code === 'COMPANY_TRIAL_RESTRICTED') {\n          await this.sendText(\n            buffer,\n            \`O Elite gratuito não inclui impulsionamento/destaque de vagas nem elegibilidade para destaques na Meta e Google. Esses benefícios ficam disponíveis no Elite pago: https://piranegocios.com.br/company/planos\`,\n          ).catch(() => undefined);\n          return;\n        }\n        const requiredPlan = String(payload?.requiredPlan || 'Plus');\n        const currentPlan = String(payload?.currentPlan || 'Free');\n        await this.sendText(\n          buffer,\n          \`Esse recurso faz parte do plano \${requiredPlan}. Sua empresa está no \${currentPlan}. Para liberar: https://piranegocios.com.br/company/planos\`,\n        ).catch(() => undefined);\n        return;\n      }`;
  source = replaceOrThrow(source, oldBlock, newBlock, 'WhatsApp trial restriction response');
  write(file, source);
}

patchPlansPage();
patchConciergeTrialMessage();
console.log('Company Elite trial integration verified.');
