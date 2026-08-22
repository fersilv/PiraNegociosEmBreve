from pathlib import Path
import re

repo = Path('.')
builder_path = repo / 'pages/ResumeBuilderPage.tsx'
workspace_path = repo / 'pages/ResumeWorkspace.tsx'
studio_path = repo / 'pages/ResumeBuilderStudio.tsx'

builder = builder_path.read_text()
workspace = workspace_path.read_text()
studio = studio_path.read_text()

# Preferências passa a ser uma etapa real do construtor, logo após Dados Pessoais.
import_line = 'import { CandidateWorkPreferencesCard } from "../components/CandidateWorkPreferencesCard";\n'
if import_line not in builder:
    marker = 'import { FileUpload } from "../components/FileUpload";\n'
    assert marker in builder, 'FileUpload import marker not found'
    builder = builder.replace(marker, marker + import_line, 1)

old_steps = '''  const STEPS = [\n    { id: "personal", label: "Dados Pessoais", icon: <User className="w-4 h-4" /> },\n    ...(isFirstJob ? [] : [{ id: "experience", label: "Experiência", icon: <Briefcase className="w-4 h-4" /> }]),'''
new_steps = '''  const STEPS = [\n    { id: "personal", label: "Dados Pessoais", icon: <User className="w-4 h-4" /> },\n    { id: "preferences", label: "Preferências", icon: <Settings className="w-4 h-4" /> },\n    ...(isFirstJob ? [] : [{ id: "experience", label: "Experiência", icon: <Briefcase className="w-4 h-4" /> }]),'''
assert old_steps in builder, 'STEPS marker not found'
builder = builder.replace(old_steps, new_steps, 1)

experience_case = '      case "experience":\n'
assert experience_case in builder, 'experience case marker not found'
preferences_case = '''      case "preferences":\n        return (\n          <div className="space-y-4">\n            <div className="rounded-2xl border border-terracotta-100 bg-terracotta-50/50 p-4">\n              <p className="text-sm font-bold text-stone-900">Como e onde você quer trabalhar</p>\n              <p className="mt-1 text-xs leading-5 text-stone-500">Essas informações ajudam o PiraNegócios a recomendar oportunidades compatíveis com sua rotina, mobilidade e necessidades.</p>\n            </div>\n            <CandidateWorkPreferencesCard />\n          </div>\n        );\n\n'''
if 'case "preferences":' not in builder:
    builder = builder.replace(experience_case, preferences_case + experience_case, 1)

# Documento-base vira ferramenta discreta no sidebar do preview.
sidebar_marker = '''              {aiEnabled && (\n                <ResumeScoreCard'''
assert sidebar_marker in builder, 'preview sidebar marker not found'
source_panel = '''              <section className="rounded-2xl border border-white/10 bg-white/[.055] p-4 text-white">\n                <div className="flex items-start gap-3">\n                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#f0b99d]">\n                    <FileText className="h-4 w-4" />\n                  </div>\n                  <div className="min-w-0 flex-1">\n                    <p className="text-[10px] font-black uppercase tracking-[.14em] text-white/45">Documento-base</p>\n                    <p className="mt-1 truncate text-xs font-bold text-white/90">{profile.uploadedResumeFile?.name || "Nenhum arquivo guardado"}</p>\n                    <p className="mt-1 text-[11px] leading-4 text-white/45">Opcional. Use apenas para guardar ou importar um currículo/documento existente.</p>\n                  </div>\n                </div>\n                <button\n                  type="button"\n                  onClick={() => window.location.assign("/user/curriculo?import=1")}\n                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-white/15"\n                >\n                  <Upload className="h-3.5 w-3.5" />\n                  {profile.uploadedResumeFile ? "Gerenciar documento-base" : "Importar documento-base"}\n                </button>\n              </section>\n\n'''
if 'Gerenciar documento-base' not in builder:
    builder = builder.replace(sidebar_marker, source_panel + sidebar_marker, 1)

# Workspace externo deixa de ser uma segunda trilha. Só edição e publicação.
workspace = workspace.replace('import { CandidateWorkPreferencesCard } from "../components/CandidateWorkPreferencesCard";\n', '')
workspace = workspace.replace('type Stage = "resume" | "preferences" | "publish";', 'type Stage = "resume" | "publish";')
workspace = workspace.replace(
    '  const initialStage: Stage = requestedStage === "preferences" || requestedStage === "publish" ? requestedStage : "resume";',
    '  const initialStage: Stage = requestedStage === "publish" ? "publish" : "resume";',
)

nav_pattern = re.compile(r'''      <div className="resume-workflow-nav sticky top-0 z-\[65\][\s\S]*?      </div>\n\n      \{stage === "resume" && \(''', re.M)
nav_replacement = '''      <div className="resume-workflow-nav sticky top-0 z-[65] border-b border-[#5b4030]/10 bg-[#fffaf5]/95 px-3 py-3 backdrop-blur-xl sm:px-5">\n        <div className="mx-auto flex max-w-7xl items-center gap-3">\n          <button type="button" onClick={() => navigate("/user")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600" aria-label="Voltar ao meu espaço">\n            <ArrowLeft className="h-4 w-4" />\n          </button>\n          <div className="min-w-0">\n            <p className="text-[9px] font-black uppercase tracking-[.16em] text-terracotta-600">Carreira</p>\n            <p className="truncate font-serif text-lg font-bold text-stone-900">Meu currículo</p>\n          </div>\n          <div className="ml-auto flex items-center gap-2">\n            <span className={`hidden shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] sm:inline-flex ${topStatusClass}`}>{topStatus}</span>\n            <button type="button" onClick={() => setStage(stage === "publish" ? "resume" : "publish")} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-bold text-stone-700 shadow-sm hover:bg-stone-50">\n              {stage === "publish" ? <><ArrowLeft className="h-4 w-4" /> Voltar ao currículo</> : <><Globe2 className="h-4 w-4 text-terracotta-600" /> Versões e publicação</>}\n            </button>\n          </div>\n        </div>\n      </div>\n\n      {stage === "resume" && ('''
workspace, count = nav_pattern.subn(nav_replacement, workspace, count=1)
assert count == 1, 'workspace external nav block not replaced'

source_pattern = re.compile(r'''          <section className="resume-source-bar[\s\S]*?          </section>\n          <ResumeBuilderStudio />\n          <div className="resume-stage-actions[\s\S]*?          </div>''', re.M)
source_replacement = '''          <div className="mx-auto max-w-7xl px-3 pt-3 sm:px-5">\n            {hasPublishedVersion && draftDiffersFromPublished && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">Você está editando o <strong>rascunho</strong>. A última versão publicada continua congelada e {online ? "permanece online" : "está fora do ar"} até você publicar o rascunho.</div>}\n            {hasPublishedVersion && !online && !draftDiffersFromPublished && <div className="rounded-2xl border border-stone-200 bg-stone-100 px-4 py-3 text-xs font-semibold text-stone-600">Existe uma versão publicada preservada, mas ela está <strong>fora do ar</strong>.</div>}\n            {error && <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}\n            {success && <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">{success}</div>}\n          </div>\n          <ResumeBuilderStudio />'''
workspace, count = source_pattern.subn(source_replacement, workspace, count=1)
assert count == 1, 'source bar / sticky action block not replaced'

pref_pattern = re.compile(r'''\n      \{stage === "preferences" && \([\s\S]*?\n      \)\}\n\n      \{stage === "publish" && \(''', re.M)
workspace, count = pref_pattern.subn('\n\n      {stage === "publish" && (', workspace, count=1)
assert count == 1, 'external preferences stage not removed'
workspace = workspace.replace('Etapa 3 de 3', 'Publicação')

# Link ?import=1 abre o modal sem precisar de uma segunda barra visual.
marker = '  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);\n'
if 'if (searchParams.get("import") === "1") setOpen(true);' not in workspace:
    assert marker in workspace, 'workspace totalSize marker not found'
    watcher = '''  React.useEffect(() => {\n    if (searchParams.get("import") === "1") setOpen(true);\n  }, [searchParams]);\n\n'''
    workspace = workspace.replace(marker, watcher + marker, 1)

# Ação de publicação na nav real do estúdio.
if 'useNavigate' not in studio:
    studio = studio.replace('import { Link } from "react-router-dom";', 'import { Link, useNavigate } from "react-router-dom";')
studio = studio.replace('export function ResumeBuilderStudio() {\n  return (', 'export function ResumeBuilderStudio() {\n  const navigate = useNavigate();\n  return (')
trust_marker = '''          <div className="hidden items-center gap-2 lg:flex">\n            <span className="resume-studio-trust">'''
if 'Versões e publicação' not in studio:
    studio = studio.replace(trust_marker, '''          <div className="hidden items-center gap-2 lg:flex">\n            <button type="button" onClick={() => navigate("/user/curriculo?stage=publish")} className="resume-studio-trust resume-studio-trust--button">\n              <FileText className="h-3.5 w-3.5" /> Versões e publicação\n            </button>\n            <span className="resume-studio-trust">''', 1)
    studio = studio.replace('import { ArrowLeft, ShieldCheck, WandSparkles } from "lucide-react";', 'import { ArrowLeft, FileText, ShieldCheck, WandSparkles } from "lucide-react";')
    css_marker = '      .resume-studio-trust {\n'
    assert css_marker in studio, 'studio trust CSS marker not found'
    studio = studio.replace(css_marker, '      .resume-studio-trust--button { cursor: pointer; transition: .18s; }\n      .resume-studio-trust--button:hover { border-color: rgba(196,91,60,.28); color: #b55236; }\n\n' + css_marker, 1)

builder_path.write_text(builder)
workspace_path.write_text(workspace)
studio_path.write_text(studio)
