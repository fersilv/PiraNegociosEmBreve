import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Accessibility,
  ArrowLeft,
  Briefcase,
  Check,
  FileCheck2,
  Loader2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { CityStateSelector } from "../components/CityStateSelector";
import { notifyCandidatesOfNewJob } from "../lib/notifications";
import { useAiStatus } from "../hooks/useAiStatus";
import type { JobPcdMode } from "../types/job";

const TYPES = ["CLT", "PJ", "Estágio", "Aprendiz", "Temporário", "Autônomo"];
const WORK_MODELS = ["Presencial", "Híbrido", "Remoto"];

export function CompanyNewJobPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { enabled: aiEnabled } = useAiStatus();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggestingSkills, setSuggestingSkills] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [type, setType] = useState("CLT");
  const [workModel, setWorkModel] = useState("Presencial");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [pcdMode, setPcdMode] = useState<JobPcdMode>("GENERAL");
  const [isConfidential, setIsConfidential] = useState(false);
  const [isTalentPool, setIsTalentPool] = useState(false);
  const [acceptsPlatformApplications, setAcceptsPlatformApplications] = useState(true);
  const [requiresResumeFile, setRequiresResumeFile] = useState(false);
  const [externalApplicationInstructions, setExternalApplicationInstructions] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/companies/mine")
      .then((response) => {
        if (!active) return;
        setCompany(Array.isArray(response.data) ? response.data[0] : response.data);
      })
      .catch((error) => console.error("Erro ao carregar empresa:", error))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const normalizeSkill = (value: string) => value.trim().replace(/\s+/g, " ").slice(0, 80);

  const mergeSkills = (incoming: unknown) => {
    if (!Array.isArray(incoming)) return;
    setSkills((current) => {
      const seen = new Set<string>(current.map((item) => item.toLocaleLowerCase("pt-BR")));
      const next = [...current];
      for (const raw of incoming) {
        if (typeof raw !== "string") continue;
        const value = normalizeSkill(raw);
        const key = value.toLocaleLowerCase("pt-BR");
        if (!value || seen.has(key)) continue;
        seen.add(key);
        next.push(value);
        if (next.length >= 10) break;
      }
      return next;
    });
  };

  const addSkill = () => {
    const value = normalizeSkill(newSkill);
    if (!value || skills.length >= 10 || skills.some((item) => item.localeCompare(value, "pt-BR", { sensitivity: "base" }) === 0)) return;
    setSkills((current) => [...current, value]);
    setNewSkill("");
  };

  const suggestSkills = async () => {
    if (!aiEnabled || suggestingSkills) return;
    if (title.trim().length < 3 || description.trim().length < 40) {
      alert("Preencha o cargo e uma descrição mais detalhada antes de pedir sugestões à IA.");
      return;
    }
    setSuggestingSkills(true);
    try {
      const response = await api.post("/ai/suggest-job-skills", {
        title: title.trim(),
        description: description.trim(),
        requirements: requirements.trim(),
      });
      mergeSkills(response.data?.skills);
    } catch (error: any) {
      console.error("Erro ao sugerir habilidades:", error);
      alert(error?.response?.data?.message || "Não foi possível sugerir habilidades agora.");
    } finally {
      setSuggestingSkills(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !company?.id) return;

    const hasRequiredCompanyInfo = Boolean(
      company?.name?.trim?.() && company?.address?.trim?.() && company?.phone?.trim?.(),
    );
    if (!hasRequiredCompanyInfo) {
      alert("Antes de publicar, complete Nome, Endereço e Telefone no perfil da empresa.");
      navigate("/company/perfil");
      return;
    }
    if (!location && workModel !== "Remoto") {
      alert("Informe a cidade da vaga.");
      return;
    }
    if (!acceptsPlatformApplications && !externalApplicationInstructions.trim()) {
      alert("Informe como a pessoa deve se candidatar fora da plataforma.");
      return;
    }
    if (deadlineDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadline = new Date(`${deadlineDate}T00:00:00`);
      if (Number.isNaN(deadline.getTime()) || deadline < today) {
        alert("O prazo da candidatura precisa ser hoje ou uma data futura.");
        return;
      }
    }

    setSaving(true);
    try {
      const response = await api.post("/jobs", {
        companyId: company.id || profile?.companyId,
        title: title.trim(),
        location: location || "Remoto",
        salary: salary.trim() || undefined,
        deadlineDate: isTalentPool ? undefined : deadlineDate || undefined,
        type,
        workModel,
        description: description.trim(),
        requirements: requirements.trim() || undefined,
        skills,
        pcdMode,
        isConfidential,
        isTalentPool,
        acceptsPlatformApplications,
        requiresResumeFile: acceptsPlatformApplications ? requiresResumeFile : false,
        externalApplicationInstructions: acceptsPlatformApplications ? "" : externalApplicationInstructions.trim(),
      });
      try {
        await notifyCandidatesOfNewJob(
          response.data.id,
          title.trim(),
          isConfidential ? "Empresa Confidencial" : company.name,
          location || "Remoto",
        );
      } catch (error) {
        console.error("Não foi possível disparar notificações da vaga:", error);
      }
      navigate(`/company/vagas/${response.data.id}`);
    } catch (error: any) {
      console.error(error);
      alert(error?.response?.data?.message || "Não foi possível publicar a vaga.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-terracotta-600" /></div>;
  if (!company) return <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-900">Cadastre sua empresa antes de publicar uma vaga.</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button type="button" onClick={() => navigate("/company/vagas")} className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-stone-900"><ArrowLeft className="h-4 w-4" /> Voltar às vagas</button>
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-terracotta-600">Recrutamento · Nova oportunidade</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-stone-950 md:text-4xl">Publique uma vaga completa.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">Defina com clareza o que é necessário para se candidatar e deixe o PiraNegócios cuidar do restante do fluxo.</p>
        </div>
      </header>

      <form onSubmit={submit} className="space-y-6">
        <Section number="01" title="Oportunidade" description="Cargo, local, prazo e formato de trabalho.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Cargo *"><input required value={title} onChange={(e) => setTitle(e.target.value)} className="field" placeholder="Ex.: Assistente Administrativo" /></Field>
            <Field label="Regime"><select value={type} onChange={(e) => setType(e.target.value)} className="field">{TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Modelo de trabalho"><select value={workModel} onChange={(e) => setWorkModel(e.target.value)} className="field">{WORK_MODELS.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Faixa salarial"><input value={salary} onChange={(e) => setSalary(e.target.value)} className="field" placeholder="Ex.: R$ 2.500 a R$ 3.000 por mês" /></Field>
            {!isTalentPool && <Field label="Candidaturas até (opcional)"><input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} className="field" /><span className="mt-1 block text-[10px] font-medium normal-case tracking-normal text-stone-400">Quando informado, o prazo também ajuda buscadores a entender quando a vaga deixa de aceitar candidaturas.</span></Field>}
          </div>
          {workModel !== "Remoto" && <div className="mt-4"><Field label="Cidade da vaga *"><CityStateSelector initialValue={location} onLocationChange={setLocation} /></Field></div>}
        </Section>

        <Section number="02" title="Acessibilidade e público" description="Informe se a vaga é geral, inclusiva ou exclusiva para PCD.">
          <div className="grid gap-3 md:grid-cols-3">
            <PcdChoice active={pcdMode === "GENERAL"} onClick={() => setPcdMode("GENERAL")} title="Vaga geral" description="Sem classificação específica para PCD." />
            <PcdChoice active={pcdMode === "INCLUSIVE"} onClick={() => setPcdMode("INCLUSIVE")} title="Também aberta a PCD" description="A oportunidade também recebe candidaturas PCD." icon />
            <PcdChoice active={pcdMode === "EXCLUSIVE"} onClick={() => setPcdMode("EXCLUSIVE")} title="Exclusiva para PCD" description="Destinada exclusivamente a candidatos PCD." icon />
          </div>
        </Section>

        <Section number="03" title="Conteúdo da vaga" description="Explique o trabalho e os requisitos sem misturar os dois campos.">
          <div className="space-y-4">
            <Field label="Descrição *"><textarea required rows={6} value={description} onChange={(e) => setDescription(e.target.value)} className="field resize-y" placeholder="Atividades, rotina, benefícios e contexto da posição." /></Field>
            <Field label="Requisitos"><textarea rows={4} value={requirements} onChange={(e) => setRequirements(e.target.value)} className="field resize-y" placeholder="Experiência, conhecimentos, escolaridade, CNH, veículo, disponibilidade..." /></Field>
            <Field label="Habilidades estruturadas">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} className="field" placeholder="Ex.: Excel" />
                <button type="button" onClick={addSkill} className="inline-flex items-center justify-center rounded-xl bg-stone-900 px-4 py-3 text-white"><Plus className="h-4 w-4" /></button>
                {aiEnabled && <button type="button" onClick={() => void suggestSkills()} disabled={suggestingSkills} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs font-bold text-violet-800 disabled:opacity-50">{suggestingSkills ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Sugerir com IA</button>}
              </div>
              {skills.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{skills.map((skill) => <span key={skill} className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700">{skill}<button type="button" onClick={() => setSkills((current) => current.filter((item) => item !== skill))}><X className="h-3 w-3" /></button></span>)}</div>}
            </Field>
          </div>
        </Section>

        <Section number="04" title="Candidatura" description="Defina por onde o candidato entra e se um arquivo de currículo é realmente necessário.">
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleCard active={acceptsPlatformApplications} onClick={() => setAcceptsPlatformApplications(true)} title="Pela plataforma" description="Receba candidaturas e acompanhe o processo no PiraNegócios." />
            <ToggleCard active={!acceptsPlatformApplications} onClick={() => { setAcceptsPlatformApplications(false); setRequiresResumeFile(false); }} title="Candidatura externa" description="Direcione para outro canal ou processo." />
          </div>

          {acceptsPlatformApplications ? (
            <div className="mt-4 rounded-[22px] border border-stone-200 bg-stone-50/70 p-4 sm:p-5">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={requiresResumeFile} onChange={(event) => setRequiresResumeFile(event.target.checked)} className="mt-1 h-4 w-4 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500" />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-bold text-stone-950"><FileCheck2 className="h-4 w-4 text-terracotta-600" /> Exigir currículo em arquivo</span>
                  <span className="mt-1 block text-xs leading-5 text-stone-500">{requiresResumeFile ? "O candidato precisará ter um PDF, Word ou outro currículo importado/anexado." : "Desmarcado: um currículo estruturado e publicado no PiraNegócios já é suficiente. Isso reduz atrito sem perder informação profissional."}</span>
                </span>
              </label>
            </div>
          ) : (
            <div className="mt-4"><Field label="Como se candidatar *"><textarea required rows={3} value={externalApplicationInstructions} onChange={(e) => setExternalApplicationInstructions(e.target.value)} className="field" placeholder="Informe link, endereço, e-mail, WhatsApp ou instruções." /></Field></div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-stone-200 p-4"><input type="checkbox" checked={isConfidential} onChange={(e) => setIsConfidential(e.target.checked)} /><span><strong className="block text-sm text-stone-900">Empresa confidencial</strong><span className="text-xs text-stone-500">Oculta o nome da empresa para candidatos.</span></span></label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-stone-200 p-4"><input type="checkbox" checked={isTalentPool} onChange={(e) => { const checked = e.target.checked; setIsTalentPool(checked); if (checked) setDeadlineDate(""); }} /><span><strong className="block text-sm text-stone-900">Banco de talentos</strong><span className="text-xs text-stone-500">Processo contínuo, sem uma única contratação imediata.</span></span></label>
          </div>
        </Section>

        <div className="flex justify-end"><button disabled={saving} type="submit" className="inline-flex min-w-48 items-center justify-center gap-2 rounded-2xl bg-terracotta-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-terracotta-600/15 hover:bg-terracotta-700 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />} Publicar vaga</button></div>
      </form>

      <style>{`.field{width:100%;border:1px solid #e7e5e4;border-radius:14px;background:#fff;padding:12px 14px;font-size:14px;outline:none}.field:focus{border-color:#c66a4b;box-shadow:0 0 0 3px rgba(198,106,75,.10)}`}</style>
    </div>
  );
}

function Section({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7"><div className="mb-6 flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-950 text-[11px] font-black text-white">{number}</span><div><h2 className="font-serif text-xl font-bold text-stone-950">{title}</h2><p className="mt-1 text-xs leading-5 text-stone-500">{description}</p></div></div>{children}</section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-[.08em] text-stone-500">{label}</span>{children}</label>; }
function PcdChoice({ active, onClick, title, description, icon }: { active: boolean; onClick: () => void; title: string; description: string; icon?: boolean }) { return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${active ? "border-terracotta-300 bg-terracotta-50 ring-2 ring-terracotta-100" : "border-stone-200 hover:border-stone-300"}`}><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-sm font-bold text-stone-900">{icon && <Accessibility className="h-4 w-4 text-violet-600" />}{title}</span>{active && <Check className="h-4 w-4 text-terracotta-600" />}</div><p className="mt-2 text-xs leading-5 text-stone-500">{description}</p></button>; }
function ToggleCard({ active, onClick, title, description }: { active: boolean; onClick: () => void; title: string; description: string }) { return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${active ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-900"}`}><div className="flex items-center justify-between"><strong className="text-sm">{title}</strong>{active && <Check className="h-4 w-4" />}</div><p className={`mt-1 text-xs leading-5 ${active ? "text-white/55" : "text-stone-500"}`}>{description}</p></button>; }
