import React, { useEffect, useMemo, useState } from 'react';
import { Crown, Handshake, Loader2, Save, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { api } from '../lib/api';

type CompanyRole = 'PRIMARY_ADMIN' | 'ADMIN' | 'EMPLOYEE';
type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
type PermissionKey = 'companyProfile' | 'recruitment' | 'marketplace' | 'finance' | 'team';

type CompanyMember = {
  id: string;
  email?: string | null;
  displayName?: string | null;
  fullName?: string | null;
  socialName?: string | null;
  phone?: string | null;
  photoURL?: string | null;
  role: CompanyRole;
  isPartner: boolean;
  permissions?: Partial<Record<PermissionKey, boolean>> | null;
  status: MembershipStatus;
  isOwner: boolean;
};

const PERMISSIONS: Array<{ key: PermissionKey; label: string; hint: string }> = [
  { key: 'companyProfile', label: 'Perfil da empresa', hint: 'Editar dados, identidade e página empresarial.' },
  { key: 'recruitment', label: 'Recrutamento', hint: 'Vagas, candidatos e ferramentas de contratação.' },
  { key: 'marketplace', label: 'Classificados', hint: 'Publicar e administrar produtos e serviços.' },
  { key: 'finance', label: 'Planos e financeiro', hint: 'Planos, cobrança e configurações financeiras.' },
  { key: 'team', label: 'Equipe e permissões', hint: 'Administrar vínculos e acessos da empresa.' },
];

const ROLE_LABEL: Record<CompanyRole, string> = {
  PRIMARY_ADMIN: 'Administrador principal',
  ADMIN: 'Administrador',
  EMPLOYEE: 'Colaborador',
};

const STATUS_LABEL: Record<MembershipStatus, string> = {
  ACTIVE: 'Ativo',
  SUSPENDED: 'Suspenso',
  REVOKED: 'Revogado',
};

export function AdminCompanyMembershipManager({ companyId, companyName }: { companyId: string; companyName?: string }) {
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<Exclude<CompanyRole, 'PRIMARY_ADMIN'>>('EMPLOYEE');
  const [newPartner, setNewPartner] = useState(false);
  const [adding, setAdding] = useState(false);

  const activeCount = useMemo(() => members.filter((member) => member.status === 'ACTIVE').length, [members]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/admin/companies/${companyId}/members`);
      setMembers(Array.isArray(response.data) ? response.data : []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar os vínculos da empresa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [companyId]);

  const patchMember = (id: string, patch: Partial<CompanyMember>) => {
    setMembers((current) => current.map((member) => member.id === id ? { ...member, ...patch } : member));
    setMessage('');
    setError('');
  };

  const patchPermission = (id: string, key: PermissionKey, checked: boolean) => {
    setMembers((current) => current.map((member) => member.id === id
      ? { ...member, permissions: { ...(member.permissions || {}), [key]: checked } }
      : member));
    setMessage('');
    setError('');
  };

  const saveMember = async (member: CompanyMember) => {
    setSavingId(member.id);
    setMessage('');
    setError('');
    try {
      const response = await api.put(`/admin/companies/${companyId}/members/${member.id}`, {
        role: member.role,
        status: member.status,
        isPartner: member.isPartner,
        permissions: member.permissions || {},
      });
      setMembers(Array.isArray(response.data) ? response.data : []);
      setMessage(`Acesso de ${memberName(member)} atualizado.`);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível atualizar este vínculo.');
    } finally {
      setSavingId(null);
    }
  };

  const addMember = async () => {
    if (!email.trim()) {
      setError('Informe o e-mail do usuário que será vinculado.');
      return;
    }
    setAdding(true);
    setMessage('');
    setError('');
    try {
      const response = await api.post(`/admin/companies/${companyId}/members`, {
        email: email.trim(),
        role: newRole,
        isPartner: newPartner,
      });
      setMembers(Array.isArray(response.data) ? response.data : []);
      setEmail('');
      setNewRole('EMPLOYEE');
      setNewPartner(false);
      setMessage('Usuário vinculado à empresa.');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível vincular este usuário.');
    } finally {
      setAdding(false);
    }
  };

  const makeOwner = async (member: CompanyMember) => {
    if (member.isOwner) return;
    if (!window.confirm(`Tornar ${memberName(member)} proprietário(a) de ${companyName || 'esta empresa'}? O proprietário atual continuará como administrador.`)) return;
    setSavingId(member.id);
    setMessage('');
    setError('');
    try {
      const response = await api.put(`/admin/companies/${companyId}/members/${member.id}/owner`);
      setMembers(Array.isArray(response.data) ? response.data : []);
      setMessage(`${memberName(member)} agora é o(a) proprietário(a) principal.`);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível transferir a propriedade da empresa.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-terracotta-600">Governança empresarial</p>
          <h3 className="mt-1 flex items-center gap-2 font-bold text-stone-950"><Users className="h-4 w-4 text-terracotta-600" /> Equipe, sociedade e permissões</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-600">O proprietário, administradores, sócios e colaboradores são vínculos diferentes. Ajuste aqui exatamente o que cada pessoa pode fazer em {companyName || 'esta empresa'}.</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-[10px] font-black text-stone-600">{activeCount} ativo{activeCount === 1 ? '' : 's'}</span>
      </div>

      <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
        <p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-500">Vincular usuário cadastrado</p>
        <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(160px,.7fr)_auto_auto] lg:items-center">
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="email@usuario.com" className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-terracotta-400" />
          <select value={newRole} onChange={(event) => setNewRole(event.target.value as Exclude<CompanyRole, 'PRIMARY_ADMIN'>)} className="h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold">
            <option value="EMPLOYEE">Colaborador</option>
            <option value="ADMIN">Administrador</option>
          </select>
          <label className="flex h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700"><input type="checkbox" checked={newPartner} onChange={(event) => setNewPartner(event.target.checked)} /> Sócio(a)</label>
          <button type="button" onClick={() => void addMember()} disabled={adding} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 text-xs font-black text-white disabled:opacity-50">{adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Vincular</button>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-stone-50 p-4 text-xs font-semibold text-stone-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando equipe e permissões...</div>
      ) : (
        <div className="mt-4 space-y-3">
          {members.map((member) => {
            const owner = member.isOwner;
            const busy = savingId === member.id;
            return (
              <article key={member.id} className={`rounded-2xl border p-4 ${owner ? 'border-amber-200 bg-amber-50/60' : 'border-stone-200 bg-white'}`}>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-stone-950">{memberName(member)}</p>
                      {owner && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-800"><Crown className="h-3 w-3" /> Proprietário</span>}
                      {member.isPartner && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-[9px] font-black uppercase text-violet-700"><Handshake className="h-3 w-3" /> Sócio(a)</span>}
                      <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${member.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : member.status === 'SUSPENDED' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{STATUS_LABEL[member.status]}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-stone-500">{member.email || 'Sem e-mail'}{member.phone ? ` · ${member.phone}` : ''}</p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[480px]">
                    <label className="block"><span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-500">Papel</span><select value={member.role} disabled={owner} onChange={(event) => patchMember(member.id, { role: event.target.value as CompanyRole })} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-2 text-xs font-bold disabled:bg-stone-100"><option value="PRIMARY_ADMIN" disabled={!owner}>{ROLE_LABEL.PRIMARY_ADMIN}</option><option value="ADMIN">{ROLE_LABEL.ADMIN}</option><option value="EMPLOYEE">{ROLE_LABEL.EMPLOYEE}</option></select></label>
                    <label className="block"><span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-500">Vínculo</span><select value={member.status} disabled={owner} onChange={(event) => patchMember(member.id, { status: event.target.value as MembershipStatus })} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-2 text-xs font-bold disabled:bg-stone-100"><option value="ACTIVE">Ativo</option><option value="SUSPENDED">Suspenso</option><option value="REVOKED">Revogado</option></select></label>
                    <label className="mt-4 flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700"><input type="checkbox" checked={Boolean(member.isPartner)} onChange={(event) => patchMember(member.id, { isPartner: event.target.checked })} /> Sócio(a)</label>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {PERMISSIONS.map((permission) => (
                    <label key={permission.key} title={permission.hint} className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${owner ? 'border-amber-200 bg-white/70' : 'border-stone-200 bg-stone-50'}`}>
                      <input type="checkbox" className="mt-0.5" disabled={owner} checked={owner || member.permissions?.[permission.key] === true} onChange={(event) => patchPermission(member.id, permission.key, event.target.checked)} />
                      <span><strong className="block text-stone-800">{permission.label}</strong><span className="mt-0.5 block text-[10px] leading-4 text-stone-500">{permission.hint}</span></span>
                    </label>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-3">
                  {!owner && member.status === 'ACTIVE' && <button type="button" onClick={() => void makeOwner(member)} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-black text-amber-800 disabled:opacity-50"><Crown className="h-4 w-4" /> Tornar proprietário</button>}
                  <button type="button" onClick={() => void saveMember(member)} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl bg-terracotta-600 px-4 text-xs font-black text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : owner ? <ShieldCheck className="h-4 w-4" /> : <Save className="h-4 w-4" />} {owner ? 'Salvar sociedade' : 'Salvar acesso'}</button>
                </div>
              </article>
            );
          })}
          {!members.length && <div className="rounded-xl border border-dashed border-stone-300 p-5 text-center text-xs text-stone-500">Nenhum vínculo encontrado.</div>}
        </div>
      )}

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>}
      {message && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{message}</p>}
    </section>
  );
}

function memberName(member: CompanyMember) {
  return member.socialName || member.displayName || member.fullName || member.email || 'Usuário';
}
