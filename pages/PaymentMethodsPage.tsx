import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  ExternalLink,
  FileKey2,
  FlaskConical,
  KeyRound,
  Loader2,
  LockKeyhole,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import { api } from "../lib/api";

type ProviderCode = "EFI" | "MERCADO_PAGO";

type Provider = {
  code: ProviderCode;
  name: string;
  description?: string;
  active: boolean;
  configured: boolean;
  configVersion: number;
  lastHealthCheckAt?: string | null;
  lastHealthCheckOk?: boolean | null;
  lastHealthCheckMessage?: string | null;
  lastHealthCheckDetails?: Record<string, unknown>;
  activatedAt?: string | null;
  updatedAt?: string | null;
  config?: Record<string, any>;
};

function dateLabel(value?: string | null) {
  if (!value) return "Nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nunca";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function providerLabel(code: ProviderCode) {
  return code === "EFI" ? "Efí Bank" : "Mercado Pago";
}

function capabilities(provider: Provider) {
  if (provider.code === "EFI") return ["Pix", "Pix Automático"];
  return ["Pix", "SDK oficial"];
}

function statusOf(provider: Provider) {
  if (provider.active) return { label: "Ativa", className: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="h-3.5 w-3.5" /> };
  if (!provider.configured) return { label: "Não configurada", className: "bg-stone-100 text-stone-500", icon: <CircleOff className="h-3.5 w-3.5" /> };
  if (provider.lastHealthCheckOk === true) return { label: "Operacional", className: "bg-sky-100 text-sky-700", icon: <CheckCircle2 className="h-3.5 w-3.5" /> };
  if (provider.lastHealthCheckOk === false) return { label: "Falha na API", className: "bg-red-100 text-red-700", icon: <AlertTriangle className="h-3.5 w-3.5" /> };
  return { label: "Aguardando teste", className: "bg-amber-100 text-amber-700", icon: <FlaskConical className="h-3.5 w-3.5" /> };
}

export function PaymentMethodsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [vault, setVault] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [certificate, setCertificate] = useState<{ name: string; dataUrl: string } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const defaultApiBaseUrl = useMemo(() => `${window.location.origin}/api`, []);

  const load = async () => {
    setLoading(true);
    try {
      const [providerResponse, vaultResponse] = await Promise.all([
        api.get("/admin/payments/providers"),
        api.get("/admin/payments/providers/vault-status"),
      ]);
      setProviders(Array.isArray(providerResponse.data) ? providerResponse.data : []);
      setVault(vaultResponse.data || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load().catch((requestError) => setError(requestError?.response?.data?.message || "Não foi possível carregar as formas de pagamento."));
  }, []);

  const openEditor = (provider: Provider) => {
    const config = provider.config || {};
    setEditing(provider);
    setCertificate(null);
    setMessage("");
    setError("");
    if (provider.code === "EFI") {
      setDraft({
        sandbox: config.environment !== "PRODUCTION",
        clientId: "",
        clientSecret: "",
        pixKey: "",
        certificatePassphrase: "",
        pixAutomaticEnabled: config.pixAutomaticEnabled === true,
        receiverAgency: "",
        receiverAccount: "",
        receiverAccountType: config.receiverAccountType || "PAGAMENTO",
        publicApiBaseUrl: config.publicApiBaseUrl || defaultApiBaseUrl,
        skipMtlsChecking: config.skipMtlsChecking === true,
        expirationSeconds: Number(config.expirationSeconds || 3600),
      });
    } else {
      setDraft({
        accessToken: "",
        publicKey: "",
        webhookSecret: "",
        publicApiBaseUrl: config.publicApiBaseUrl || defaultApiBaseUrl,
      });
    }
  };

  const readCertificate = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(p12|pfx)$/i.test(file.name)) {
      setError("Selecione o certificado .p12 ou .pfx baixado da Efí.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("O certificado ultrapassa 5 MB.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    setCertificate({ name: file.name, dataUrl });
    setError("");
  };

  const secretIfFilled = (body: Record<string, unknown>, key: string, value: unknown) => {
    if (String(value || "").trim()) body[key] = String(value).trim();
  };

  const save = async () => {
    if (!editing) return;
    setWorking(`save:${editing.code}`);
    setError("");
    setMessage("");
    try {
      const body: Record<string, unknown> = { publicApiBaseUrl: draft.publicApiBaseUrl || defaultApiBaseUrl };
      if (editing.code === "EFI") {
        body.sandbox = draft.sandbox === true;
        body.pixAutomaticEnabled = draft.pixAutomaticEnabled === true;
        body.skipMtlsChecking = draft.skipMtlsChecking === true;
        body.expirationSeconds = Number(draft.expirationSeconds || 3600);
        body.receiverAccountType = draft.receiverAccountType || "PAGAMENTO";
        secretIfFilled(body, "clientId", draft.clientId);
        secretIfFilled(body, "clientSecret", draft.clientSecret);
        secretIfFilled(body, "pixKey", draft.pixKey);
        secretIfFilled(body, "certificatePassphrase", draft.certificatePassphrase);
        secretIfFilled(body, "receiverAgency", draft.receiverAgency);
        secretIfFilled(body, "receiverAccount", draft.receiverAccount);
        if (certificate) {
          body.certificateFileName = certificate.name;
          body.certificateBase64 = certificate.dataUrl;
        }
      } else {
        secretIfFilled(body, "accessToken", draft.accessToken);
        secretIfFilled(body, "publicKey", draft.publicKey);
        secretIfFilled(body, "webhookSecret", draft.webhookSecret);
      }
      await api.patch(`/admin/payments/providers/${editing.code}`, body);
      setEditing(null);
      setCertificate(null);
      setMessage(`${providerLabel(editing.code)} salva. Por segurança, a integração foi desativada e precisa ser testada novamente antes de ativar.`);
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || "Não foi possível salvar a forma de pagamento.");
    } finally {
      setWorking(null);
    }
  };

  const testProvider = async (provider: Provider) => {
    setWorking(`test:${provider.code}`);
    setMessage("");
    setError("");
    try {
      const response = await api.post(`/admin/payments/providers/${provider.code}/test`);
      const ok = response.data?.lastHealthCheckOk === true;
      setMessage(ok
        ? `${provider.name}: API operacional.`
        : `${provider.name}: teste concluído com falha. ${response.data?.lastHealthCheckMessage || "Revise a configuração."}`);
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || "Não foi possível executar o teste operacional.");
      await load().catch(() => undefined);
    } finally {
      setWorking(null);
    }
  };

  const toggleActive = async (provider: Provider, next: boolean) => {
    if (working) return;
    if (next) {
      const accepted = window.confirm(
        `Ativar ${provider.name}? A plataforma vai testar a API novamente agora. Se estiver operacional, qualquer outra forma de pagamento ativa será desativada automaticamente.`,
      );
      if (!accepted) return;
    }
    setWorking(`active:${provider.code}`);
    setMessage("");
    setError("");
    try {
      if (next) {
        await api.post(`/admin/payments/providers/${provider.code}/activate`);
        setMessage(`${provider.name} testada e ativada para novos pagamentos.`);
      } else {
        await api.post(`/admin/payments/providers/${provider.code}/deactivate`);
        setMessage(`${provider.name} desativada. Nenhuma cobrança nova será enviada por ela.`);
      }
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || "A forma de pagamento não pôde ser ativada.");
      await load().catch(() => undefined);
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">Financeiro · Integrações</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-stone-900">Formas de pagamento</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Cadastre credenciais, certificados e Webhooks dos provedores. Somente uma integração pode ficar ativa e ela precisa passar por uma checagem operacional antes da ativação.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 shadow-sm disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar status
        </button>
      </header>

      <section className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white"><LockKeyhole className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.15em] text-violet-700">Cofre de credenciais</p>
              <h2 className="mt-1 font-bold text-stone-950">Segredos criptografados no banco</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">Client Secret, Access Token, chave Pix, assinatura de Webhook e o próprio certificado da Efí são armazenados criptografados. A chave-mestra fica separada do banco e é gerada localmente no servidor.</p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[.15em] text-stone-400">Criptografia</p>
          <p className="mt-2 text-sm font-black text-stone-900">{vault?.algorithm || "AES-256-GCM"}</p>
          <p className="mt-1 text-xs text-stone-500">Chave fora do banco</p>
        </div>
      </section>

      {(message || error) && (
        <div className={`rounded-2xl border p-4 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {error ? <AlertTriangle className="mr-2 inline h-4 w-4" /> : <CheckCircle2 className="mr-2 inline h-4 w-4" />}{error || message}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 p-5 sm:p-6">
          <h2 className="font-bold text-stone-950">Provedores disponíveis</h2>
          <p className="mt-1 text-xs text-stone-500">Editar uma configuração invalida o teste anterior e desativa aquela integração até uma nova checagem.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400"><th className="px-4 py-3">Forma</th><th className="px-4 py-3">Recursos</th><th className="px-4 py-3">Configuração</th><th className="px-4 py-3">API</th><th className="px-4 py-3">Último teste</th><th className="px-4 py-3 text-center">Ativa</th><th className="px-4 py-3"></th></tr></thead>
            <tbody>
              {providers.map((provider) => {
                const status = statusOf(provider);
                return (
                  <tr key={provider.code} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-4"><div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${provider.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}><WalletCards className="h-5 w-5" /></span><div><p className="font-bold text-stone-900">{provider.name}</p><p className="mt-0.5 text-[10px] text-stone-400">{provider.code === "MERCADO_PAGO" ? "Ecossistema Mercado Livre" : "Banco e API Pix"}</p></div></div></td>
                    <td className="px-4 py-4"><div className="flex flex-wrap gap-1.5">{capabilities(provider).map((item) => <span key={item} className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-600">{item}</span>)}</div></td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${provider.configured ? "bg-sky-100 text-sky-700" : "bg-stone-100 text-stone-500"}`}>{provider.configured ? "SALVA" : "PENDENTE"}</span><p className="mt-1 text-[10px] text-stone-400">v{provider.configVersion || 0}</p></td>
                    <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${status.className}`}>{status.icon}{status.label}</span>{provider.lastHealthCheckMessage && <p className="mt-2 max-w-xs text-[10px] leading-4 text-stone-500">{provider.lastHealthCheckMessage}</p>}</td>
                    <td className="px-4 py-4 text-xs text-stone-500">{dateLabel(provider.lastHealthCheckAt)}</td>
                    <td className="px-4 py-4 text-center"><Switch checked={provider.active} disabled={Boolean(working)} onChange={(next) => void toggleActive(provider, next)} label={`Ativar ${provider.name}`} /></td>
                    <td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" disabled={!provider.configured || Boolean(working)} onClick={() => void testProvider(provider)} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-600 disabled:opacity-40">{working === `test:${provider.code}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />} Testar</button><button type="button" onClick={() => openEditor(provider)} className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-xs font-black text-white"><Pencil className="h-3.5 w-3.5" /> Editar</button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && providers.length === 0 && <p className="p-8 text-center text-sm text-stone-400">Execute a migration de pagamentos para cadastrar os provedores.</p>}
        </div>
      </section>

      {editing && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={() => setEditing(null)}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[30px] bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200 bg-white/95 p-5 backdrop-blur sm:p-6">
              <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-terracotta-600">{editing.code}</p><h2 className="mt-1 text-xl font-bold text-stone-950">Configurar {editing.name}</h2><p className="mt-1 text-xs text-stone-500">Campos secretos já salvos permanecem preservados quando deixados em branco.</p></div>
              <button type="button" onClick={() => setEditing(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              {editing.code === "EFI" ? (
                <>
                  <EfiInstructions />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField label="Ambiente" value={draft.sandbox ? "HOMOLOGATION" : "PRODUCTION"} onChange={(value) => setDraft((current) => ({ ...current, sandbox: value === "HOMOLOGATION" }))} options={[{ value: "HOMOLOGATION", label: "Homologação" }, { value: "PRODUCTION", label: "Produção" }]} />
                    <Field label="URL pública da API" value={draft.publicApiBaseUrl || ""} onChange={(value) => setDraft((current) => ({ ...current, publicApiBaseUrl: value }))} placeholder={defaultApiBaseUrl} />
                    <SecretField label="Client ID" configured={editing.config?.clientIdConfigured} value={draft.clientId || ""} onChange={(value) => setDraft((current) => ({ ...current, clientId: value }))} />
                    <SecretField label="Client Secret" configured={editing.config?.clientSecretConfigured} value={draft.clientSecret || ""} onChange={(value) => setDraft((current) => ({ ...current, clientSecret: value }))} />
                    <SecretField label="Chave Pix" configured={editing.config?.pixKeyConfigured} value={draft.pixKey || ""} onChange={(value) => setDraft((current) => ({ ...current, pixKey: value }))} />
                    <Field label="Expiração do Pix (segundos)" type="number" value={String(draft.expirationSeconds || 3600)} onChange={(value) => setDraft((current) => ({ ...current, expirationSeconds: Number(value || 3600) }))} />
                  </div>

                  <label className="block rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 p-4">
                    <span className="flex items-center gap-2 text-sm font-black text-violet-800"><Upload className="h-4 w-4" /> Certificado mTLS</span>
                    <span className="mt-1 block text-xs leading-5 text-violet-700/75">{certificate ? `Novo arquivo: ${certificate.name}` : editing.config?.certificateConfigured ? `Salvo no cofre: ${editing.config?.certificateFileName || "certificado"}` : "Nenhum certificado salvo."}</span>
                    <input type="file" accept=".p12,.pfx,application/x-pkcs12" onChange={(event) => void readCertificate(event.target.files?.[0])} className="mt-3 block w-full text-xs text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:font-bold file:text-white" />
                  </label>
                  <SecretField label="Senha do certificado, se houver" configured={editing.config?.certificateHasPassphrase} value={draft.certificatePassphrase || ""} onChange={(value) => setDraft((current) => ({ ...current, certificatePassphrase: value }))} />

                  <div className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex items-start justify-between gap-4"><div><p className="font-bold text-stone-900">Pix Automático</p><p className="mt-1 text-xs leading-5 text-stone-500">Ative para permitir a assinatura mensal com autorização recorrente oficial da Efí.</p></div><Switch checked={draft.pixAutomaticEnabled === true} onChange={(value) => setDraft((current) => ({ ...current, pixAutomaticEnabled: value }))} label="Pix Automático" /></div>
                    {draft.pixAutomaticEnabled && <div className="mt-4 grid gap-4 sm:grid-cols-3"><SecretField label="Agência recebedora" configured={editing.config?.receiverAccountConfigured} value={draft.receiverAgency || ""} onChange={(value) => setDraft((current) => ({ ...current, receiverAgency: value }))} /><SecretField label="Conta recebedora" configured={editing.config?.receiverAccountConfigured} value={draft.receiverAccount || ""} onChange={(value) => setDraft((current) => ({ ...current, receiverAccount: value }))} /><SelectField label="Tipo da conta" value={draft.receiverAccountType || "PAGAMENTO"} onChange={(value) => setDraft((current) => ({ ...current, receiverAccountType: value }))} options={[{ value: "PAGAMENTO", label: "Pagamento" }, { value: "CORRENTE", label: "Corrente" }, { value: "POUPANCA", label: "Poupança" }]} /></div>}
                  </div>

                  <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><input type="checkbox" checked={draft.skipMtlsChecking === true} onChange={(event) => setDraft((current) => ({ ...current, skipMtlsChecking: event.target.checked }))} className="mt-1" /><span><strong className="text-sm text-amber-900">Ignorar validação mTLS do Webhook na Efí</strong><span className="mt-1 block text-xs leading-5 text-amber-800/80">Use apenas se o seu proxy não consegue receber o certificado cliente da Efí. Em produção, prefira manter desligado.</span></span></label>
                </>
              ) : (
                <>
                  <MercadoPagoInstructions />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="URL pública da API" value={draft.publicApiBaseUrl || ""} onChange={(value) => setDraft((current) => ({ ...current, publicApiBaseUrl: value }))} placeholder={defaultApiBaseUrl} />
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Webhook calculado</p><p className="mt-1 break-all text-xs font-bold text-stone-600">{`${String(draft.publicApiBaseUrl || defaultApiBaseUrl).replace(/\/$/, "")}/payments/webhooks/mercado-pago`}</p></div>
                    <SecretField label="Access Token" configured={editing.config?.accessTokenConfigured} value={draft.accessToken || ""} onChange={(value) => setDraft((current) => ({ ...current, accessToken: value }))} />
                    <SecretField label="Public Key" configured={editing.config?.publicKeyConfigured} value={draft.publicKey || ""} onChange={(value) => setDraft((current) => ({ ...current, publicKey: value }))} />
                    <div className="sm:col-span-2"><SecretField label="Assinatura secreta do Webhook" configured={editing.config?.webhookSecretConfigured} value={draft.webhookSecret || ""} onChange={(value) => setDraft((current) => ({ ...current, webhookSecret: value }))} /></div>
                  </div>
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs leading-5 text-sky-800"><strong>Escopo atual do adapter:</strong> Pix avulso via SDK oficial. Para o Plano Destaque mensal por Pix Automático, mantenha a Efí ativa. O suporte de assinatura Mercado Pago será expandido quando a jornada recorrente Pix puder ser vinculada ao nosso ciclo com a mesma garantia de confirmação.</div>
                </>
              )}
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-stone-200 bg-white/95 p-4 backdrop-blur sm:px-6">
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-stone-500">Cancelar</button>
              <button type="button" onClick={() => void save()} disabled={working === `save:${editing.code}`} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">{working === `save:${editing.code}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Salvar no cofre</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EfiInstructions() {
  return <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><div className="flex gap-3"><FileKey2 className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" /><div><p className="font-bold text-violet-950">Onde pegar o certificado da Efí?</p><ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-5 text-violet-800"><li>Entre na sua conta Efí e abra <strong>API</strong>.</li><li>Acesse <strong>Meus Certificados</strong>.</li><li>Escolha <strong>Produção</strong> ou <strong>Homologação</strong>, conforme as credenciais usadas.</li><li>Clique em <strong>Novo Certificado</strong>, dê um nome e gere.</li><li>Baixe o arquivo <strong>.p12</strong> e envie aqui.</li></ol><p className="mt-2 rounded-lg bg-white/70 p-2 text-[11px] font-semibold text-violet-800">⚠️ Guarde uma cópia segura. A Efí informa que o mesmo certificado não fica disponível para baixar novamente depois.</p><a href="https://dev.efipay.com.br/docs/api-pix/credenciais/" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-violet-700 underline">Abrir documentação oficial <ExternalLink className="h-3.5 w-3.5" /></a></div></div></div>;
}

function MercadoPagoInstructions() {
  return <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="flex gap-3"><KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" /><div><p className="font-bold text-sky-950">Credenciais Mercado Pago</p><ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-5 text-sky-800"><li>Acesse <strong>Mercado Pago Developers → Suas integrações</strong> e selecione sua aplicação.</li><li>Em <strong>Dados da integração / Credenciais</strong>, copie o Access Token correspondente ao ambiente.</li><li>Em <strong>Webhooks → Configurar notificações</strong>, cadastre a URL exibida abaixo e habilite eventos de pagamento.</li><li>Depois de salvar o Webhook, revele a <strong>assinatura secreta</strong> e cole aqui.</li></ol><a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-sky-700 underline">Abrir Suas integrações <ExternalLink className="h-3.5 w-3.5" /></a></div></div></div>;
}

function Switch({ checked, onChange, disabled = false, label }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-emerald-500" : "bg-stone-300"} disabled:opacity-50`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} /></button>;
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-terracotta-400" /></label>;
}

function SecretField({ label, configured, value, onChange }: { label: string; configured?: boolean; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-stone-400"><span>{label}</span>{configured && <span className="normal-case tracking-normal text-emerald-600">✓ já salvo</span>}</span><input type="password" autoComplete="new-password" value={value} onChange={(event) => onChange(event.target.value)} placeholder={configured ? "Deixe em branco para manter" : "Informe para configurar"} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-terracotta-400" /></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-terracotta-400">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
