import React, { useEffect, useState } from "react";
import { AlertTriangle, Eye, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

function dateLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
}

export function BoostVisibilityBanner() {
  const { profile, refreshProfile } = useAuth();
  const [boost, setBoost] = useState<any>(null);
  const [activating, setActivating] = useState(false);

  const load = async () => {
    try {
      const response = await api.get("/payments/me/billing-status");
      const entitlement = (response.data?.entitlements || []).find((item: any) => item.feature === "RESUME_BOOST" && item.active);
      setBoost(entitlement || null);
    } catch {
      setBoost(null);
    }
  };

  useEffect(() => { void load(); }, [profile?.id]);

  if (!boost) return null;
  const visible = profile?.isOpenToWork === true;

  const activateVisibility = async () => {
    setActivating(true);
    try {
      await api.post("/users/me", { isOpenToWork: true });
      await refreshProfile();
      await load();
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className={`mb-5 overflow-hidden rounded-[22px] border p-4 shadow-sm ${visible ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-lime-50" : "border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white ${visible ? "bg-emerald-600" : "bg-orange-500"}`}>
          {visible ? <Zap className="h-4 w-4 animate-pulse" /> : <AlertTriangle className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-black uppercase tracking-[.15em] ${visible ? "text-emerald-700" : "text-orange-700"}`}>Impulso ativo</p>
          <p className="mt-0.5 text-sm font-bold text-stone-900">{visible ? "Seu currículo está em destaque" : "Banco de Talentos oculto"}</p>
          <p className="mt-1 text-xs leading-5 text-stone-600">{visible ? `Seu Impulso está funcionando no Banco de Talentos e nas candidaturas${boost.expiresAt ? ` até ${dateLabel(boost.expiresAt)}` : ""}.` : `Seu Impulso continua funcionando normalmente nas candidaturas${boost.expiresAt ? ` até ${dateLabel(boost.expiresAt)}` : ""}, mas seu currículo não aparece no Banco de Talentos enquanto “Estou buscando oportunidades” estiver desligado.`}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {!visible && <button type="button" onClick={() => void activateVisibility()} disabled={activating} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Eye className="h-3.5 w-3.5" /> {activating ? "Ativando..." : "Exibir meu currículo"}</button>}
          <Link to="/user/pagamentos" className={`inline-flex items-center rounded-xl border px-3 py-2.5 text-xs font-bold ${visible ? "border-emerald-200 bg-white/70 text-emerald-800" : "border-orange-200 bg-white/70 text-orange-800"}`}>Ver benefício</Link>
        </div>
      </div>
    </div>
  );
}