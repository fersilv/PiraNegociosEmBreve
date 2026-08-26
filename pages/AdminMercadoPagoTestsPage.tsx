import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Clipboard,
  CreditCard,
  FlaskConical,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { api } from "../lib/api";

type ProfileCode = "ORDERS" | "SUBSCRIPTIONS" | "MARKETPLACE";

type ProfileState = {
  profile: ProfileCode;
  applicationId?: string | null;
  publicKeyConfigured?: boolean;
  accessTokenConfigured?: boolean;
  sellerAccessTokenConfigured?: boolean;
  payerEmail?: string;
  updatedAt?: string | null;
};

type Draft = {
  applicationId: string;
  publicKey: string;
  accessToken: string;
  sellerAccessToken: string;
  payerEmail: string;
};

const profileInfo: Record<ProfileCode, { title: string; subtitle: string; icon: React.ReactNode; idLabel: string }> = {
  ORDERS: {
    title: "Checkout Transparente · Orders",
    subtitle: "Credenciais de teste da aplicação que será medida pelo Mercado Pago.",
    icon: <ShoppingBag className="h-5 w-5" />,
    idLabel: "Order ID",
  },
  SUBSCRIPTIONS: {
    title: "Planos mensais · Assinaturas",
    subtitle: "Teste isolado de /preapproval para Plus, Elite e outras recorrências.",
    icon: <RefreshCw className="h-5 w-5" />,
    idLabel: "Preapproval ID",
  },
  MARKETPLACE: {
    title: "Marketplace · Split 1:1",
    subtitle: "Teste com vendedor sandbox/OAuth e taxa de intermediação via application_fee.",
    icon: <WalletCards className="h-5 w-5" />,
    idLabel: "Payment ID",
  },
};

const emptyDraft = (): Draft => ({
  applicationId: "",
  publicKey: "",
  accessToken: "",
  sellerAccessToken: "",
  payerEmail: "",
});

export default function AdminMercadoPagoTestsPage() {
  const [data, setData] = useState<any>(null);
  const [drafts, setDrafts] = useState<Record<ProfileCode, Draft>>({
    ORDERS: emptyDraft(),
    SUBSCRIPTIONS: emptyDraft(),
    MARKETPLACE: emptyDraft(),
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [lastResult, setLastResult] = useState<Record<string, any>>({});

  const load = async () => {
    const response = await api.get("/admin/payments/mercado-pago-tests");
    const payload = response.data || {};
    setData(payload);
    setDrafts((current) => {
      const next = { ...current };
      (["ORDERS", "SUBSCRIPTIONS", "MARKETPLACE"] as ProfileCode[]).forEach((code) => {
        const profile = payload?.profiles?.[code] || {};
        next[code] = {
          ...current[code],
          applicationId: profile.applicationId || "",
          payerEmail: profile.payerEmail || "",
          publicKey: "",
          accessToken: "",
          sellerAccessToken: "",
        };
      });
      return next;
    });
  };

  useEffect(() => {
    void load().catch((error) => setMessage(error?.response?.data?.message || "Não foi possível carregar o laboratório Mercado Pago."));
  }, []);

  const history = useMemo(() => Array.isArray(data?.history) ? data.history : [], [data]);

  const patchDraft = (code: ProfileCode, patch: Partial<Draft>) => {
    setDrafts((current) => ({ ...current, [code]: { ...current[code], ...patch } }));
  };

  const save = async (code: ProfileCode) => {
    setBusy(`save-${code}`);
    setMessage("");
    try {
      const draft = drafts[code];
      const body: Record<string, unknown> = {
        applicationId: draft.applicationId,
        payerEmail: draft.payerEmail,
      };
      if (draft.publicKey.trim()) body.publicKey = draft.publicKey.trim();
      if (draft.accessToken.trim()) body.accessToken = draft.accessToken.trim();
      if (draft.sellerAccessToken.trim()) body.sellerAccessToken = draft.sellerAccessToken.trim();
      await api.patch(`/admin/payments/mercado-pago-tests/${code}`, body);
      setMessage(`${profileInfo[code].title}: credenciais de teste salvas no cofre.`);
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível salvar as credenciais de teste.");
    } finally {
      setBusy(null);
    }
  };

  const testCredentials = async (code: ProfileCode) => {
    setBusy(`cred-${code}`);
    setMessage("");
    try {
      const response = await api.post(`/admin/payments/mercado-pago-tests/${code}/credentials`);
      setLastResult((current) => ({ ...current, [`credentials-${code}`]: response.data }));
      setMessage(`${profileInfo[code].title}: credencial respondeu corretamente.`);
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "O Mercado Pago recusou a credencial de teste.");
    } finally {
      setBusy(null);
    }
  };

  const execute = async (code: ProfileCode) => {
    const path = code === "ORDERS"
      ? "/admin/payments/mercado-pago-tests/orders/create"
      : code === "SUBSCRIPTIONS"
        ? "/admin/payments/mercado-pago-tests/subscriptions/create"
        : "/admin/payments/mercado-pago-tests/marketplace/create";
    setBusy(`run-${code}`);
    setMessage("");
    try {
      const response = await api.post(path);
      setLastResult((current) => ({ ...current, [code]: response.data }));
      setMessage(`${profileInfo[code].title}: teste criado com sucesso.`);
      await load();
    } catch (error: any) {
      const payload = error?.response?.data;
      setMessage(payload?.message || payload?.providerResponse?.message || "O teste não pôde ser criado.");
    } finally {
      setBusy(null);
    }
  };

  const copy = async (value: unknown) => {
    const text = String(value || "");
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setMessage(`Copiado: ${text}`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-[28px] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-stone-50 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-violet-700">
              <FlaskConical className="h-4 w-4" /> Financeiro · Ambiente de teste
            </div>
            <h1 className="mt-2 font-serif text-3xl font-black text-stone-950">Laboratório Mercado Pago</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
              Execute transações reais no ambiente de teste do Mercado Pago sem trocar as credenciais produtivas. Os IDs gerados ficam registrados aqui para certificação, diagnóstico e medição de qualidade.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Produção isolada</div>
            <p className="mt-1 font-medium text-emerald-800">Salvar ou executar testes não altera o provedor ativo.</p>
          </div>
        </div>
      </header>

      {message && <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 shadow-sm">{message}</div>}

      <section className="grid gap-5 xl:grid-cols-3">
        {(["ORDERS", "SUBSCRIPTIONS", "MARKETPLACE"] as ProfileCode[]).map((code) => {
          const profile: ProfileState = data?.profiles?.[code] || { profile: code };
          const draft = drafts[code];
          const result = lastResult[code];
          const resourceId = code === "ORDERS" ? result?.orderId : code === "SUBSCRIPTIONS" ? result?.preapprovalId : result?.paymentId;
          return (
            <article key={code} className="flex flex-col rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-950 text-white">{profileInfo[code].icon}</span>
                  <div><h2 className="font-bold text-stone-950">{profileInfo[code].title}</h2><p className="mt-1 text-xs leading-5 text-stone-500">{profileInfo[code].subtitle}</p></div>
                </div>
                {(profile.accessTokenConfigured || profile.sellerAccessTokenConfigured) && <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-600" />}
              </div>

              <div className="mt-5 space-y-3">
                <Field label="Nº da aplicação" value={draft.applicationId} onChange={(value) => patchDraft(code, { applicationId: value })} placeholder="Ex.: 1463218279192769" />
                <Field label="Public Key de teste" value={draft.publicKey} onChange={(value) => patchDraft(code, { publicKey: value })} placeholder={profile.publicKeyConfigured ? "Configurada · deixe vazio para manter" : "Cole a Public Key de teste"} secret />
                {code !== "MARKETPLACE" && <Field label="Access Token de teste" value={draft.accessToken} onChange={(value) => patchDraft(code, { accessToken: value })} placeholder={profile.accessTokenConfigured ? "Configurado · deixe vazio para manter" : "Cole o Access Token de teste"} secret />}
                {code === "MARKETPLACE" && <Field label="Access Token OAuth do vendedor de teste" value={draft.sellerAccessToken} onChange={(value) => patchDraft(code, { sellerAccessToken: value })} placeholder={profile.sellerAccessTokenConfigured ? "Configurado · deixe vazio para manter" : "Token OAuth da conta vendedor sandbox"} secret />}
                <Field label={code === "MARKETPLACE" ? "E-mail do comprador de teste" : "E-mail do pagador de teste"} value={draft.payerEmail} onChange={(value) => patchDraft(code, { payerEmail: value })} placeholder={code === "ORDERS" ? "test_user_br@testuser.com" : "usuario_teste@..."} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void save(code)} disabled={busy !== null} className="rounded-xl border border-stone-200 px-3 py-2.5 text-xs font-black text-stone-700 disabled:opacity-50">
                  {busy === `save-${code}` ? "Salvando..." : "Salvar teste"}
                </button>
                <button type="button" onClick={() => void testCredentials(code)} disabled={busy !== null} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs font-black text-violet-700 disabled:opacity-50">
                  {busy === `cred-${code}` ? "Testando..." : "Validar credencial"}
                </button>
              </div>

              <div className="mt-4 rounded-2xl bg-stone-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-400">Teste executado</p>
                <p className="mt-1 text-xs leading-5 text-stone-600">
                  {code === "ORDERS" && "Cria Pix de teste de R$ 50,00 pela Orders API, exatamente no trilho usado pela medição de qualidade."}
                  {code === "SUBSCRIPTIONS" && "Cria assinatura pendente de R$ 10,00/mês e devolve o link/Preapproval ID."}
                  {code === "MARKETPLACE" && "Cria Pix de R$ 25,00 com R$ 0,25 de taxa de intermediação usando o token OAuth do seller de teste."}
                </p>
                <button type="button" onClick={() => void execute(code)} disabled={busy !== null} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-3 py-3 text-xs font-black text-white disabled:opacity-50">
                  {busy === `run-${code}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {code === "ORDERS" ? "Gerar Order ID" : code === "SUBSCRIPTIONS" ? "Gerar Preapproval ID" : "Gerar Payment ID com split"}
                </button>
              </div>

              {resourceId && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">{profileInfo[code].idLabel}</p>
                <div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-xs font-bold text-emerald-950">{resourceId}</code><button type="button" onClick={() => void copy(resourceId)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm"><Clipboard className="h-4 w-4" /></button></div>
                {result?.status && <p className="mt-2 text-xs font-semibold text-emerald-800">Status: {String(result.status)}</p>}
                {result?.initPoint && <a href={result.initPoint} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-black text-emerald-800 underline">Abrir autorização da assinatura</a>}
              </div>}
            </article>
          );
        })}
      </section>

      <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-stone-400">Auditoria de testes</p><h2 className="mt-1 text-xl font-black text-stone-950">IDs gerados recentemente</h2></div><button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700"><RefreshCw className="h-4 w-4" /> Atualizar</button></div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead><tr className="border-b border-stone-200 text-[10px] uppercase tracking-[0.14em] text-stone-400"><th className="px-3 py-3">Quando</th><th className="px-3 py-3">Integração</th><th className="px-3 py-3">Ação</th><th className="px-3 py-3">Resultado</th><th className="px-3 py-3">ID Mercado Pago</th></tr></thead>
            <tbody>{history.map((row: any) => <tr key={row.id} className="border-b border-stone-100 last:border-0"><td className="whitespace-nowrap px-3 py-3 text-stone-500">{new Date(row.createdAt).toLocaleString("pt-BR")}</td><td className="px-3 py-3 font-bold text-stone-800">{row.profileCode}</td><td className="px-3 py-3 text-stone-600">{row.action}</td><td className="px-3 py-3">{row.success ? <span className="inline-flex items-center gap-1 font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> OK</span> : <span className="font-bold text-red-700">Falhou</span>}</td><td className="px-3 py-3">{row.providerResourceId ? <button type="button" onClick={() => void copy(row.providerResourceId)} className="inline-flex items-center gap-2 font-mono font-bold text-violet-700"><Clipboard className="h-3.5 w-3.5" />{row.providerResourceId}</button> : <span className="text-stone-400">—</span>}</td></tr>)}</tbody>
          </table>
          {!history.length && <div className="py-10 text-center text-sm text-stone-400">Nenhum teste executado ainda.</div>}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Hint icon={<KeyRound className="h-4 w-4" />} title="Credenciais separadas">Nunca cole credenciais produtivas nesta tela. Ela existe exclusivamente para sandbox/teste.</Hint>
        <Hint icon={<CreditCard className="h-4 w-4" />} title="Marketplace">O split exige contas de teste e token OAuth de um vendedor de teste. Ele não usa o Access Token da aplicação Orders.</Hint>
        <Hint icon={<ShieldCheck className="h-4 w-4" />} title="Segredos protegidos">Tokens ficam criptografados em AES-256-GCM e a API só informa se estão configurados.</Hint>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, secret = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; secret?: boolean }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-stone-500">{label}</span><input type={secret ? "password" : "text"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs text-stone-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label>;
}

function Hint({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-4 text-xs leading-5 text-stone-600 shadow-sm"><div className="mb-2 flex items-center gap-2 font-black text-stone-900">{icon}{title}</div>{children}</div>;
}
