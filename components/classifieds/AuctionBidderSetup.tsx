import React, { useEffect, useMemo, useState } from 'react';
import { Camera, Check, CheckCircle2, Loader2, MessageCircle, ShieldCheck, Upload, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';

export function AuctionBidderSetup({ onReady, onClose }: { onReady?: () => void; onClose?: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [phone, setPhone] = useState(profile?.phone || '');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [whatsappVerified, setWhatsappVerified] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [photoReady, setPhotoReady] = useState(Boolean(profile?.photoURL));
  const [working, setWorking] = useState<'otp' | 'verify' | 'photo' | ''>('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    if (!user) return;
    api.get('/whatsapp/phone/status')
      .then((response) => {
        if (!active) return;
        setWhatsappVerified(Boolean(response.data?.verified));
        if (response.data?.phoneE164) setPhone(String(response.data.phoneE164));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [user?.uid]);

  useEffect(() => { setPhotoReady(Boolean(profile?.photoURL)); }, [profile?.photoURL]);

  const emailReady = Boolean(user?.email || profile?.email);
  const ready = emailReady && whatsappVerified && photoReady;
  const progress = useMemo(() => [emailReady, whatsappVerified, photoReady].filter(Boolean).length, [emailReady, whatsappVerified, photoReady]);

  useEffect(() => {
    if (ready) onReady?.();
  }, [ready, onReady]);

  const requestOtp = async () => {
    if (!phone.trim() || working) return;
    setWorking('otp'); setMessage('');
    try {
      const response = await api.post('/whatsapp/phone/request-otp', { phone });
      setOtpSent(true);
      setMaskedPhone(response.data?.phone || 'seu WhatsApp');
      setMessage(response.data?.message || 'Código enviado pelo WhatsApp.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível enviar o código agora.');
    } finally { setWorking(''); }
  };

  const verifyOtp = async () => {
    if (code.replace(/\D/g, '').length !== 6 || working) return;
    setWorking('verify'); setMessage('');
    try {
      await api.post('/whatsapp/phone/verify-otp', { phone, code });
      setWhatsappVerified(true);
      setCode('');
      await refreshProfile();
      setMessage('WhatsApp confirmado.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível validar este código.');
    } finally { setWorking(''); }
  };

  const uploadPhoto = async (file?: File | null) => {
    if (!file || working) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) { setMessage('Escolha uma foto JPG, PNG ou WebP.'); return; }
    if (file.size > 8 * 1024 * 1024) { setMessage('A foto deve ter no máximo 8 MB.'); return; }
    setWorking('photo'); setMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      const upload = await api.post('/uploads', form);
      const url = String(upload.data?.url || '');
      if (!url) throw new Error('Upload sem URL');
      await api.patch('/users/me', { photoURL: url });
      await refreshProfile();
      setPhotoReady(true);
      setMessage('Foto adicionada ao seu perfil.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível enviar sua foto.');
    } finally { setWorking(''); }
  };

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#17100e] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,.25)] sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff7049]/15 blur-3xl" />
      {onClose && <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/15 hover:text-white" aria-label="Fechar"><X className="h-4 w-4" /></button>}
      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff633c] text-white shadow-[0_10px_30px_rgba(255,99,60,.25)]"><ShieldCheck className="h-5 w-5" /></span>
          <div><p className="text-[9px] font-black uppercase tracking-[.17em] text-[#ff9b7c]">Pronto para dar lance</p><h3 className="mt-0.5 text-lg font-black">Complete seu passe de participante</h3></div>
        </div>
        <p className="mt-3 max-w-2xl text-xs leading-5 text-white/55">Leilões exigem e-mail, WhatsApp confirmado e uma foto de perfil. A foto é usada como requisito de perfil; nesta versão não fazemos reconhecimento facial.</p>

        <div className="mt-5 flex items-center gap-2">
          {[0, 1, 2].map((index) => <span key={index} className={`h-1.5 flex-1 rounded-full transition ${index < progress ? 'bg-[#ff633c]' : 'bg-white/10'}`} />)}
          <span className="ml-1 text-[10px] font-black text-white/45">{progress}/3</span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Requirement done={emailReady} icon={<CheckCircle2 className="h-4 w-4" />} title="E-mail" text={emailReady ? (user?.email || profile?.email || 'Confirmado') : 'Adicione um e-mail à conta'} />
          <Requirement done={whatsappVerified} icon={<MessageCircle className="h-4 w-4" />} title="WhatsApp" text={whatsappVerified ? 'Número confirmado' : 'Receba um OTP de 6 dígitos'} />
          <Requirement done={photoReady} icon={<Camera className="h-4 w-4" />} title="Foto de perfil" text={photoReady ? 'Foto adicionada' : 'Envie uma foto do seu perfil'} />
        </div>

        {!whatsappVerified && <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.055] p-4">
          <div className="flex items-center gap-2 text-xs font-black"><MessageCircle className="h-4 w-4 text-[#ff8b69]" /> Validar WhatsApp</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input value={phone} onChange={(event) => setPhone(event.target.value)} disabled={working === 'otp' || working === 'verify'} placeholder="(19) 99999-9999" className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm font-bold text-white outline-none placeholder:text-white/25 focus:border-[#ff7049]/60" />
            <button type="button" onClick={() => void requestOtp()} disabled={Boolean(working) || !phone.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-[#251611] disabled:opacity-40">{working === 'otp' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Enviar código</button>
          </div>
          {otpSent && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="h-11 rounded-xl border border-[#ff7049]/30 bg-black/20 px-3 text-center text-lg font-black tracking-[.3em] text-white outline-none" /><button type="button" onClick={() => void verifyOtp()} disabled={Boolean(working) || code.length !== 6} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#ff633c] px-4 text-xs font-black text-white disabled:opacity-40">{working === 'verify' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar OTP</button><p className="sm:col-span-2 text-[10px] text-white/40">Código enviado para {maskedPhone || 'o número informado'}. Expira em 10 minutos.</p></div>}
        </div>}

        {!photoReady && <div className="mt-3 rounded-2xl border border-white/10 bg-white/[.055] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="flex items-center gap-2 text-xs font-black"><Camera className="h-4 w-4 text-[#ff8b69]" /> Adicionar foto de perfil</p><p className="mt-1 text-[10px] leading-4 text-white/40">JPG, PNG ou WebP, até 8 MB.</p></div>
            <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-[#251611]"><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { void uploadPhoto(event.target.files?.[0]); event.currentTarget.value = ''; }} /><>{working === 'photo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Escolher foto</></label>
          </div>
        </div>}

        {message && <p className={`mt-4 rounded-xl px-3 py-2 text-xs font-bold ${ready ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/[.06] text-white/65'}`}>{message}</p>}
        {ready && <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Perfil pronto. Você já pode participar dos leilões.</div>}
      </div>
    </section>
  );
}

function Requirement({ done, icon, title, text }: { done: boolean; icon: React.ReactNode; title: string; text: string }) {
  return <div className={`rounded-2xl border p-3 transition ${done ? 'border-emerald-400/20 bg-emerald-400/[.08]' : 'border-white/10 bg-white/[.035]'}`}><div className={`flex h-8 w-8 items-center justify-center rounded-xl ${done ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-white/50'}`}>{done ? <Check className="h-4 w-4" /> : icon}</div><p className="mt-2 text-xs font-black">{title}</p><p className="mt-1 text-[10px] leading-4 text-white/42">{text}</p></div>;
}
