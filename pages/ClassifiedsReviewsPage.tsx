import React, { useEffect, useState } from 'react';
import { Camera, CheckCircle2, Loader2, MessageSquareText, ShieldCheck, Star, X } from 'lucide-react';
import { api } from '../lib/api';

type Eligible = {
  orderId: string;
  listingId: string;
  title: string;
  slug: string;
  listingType: 'PRODUCT' | 'SERVICE';
  image?: string | null;
  companyName: string;
  completedAt?: string | null;
  review?: { id: string; status: string; publishAt?: string | null } | null;
  canReview: boolean;
};

type Draft = {
  productRating: number | null;
  serviceRating: number | null;
  companyRating: number | null;
  comment: string;
  photoUrls: string[];
};

const emptyDraft: Draft = { productRating: null, serviceRating: null, companyRating: null, comment: '', photoUrls: [] };

export default function ClassifiedsReviewsPage() {
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [selected, setSelected] = useState<Eligible | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [eligibleResponse, mineResponse] = await Promise.all([
        api.get('/classifieds/me/reviews/eligible'),
        api.get('/classifieds/me/reviews'),
      ]);
      setEligible(Array.isArray(eligibleResponse.data) ? eligibleResponse.data : []);
      setMine(Array.isArray(mineResponse.data) ? mineResponse.data : []);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível carregar suas avaliações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const open = (item: Eligible) => {
    setSelected(item);
    setDraft(emptyDraft);
    setMessage('');
  };

  const uploadPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const available = 4 - draft.photoUrls.length;
    const selectedFiles = Array.from(files).slice(0, available);
    if (!selectedFiles.length) return;
    setUploading(true);
    setMessage('');
    try {
      const next: string[] = [];
      for (const file of selectedFiles) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} ultrapassa 10 MB.`);
        const data = new FormData();
        data.append('file', file);
        const response = await api.post('/uploads', data, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (response.data?.url) next.push(response.data.url);
      }
      setDraft((current) => ({ ...current, photoUrls: [...current.photoUrls, ...next].slice(0, 4) }));
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Não foi possível enviar a foto.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!selected || saving) return;
    if (selected.listingType === 'PRODUCT' && !draft.productRating) {
      setMessage('Dê uma nota para o produto.');
      return;
    }
    if (selected.listingType !== 'PRODUCT' && !draft.serviceRating && !draft.companyRating) {
      setMessage('Dê pelo menos uma nota para atendimento ou empresa.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const response = await api.post(`/classifieds/me/reviews/orders/${selected.orderId}`, draft);
      const status = String(response.data?.status || '');
      setSelected(null);
      setDraft(emptyDraft);
      setMessage(status === 'APPROVED'
        ? 'Avaliação recebida e aprovada na pré-análise. Ela será publicada anonimamente após 7 dias.'
        : status === 'REJECTED'
          ? 'A avaliação não passou na moderação. Você pode revisar o texto e enviar novamente.'
          : 'Avaliação recebida e aguardando revisão. Ela só poderá aparecer após a moderação e o prazo de 7 dias.');
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível enviar a avaliação.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-[45vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">Classificados · reputação</p>
        <h1 className="mt-1 font-serif text-3xl font-black">Minhas avaliações</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Só compras pagas e concluídas podem ser avaliadas. Publicamente você aparece apenas como <strong>Compra verificada</strong>, sem nome, foto ou perfil.</p>
      </header>

      {message && <div className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-bold text-white">{message}</div>}

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
        <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-600" /><div><h2 className="font-black">Compras disponíveis para avaliar</h2><p className="mt-1 text-xs text-stone-500">A nota do produto fica no produto. Atendimento e empresa ajudam a formar a reputação da empresa.</p></div></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {eligible.filter((item) => item.canReview).length ? eligible.filter((item) => item.canReview).map((item) => (
            <article key={item.orderId} className="flex gap-4 rounded-2xl bg-stone-50 p-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-stone-200">{item.image && <img src={item.image} alt="" className="h-full w-full object-cover" />}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{item.title}</p><p className="mt-1 text-xs text-stone-500">{item.companyName}</p><button onClick={() => open(item)} className="mt-3 rounded-xl bg-stone-900 px-4 py-2 text-xs font-black text-white">Avaliar compra</button></div>
            </article>
          )) : <div className="col-span-full py-10 text-center text-sm text-stone-400">Nenhuma compra concluída aguardando avaliação.</div>}
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
        <div className="flex items-center gap-3"><MessageSquareText className="h-5 w-5 text-stone-500" /><h2 className="font-black">Avaliações enviadas</h2></div>
        <div className="mt-4 space-y-3">
          {mine.length ? mine.map((review) => <div key={review.id} className="rounded-2xl border border-stone-100 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-black">{review.title}</p><p className="mt-1 text-xs text-stone-500">{review.companyName}</p></div><Status status={review.status} publicNow={review.publicNow} publishAt={review.publishAt} /></div>{review.comment && <p className="mt-3 text-sm leading-6 text-stone-600">{review.comment}</p>}<div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">{review.productRating && <span>Produto <strong>{review.productRating}/5</strong></span>}{review.serviceRating && <span>Atendimento <strong>{review.serviceRating}/5</strong></span>}{review.companyRating && <span>Empresa <strong>{review.companyRating}/5</strong></span>}</div>{review.status === 'REJECTED' && review.moderationReason && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{review.moderationReason}</p>}</div>) : <div className="py-8 text-center text-sm text-stone-400">Você ainda não enviou avaliações.</div>}
        </div>
      </section>

      {selected && <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-5"><div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-2xl sm:rounded-[30px] sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#b06448]">Compra verificada</p><h2 className="mt-1 font-serif text-2xl font-black">Avaliar {selected.title}</h2><p className="mt-1 text-xs text-stone-500">Sua identidade não será exibida junto da avaliação.</p></div><button onClick={() => setSelected(null)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100"><X className="h-4 w-4" /></button></div>
        <div className="mt-6 space-y-5">
          {selected.listingType === 'PRODUCT' && <RatingField label="Produto" text="Qualidade, condição e se corresponde ao anúncio." value={draft.productRating} onChange={(value) => setDraft((current) => ({ ...current, productRating: value }))} />}
          <RatingField label="Atendimento" text="Comunicação, cordialidade e resolução durante a compra." value={draft.serviceRating} onChange={(value) => setDraft((current) => ({ ...current, serviceRating: value }))} />
          <RatingField label="Empresa" text="Sua impressão geral da empresa nesta experiência." value={draft.companyRating} onChange={(value) => setDraft((current) => ({ ...current, companyRating: value }))} />
          <label className="block"><span className="text-xs font-black">Comentário <span className="font-medium text-stone-400">(opcional)</span></span><textarea value={draft.comment} maxLength={3000} onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))} rows={5} placeholder="Conte como foi sua experiência. Críticas objetivas são bem-vindas; ofensas e ataques pessoais não são publicados." className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-400" /></label>
          <div><div className="flex items-center justify-between gap-3"><span className="text-xs font-black">Fotos <span className="font-medium text-stone-400">(opcional, até 4)</span></span><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-xs font-black"><Camera className="h-4 w-4" /> {uploading ? 'Enviando...' : 'Adicionar'}<input type="file" accept="image/*" multiple className="hidden" disabled={uploading || draft.photoUrls.length >= 4} onChange={(event) => void uploadPhotos(event.target.files)} /></label></div>{draft.photoUrls.length > 0 && <div className="mt-3 grid grid-cols-4 gap-2">{draft.photoUrls.map((url, index) => <div key={`${url}-${index}`} className="relative aspect-square overflow-hidden rounded-xl bg-stone-100"><img src={url} alt="" className="h-full w-full object-cover" /><button onClick={() => setDraft((current) => ({ ...current, photoUrls: current.photoUrls.filter((_, i) => i !== index) }))} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"><X className="h-3 w-3" /></button></div>)}</div>}</div>
          <div className="rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-950"><strong>Antes de publicar:</strong> a avaliação passa por moderação. Conteúdo abusivo é recusado; críticas legítimas não são escondidas. Mesmo aprovada, ela só se torna pública 7 dias depois do envio.</div>
          <button onClick={() => void submit()} disabled={saving || uploading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2d211c] text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Enviar avaliação</button>
        </div></div></div>}
    </div>
  );
}

function RatingField({ label, text, value, onChange }: { label: string; text: string; value: number | null; onChange: (value: number) => void }) {
  return <div><p className="text-xs font-black">{label}</p><p className="mt-1 text-xs text-stone-400">{text}</p><div className="mt-2 flex gap-1">{[1,2,3,4,5].map((star) => <button key={star} onClick={() => onChange(star)} aria-label={`${star} estrelas`} className="p-1"><Star className={`h-7 w-7 ${value && star <= value ? 'fill-amber-400 text-amber-400' : 'text-stone-300'}`} /></button>)}</div></div>;
}

function Status({ status, publicNow, publishAt }: { status: string; publicNow?: boolean; publishAt?: string | null }) {
  const data = status === 'APPROVED' ? (publicNow ? ['Publicada','bg-emerald-50 text-emerald-700'] : ['Aprovada · aguardando 7 dias','bg-blue-50 text-blue-700']) : status === 'REJECTED' ? ['Reprovada','bg-red-50 text-red-700'] : status === 'PENDING_MANUAL' ? ['Em revisão','bg-amber-50 text-amber-700'] : ['Pré-análise pendente','bg-stone-100 text-stone-600'];
  return <div className="text-right"><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${data[1]}`}>{data[0]}</span>{status === 'APPROVED' && !publicNow && publishAt && <p className="mt-1 text-[9px] text-stone-400">Liberação: {new Date(publishAt).toLocaleDateString('pt-BR')}</p>}</div>;
}
