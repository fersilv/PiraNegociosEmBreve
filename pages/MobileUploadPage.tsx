import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, FileUp, KeyRound, Loader2, LockKeyhole, ShieldCheck, Smartphone, XCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';

type PairResult = {
  uploadToken: string;
  purpose: 'avatar' | 'resume' | 'document';
  accept: string;
  maxSizeBytes: number;
  expiresAt: string;
};

function apiMessage(error: any, fallback: string) {
  const raw = error?.response?.data?.message;
  return Array.isArray(raw) ? raw.join(' · ') : raw || error?.message || fallback;
}

export default function MobileUploadPage() {
  const { sessionId = '' } = useParams();
  const [code, setCode] = useState('');
  const [paired, setPaired] = useState<PairResult | null>(null);
  const [pairing, setPairing] = useState(false);
  const [autoPairing, setAutoPairing] = useState(false);
  const [manualFallback, setManualFallback] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const qrAttemptedRef = useRef(false);

  const maxSizeLabel = useMemo(() => {
    if (!paired?.maxSizeBytes) return '';
    return `${Math.round(paired.maxSizeBytes / 1024 / 1024)} MB`;
  }, [paired?.maxSizeBytes]);

  useEffect(() => {
    if (!sessionId || qrAttemptedRef.current) return;
    qrAttemptedRef.current = true;

    const token = decodeURIComponent(window.location.hash.replace(/^#/, '').trim());
    if (!token) {
      setManualFallback(true);
      return;
    }

    // Remove o segredo da barra de endereço e do histórico assim que ele é lido.
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    setAutoPairing(true);
    setError('');
    api.post(`/uploads/mobile-transfer/${sessionId}/pair-qr`, { token })
      .then((response) => {
        setPaired(response.data as PairResult);
        setManualFallback(false);
      })
      .catch((requestError: any) => {
        setError(apiMessage(requestError, 'Este QR Code não pôde ser validado. Use o código manual exibido no computador.'));
        setManualFallback(true);
      })
      .finally(() => setAutoPairing(false));
  }, [sessionId]);

  const pair = async () => {
    const normalized = code.replace(/\D/g, '').slice(0, 6);
    if (normalized.length !== 6 || pairing) return;
    setPairing(true);
    setError('');
    try {
      const response = await api.post(`/uploads/mobile-transfer/${sessionId}/pair`, { code: normalized });
      setPaired(response.data as PairResult);
    } catch (requestError: any) {
      setError(apiMessage(requestError, 'Não foi possível parear este telefone.'));
    } finally {
      setPairing(false);
    }
  };

  const upload = async (file?: File) => {
    if (!file || !paired || uploading) return;
    if (file.size > paired.maxSizeBytes) {
      setError(`Este arquivo é maior que ${maxSizeLabel}. Escolha um arquivo menor.`);
      return;
    }
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/uploads/mobile-transfer/${sessionId}/file`, form, {
        headers: { 'X-Upload-Token': paired.uploadToken },
        timeout: 120000,
      });
      setDone(true);
    } catch (requestError: any) {
      setError(apiMessage(requestError, 'Não foi possível enviar o arquivo.'));
    } finally {
      setUploading(false);
      if (galleryRef.current) galleryRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  const cameraFacing = paired?.purpose === 'avatar' ? 'user' : 'environment';
  const cameraLabel = paired?.purpose === 'avatar' ? 'Tirar uma foto' : 'Fotografar documento';
  const galleryLabel = paired?.purpose === 'resume' ? 'Escolher currículo ou imagem' : 'Escolher da galeria/arquivos';

  return (
    <main className="min-h-screen bg-[#f5efe8] px-4 py-8 text-[#241914]">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">
          <Smartphone className="h-4 w-4" /> PiraNegócios · transferência segura
        </div>

        <section className="overflow-hidden rounded-[30px] border border-stone-200 bg-[#fffdfa] shadow-xl">
          <div className="border-b border-stone-100 bg-gradient-to-br from-violet-50 to-white p-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              {done ? <CheckCircle2 className="h-7 w-7" /> : autoPairing ? <Loader2 className="h-7 w-7 animate-spin" /> : <LockKeyhole className="h-7 w-7" />}
            </span>
            <h1 className="mt-4 font-serif text-2xl font-bold text-stone-950">
              {done ? 'Arquivo enviado' : autoPairing ? 'Conectando com seu computador' : paired ? 'Escolha como enviar' : 'Conecte com seu computador'}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-stone-500">
              {done
                ? 'A transferência foi concluída. O computador receberá o arquivo automaticamente.'
                : autoPairing
                  ? 'Validando a autorização segura que veio no QR Code.'
                  : paired
                    ? 'Esta autorização vale somente para um envio e expira automaticamente.'
                    : 'Se você escaneou o QR Code, a conexão acontece automaticamente. O código abaixo é apenas uma alternativa manual.'}
            </p>
          </div>

          <div className="p-6">
            {autoPairing && !paired && !done && (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-violet-50 p-4 text-sm font-bold text-violet-700">
                <Loader2 className="h-4 w-4 animate-spin" /> Autorizando este telefone...
              </div>
            )}

            {!autoPairing && !paired && !done && manualFallback && (
              <>
                <div className="mb-4 flex items-start gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-3 text-[11px] leading-5 text-stone-600">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                  <span>Alternativa manual: digite o código de 6 dígitos que aparece no computador.</span>
                </div>
                <label className="block text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Código de pareamento</label>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(event) => { if (event.key === 'Enter') void pair(); }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-4 text-center font-mono text-3xl font-black tracking-[.28em] text-stone-950 outline-none focus:border-violet-400"
                />
                <button
                  type="button"
                  disabled={pairing || code.length !== 6}
                  onClick={() => void pair()}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 py-3.5 text-sm font-black text-white disabled:opacity-40"
                >
                  {pairing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {pairing ? 'Conectando...' : 'Conectar com segurança'}
                </button>
              </>
            )}

            {paired && !done && (
              <div className="grid gap-3">
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture={cameraFacing}
                  className="hidden"
                  onChange={(event) => void upload(event.target.files?.[0])}
                />
                <input
                  ref={galleryRef}
                  type="file"
                  accept={paired.accept}
                  className="hidden"
                  onChange={(event) => void upload(event.target.files?.[0])}
                />

                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => cameraRef.current?.click()}
                  className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 text-left transition hover:border-violet-300 disabled:opacity-50"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-white"><Camera className="h-5 w-5" /></span>
                  <span><strong className="block text-sm text-stone-900">{cameraLabel}</strong><span className="mt-1 block text-[11px] text-stone-500">Abre a câmera deste telefone.</span></span>
                </button>

                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => galleryRef.current?.click()}
                  className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 text-left transition hover:border-violet-300 disabled:opacity-50"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><FileUp className="h-5 w-5" /></span>
                  <span><strong className="block text-sm text-stone-900">{galleryLabel}</strong><span className="mt-1 block text-[11px] text-stone-500">Galeria ou arquivos · máximo {maxSizeLabel}.</span></span>
                </button>

                {uploading && <div className="flex items-center justify-center gap-2 rounded-xl bg-violet-50 px-3 py-3 text-xs font-bold text-violet-700"><Loader2 className="h-4 w-4 animate-spin" /> Enviando com segurança...</div>}
              </div>
            )}

            {done && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800">
                Pronto. Você já pode voltar ao computador.
              </div>
            )}

            {error && <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold leading-5 text-red-700"><XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</div>}
          </div>
        </section>

        <p className="mt-4 text-center text-[10px] leading-4 text-stone-400">
          A autorização do QR Code é aleatória, temporária e de uso único. Ela é removida da barra de endereço assim que o telefone a lê.
        </p>
      </div>
    </main>
  );
}
