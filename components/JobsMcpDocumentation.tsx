import React from "react";
import {
  Bot,
  CheckCircle2,
  KeyRound,
  Link2,
  LockKeyhole,
  PlugZap,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";

const MCP_ENDPOINT = "https://piranegocios.com.br/api/jobs/mcp";

const tools = [
  ["piranegocios_jobs_list", "Lista e pesquisa vagas com filtros e cursor."],
  ["piranegocios_jobs_match_profile_schema", "Mostra o formato aceito de matchProfile."],
  ["piranegocios_jobs_match_profile_status", "Localiza fichas de matching prontas, ausentes ou desatualizadas."],
  ["piranegocios_jobs_check_duplicate", "Confere duplicidade antes de cadastrar uma vaga externa."],
  ["piranegocios_jobs_create_external", "Cadastra uma nova vaga externa usando as regras atuais da API."],
  ["piranegocios_jobs_update_external", "Atualiza uma vaga externa pertencente à mesma origem de ingestão."],
  ["piranegocios_jobs_verify_external", "Registra disponibilidade, encerramento, expiração ou incerteza da vaga."],
  ["piranegocios_jobs_review_queue", "Lista vagas pendentes ou que exigem rechecagem operacional."],
  ["piranegocios_jobs_set_review_status", "Altera o estado de revisão depois da auditoria."],
  ["piranegocios_jobs_activate", "Aprova e ativa uma vaga válida para publicação."],
  ["piranegocios_jobs_deactivate", "Desativa uma vaga inválida, encerrada ou não verificável."],
  ["piranegocios_jobs_flag", "Sinaliza uma vaga que exige atenção ou correção adicional."],
  ["piranegocios_jobs_unflag", "Remove a sinalização depois que o problema foi resolvido."],
] as const;

export function JobsMcpDocumentation() {
  return (
    <section className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-violet-100 bg-gradient-to-br from-violet-50 via-white to-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
              <PlugZap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">
                Model Context Protocol
              </p>
              <h2 className="mt-1 font-serif text-2xl font-black text-stone-900">
                MCP de Vagas
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                Conecta ChatGPT e outros clientes MCP diretamente à API externa de vagas.
                As ferramentas reutilizam a mesma validação, deduplicação, auditoria e regras
                de ingestão da API REST.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
            <ShieldCheck className="h-4 w-4" /> OAuth + PKCE S256
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-black text-stone-800">
            <Link2 className="h-4 w-4 text-violet-600" /> Endpoint para conectar
          </div>
          <code className="block overflow-x-auto rounded-xl border border-stone-200 bg-stone-950 px-4 py-3 text-xs text-stone-100">
            {MCP_ENDPOINT}
          </code>
          <p className="mt-2 text-xs leading-5 text-stone-500">
            No ChatGPT, informe somente esse endpoint. O cliente descobre automaticamente
            o servidor OAuth pelo metadata protegido do MCP.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center gap-2 font-bold text-stone-900">
              <LockKeyhole className="h-4 w-4 text-emerald-600" /> Autorização
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-stone-600">
              <p>Authorization Code com PKCE S256 e refresh token.</p>
              <p>
                A chave <code className="rounded bg-white px-1.5 py-0.5 text-xs">pn_v1_...</code>{" "}
                é usada somente para aprovar o vínculo. Depois disso, o cliente usa access
                token e refresh token OAuth próprios.
              </p>
              <p>
                Alterar, revogar ou reduzir os scopes da chave original também reduz o
                acesso efetivo do vínculo OAuth.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center gap-2 font-bold text-stone-900">
              <KeyRound className="h-4 w-4 text-amber-600" /> Scopes
            </div>
            <div className="mt-3 space-y-2 text-sm text-stone-600">
              <div className="rounded-lg bg-white px-3 py-2">
                <code className="text-xs font-black text-stone-900">jobs:review:read + jobs:review:write</code>
                <p className="mt-1 text-xs">Consultar a fila e registrar a decisão final da auditoria.</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2">
                <code className="text-xs font-black text-stone-900">jobs:activate + jobs:deactivate</code>
                <p className="mt-1 text-xs">Publicar vagas aprovadas ou retirar de publicação as inválidas.</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2">
                <code className="text-xs font-black text-stone-900">jobs:flag + jobs:unflag</code>
                <p className="mt-1 text-xs">Sinalizar problemas e limpar o alerta depois da correção.</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2">
                <code className="text-xs font-black text-stone-900">jobs:update + jobs:verify</code>
                <p className="mt-1 text-xs">Corrigir dados permitidos e registrar a verificação da fonte original.</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2">
                <code className="text-xs font-black text-stone-900">offline_access</code>
                <p className="mt-1 text-xs">Permite renovação do acesso sem nova autorização manual.</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2 font-bold text-stone-900">
            <Wrench className="h-4 w-4 text-violet-600" /> Ferramentas expostas
          </div>
          <div className="grid gap-2 xl:grid-cols-2">
            {tools.map(([name, description]) => (
              <div key={name} className="rounded-xl border border-stone-200 p-3">
                <div className="flex items-start gap-2">
                  {name.includes("list") || name.includes("status") ? (
                    <Search className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                  ) : (
                    <Bot className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                  )}
                  <div className="min-w-0">
                    <code className="break-all text-[11px] font-black text-violet-700">{name}</code>
                    <p className="mt-1 text-xs leading-5 text-stone-500">{description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <div className="text-sm leading-6 text-emerald-900">
              <strong>Fluxo recomendado de ingestão:</strong>{" "}
              pesquisar a fonte, chamar <code className="text-xs font-black">check_duplicate</code>,
              cadastrar com <code className="text-xs font-black">create_external</code> e,
              nas auditorias posteriores, usar <code className="text-xs font-black">verify_external</code>.
              Quando a IA já tiver estruturado a vaga, ela pode enviar também o
              <code className="ml-1 text-xs font-black">matchProfile</code>.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
