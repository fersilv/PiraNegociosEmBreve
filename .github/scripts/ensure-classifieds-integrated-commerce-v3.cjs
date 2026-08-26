const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
process.chdir(root);

function patch(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) { fs.writeFileSync(file, next); console.log(`updated ${file}`); }
}

patch('pages/DashboardRouter.tsx', (input) => {
  let source = input;
  if (!source.includes('CompanyPlansPage')) {
    source = source.replace('import { CompanyHomePage } from "./CompanyHomePage";', 'import { CompanyHomePage } from "./CompanyHomePage";\nimport { CompanyPlansPage } from "./CompanyPlansPage";');
  }
  if (!source.includes('<Route path="planos"')) {
    source = source.replace('<Route path="contratacao" element={companyOnly(<CompanyHiringConfig />)} />', '<Route path="contratacao" element={companyOnly(<CompanyHiringConfig />)} />\n      <Route path="planos" element={companyOnly(<CompanyPlansPage />)} />');
  }
  if (!source.includes('<Route path="planos"')) throw new Error('Company plans route missing.');
  return source;
});

patch('components/WorkspaceLayout.tsx', (input) => {
  let source = input;
  if (!source.includes('Crown,')) source = source.replace('  Building2,', '  Building2,\n  Crown,');
  if (!source.includes('{ to: "/company/planos"')) {
    source = source.replace('{ to: "/company/contratacao", label: "Contratação", icon: <Settings2 className="h-5 w-5" /> },', '{ to: "/company/contratacao", label: "Contratação", icon: <Settings2 className="h-5 w-5" /> },\n  { to: "/company/planos", label: "Planos", icon: <Crown className="h-5 w-5" /> },');
  }
  if (!source.includes('/company/planos')) throw new Error('Company plans navigation missing.');
  return source;
});

patch('components/classifieds/ClassifiedsWorkspaceLayout.tsx', (input) => {
  let source = input;
  source = source.replaceAll("{ to: '/classificados/leiloes', label: 'Leilões'", "{ to: '/classificados/gestao/leiloes', label: 'Leilões'");
  source = source.replaceAll("{ to: '/classificados/ofertas', label: 'Ofertas'", "{ to: '/classificados/ofertas', label: 'Negociações'");
  if (!source.includes("'/classificados/gestao/leiloes'")) throw new Error('Internal auction navigation missing.');
  return source;
});

patch('pages/PaymentMethodsPage.tsx', (input) => {
  let source = input;
  const oldDraft = `      setDraft({\n        accessToken: \"\",\n        publicKey: \"\",\n        webhookSecret: \"\",\n        publicApiBaseUrl: config.publicApiBaseUrl || defaultApiBaseUrl,\n      });`;
  const newDraft = `      setDraft({\n        accessToken: \"\",\n        publicKey: \"\",\n        webhookSecret: \"\",\n        marketplaceClientId: config.marketplaceClientId || \"\",\n        marketplaceClientSecret: \"\",\n        marketplaceRedirectUri: config.marketplaceRedirectUri || \`${'${window.location.origin}'}/classificados/vendas/mercado-pago\`,\n        publicApiBaseUrl: config.publicApiBaseUrl || defaultApiBaseUrl,\n      });`;
  if (!source.includes(newDraft)) {
    if (!source.includes(oldDraft)) throw new Error('Mercado Pago editor draft anchor missing.');
    source = source.replace(oldDraft, newDraft);
  }
  const saveAnchor = `        secretIfFilled(body, \"accessToken\", draft.accessToken);\n        secretIfFilled(body, \"publicKey\", draft.publicKey);\n        secretIfFilled(body, \"webhookSecret\", draft.webhookSecret);`;
  const saveReplacement = `${saveAnchor}\n        if (typeof draft.marketplaceClientId === 'string') body.marketplaceClientId = draft.marketplaceClientId.trim();\n        secretIfFilled(body, \"marketplaceClientSecret\", draft.marketplaceClientSecret);\n        body.marketplaceRedirectUri = draft.marketplaceRedirectUri || \`${'${window.location.origin}'}/classificados/vendas/mercado-pago\`;`;
  if (!source.includes('body.marketplaceClientId = draft.marketplaceClientId.trim()')) {
    if (!source.includes(saveAnchor)) throw new Error('Mercado Pago save anchor missing.');
    source = source.replace(saveAnchor, saveReplacement);
  }
  const uiAnchor = `<SecretField label=\"Access Token\" configured={editing.config?.accessTokenConfigured} value={draft.accessToken || \"\"} onChange={(value) => setDraft((current) => ({ ...current, accessToken: value }))} />`;
  const uiReplacement = `<div className=\"sm:col-span-2 rounded-2xl border border-[#009ee3]/20 bg-[#eaf7fd] p-4\"><div className=\"flex items-center gap-3\"><span className=\"flex h-10 w-10 items-center justify-center rounded-full bg-[#009ee3] text-xs font-black text-white\">MP</span><div><p className=\"text-sm font-black text-[#073b5c]\">Marketplace · conectar contas das empresas</p><p className=\"mt-0.5 text-[11px] leading-5 text-[#35647d]\">Estas credenciais pertencem à aplicação PiraNegócios no Mercado Pago. O Client Secret fica criptografado e nunca volta para o navegador.</p></div></div></div>\n                    <Field label=\"Marketplace Client ID\" value={draft.marketplaceClientId || \"\"} onChange={(value) => setDraft((current) => ({ ...current, marketplaceClientId: value }))} placeholder=\"Client ID da aplicação Mercado Pago\" />\n                    <SecretField label=\"Marketplace Client Secret\" configured={editing.config?.marketplaceClientSecretConfigured} value={draft.marketplaceClientSecret || \"\"} onChange={(value) => setDraft((current) => ({ ...current, marketplaceClientSecret: value }))} />\n                    <div className=\"sm:col-span-2\"><Field label=\"Redirect URI do marketplace\" value={draft.marketplaceRedirectUri || \"\"} onChange={(value) => setDraft((current) => ({ ...current, marketplaceRedirectUri: value }))} placeholder={\`${'${window.location.origin}'}/classificados/vendas/mercado-pago\`} /></div>\n                    ${uiAnchor}`;
  if (!source.includes('Marketplace Client Secret')) {
    if (!source.includes(uiAnchor)) throw new Error('Mercado Pago credential UI anchor missing.');
    source = source.replace(uiAnchor, uiReplacement);
  }
  return source;
});

patch('pages/ClassifiedsSalesPage.tsx', (input) => {
  let source = input;
  const oldButton = `<button onClick={() => void connectMercadoPago()} disabled={!status?.companyVerified || Boolean(working)} className=\"mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#009ee3] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40\">{working === 'connect' || working === 'oauth' ? <Loader2 className=\"h-4 w-4 animate-spin\" /> : <WalletCards className=\"h-4 w-4\" />} Conectar Mercado Pago</button>`;
  const newButton = `<button onClick={() => void connectMercadoPago()} disabled={!status?.companyVerified || Boolean(working)} className=\"mt-5 flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl bg-[#009ee3] px-4 py-3 text-left text-white shadow-[0_14px_35px_rgba(0,158,227,.24)] transition hover:bg-[#008ed0] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[320px]\"><span className=\"flex items-center gap-3\"><span className=\"flex h-9 w-9 items-center justify-center rounded-full bg-white text-[10px] font-black text-[#009ee3]\">MP</span><span><strong className=\"block text-sm\">Conectar com Mercado Pago</strong><span className=\"mt-0.5 block text-[10px] font-semibold text-white/75\">Autorizar a conta recebedora da empresa</span></span></span>{working === 'connect' || working === 'oauth' ? <Loader2 className=\"h-5 w-5 animate-spin\" /> : <WalletCards className=\"h-5 w-5\" />}</button>`;
  if (!source.includes(newButton)) {
    if (!source.includes(oldButton)) throw new Error('Mercado Pago connect button anchor missing.');
    source = source.replace(oldButton, newButton);
  }
  if (!source.includes('href="/company/planos"') && !source.includes('to="/company/planos"')) {
    source = source.replace('</header>\n\n      {(error || notice)', '</header>\n      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500"><span>Plano atual: <strong>{status?.plan || \'FREE\'}</strong></span><Link to="/company/planos" className="rounded-full bg-white px-3 py-1.5 font-black text-[#397c75] ring-1 ring-stone-200">Ver ou alterar planos Business</Link></div>\n\n      {(error || notice)');
  }
  return source;
});

console.log('Integrated Classificados navigation, Business plans and Mercado Pago marketplace UI verified.');
