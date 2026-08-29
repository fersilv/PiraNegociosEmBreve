import React, { useMemo } from "react";
import {
  Bot,
  CheckCircle2,
  Copy,
  KeyRound,
  Link2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

const MCP_ENDPOINT = "https://piranegocios.com.br/api/jobs/mcp";

type Capability = {
  section?: string;
  toolName?: string;
  legacy?: boolean;
  channels?: string[];
};

export function JobsMcpDocumentation({ capabilities = [] }: { capabilities?: Capability[] }) {
  const summary = useMemo(() => {
    const tools = capabilities.filter(
      (item) => !item.legacy && item.toolName && item.channels?.includes("mcp"),
    );
    return {
      tools: tools.length,
      sections: new Set(tools.map((item) => item.section).filter(Boolean)).size,
    };
  }, [capabilities]);

  return (
    <section className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-sm">
      <div className="border-b border-violet-100 bg-gradient-to-br from-violet-50 via-white to-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">
                Model Context Protocol
              </p>
              <h2 className="mt-1 font-serif text-2xl font-black text-stone-900">
                MCP de Operações
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                O MCP expõe somente as ferramentas autorizadas pela chave vinculada. Cada função
                gerencial possui seu próprio scope, então leitura e alteração podem ser liberadas
                separadamente.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" /> OAuth + PKCE
            </span>
            {summary.tools > 0 && (
              <span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-black text-violet-700">
                {summary.tools} ferramentas · {summary.sections} áreas
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-stone-800">
              <Link2 className="h-4 w-4 text-violet-600" /> Endpoint único
            </div>
            <div className="flex gap-2 rounded-xl border border-stone-200 bg-stone-950 p-2 pl-4 text-white">
              <code className="min-w-0 flex-1 self-center overflow-x-auto text-xs text-white/80">
                {MCP_ENDPOINT}
              </code>
              <button
                type="button"
                title="Copiar endpoint"
                onClick={() => void navigator.clipboard.writeText(MCP_ENDPOINT)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 hover:bg-white/15"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
              <div className="flex items-center gap-2 text-xs font-black text-stone-800">
                <KeyRound className="h-4 w-4 text-amber-600" /> Chave define o teto
              </div>
              <p className="mt-1 text-[11px] leading-5 text-stone-500">
                O OAuth nunca recebe uma permissão que não esteja liberada na chave MCP usada na autorização.
              </p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
              <div className="flex items-center gap-2 text-xs font-black text-stone-800">
                <LockKeyhole className="h-4 w-4 text-emerald-600" /> Revogação continua valendo
              </div>
              <p className="mt-1 text-[11px] leading-5 text-stone-500">
                Desativar a chave ou retirar scopes reduz o acesso dos tokens vinculados nas próximas requisições.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <div>
              <p className="text-sm font-black text-emerald-950">IA operacional é request-only</p>
              <p className="mt-1 text-xs leading-5 text-emerald-900/80">
                Filas de matching, moderação de anúncios, avaliações, feedback e FAQ podem ser lidas pelo MCP.
                O agente externo faz a análise e devolve somente o resultado estruturado. Essas ferramentas não
                chamam um provedor de IA dentro do PiraNegócios.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
