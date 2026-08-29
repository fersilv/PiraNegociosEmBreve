import React, { useEffect, useState } from "react";
import { Loader2, Trash2, UserMinus, Users } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

type Employee = {
  id: string;
  email?: string | null;
  name?: string | null;
  displayName?: string | null;
  fullName?: string | null;
  socialName?: string | null;
  isCompanyAdmin?: boolean;
};

export function CompanyEmployeeRemovalPanel() {
  const { user, profile, refreshProfile } = useAuth();
  const companyId = profile?.companyId;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [employeesResponse, companyResponse] = await Promise.all([
        api.get(`/companies/${companyId}/employees`),
        api.get(`/companies/${companyId}`),
      ]);
      setEmployees(Array.isArray(employeesResponse.data) ? employeesResponse.data : []);
      setOwnerId(companyResponse.data?.ownerId || null);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível carregar os vínculos da empresa.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [companyId]);

  const remove = async (member: Employee) => {
    if (!companyId || member.id === ownerId || member.id === user?.uid) return;
    const label = member.socialName || member.displayName || member.fullName || member.name || member.email || "esta pessoa";
    if (!window.confirm(`Remover ${label} da empresa? O acesso empresarial e as permissões serão revogados.`)) return;
    setRemovingId(member.id);
    setMessage("");
    try {
      await api.delete(`/company-membership/${companyId}/members/${member.id}`);
      setEmployees((current) => current.filter((item) => item.id !== member.id));
      setMessage(`${label} foi removido(a) da empresa.`);
      await refreshProfile();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível remover este vínculo.");
    } finally {
      setRemovingId(null);
    }
  };

  if (!companyId) return null;

  return (
    <section className="mx-auto mt-6 max-w-6xl overflow-hidden rounded-[28px] bg-white ring-1 ring-stone-200">
      <div className="flex items-start gap-3 border-b border-stone-100 p-5 sm:p-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600"><UserMinus className="h-5 w-5" /></span>
        <div>
          <h2 className="font-black text-stone-950">Remover funcionário da empresa</h2>
          <p className="mt-1 text-xs leading-5 text-stone-500">A remoção encerra o vínculo empresarial e revoga as permissões de Business e dos módulos autorizados. A conta pessoal da pessoa continua existindo.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando pessoas vinculadas...</div>
      ) : (
        <div className="divide-y divide-stone-100">
          {employees.map((member) => {
            const isOwner = member.id === ownerId;
            const isSelf = member.id === user?.uid;
            const label = member.socialName || member.displayName || member.fullName || member.name || member.email || "Usuário";
            return (
              <div key={member.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black text-stone-900">{label}</p>
                    {isOwner && <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black uppercase text-amber-700">Proprietário</span>}
                    {member.isCompanyAdmin && !isOwner && <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black uppercase text-violet-700">Administrador</span>}
                  </div>
                  <p className="mt-1 truncate text-xs text-stone-400">{member.email || "Sem e-mail"}</p>
                </div>
                {!isOwner && !isSelf ? (
                  <button type="button" onClick={() => void remove(member)} disabled={removingId === member.id} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:opacity-50">
                    {removingId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Remover da empresa
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-stone-400">{isOwner ? "Vínculo principal protegido" : "Sua própria conta"}</span>
                )}
              </div>
            );
          })}
          {!employees.length && <div className="flex items-center justify-center gap-2 p-8 text-sm text-stone-400"><Users className="h-4 w-4" /> Nenhuma pessoa vinculada.</div>}
        </div>
      )}
      {message && <div className="border-t border-stone-100 bg-stone-50 px-5 py-3 text-xs font-bold text-stone-600">{message}</div>}
    </section>
  );
}
