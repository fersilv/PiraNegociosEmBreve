const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
process.chdir(root);

const file = 'components/classifieds/ClassifiedsWorkspaceLayout.tsx';
let source = fs.readFileSync(file, 'utf8');

function replace(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`Classifieds publication consent missing ${label}`);
  source = source.replace(from, to);
}

replace(
  "import React, { useState } from 'react';",
  "import React, { useEffect, useState } from 'react';",
  'react hooks import',
);
replace(
  "import { Link, NavLink, useNavigate } from 'react-router-dom';",
  "import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';",
  'router location import',
);
replace(
  "import { auth } from '../../lib/firebase';",
  "import { auth } from '../../lib/firebase';\nimport { api } from '../../lib/api';",
  'api import',
);
replace(
  "  const { data, loading, error, selectIdentity, acceptPersonalTerms, configureCompany } = useClassifiedsWorkspace();\n  const [working, setWorking] = useState(false);",
  "  const { data, loading, error, selectIdentity, acceptPersonalTerms, configureCompany } = useClassifiedsWorkspace();\n  const location = useLocation();\n  const publicationFlow = location.pathname.startsWith('/classificados/publicar');\n  const [working, setWorking] = useState(false);\n  const [companyPlan, setCompanyPlan] = useState('FREE');",
  'publication route state',
);
replace(
  "  const [channels, setChannels] = useState<ClassifiedPublicationChannel[]>(['CLASSIFIEDS', 'COMPANY_PAGE']);\n\n  const run = async",
  "  const [channels, setChannels] = useState<ClassifiedPublicationChannel[]>(['CLASSIFIEDS', 'COMPANY_PAGE']);\n\n  useEffect(() => {\n    if (!publicationFlow || data?.activeIdentity !== 'COMPANY') return;\n    let active = true;\n    api.get('/classifieds/me/limits')\n      .then((response) => { if (active) setCompanyPlan(String(response.data?.plan || 'FREE').toUpperCase()); })\n      .catch(() => { if (active) setCompanyPlan('FREE'); });\n    return () => { active = false; };\n  }, [publicationFlow, data?.activeIdentity, data?.company?.id]);\n\n  const run = async",
  'company plan lookup',
);
replace(
  "  if (data.activeIdentity === 'PERSONAL' && !data.personal.termsAccepted) {",
  "  if (publicationFlow && data.activeIdentity === 'PERSONAL' && !data.personal.termsAccepted) {",
  'personal consent gate',
);
replace(
  "      <OnboardingFrame mode=\"PERSONAL\" title=\"Ative seu PiraNegócios Personal\" subtitle=\"Seu espaço pessoal para vender, comprar e negociar com segurança dentro da plataforma.\" error={error}>",
  "      <OnboardingFrame mode=\"PERSONAL\" title=\"Antes da sua primeira publicação\" subtitle=\"Explorar os Classificados é livre. Este aceite é necessário somente quando você decide anunciar.\" error={error}>",
  'personal consent copy',
);
replace(
  "{working ? 'Ativando...' : 'Aceitar e entrar como Personal'}",
  "{working ? 'Salvando aceite...' : 'Aceitar e continuar para publicar'}",
  'personal consent action',
);
replace(
  "  if (data.activeIdentity === 'COMPANY' && data.company && !data.company.verified) {",
  "  if (publicationFlow && data.activeIdentity === 'COMPANY' && data.company && !data.company.verified) {",
  'company verification gate',
);
replace(
  "      <OnboardingFrame mode=\"BUSINESS\" title={`${data.company.name} ainda precisa ser verificada`} subtitle=\"Empresas ganham identidade comercial, selo de verificação, vitrine na página e recursos próprios de catálogo.\" error={error}>",
  "      <OnboardingFrame mode=\"BUSINESS\" title={`Verifique ${data.company.name} para publicar`} subtitle=\"A empresa pode acessar e explorar os Classificados normalmente. A verificação é exigida quando ela começa a anunciar.\" error={error}>",
  'company verification copy',
);
replace(
  "  if (data.activeIdentity === 'COMPANY' && data.company && !data.company.termsAccepted) {",
  "  if (publicationFlow && data.activeIdentity === 'COMPANY' && data.company && !data.company.termsAccepted) {",
  'company consent gate',
);
replace(
  "        <div className=\"space-y-6\">\n          <section>",
  "        <div className=\"space-y-6\">\n          <div className=\"rounded-3xl border border-[#c9dedb] bg-white p-5 shadow-sm\"><p className=\"text-[10px] font-black uppercase tracking-[.16em] text-[#44736e]\">Plano desta publicação</p><div className=\"mt-2 flex items-center justify-between gap-4\"><div><p className=\"text-2xl font-black text-[#0d4542]\">{companyPlan}</p><p className=\"mt-1 text-xs leading-5 text-stone-500\">Os limites e recursos do anúncio seguem o plano ativo da empresa. Leilões são exclusivos do Elite.</p></div><span className=\"rounded-full bg-[#e7f2ef] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] text-[#276b64]\">Business</span></div></div>\n          <section>",
  'company plan summary',
);
replace(
  "<OnboardingFrame mode=\"BUSINESS\" title={`Leve ${data.company.name} para os Classificados`} subtitle=\"Configure uma vez. Depois, o PiraNegócios lembra que você entrou como Business e aplica estas escolhas como padrão.\" error={error}>",
  "<OnboardingFrame mode=\"BUSINESS\" title={`Primeira publicação de ${data.company.name}`} subtitle=\"Acesso aos Classificados é livre. Aqui você só configura as regras de publicação da empresa uma vez.\" error={error}>",
  'company consent copy',
);
replace(
  "{working ? 'Ativando Business...' : 'Aceitar e ativar PiraNegócios Business'}",
  "{working ? 'Salvando configuração...' : 'Aceitar e continuar para publicar'}",
  'company consent action',
);

fs.writeFileSync(file, source);
console.log('Classifieds public access and publication-only consent verified.');
