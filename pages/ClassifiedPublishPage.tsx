import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Globe2,
  ImagePlus,
  Layers3,
  Loader2,
  MapPin,
  Plus,
  Save,
  Settings2,
  ShoppingBag,
  Trash2,
  UploadCloud,
  Wrench,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ClassifiedCategoryIcon } from '../components/classifieds/ClassifiedCategoryIcon';
import { useClassifiedsWorkspace } from '../contexts/ClassifiedsWorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type {
  ClassifiedCatalogOptionGroup,
  ClassifiedCatalogPricingStrategy,
  ClassifiedCategory,
  ClassifiedCondition,
  ClassifiedListingType,
  ClassifiedPriceType,
  ClassifiedPublicationChannel,
} from '../types/classifieds';

const STEPS = ['Tipo e categoria', 'Anúncio', 'Fotos', 'Detalhes', 'Opções', 'Local', 'Revisão'];

const PRICING_STRATEGIES: Array<{ value: ClassifiedCatalogPricingStrategy; label: string }> = [
  { value: 'BASE', label: 'Preço base' },
  { value: 'SUM', label: 'Somar opções' },
  { value: 'HIGHEST_SELECTION', label: 'Cobrar a opção de maior valor' },
  { value: 'LOWEST_SELECTION', label: 'Cobrar a opção de menor valor' },
  { value: 'AVERAGE_SELECTION', label: 'Média das opções escolhidas' },
];

type FormState = {
  listingType: ClassifiedListingType;
  categorySlug: string;
  title: string;
  description: string;
  price: string;
  priceType: ClassifiedPriceType;
  condition: ClassifiedCondition;
  city: string;
  state: string;
  neighborhood: string;
  zipCode: string;
  contactPhone: string;
  contactWhatsapp: string;
  attributes: Record<string, string>;
  images: string[];
  publicationChannels: ClassifiedPublicationChannel[];
  optionGroups: ClassifiedCatalogOptionGroup[];
};

export default function ClassifiedPublishPage() {
  const { profile } = useAuth();
  const { data } = useClassifiedsWorkspace();
  const navigate = useNavigate();
  const business = data?.activeIdentity === 'COMPANY';
  const company = data?.company;
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [step, setStep] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [channelsTouched, setChannelsTouched] = useState(false);
  const [form, setForm] = useState<FormState>({
    listingType: 'PRODUCT',
    categorySlug: '',
    title: '',
    description: '',
    price: '',
    priceType: 'FIXED',
    condition: 'USED',
    city: profile?.city || '',
    state: profile?.state || '',
    neighborhood: '',
    zipCode: '',
    contactPhone: profile?.phone || '',
    contactWhatsapp: profile?.whatsappPhoneE164 || '',
    attributes: {},
    images: [],
    publicationChannels: business ? company?.defaultPublicationChannels || ['CLASSIFIEDS', 'COMPANY_PAGE'] : ['CLASSIFIEDS'],
    optionGroups: [],
  });

  useEffect(() => {
    api.get('/classifieds/categories').then((response) => setCategories(Array.isArray(response.data) ? response.data : [])).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (channelsTouched) return;
    setForm((current) => ({ ...current, publicationChannels: business ? company?.defaultPublicationChannels || ['CLASSIFIEDS', 'COMPANY_PAGE'] : ['CLASSIFIEDS'] }));
  }, [business, company?.id, company?.defaultPublicationChannels, channelsTouched]);

  const category = useMemo(() => categories.find((item) => item.slug === form.categorySlug), [categories, form.categorySlug]);
  const schema = Array.isArray(category?.attributeSchema) ? category!.attributeSchema! : [];
  const accent = business ? '#0d4542' : '#c96847';

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(''); setError('');
  };

  const chooseListingType = (listingType: ClassifiedListingType) => {
    setForm((current) => ({
      ...current,
      listingType,
      condition: listingType === 'SERVICE' ? 'NOT_APPLICABLE' : current.condition === 'NOT_APPLICABLE' ? 'USED' : current.condition,
      priceType: listingType === 'PRODUCT' && current.priceType === 'CONTACT' ? 'FIXED' : current.priceType,
      categorySlug: listingType === 'SERVICE' && !current.categorySlug ? 'servicos' : current.categorySlug,
    }));
    setMessage(''); setError('');
  };

  const validateStep = () => {
    if (step === 0) {
      if (business && form.listingType === 'PRODUCT' && company?.canSellProducts === false) return 'A empresa não habilitou venda de produtos.';
      if (business && form.listingType === 'SERVICE' && company?.canOfferServices === false) return 'A empresa não habilitou prestação de serviços.';
      if (!form.categorySlug) return 'Escolha uma categoria.';
    }
    if (step === 1) {
      if (!form.title.trim()) return 'Informe o título do anúncio.';
      if (!form.description.trim()) return 'Conte os detalhes do que você está anunciando.';
      if (form.listingType === 'PRODUCT' && form.priceType === 'CONTACT') return 'Produtos precisam ter preço.';
      if (form.priceType !== 'CONTACT' && (!form.price || Number(form.price.replace(',', '.')) < 0)) return 'Informe um preço válido.';
    }
    if (step === 5 && (!form.city.trim() || form.state.trim().length !== 2)) return 'Informe cidade e UF.';
    if (step === 6 && !form.publicationChannels.length) return 'Escolha pelo menos um local para exibir o anúncio.';
    return '';
  };

  const next = () => {
    const problem = validateStep();
    if (problem) { setError(problem); return; }
    setError('');
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const available = 12 - form.images.length;
    const selected = Array.from(files).slice(0, available);
    if (!selected.length) { setError('Você pode enviar até 12 fotos.'); return; }
    setUploading(true); setError('');
    try {
      const uploaded: string[] = [];
      for (const file of selected) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} ultrapassa 10 MB.`);
        const data = new FormData();
        data.append('file', file);
        const response = await api.post('/uploads', data, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (response.data?.url) uploaded.push(response.data.url);
      }
      patch('images', [...form.images, ...uploaded]);
    } catch (uploadError: any) {
      setError(uploadError?.response?.data?.message || uploadError?.message || 'Não foi possível enviar uma das fotos.');
    } finally { setUploading(false); }
  };

  const payload = (status: 'DRAFT' | 'PUBLISHED' = 'DRAFT') => ({
    ...form,
    state: form.state.toUpperCase(),
    price: form.priceType === 'CONTACT' ? null : form.price,
    attributes: form.attributes,
    images: form.images,
    status,
    publicationChannels: business ? form.publicationChannels : ['CLASSIFIEDS'],
    catalogConfig: form.optionGroups.length ? { optionGroups: form.optionGroups, pricingStrategy: 'BASE' } : null,
  });

  const saveDraft = async () => {
    if (!form.categorySlug || !form.title.trim() || !form.description.trim() || !form.city.trim() || form.state.trim().length !== 2) {
      setError('Para salvar o rascunho, preencha categoria, título, descrição, cidade e UF.');
      return null;
    }
    const problem = validateAll(form);
    if (problem) { setError(problem); return null; }
    setSaving(true); setError(''); setMessage('');
    try {
      const response = draftId
        ? await api.patch(`/classifieds/me/listings/${draftId}`, payload('DRAFT'))
        : await api.post('/classifieds/me/listings', payload('DRAFT'));
      const id = response.data?.id || draftId;
      if (id) setDraftId(id);
      setMessage('Rascunho salvo.');
      return id as string | null;
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível salvar o rascunho.');
      return null;
    } finally { setSaving(false); }
  };

  const publish = async () => {
    const problem = validateAll(form);
    if (problem) { setError(problem); return; }
    if (!form.publicationChannels.length) { setError('Escolha onde o anúncio será exibido.'); return; }
    setPublishing(true); setError(''); setMessage('');
    try {
      let id = draftId;
      if (id) await api.patch(`/classifieds/me/listings/${id}`, payload('DRAFT'));
      else {
        const created = await api.post('/classifieds/me/listings', payload('DRAFT'));
        id = created.data?.id;
        if (id) setDraftId(id);
      }
      if (!id) throw new Error('Não foi possível identificar o rascunho.');
      const response = await api.post(`/classifieds/me/listings/${id}/publish`);
      navigate(`/classificados/anuncio/${response.data.slug}`);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Não foi possível publicar o anúncio.');
    } finally { setPublishing(false); }
  };

  return (
    <div className="mx-auto max-w-5xl pb-12 text-[#2d211c]">
      <header className="mb-6 flex items-center gap-3">
        <Link to="/classificados/painel" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/[.06]" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="min-w-0"><p className={`text-[9px] font-black uppercase tracking-[.16em] ${business ? 'text-[#397c75]' : 'text-[#b06448]'}`}>PiraNegócios {business ? 'Business' : 'Personal'}</p><h1 className="truncate font-serif text-2xl font-black">Criar anúncio</h1></div>
        <button onClick={() => void saveDraft()} disabled={saving} className="ml-auto hidden items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#604c42] shadow-sm ring-1 ring-black/[.06] hover:bg-stone-50 sm:inline-flex">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar rascunho</button>
      </header>

      <div className="overflow-hidden rounded-full bg-black/[.08]"><div className="h-1.5 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%`, backgroundColor: accent }} /></div>
      <div className="mt-3 flex justify-between gap-2 text-[9px] font-black uppercase tracking-[.12em] text-stone-400"><span>Etapa {step + 1} de {STEPS.length}</span><span>{STEPS[step]}</span></div>

      {(message || error) && <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}

      <section className="mt-5 rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-black/[.06] sm:p-8">
        {step === 0 && <TypeCategoryStep form={form} categories={categories} business={business} company={company} chooseType={chooseListingType} chooseCategory={(value) => patch('categorySlug', value)} />}
        {step === 1 && <MainInfoStep form={form} patch={patch} />}
        {step === 2 && <PhotosStep images={form.images} uploading={uploading} uploadImages={uploadImages} remove={(index) => patch('images', form.images.filter((_, itemIndex) => itemIndex !== index))} />}
        {step === 3 && <AttributesStep schema={schema} attributes={form.attributes} onChange={(key, value) => patch('attributes', { ...form.attributes, [key]: value })} />}
        {step === 4 && <OptionsStep groups={form.optionGroups} onChange={(groups) => patch('optionGroups', groups)} />}
        {step === 5 && <LocationStep form={form} patch={patch} />}
        {step === 6 && <ReviewStep form={form} category={category} business={business} setChannels={(channels) => { setChannelsTouched(true); patch('publicationChannels', channels); }} />}
      </section>

      <div className="mt-5 flex items-center justify-between gap-3"><button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0} className="rounded-2xl px-4 py-3 text-sm font-bold text-stone-500 disabled:opacity-30">Voltar</button><div className="flex gap-2"><button onClick={() => void saveDraft()} disabled={saving || publishing} className="hidden items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold shadow-sm ring-1 ring-black/[.06] disabled:opacity-50 sm:inline-flex">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Rascunho</button>{step < STEPS.length - 1 ? <button onClick={next} className="inline-flex items-center gap-2 rounded-2xl bg-stone-900 px-6 py-3 text-sm font-black text-white">Continuar <ArrowRight className="h-4 w-4" /></button> : <button onClick={() => void publish()} disabled={publishing} className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white disabled:opacity-60" style={{ backgroundColor: accent }}>{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Publicar anúncio</button>}</div></div>
    </div>
  );
}

function TypeCategoryStep({ form, categories, business, company, chooseType, chooseCategory }: { form: FormState; categories: ClassifiedCategory[]; business: boolean; company: any; chooseType: (value: ClassifiedListingType) => void; chooseCategory: (value: string) => void }) {
  return <div><StepHeading eyebrow="Comece pela natureza do anúncio" title="Produto ou serviço?" text="Isso define preço, condição e quais recursos de catálogo fazem sentido. Uma empresa pode trabalhar com os dois." /><div className="mt-6 grid gap-3 sm:grid-cols-2"><TypeCard selected={form.listingType === 'PRODUCT'} disabled={business && company?.canSellProducts === false} onClick={() => chooseType('PRODUCT')} icon={<ShoppingBag className="h-6 w-6" />} title="Produto" text="Novo, usado, recondicionado, cardápio, roupa, veículo, imóvel e outros itens comercializáveis." /><TypeCard selected={form.listingType === 'SERVICE'} disabled={business && company?.canOfferServices === false} onClick={() => chooseType('SERVICE')} icon={<Wrench className="h-6 w-6" />} title="Serviço" text="Atendimento, mão de obra, orçamento, preço fixo ou valor a partir de." /></div><div className="mt-8 border-t border-stone-100 pt-7"><h3 className="font-serif text-2xl font-black">Categoria</h3><p className="mt-1 text-sm text-stone-500">A categoria organiza busca e campos específicos. As opções do produto ou serviço são configuradas depois.</p><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{categories.map((category) => <button key={category.slug} onClick={() => chooseCategory(category.slug)} className={`flex min-h-[104px] flex-col items-center justify-center gap-3 rounded-[20px] p-4 text-center ring-1 transition ${form.categorySlug === category.slug ? 'bg-stone-900 text-white ring-stone-900' : 'bg-stone-50 text-stone-700 ring-stone-200 hover:bg-stone-100'}`}><ClassifiedCategoryIcon name={category.icon} className="h-6 w-6" /><span className="text-xs font-bold">{category.name}</span></button>)}</div></div></div>;
}

function TypeCard({ selected, disabled, onClick, icon, title, text }: { selected: boolean; disabled?: boolean; onClick: () => void; icon: React.ReactNode; title: string; text: string }) { return <button disabled={disabled} onClick={onClick} className={`rounded-[24px] border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${selected ? 'border-stone-900 bg-stone-900 text-white shadow-lg' : 'border-stone-200 bg-stone-50 text-stone-900 hover:bg-stone-100'}`}><span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${selected ? 'bg-white/10' : 'bg-white shadow-sm'}`}>{icon}</span><h3 className="mt-4 text-lg font-black">{title}</h3><p className={`mt-1 text-xs leading-5 ${selected ? 'text-white/60' : 'text-stone-500'}`}>{text}</p>{disabled && <p className="mt-3 text-[10px] font-black uppercase tracking-[.12em]">Desabilitado nas configurações Business</p>}</button>; }

function MainInfoStep({ form, patch }: { form: FormState; patch: <K extends keyof FormState>(key: K, value: FormState[K]) => void }) {
  const service = form.listingType === 'SERVICE';
  return <div><StepHeading eyebrow={service ? 'Apresente o serviço' : 'Apresente o produto'} title="Conte o que está oferecendo" text="Título direto, descrição útil e uma regra de preço clara deixam a negociação mais simples." /><div className="mt-6 space-y-5"><Field label="Título"><input value={form.title} onChange={(event) => patch('title', event.target.value)} maxLength={160} placeholder={service ? 'Ex.: Formatação e manutenção de notebook' : 'Ex.: iPhone 14 128 GB muito conservado'} className={inputClass} /></Field><Field label="Descrição"><textarea value={form.description} onChange={(event) => patch('description', event.target.value)} rows={7} placeholder={service ? 'Explique o atendimento, o que está incluso, região atendida e condições...' : 'Estado do item, tempo de uso, detalhes importantes, garantia...'} className={`${inputClass} h-auto resize-y py-3`} /></Field><div className="grid gap-4 sm:grid-cols-2">{!service && <Field label="Condição"><select value={form.condition} onChange={(event) => patch('condition', event.target.value as ClassifiedCondition)} className={inputClass}><option value="NEW">Novo</option><option value="USED">Usado</option><option value="REFURBISHED">Recondicionado</option></select></Field>}<Field label="Como exibir o preço"><select value={form.priceType} onChange={(event) => patch('priceType', event.target.value as ClassifiedPriceType)} className={inputClass}><option value="FIXED">Preço fixo</option><option value="NEGOTIABLE">Preço negociável</option>{service && <option value="STARTING_AT">A partir de</option>}{service && <option value="CONTACT">Solicite um orçamento</option>}</select></Field></div>{form.priceType !== 'CONTACT' && <Field label={form.priceType === 'STARTING_AT' ? 'Valor inicial' : 'Preço'}><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">R$</span><input type="number" min="0" step="0.01" value={form.price} onChange={(event) => patch('price', event.target.value)} className={`${inputClass} pl-11`} placeholder="0,00" /></div></Field>}</div></div>;
}

function PhotosStep({ images, uploading, uploadImages, remove }: { images: string[]; uploading: boolean; uploadImages: (files: FileList | null) => void; remove: (index: number) => void }) { return <div><StepHeading eyebrow="Imagem vende contexto" title="Mostre bem o anúncio" text="A primeira foto vira a capa. Você pode usar fotos do produto, do serviço, do ambiente ou do resultado do trabalho." /><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{images.map((url, index) => <div key={`${url}-${index}`} className="relative aspect-square overflow-hidden rounded-[20px] bg-stone-100"><img src={url} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />{index === 0 && <span className="absolute left-2 top-2 rounded-full bg-stone-900/90 px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] text-white">Capa</span>}<button onClick={() => remove(index)} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/94 text-red-600 shadow" aria-label="Remover foto"><Trash2 className="h-4 w-4" /></button></div>)}{images.length < 12 && <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-3 rounded-[20px] border-2 border-dashed border-stone-300 bg-stone-50 text-center text-stone-500 hover:bg-stone-100"><input type="file" accept="image/*" multiple className="hidden" onChange={(event) => { uploadImages(event.target.files); event.currentTarget.value = ''; }} disabled={uploading} />{uploading ? <Loader2 className="h-7 w-7 animate-spin" /> : <ImagePlus className="h-7 w-7" />}<span className="px-3 text-xs font-bold">{uploading ? 'Enviando...' : 'Adicionar fotos'}</span></label>}</div><div className="mt-5 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-800"><UploadCloud className="mt-0.5 h-4 w-4 shrink-0" /><span>Até 12 imagens, máximo de 10 MB por arquivo.</span></div></div>; }

function AttributesStep({ schema, attributes, onChange }: { schema: ClassifiedCategory['attributeSchema']; attributes: Record<string, string>; onChange: (key: string, value: string) => void }) { const fields = Array.isArray(schema) ? schema : []; return <div><StepHeading eyebrow="Campos da categoria" title="Detalhes que ajudam na decisão" text={fields.length ? 'Essas informações mudam conforme a categoria e aparecem de forma organizada no anúncio.' : 'Essa categoria não exige detalhes estruturados adicionais.'} />{fields.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2">{fields.map((field) => <Field key={field.key} label={field.label}>{field.type === 'select' && field.options?.length ? <select value={attributes[field.key] || ''} onChange={(event) => onChange(field.key, event.target.value)} className={inputClass}><option value="">Selecione</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input type={field.type === 'number' ? 'number' : 'text'} value={attributes[field.key] || ''} onChange={(event) => onChange(field.key, event.target.value)} className={inputClass} />}</Field>)}</div> : <div className="mt-6 rounded-[20px] bg-stone-50 p-6 text-sm text-stone-500">Sem detalhes adicionais obrigatórios.</div>}</div>; }

function OptionsStep({ groups, onChange }: { groups: ClassifiedCatalogOptionGroup[]; onChange: (groups: ClassifiedCatalogOptionGroup[]) => void }) {
  const addGroup = () => onChange([...groups, { id: crypto.randomUUID(), name: '', kind: 'MODIFIER', selectionType: 'SINGLE', minSelections: 0, maxSelections: 1, pricingStrategy: 'BASE', options: [] }]);
  const updateGroup = (index: number, patch: Partial<ClassifiedCatalogOptionGroup>) => onChange(groups.map((group, itemIndex) => itemIndex === index ? { ...group, ...patch } : group));
  const removeGroup = (index: number) => onChange(groups.filter((_, itemIndex) => itemIndex !== index));
  return <div><StepHeading eyebrow="Opcional, mas poderoso" title="Variações, sabores e adicionais" text="Use a mesma estrutura para tamanho/cor, sabores de pizza, complementos de açaí, tipos de atendimento ou qualquer escolha configurável." /><div className="mt-5 rounded-2xl bg-[#f4f7f6] p-4 text-xs leading-5 text-stone-600"><strong>Exemplo:</strong> grupo “Sabores”, múltipla escolha, máximo 2, estratégia “cobrar a opção de maior valor”. Isso resolve pizza meio a meio sem criar um campo exclusivo para pizzaria.</div><div className="mt-6 space-y-4">{groups.map((group, index) => <OptionGroupEditor key={group.id} group={group} index={index} update={(patch) => updateGroup(index, patch)} remove={() => removeGroup(index)} />)}<button onClick={addGroup} className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-xs font-black text-stone-600 hover:bg-stone-100"><Plus className="h-4 w-4" /> Adicionar grupo de opções</button>{!groups.length && <p className="text-xs text-stone-400">Não precisa configurar nada se o anúncio não tiver opções.</p>}</div></div>;
}

function OptionGroupEditor({ group, index, update, remove }: { group: ClassifiedCatalogOptionGroup; index: number; update: (patch: Partial<ClassifiedCatalogOptionGroup>) => void; remove: () => void }) {
  const addOption = () => update({ options: [...group.options, { id: crypto.randomUUID(), label: '', priceDelta: 0 }] });
  const updateOption = (optionIndex: number, patch: any) => update({ options: group.options.map((option, itemIndex) => itemIndex === optionIndex ? { ...option, ...patch } : option) });
  const removeOption = (optionIndex: number) => update({ options: group.options.filter((_, itemIndex) => itemIndex !== optionIndex) });
  return <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4 sm:p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-stone-500 shadow-sm"><Layers3 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.14em] text-stone-400">Grupo {index + 1}</p><input value={group.name} onChange={(event) => update({ name: event.target.value })} placeholder="Ex.: Sabores, Tamanho, Borda, Atendimento" className="mt-1 w-full bg-transparent text-base font-black outline-none placeholder:text-stone-300" /></div><button onClick={remove} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-red-500 shadow-sm"><Trash2 className="h-4 w-4" /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MiniField label="Tipo"><select value={group.kind} onChange={(event) => update({ kind: event.target.value as 'VARIANT' | 'MODIFIER' })} className={miniInputClass}><option value="VARIANT">Variante</option><option value="MODIFIER">Adicional</option></select></MiniField><MiniField label="Escolha"><select value={group.selectionType} onChange={(event) => update({ selectionType: event.target.value as 'SINGLE' | 'MULTIPLE' })} className={miniInputClass}><option value="SINGLE">Uma opção</option><option value="MULTIPLE">Várias opções</option></select></MiniField><MiniField label="Máximo"><input type="number" min="1" max="80" value={group.maxSelections || 1} onChange={(event) => update({ maxSelections: Number(event.target.value) || 1 })} className={miniInputClass} /></MiniField><MiniField label="Cálculo"><select value={group.pricingStrategy || 'BASE'} onChange={(event) => update({ pricingStrategy: event.target.value as ClassifiedCatalogPricingStrategy })} className={miniInputClass}>{PRICING_STRATEGIES.map((strategy) => <option key={strategy.value} value={strategy.value}>{strategy.label}</option>)}</select></MiniField></div><div className="mt-4 space-y-2">{group.options.map((option, optionIndex) => <div key={option.id} className="grid grid-cols-[minmax(0,1fr)_110px_36px] gap-2"><input value={option.label} onChange={(event) => updateOption(optionIndex, { label: event.target.value })} placeholder="Nome da opção" className={miniInputClass} /><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-400">+ R$</span><input type="number" step="0.01" value={option.priceDelta ?? 0} onChange={(event) => updateOption(optionIndex, { priceDelta: Number(event.target.value) || 0 })} className={`${miniInputClass} pl-9`} /></div><button onClick={() => removeOption(optionIndex)} className="flex h-10 w-9 items-center justify-center rounded-xl bg-white text-stone-400 ring-1 ring-stone-200"><Trash2 className="h-3.5 w-3.5" /></button></div>)}<button onClick={addOption} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-black text-stone-600 ring-1 ring-stone-200"><Plus className="h-3.5 w-3.5" /> Opção</button></div></div>;
}

function LocationStep({ form, patch }: { form: FormState; patch: <K extends keyof FormState>(key: K, value: FormState[K]) => void }) { return <div><StepHeading eyebrow="Região e contato" title="Onde está o anúncio?" text="A localização aproxima pessoas da região. O endereço exato não é publicado." /><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Cidade"><div className="relative"><MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={form.city} onChange={(event) => patch('city', event.target.value)} className={`${inputClass} pl-11`} /></div></Field><Field label="UF"><input value={form.state} onChange={(event) => patch('state', event.target.value.toUpperCase().slice(0, 2))} maxLength={2} className={`${inputClass} uppercase`} placeholder="SP" /></Field><Field label="Bairro (opcional)"><input value={form.neighborhood} onChange={(event) => patch('neighborhood', event.target.value)} className={inputClass} /></Field><Field label="CEP (opcional)"><input value={form.zipCode} onChange={(event) => patch('zipCode', event.target.value)} className={inputClass} /></Field></div><div className="mt-7 border-t border-stone-100 pt-6"><h3 className="font-serif text-xl font-black">Contatos externos opcionais</h3><p className="mt-1 text-xs leading-5 text-stone-500"><strong>A negociação principal acontece pelo chat interno do PiraNegócios.</strong> Telefone e WhatsApp são complementares e só aparecem se você preencher.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Telefone"><input value={form.contactPhone} onChange={(event) => patch('contactPhone', event.target.value)} className={inputClass} /></Field><Field label="WhatsApp"><input value={form.contactWhatsapp} onChange={(event) => patch('contactWhatsapp', event.target.value)} className={inputClass} /></Field></div></div></div>; }

function ReviewStep({ form, category, business, setChannels }: { form: FormState; category?: ClassifiedCategory; business: boolean; setChannels: (channels: ClassifiedPublicationChannel[]) => void }) {
  const toggle = (channel: ClassifiedPublicationChannel) => setChannels(form.publicationChannels.includes(channel) ? form.publicationChannels.filter((item) => item !== channel) : [...form.publicationChannels, channel]);
  const price = form.priceType === 'CONTACT' ? 'Solicite um orçamento' : form.priceType === 'STARTING_AT' ? `A partir de ${moneyLabel(form.price)}` : form.priceType === 'NEGOTIABLE' ? `${moneyLabel(form.price)} · negociável` : moneyLabel(form.price);
  return <div><StepHeading eyebrow="Última conferida" title="Pronto para publicar" text="A identidade anunciante já vem do workspace. Aqui você só confere o anúncio e, no Business, pode alterar discretamente onde este item aparece." /><div className="mt-6 grid gap-5 lg:grid-cols-[280px_1fr]"><div className="aspect-square overflow-hidden rounded-[22px] bg-stone-100">{form.images[0] ? <img src={form.images[0]} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-stone-300"><ImagePlus className="h-10 w-10" /></div>}</div><div className="space-y-5"><div><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-black uppercase tracking-[.15em] text-stone-400">{category?.name || 'Categoria'} · {form.listingType === 'SERVICE' ? 'Serviço' : 'Produto'}</p></div><h2 className="mt-1 text-2xl font-black">{form.title || 'Sem título'}</h2><p className="mt-2 text-3xl font-black">{price}</p></div><div className="grid grid-cols-2 gap-4 text-sm"><ReviewItem label="Local" value={`${form.city} - ${form.state}`} /><ReviewItem label="Fotos" value={`${form.images.length} enviada${form.images.length === 1 ? '' : 's'}`} /><ReviewItem label="Opções" value={form.optionGroups.length ? `${form.optionGroups.length} grupo${form.optionGroups.length === 1 ? '' : 's'}` : 'Sem opções'} /><ReviewItem label="Negociação" value="Chat interno em tempo real" /></div><p className="whitespace-pre-wrap rounded-[18px] bg-stone-50 p-4 text-sm leading-6 text-stone-600">{form.description}</p>{business && <div className="rounded-[18px] border border-stone-200 bg-white p-3"><div className="flex items-center gap-2"><Settings2 className="h-3.5 w-3.5 text-stone-400" /><p className="text-[9px] font-black uppercase tracking-[.14em] text-stone-400">Exibição deste anúncio</p></div><div className="mt-2 flex flex-wrap gap-2"><ChannelPill active={form.publicationChannels.includes('CLASSIFIEDS')} onClick={() => toggle('CLASSIFIEDS')} icon={<Globe2 className="h-3.5 w-3.5" />} label="Classificados" /><ChannelPill active={form.publicationChannels.includes('COMPANY_PAGE')} onClick={() => toggle('COMPANY_PAGE')} icon={<Building2 className="h-3.5 w-3.5" />} label="Página da empresa" /></div><p className="mt-2 text-[10px] text-stone-400">Este ajuste vale só para este anúncio. O padrão continua nas configurações Business.</p></div>}</div></div></div>;
}

function ChannelPill({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) { return <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-black transition ${active ? 'bg-[#0d4542] text-white' : 'bg-stone-100 text-stone-400'}`}>{icon}{label}{active && <Check className="h-3 w-3" />}</button>; }
function StepHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-stone-400">{eyebrow}</p><h2 className="mt-1 font-serif text-3xl font-black tracking-[-.025em] sm:text-4xl">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{text}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[.14em] text-stone-400">{label}</span>{children}</label>; }
function MiniField({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-1 block text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{label}</span>{children}</label>; }
function ReviewItem({ label, value }: { label: string; value: string }) { return <div><p className="text-[9px] font-black uppercase tracking-[.14em] text-stone-400">{label}</p><p className="mt-1 font-bold text-stone-700">{value}</p></div>; }
const inputClass = 'h-12 w-full rounded-2xl border-0 bg-stone-50 px-4 text-sm font-semibold text-stone-800 outline-none ring-1 ring-stone-200 placeholder:text-stone-300 focus:ring-2 focus:ring-stone-400/40';
const miniInputClass = 'h-10 w-full rounded-xl border-0 bg-white px-3 text-xs font-semibold text-stone-700 outline-none ring-1 ring-stone-200 focus:ring-2 focus:ring-stone-400/40';
function moneyLabel(value: string) { const numeric = Number(String(value || 0).replace(',', '.')); return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(numeric) ? numeric : 0); }
function validateAll(form: FormState) { if (!form.categorySlug) return 'Escolha uma categoria.'; if (!form.title.trim()) return 'Informe o título.'; if (!form.description.trim()) return 'Informe a descrição.'; if (form.listingType === 'PRODUCT' && form.priceType === 'CONTACT') return 'Produtos precisam ter preço.'; if (form.priceType !== 'CONTACT' && (!form.price || Number(form.price.replace(',', '.')) < 0)) return 'Informe um preço válido.'; if (!form.city.trim() || form.state.trim().length !== 2) return 'Informe cidade e UF.'; if (!form.publicationChannels.length) return 'Escolha onde o anúncio será exibido.'; return ''; }
