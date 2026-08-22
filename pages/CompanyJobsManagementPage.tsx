import React from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { CompanyDashboard } from "./CompanyDashboard";

export function CompanyJobsManagementPage() {
  return (
    <div className="company-jobs-management space-y-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-terracotta-600">Gestão de vagas</p>
          <h1 className="mt-1 font-serif text-2xl font-bold text-stone-950">Oportunidades da empresa</h1>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">Crie vagas com localização, PCD e requisitos estruturados para melhorar o matching.</p>
        </div>
        <Link to="/company/vagas/nova" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-terracotta-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-terracotta-700">
          <Plus className="h-4 w-4" /> Nova vaga
        </Link>
      </div>
      <CompanyDashboard />
      <style>{`
        .company-jobs-management > div:nth-of-type(2) > .flex.justify-between.items-center:first-of-type > button { display: none !important; }
      `}</style>
    </div>
  );
}
