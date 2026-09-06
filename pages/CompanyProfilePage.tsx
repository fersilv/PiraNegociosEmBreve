import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Globe2,
  Loader2,
  MapPin,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Store,
  UserCog,
  Users,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { FileUpload } from "../components/FileUpload";
import { CompanyRegistrationFlow } from "../components/CompanyRegistrationFlow";

export type CompanyProfileSection = "commercial" | "finance" | "team" | "settings";

type PermissionKey = "companyProfile" | "recruitment" | "marketplace" | "finance" | "team";
const permissionLabels: Record<PermissionKey, string> = {
  companyProfile: "Perfil da empresa",
  recruitment: "Recrutamento",
  marketplace: "Marketplace",
  finance: "Financeiro",
  team: "Equipe e permissões",
};

export function CompanyProfilePage({ section = "commercial" }: { section?: CompanyProfileSection }) {
  const { user, profile, refreshProfile } = useAuth();
  const companyId = profile?.companyId || null;
  const [company, setCompany] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [plans, setPlans] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoURL, setLogoURL] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [sameAddress, setSameAddress] = useState(true);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [rapi10CatalogOptIn, setRapi10CatalogOptIn] = useState(true);
  const [businessHoursText, setBusinessHoursText] = useState("");
  const [specialDatesText, setSpecialDatesText] = useState("");
  const [servicesText, setServicesText] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "colaborador">("colaborador");
  const [checkout, setCheckout] = useState<any>(null);

  const load = async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [companyResult, employeesResult, plansResult] = await Promise.allSettled([
        api.get(`/companies/${companyId}`),
        api.get(`/companies/${companyId}/employees`),
        api.get("/company/plans"),
      ]);
      if (companyResult.status === "fulfilled") {
        const item = companyResult.value.data;
        setCompany(item);
        setName(item?.name || "");
        setDescription(item?.description || "");
        setLogoURL(item?.logoURL || "");
        setWebsite(item?.website || "");
        setPhone(item?.phone || "");
        setSameAddress(item?.commercialAddressSameAsLegal !== false);
        setAddress(item?.address || "");
        setCity(item?.city || "");
        setState(item?.state || "");
        setRapi10CatalogOptIn(item?.rapi10CatalogOptIn !== false);
        setBusinessHoursText((Array.isArray(item?.businessHoursJson) ? item.businessHoursJson : []).join("
"));
        setSpecialDatesText((Array.isArray(item?.specialBusinessDatesJson) ? item.specialBusinessDatesJson : []).join("
"));
        setServicesText((Array.isArray(item?.servicesTagsJson) ? item.servicesTagsJson : []).join("
"));
      }
      if (employeesResult.status === "fulfilled") setEmployees(Array.isArray(employeesResult.value.data) ? employeesResult.value.data : []);
      if (plansResult.status === "fulfilled") setPlans(plansResult.value.data);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível carregar a empresa.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [companyId]);

  const saveCommercial = async () => {
    if (!companyId) return;
    setWorking("commercial"); setMessage("");
    try {
      await api.patch("/compliance/company/commercial-profile", {
        name,
        commercialAddressSameAsLegal: sameAddress,
        address,
        city,
        state,
        rapi10CatalogOptIn,
        businessHoursJson: businessHoursText.split("
").map(v => v.trim()).filter(Boolean),
        specialBusinessDatesJson: specialDatesText.split("
").map(v => v.trim()).filter(Boolean),
        servicesTagsJson: servicesText.split(/[,
]/).map(v => v.trim()).filter(Boolean),
      });
      await api.put(`/companies/${companyId}`, { description, website, phone, logoURL });
      if (user) await api.post("/users/me", { companyName: name, companyLogo: logoURL });
      await refreshProfile();
      setMessage("Perfil comercial salvo.");
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível salvar os dados comerciais.");
    } finally { setWorking(""); }
  };

  const refreshRegistry = async () => {
    if (!company?.cnpj) return;
    setWorking("cnpj"); setMessage("");
    try {
      const response = await api.get(`/compliance/company/cnpj/${encodeURIComponent(company.cnpj)}`);
      setMessage(response.data?.changes?.length ? "Consulta atualizada. Encontramos alterações cadastrais para você conferir." : "Dados públicos do CNPJ estão atualizados.");
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível atualizar a consulta do CNPJ.");
    } finally { setWorking(""); }
  };

  const invite = async () => {
    if (!companyId || !inviteName.trim() || !inviteEmail.trim()) return;
    setWorking("invite"); setMessage("");
    try {
      await api.post(`/companies/${companyId}/employees`, { name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole });
      setInviteName(""); setInviteEmail(""); setInviteRole("colaborador");
      setMessage("Convite enviado.");
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível convidar a pessoa.");
    } finally { setWorking(""); }
  };

  const changeRole = async (member: any, admin: boolean) => {
    if (!companyId) return;
    setWorking(`member-${member.id}`); setMessage("");
    try {
      await api.put(`/companies/${companyId}/employees/${member.id}/role`, { isCompanyAdmin: admin });
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível alterar o nível de acesso.");
    } finally { setWorking(""); }
  };

  const subscribe = async (plan: "PLUS" | "ELITE") => {
    setWorking(`plan-${plan}`); setMessage("");
    try {
      const response = await api.post("/company/plans/checkout", { plan, payer: {} });
      const result = response.data || {};
      setCheckout(result);
      const url = result?.metadata?.subscriptionCheckoutUrl || result?.metadata?.ticketUrl || result?.ticketUrl || result?.checkoutUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      setMessage(result?.message || (url ? "Checkout aberto em uma nova aba." : "Cobrança criada. Confira os dados abaixo."));
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível iniciar a assinatura.");
    } finally { setWorking(""); }
  };

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>;
  if (!companyId || !company) return <CompanyRegistrationFlow onComplete={() => window.location.reload()} />;

  return <div className="mx-auto max-w-6xl space-y-6 pb-16">
    <header className="rounded-[30px] bg-[#1c211e] p-6 text-white sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">Empresa</p><h1 className="mt-2 font-serif text-3xl font-black">{company.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Um único perfil empresarial para Recrutamento e Marketplace. Dados da empresa ficam aqui; configurações específicas continuam dentro de cada módulo.</p></div>
        <VerificationBadge verified={Boolean(company.isVerified || company.verificationStatus === "VERIFIED")} />
      </div>
    </header>

    <CompanyTabs active={section} />
    {message && <div className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-bold text-white">{message}</div>}

    {section === "commercial" && <CommercialSection company={company} name={name} setName={setName} description={description} setDescription={setDescription} logoURL={logoURL} setLogoURL={setLogoURL} website={website} setWebsite={setWebsite} phone={phone} setPhone={setPhone} sameAddress={sameAddress} setSameAddress={setSameAddress} address={address} setAddress={setAddress} city={city} setCity={setCity} state={state} setState={setState} rapi10CatalogOptIn={rapi10CatalogOptIn} setRapi10CatalogOptIn={setRapi10CatalogOptIn} businessHoursText={businessHoursText} setBusinessHoursText={setBusinessHoursText} specialDatesText={specialDatesText} setSpecialDatesText={setSpecialDatesText} servicesText={servicesText} setServicesText={setServicesText} working={working} onSave={saveCommercial} onRefreshRegistry={refreshRegistry} />}
    {section === "finance" && <FinanceSection plans={plans} checkout={checkout} working={working} onSubscribe={subscribe} />}
    {section === "team" && <TeamSection employees={employees} userId={user?.uid || ""} inviteName={inviteName} setInviteName={setInviteName} inviteEmail={inviteEmail} setInviteEmail={setInviteEmail} inviteRole={inviteRole} setInviteRole={setInviteRole} working={working} onInvite={invite} onChangeRole={changeRole} />}
    {section === "settings" && <SettingsSection company={company} />}
  </div>;
}

function CompanyTabs({ active }: { active: CompanyProfileSection }) {
  const items = [
    ["commercial", "/company/comercial", "Comercial", Store],
    ["finance", "/company/financeiro", "Financeiro", WalletCards],
    ["team", "/company/equipe", "Equipe e permissões", Users],
    ["verification", "/company/verificacao", "Verificação", ShieldCheck],
    ["settings", "/company/configuracoes", "Configurações", Settings2],
  ] as const;
  return <nav className="flex gap-2 overflow-x-auto rounded-[24px] bg-white p-2 ring-1 ring-stone-200">{items.map(([id,to,label,Icon]) => <Link key={id} to={to} className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black ${active === id ? "bg-stone-950 text-white" : "text-stone-500 hover:bg-stone-50"}`}><Icon className="h-4 w-4" />{label}</Link>)}</nav>;
}

function CommercialSection(props: any) {
  const { company, name, setName, description, setDescription, logoURL, setLogoURL, website, setWebsite, phone, setPhone, sameAddress, setSameAddress, address, setAddress, city, setCity, state, setState, rapi10CatalogOptIn, setRapi10CatalogOptIn, businessHoursText, setBusinessHoursText, specialDatesText, setSpecialDatesText, servicesText, setServicesText, working, onSave, onRefreshRegistry } = props;
  const legalAddress = [company.legalAddress, [company.legalCity, company.legalState].filter(Boolean).join("/")].filter(Boolean).join(", ");
  return <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
    <section className="rounded-[28px] bg-white p-5 ring-1 ring-stone-200 sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Dados jurídicos</p><h2 className="mt-1 text-xl font-black">{company.hasCnpj ? "Consulta pública do CNPJ" : "Empresa sem CNPJ"}</h2></div>{company.hasCnpj && <button onClick={() => void onRefreshRegistry()} disabled={working === "cnpj"} className="inline-flex h-10 items-center gap-2 rounded-xl bg-stone-100 px-3 text-xs font-black disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${working === "cnpj" ? "animate-spin" : ""}`} />Atualizar</button>}</div>
      {company.hasCnpj ? <div className="mt-5 space-y-3"><LegalLine label="CNPJ" value={company.cnpj}/><LegalLine label="Razão social" value={company.legalName}/><LegalLine label="Nome fantasia cadastral" value={company.registryTradeName || "Não informado"}/><LegalLine label="Situação" value={company.cnpjSituation || "Não informada"}/><LegalLine label="Endereço jurídico" value={legalAddress || "Não informado"}/><p className="pt-2 text-[10px] leading-4 text-stone-400">Esses dados vêm da consulta pública e não são editados manualmente. Se o cadastro público mudar, o PiraNegócios sinaliza a alteração.</p></div> : <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">A empresa pode usar a plataforma sem CNPJ, porém permanece não verificada e recursos reservados a empresas verificadas ficam indisponíveis.</div>}
      {company.cnpjChangeAlert && <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0" /><span>Encontramos alteração nos dados públicos desde a consulta anterior. Confira antes de continuar.</span></div>}
      {company.hasCnpj && !(company.isVerified || company.verificationStatus === "VERIFIED") && <Link to="/company/verificacao" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white"><ShieldCheck className="h-4 w-4" />Concluir verificação simples</Link>}
    </section>

    <section className="rounded-[28px] bg-white p-5 ring-1 ring-stone-200 sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#397c75]">Perfil comercial</p><h2 className="mt-1 text-xl font-black">Como a empresa aparece no PiraNegócios</h2>
      <div className="mt-5 space-y-4"><FileUpload label="Logotipo" accept="image/*" value={logoURL} onChange={setLogoURL} type="avatar" placeholder="Logo da empresa" /><Field label="Nome comercial"><input value={name} onChange={e => setName(e.target.value)} className={inputClass} /></Field><Field label="Apresentação"><textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className={inputClass} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Telefone comercial"><input value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} /></Field><Field label="Site"><input value={website} onChange={e => setWebsite(e.target.value)} className={inputClass} placeholder="https://" /></Field></div>
      <label className="flex items-start gap-3 rounded-2xl bg-stone-50 p-4"><input type="checkbox" checked={sameAddress} onChange={e => setSameAddress(e.target.checked)} className="mt-1 h-4 w-4" /><span className="text-xs leading-5 text-stone-600"><strong className="block text-stone-900">Endereço comercial igual ao jurídico</strong>Quando marcado, o endereço comercial acompanha a consulta do CNPJ.</span></label>
      {!sameAddress && <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr_.45fr]"><Field label="Endereço comercial"><input value={address} onChange={e => setAddress(e.target.value)} className={inputClass} /></Field><Field label="Cidade"><input value={city} onChange={e => setCity(e.target.value)} className={inputClass} /></Field><Field label="UF"><input maxLength={2} value={state} onChange={e => setState(e.target.value.toUpperCase())} className={inputClass} /></Field></div>}
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
        <label className="flex items-start gap-3"><input type="checkbox" checked={rapi10CatalogOptIn} onChange={e => setRapi10CatalogOptIn(e.target.checked)} className="mt-1 h-4 w-4" /><span className="text-xs leading-5 text-stone-600"><strong className="block text-stone-900">Exibir no Catálogo Rapi10</strong>Ligado por padrão para empresas verificadas. A Central Rapi10 ainda confirma o ponto no mapa e a categoria antes da publicação.</span></label>
      </div>
      <Field label="Horário de funcionamento"><textarea value={businessHoursText} onChange={e => setBusinessHoursText(e.target.value)} rows={5} className={inputClass} placeholder={'Seg a Sex · 08:00 às 18:00
Sáb · 08:00 às 13:00
Dom · Fechado'} /><span className="mt-1 block text-[10px] leading-4 text-stone-400">Uma linha por período. Essas informações aparecem no Catálogo Rapi10 e ajudam o cliente a entender quando o estabelecimento funciona.</span></Field>
      <Field label="Datas e horários especiais"><textarea value={specialDatesText} onChange={e => setSpecialDatesText(e.target.value)} rows={4} className={inputClass} placeholder={'24/12/2026 · 08:00 às 14:00 · Véspera de Natal
25/12/2026 · Fechado · Natal'} /></Field>
      <Field label="Produtos, serviços ou atividades"><textarea value={servicesText} onChange={e => setServicesText(e.target.value)} rows={3} className={inputClass} placeholder={'Almoço executivo
Delivery
Eventos e encomendas'} /><span className="mt-1 block text-[10px] leading-4 text-stone-400">Use uma linha ou vírgula por item. Ajuda clientes a entenderem rapidamente o que o estabelecimento oferece.</span></Field>
      <button onClick={() => void onSave()} disabled={working === "commercial"} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0d4542] px-5 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{working === "commercial" ? "Salvando..." : "Salvar perfil comercial"}</button></div>
    </section>
  </div>;
}

function FinanceSection({ plans, checkout, working, onSubscribe }: any) {
  const current = plans?.current;
  return <div className="space-y-5">
    <section className="rounded-[28px] bg-white p-5 ring-1 ring-stone-200 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Plano da empresa</p><h2 className="mt-1 text-2xl font-black">{current?.plan || "Free"}</h2><p className="mt-2 text-xs text-stone-500">Planos empresariais são compartilhados entre os recursos elegíveis. Configurações financeiras específicas do Marketplace continuam no próprio Marketplace.</p></div><Link to="/classificados/recebimentos" className="inline-flex items-center gap-2 rounded-2xl bg-[#009ee3] px-4 py-3 text-xs font-black text-white"><CreditCard className="h-4 w-4" />Recebimentos do Marketplace</Link></div></section>
    <div className="grid gap-4 lg:grid-cols-3">{(plans?.plans || []).map((plan: any) => <article key={plan.id} className={`rounded-[28px] bg-white p-5 ring-1 ${plan.current ? "ring-2 ring-emerald-500" : "ring-stone-200"}`}><div className="flex items-center justify-between"><h3 className="text-xl font-black">{plan.name}</h3>{plan.current && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-700">Atual</span>}</div><p className="mt-2 text-2xl font-black">{plan.priceCents ? `${money(plan.priceCents / 100)}/mês` : "Grátis"}</p><p className="mt-3 text-xs leading-5 text-stone-500">{plan.description}</p><ul className="mt-4 space-y-2 text-xs text-stone-600">{(plan.features || []).slice(0, 8).map((feature: string) => <li key={feature} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{feature}</li>)}</ul>{plan.id !== "FREE" && !plan.current && <button onClick={() => void onSubscribe(plan.id)} disabled={Boolean(working)} className="mt-5 h-11 w-full rounded-xl bg-stone-950 text-xs font-black text-white disabled:opacity-50">{working === `plan-${plan.id}` ? "Preparando..." : `Contratar ${plan.name}`}</button>}</article>)}</div>
    {checkout?.pixCopyPaste && <section className="rounded-[24px] bg-white p-5 ring-1 ring-stone-200"><p className="text-sm font-black">Pix da assinatura</p><textarea readOnly value={checkout.pixCopyPaste} rows={3} className="mt-3 w-full rounded-xl bg-stone-50 p-3 text-xs" /><button onClick={() => navigator.clipboard?.writeText(checkout.pixCopyPaste)} className="mt-2 rounded-xl bg-stone-900 px-4 py-2 text-xs font-black text-white">Copiar Pix</button></section>}
  </div>;
}

function TeamSection({ employees, userId, inviteName, setInviteName, inviteEmail, setInviteEmail, inviteRole, setInviteRole, working, onInvite, onChangeRole }: any) {
  return <div className="space-y-5"><section className="rounded-[28px] bg-white p-5 ring-1 ring-stone-200 sm:p-6"><div className="flex items-start gap-3"><Users className="h-5 w-5 text-[#397c75]" /><div><h2 className="text-xl font-black">Equipe e permissões</h2><p className="mt-1 text-xs leading-5 text-stone-500">O administrador principal pode conceder acesso à empresa. Recrutamento, Marketplace, Financeiro, Perfil e Equipe são domínios separados na camada de permissões.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_.65fr_auto]"><input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Nome" className={inputClass} /><input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="E-mail" className={inputClass} /><select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className={inputClass}><option value="colaborador">Colaborador</option><option value="admin">Administrador</option></select><button onClick={() => void onInvite()} disabled={working === "invite" || !inviteName.trim() || !inviteEmail.trim()} className="rounded-xl bg-[#0d4542] px-4 text-xs font-black text-white disabled:opacity-40">Convidar</button></div></section>
    <section className="overflow-hidden rounded-[28px] bg-white ring-1 ring-stone-200"><div className="border-b border-stone-100 p-5"><h3 className="font-black">Pessoas vinculadas</h3></div><div className="divide-y divide-stone-100">{employees.length ? employees.map((member: any) => <div key={member.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black">{member.name || member.displayName || member.email}</p><p className="mt-1 text-xs text-stone-400">{member.email}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${member.isCompanyAdmin ? "bg-violet-50 text-violet-700" : "bg-stone-100 text-stone-600"}`}>{member.isCompanyAdmin ? "Administrador" : "Colaborador"}</span>{member.id !== userId && <select disabled={working === `member-${member.id}`} value={member.isCompanyAdmin ? "admin" : "colaborador"} onChange={e => void onChangeRole(member, e.target.value === "admin")} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold"><option value="colaborador">Colaborador</option><option value="admin">Administrador</option></select>}</div></div>) : <div className="p-10 text-center text-sm text-stone-400">Nenhuma outra pessoa vinculada.</div>}</div><div className="border-t border-stone-100 bg-stone-50 p-4 text-[10px] leading-4 text-stone-500">Permissões granulares já existem na camada de autorização societária. A edição individual dos colaboradores será aplicada sobre os mesmos domínios: {Object.values(permissionLabels).join(", ")}.</div></section>
  </div>;
}

function SettingsSection({ company }: { company: any }) {
  return <div className="grid gap-4 md:grid-cols-2"><Link to="/company/verificacao" className="rounded-[26px] bg-white p-5 ring-1 ring-stone-200"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h2 className="mt-4 font-black">Verificação cadastral</h2><p className="mt-2 text-xs leading-5 text-stone-500">CNPJ público, responsável, selfie e aceite. Sem upload obrigatório de contrato social ou cartão CNPJ.</p></Link><Link to="/company/notificacoes" className="rounded-[26px] bg-white p-5 ring-1 ring-stone-200"><Bell className="h-5 w-5 text-violet-600" /><h2 className="mt-4 font-black">Notificações e contato</h2><p className="mt-2 text-xs leading-5 text-stone-500">Escolha alertas e horários preferenciais para não receber mensagens comerciais de madrugada.</p></Link><Link to="/company/pagina" className="rounded-[26px] bg-white p-5 ring-1 ring-stone-200"><Globe2 className="h-5 w-5 text-blue-600" /><h2 className="mt-4 font-black">Página pública da empresa</h2><p className="mt-2 text-xs leading-5 text-stone-500">Gerencie a presença pública compartilhada entre Recrutamento e Marketplace.</p></Link><Link to="/classificados/configuracoes" className="rounded-[26px] bg-white p-5 ring-1 ring-stone-200"><Store className="h-5 w-5 text-[#397c75]" /><h2 className="mt-4 font-black">Configurações do Marketplace</h2><p className="mt-2 text-xs leading-5 text-stone-500">Preferências que só fazem sentido para vendas e Classificados ficam no módulo Marketplace.</p></Link><section className="md:col-span-2 rounded-[26px] bg-stone-950 p-5 text-white"><div className="flex items-start gap-3"><UserCog className="h-5 w-5 text-stone-300" /><div><h2 className="font-black">Identidade empresarial única</h2><p className="mt-2 text-xs leading-5 text-white/55">{company.name} usa os mesmos dados jurídicos, comerciais, equipe e identidade nos módulos de Recrutamento e Marketplace. Você não precisa editar a empresa duas vezes.</p></div></div></section></div>;
}

function VerificationBadge({ verified }: { verified: boolean }) { return <span className={`inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-xs font-black ${verified ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"}`}>{verified ? <BadgeCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{verified ? "Empresa verificada" : "Empresa não verificada"}</span>; }
function LegalLine({ label, value }: { label: string; value?: string | null }) { return <div className="rounded-2xl bg-stone-50 p-3"><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{label}</p><p className="mt-1 text-sm font-bold text-stone-800">{value || "Não informado"}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[.12em] text-stone-500">{label}</span>{children}</label>; }
const inputClass = "min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#397c75]";
function money(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0)); }
