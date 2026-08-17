import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, asArray } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Briefcase, Building2, CheckCircle2, ChevronRight, Loader2, Plus, Search, Shield, Users, X } from 'lucide-react';

type Tab = 'overview' | 'companies' | 'jobs' | 'users';
type Company = { id: string; name: string; cityState?: string; phone?: string; verificationStatus: string };
type Job = { id: string; title: string; companyId: string; companyName: string; location?: string; active: boolean };
type PlatformUser = { id: string; email?: string; displayName?: string; fullName?: string; type?: string; createdAt: string };
type Summary = { companies: number; pendingCompanies: number; activeJobs: number; users: number };
type AccessRequest = { id: string; requesterName: string; requesterEmail: string; companyName: string };

const statusStyle: Record<string, string> = { VERIFIED: 'bg-emerald-100 text-emerald-800', PENDING: 'bg-amber-100 text-amber-800', REJECTED: 'bg-red-100 text-red-800', DRAFT: 'bg-stone-100 text-stone-600' };

export function AdminDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [companyFormOpen, setCompanyFormOpen] = useState(false);
  const [jobFormOpen, setJobFormOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: '', cityState: '', phone: '', cnpj: '', verificationStatus: 'DRAFT' });
  const [jobForm, setJobForm] = useState({ companyId: '', title: '', location: '', type: 'CLT', workModel: 'Presencial', salary: '', description: '', acceptsPlatformApplications: true, externalApplicationInstructions: '' });

  const load = useCallback(async (currentTab = tab) => {
    setLoading(true); setError('');
    try {
      const requests: Promise<any>[] = [api.get('/admin/summary')];
      if (currentTab === 'companies' || currentTab === 'overview') requests.push(api.get('/admin/companies'));
      if (currentTab === 'jobs' || currentTab === 'overview') requests.push(api.get('/admin/jobs'));
      if (currentTab === 'users' || currentTab === 'overview') requests.push(api.get('/admin/users'));
      if (currentTab === 'overview') requests.push(api.get('/admin/company-access-requests'));
      const responses = await Promise.all(requests);
      setSummary(responses[0].data);
      let index = 1;
      if (currentTab === 'companies' || currentTab === 'overview') setCompanies(asArray(responses[index++].data));
      if (currentTab === 'jobs' || currentTab === 'overview') setJobs(asArray(responses[index++].data));
      if (currentTab === 'users' || currentTab === 'overview') setUsers(asArray(responses[index++].data));
      if (currentTab === 'overview') setAccessRequests(asArray(responses[index++].data));
    } catch (requestError: any) { setError(requestError.response?.data?.message || 'Não foi possível carregar os dados administrativos.'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(tab); }, [load, tab]);
  const switchTab = (nextTab: Tab) => { setSearch(''); setTab(nextTab); };

  const submitCompany = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await api.post('/admin/companies', companyForm);
      setCompanyFormOpen(false); setCompanyForm({ name: '', cityState: '', phone: '', cnpj: '', verificationStatus: 'DRAFT' });
      await load('companies');
    } catch (requestError: any) { setError(requestError.response?.data?.message || 'Não foi possível criar a empresa.'); }
    finally { setSaving(false); }
  };
  const submitJob = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await api.post('/admin/jobs', jobForm);
      setJobFormOpen(false); setJobForm({ companyId: '', title: '', location: '', type: 'CLT', workModel: 'Presencial', salary: '', description: '', acceptsPlatformApplications: true, externalApplicationInstructions: '' });
      await load('jobs');
    } catch (requestError: any) { setError(requestError.response?.data?.message || 'Não foi possível publicar a vaga.'); }
    finally { setSaving(false); }
  };
  const updateCompanyStatus = async (company: Company, verificationStatus: string) => {
    try { await api.put(`/admin/companies/${company.id}`, { verificationStatus }); await load('companies'); }
    catch (requestError: any) { setError(requestError.response?.data?.message || 'Não foi possível atualizar a empresa.'); }
  };
  const toggleJob = async (job: Job) => {
    try { await api.put(`/admin/jobs/${job.id}`, { active: !job.active }); await load('jobs'); }
    catch (requestError: any) { setError(requestError.response?.data?.message || 'Não foi possível atualizar a vaga.'); }
  };
  const deleteJob = async (job: Job) => {
    if (!window.confirm(`Excluir permanentemente a vaga “${job.title}”?`)) return;
    try { await api.delete(`/admin/jobs/${job.id}`); await load('jobs'); }
    catch (requestError: any) { setError(requestError.response?.data?.message || 'Não foi possível excluir a vaga.'); }
  };
  const reviewAccessRequest = async (request: AccessRequest, action: 'approve' | 'reject', role: 'admin' | 'colaborador' = 'colaborador') => {
    try { await api.put(`/admin/company-access-requests/${request.id}`, { action, role }); await load('overview'); }
    catch (requestError: any) { setError(requestError.response?.data?.message || 'Não foi possível processar a solicitação.'); }
  };

  if (profile?.type !== 'ADMIN') return <div className="p-8 text-center font-bold text-red-700">Acesso restrito à administração.</div>;
  const normalizedSearch = search.trim().toLowerCase();
  const filteredCompanies = companies.filter(company => `${company.name} ${company.cityState || ''}`.toLowerCase().includes(normalizedSearch));
  const filteredJobs = jobs.filter(job => `${job.title} ${job.companyName} ${job.location || ''}`.toLowerCase().includes(normalizedSearch));
  const filteredUsers = users.filter(user => `${user.fullName || ''} ${user.displayName || ''} ${user.email || ''}`.toLowerCase().includes(normalizedSearch));

  return <div className="max-w-7xl mx-auto space-y-6">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">Operação da plataforma</p><h1 className="mt-1 flex items-center gap-3 text-3xl font-serif font-bold text-stone-900"><Shield className="text-terracotta-600" /> Administração</h1><p className="mt-1 text-stone-500">Cadastre empresas, publique vagas em nome delas e acompanhe a operação.</p></div><div className="flex gap-2"><button onClick={() => setCompanyFormOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 hover:bg-stone-50"><Building2 className="h-4 w-4" /> Nova empresa</button><button onClick={() => { setJobForm(prev => ({ ...prev, companyId: prev.companyId || companies[0]?.id || '' })); setJobFormOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-terracotta-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-terracotta-700"><Plus className="h-4 w-4" /> Publicar vaga</button></div></header>
    <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-1.5" aria-label="Seções administrativas">{([['overview', 'Visão geral'], ['companies', 'Empresas'], ['jobs', 'Vagas'], ['users', 'Usuários']] as const).map(([id, label]) => <button key={id} onClick={() => switchTab(id)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${tab === id ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'}`}>{label}</button>)}</nav>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"><span>{error}</span><button onClick={() => setError('')} aria-label="Fechar aviso"><X className="h-4 w-4" /></button></div>}
    {loading ? <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-terracotta-600" /></div> : <>
      {tab === 'overview' && <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[[Building2, summary?.companies || 0, 'Empresas cadastradas', 'companies'], [CheckCircle2, summary?.pendingCompanies || 0, 'Pendentes de análise', 'companies'], [Briefcase, summary?.activeJobs || 0, 'Vagas ativas', 'jobs'], [Users, summary?.users || 0, 'Usuários', 'users']].map(([Icon, value, label, destination]: any) => <button key={label} onClick={() => switchTab(destination)} className="rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-terracotta-200"><Icon className="h-5 w-5 text-terracotta-600" /><p className="mt-4 text-3xl font-bold text-stone-900">{value}</p><p className="mt-1 text-sm text-stone-500">{label}</p></button>)}</div>{accessRequests.length > 0 && <section className="rounded-2xl border border-terracotta-200 bg-terracotta-50 p-5"><h2 className="font-bold text-terracotta-900">Solicitações de vínculo pendentes</h2><p className="mt-1 text-sm text-terracotta-800">Estas empresas ainda não têm um gestor corporativo para avaliar o pedido.</p><div className="mt-4 divide-y divide-terracotta-100">{accessRequests.map(request => <div key={request.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-stone-900">{request.requesterName} <span className="font-normal text-stone-500">quer acessar {request.companyName}</span></p><p className="text-xs text-stone-600">{request.requesterEmail}</p></div><div className="flex gap-2"><button onClick={() => reviewAccessRequest(request, 'approve', 'colaborador')} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-stone-700">Colaborador</button><button onClick={() => reviewAccessRequest(request, 'approve', 'admin')} className="rounded-lg bg-terracotta-600 px-3 py-2 text-xs font-bold text-white">Aprovar como admin</button><button onClick={() => reviewAccessRequest(request, 'reject')} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Recusar</button></div></div>)}</div></section>}<div className="grid gap-6 lg:grid-cols-2"><Preview title="Empresas recentes" onClick={() => switchTab('companies')}>{companies.slice(0, 5).map(company => <div className="flex items-center justify-between border-t border-stone-100 py-3 first:border-0" key={company.id}><div><p className="font-semibold text-stone-800">{company.name}</p><p className="text-xs text-stone-500">{company.cityState || 'Localização não informada'}</p></div><Status status={company.verificationStatus} /></div>)}</Preview><Preview title="Vagas recentes" onClick={() => switchTab('jobs')}>{jobs.slice(0, 5).map(job => <div className="flex items-center justify-between border-t border-stone-100 py-3 first:border-0" key={job.id}><div><p className="font-semibold text-stone-800">{job.title}</p><p className="text-xs text-stone-500">{job.companyName}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${job.active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>{job.active ? 'Ativa' : 'Inativa'}</span></div>)}</Preview></div></div>}
      {tab !== 'overview' && <div className="rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-stone-900">{tab === 'companies' ? 'Empresas' : tab === 'jobs' ? 'Vagas' : 'Usuários'}</h2><p className="text-sm text-stone-500">{tab === 'companies' ? 'Verifique empresas e publique oportunidades vinculadas.' : tab === 'jobs' ? 'Modere e acompanhe as vagas publicadas.' : 'Consulta de contas registradas na plataforma.'}</p></div><label className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-stone-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar..." className="rounded-xl border border-stone-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-terracotta-500" /></label></div><div className="overflow-x-auto">{tab === 'companies' && <CompaniesTable companies={filteredCompanies} onVerify={updateCompanyStatus} onCreateJob={company => { setJobForm(prev => ({ ...prev, companyId: company.id })); setJobFormOpen(true); }} />}{tab === 'jobs' && <JobsTable jobs={filteredJobs} onToggle={toggleJob} onDelete={deleteJob} />}{tab === 'users' && <UsersTable users={filteredUsers} />}</div></div>}
    </>}
    {companyFormOpen && <Modal title="Cadastrar empresa" onClose={() => setCompanyFormOpen(false)}><form onSubmit={submitCompany} className="space-y-4"><Field label="Nome da empresa *"><input required value={companyForm.name} onChange={event => setCompanyForm({ ...companyForm, name: event.target.value })} className="input" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Cidade / Estado"><input value={companyForm.cityState} onChange={event => setCompanyForm({ ...companyForm, cityState: event.target.value })} className="input" placeholder="Piracicaba - SP" /></Field><Field label="Telefone"><input value={companyForm.phone} onChange={event => setCompanyForm({ ...companyForm, phone: event.target.value })} className="input" /></Field><Field label="CNPJ"><input value={companyForm.cnpj} onChange={event => setCompanyForm({ ...companyForm, cnpj: event.target.value })} className="input" /></Field><Field label="Situação inicial"><select value={companyForm.verificationStatus} onChange={event => setCompanyForm({ ...companyForm, verificationStatus: event.target.value })} className="input"><option value="DRAFT">Rascunho</option><option value="VERIFIED">Verificada</option></select></Field></div><Actions saving={saving} text="Cadastrar empresa" /></form></Modal>}
    {jobFormOpen && <Modal title="Publicar vaga em nome de empresa" onClose={() => setJobFormOpen(false)}><form onSubmit={submitJob} className="space-y-4"><Field label="Empresa *"><select required value={jobForm.companyId} onChange={event => setJobForm({ ...jobForm, companyId: event.target.value })} className="input"><option value="">Selecione uma empresa</option>{companies.map(company => <option value={company.id} key={company.id}>{company.name}</option>)}</select></Field><Field label="Título da vaga *"><input required value={jobForm.title} onChange={event => setJobForm({ ...jobForm, title: event.target.value })} className="input" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Localização"><input value={jobForm.location} onChange={event => setJobForm({ ...jobForm, location: event.target.value })} className="input" /></Field><Field label="Contrato"><select value={jobForm.type} onChange={event => setJobForm({ ...jobForm, type: event.target.value })} className="input"><option>CLT</option><option>PJ</option><option>Estágio</option><option>Freelancer</option></select></Field></div><Field label="Descrição *"><textarea required rows={5} value={jobForm.description} onChange={event => setJobForm({ ...jobForm, description: event.target.value })} className="input" /></Field><label className="flex gap-3 rounded-xl border border-stone-200 p-3 text-sm"><input type="checkbox" checked={jobForm.acceptsPlatformApplications} onChange={event => setJobForm({ ...jobForm, acceptsPlatformApplications: event.target.checked })} /> <span><strong>Receber candidaturas pela plataforma</strong><small className="mt-1 block text-stone-500">Desmarque para informar um canal externo.</small></span></label>{!jobForm.acceptsPlatformApplications && <Field label="Instruções para envio externo *"><textarea required rows={3} value={jobForm.externalApplicationInstructions} onChange={event => setJobForm({ ...jobForm, externalApplicationInstructions: event.target.value })} className="input" /></Field>}<Actions saving={saving} text="Publicar vaga" /></form></Modal>}
  </div>;
}

function Preview({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) { return <section className="rounded-2xl border border-stone-200 bg-white p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-stone-900">{title}</h2><button onClick={onClick} className="text-sm font-bold text-terracotta-700">Ver todas</button></div>{children}</section>; }
function Status({ status }: { status: string }) { return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[status] || statusStyle.DRAFT}`}>{status === 'VERIFIED' ? 'Verificada' : status === 'PENDING' ? 'Pendente' : status === 'REJECTED' ? 'Recusada' : 'Rascunho'}</span>; }
function Empty({ colSpan, text }: { colSpan: number; text: string }) { return <tr><td colSpan={colSpan} className="px-5 py-12 text-center text-stone-500">{text}</td></tr>; }
function CompaniesTable({ companies, onVerify, onCreateJob }: { companies: Company[]; onVerify: (company: Company, status: string) => void; onCreateJob: (company: Company) => void }) { return <table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-5 py-3">Empresa</th><th className="px-5 py-3">Localização</th><th className="px-5 py-3">Situação</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody>{companies.map(company => <tr key={company.id} className="border-t border-stone-100"><td className="px-5 py-4 font-bold text-stone-800">{company.name}<span className="mt-1 block font-normal text-stone-500">{company.phone || 'Sem telefone'}</span></td><td className="px-5 py-4 text-stone-600">{company.cityState || '—'}</td><td className="px-5 py-4"><Status status={company.verificationStatus} /></td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => onVerify(company, company.verificationStatus === 'VERIFIED' ? 'DRAFT' : 'VERIFIED')} className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-200">{company.verificationStatus === 'VERIFIED' ? 'Remover selo' : 'Verificar'}</button><button onClick={() => onCreateJob(company)} className="rounded-lg bg-terracotta-50 px-3 py-1.5 text-xs font-bold text-terracotta-700 hover:bg-terracotta-100">Criar vaga</button></div></td></tr>)}{companies.length === 0 && <Empty colSpan={4} text="Nenhuma empresa encontrada." />}</tbody></table>; }
function JobsTable({ jobs, onToggle, onDelete }: { jobs: Job[]; onToggle: (job: Job) => void; onDelete: (job: Job) => void }) { return <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-5 py-3">Vaga</th><th className="px-5 py-3">Empresa</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody>{jobs.map(job => <tr key={job.id} className="border-t border-stone-100"><td className="px-5 py-4 font-bold text-stone-800">{job.title}<span className="mt-1 block font-normal text-stone-500">{job.location || 'Localização não informada'}</span></td><td className="px-5 py-4 text-stone-600">{job.companyName}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${job.active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>{job.active ? 'Ativa' : 'Inativa'}</span></td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-2"><Link to={`/dashboard/vaga/${job.id}`} className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-200">Gerenciar</Link><button onClick={() => onToggle(job)} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100">{job.active ? 'Desativar' : 'Ativar'}</button><button onClick={() => onDelete(job)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100">Excluir</button></div></td></tr>)}{jobs.length === 0 && <Empty colSpan={4} text="Nenhuma vaga encontrada." />}</tbody></table>; }
function UsersTable({ users }: { users: PlatformUser[] }) { return <table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-5 py-3">Usuário</th><th className="px-5 py-3">E-mail</th><th className="px-5 py-3">Perfil</th><th className="px-5 py-3">Cadastro</th></tr></thead><tbody>{users.map(user => <tr key={user.id} className="border-t border-stone-100"><td className="px-5 py-4 font-bold text-stone-800">{user.fullName || user.displayName || 'Sem nome'}</td><td className="px-5 py-4 text-stone-600">{user.email || '—'}</td><td className="px-5 py-4"><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-700">{user.type || 'Pendente'}</span></td><td className="px-5 py-4 text-stone-600">{new Date(user.createdAt).toLocaleDateString('pt-BR')}</td></tr>)}{users.length === 0 && <Empty colSpan={4} text="Nenhum usuário encontrado." />}</tbody></table>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">{label}</span>{children}</label>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4" role="dialog" aria-modal="true"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4"><h2 className="font-serif text-xl font-bold text-stone-900">{title}</h2><button onClick={onClose} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fechar"><X className="h-5 w-5" /></button></div><div className="p-6">{children}</div></div></div>; }
function Actions({ saving, text }: { saving: boolean; text: string }) { return <div className="flex justify-end gap-3 border-t border-stone-100 pt-4"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-terracotta-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-terracotta-700 disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{text}<ChevronRight className="h-4 w-4" /></button></div>; }
