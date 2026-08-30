import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ImagePlus,
  Layers3,
  Loader2,
  MapPin,
  Plus,
  Save,
  ShoppingBag,
  Trash2,
  UploadCloud,
  Wrench,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ClassifiedCategoryIcon } from '../components/classifieds/ClassifiedCategoryIcon';
import { ClassifiedMediaFrame } from '../components/classifieds/ClassifiedMediaFrame';
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

const STEPS = ['Tipo e categoria','Anúncio','Fotos','Detalhes','Opções','Local','Revisão'];
const CUSTOM_CATEGORY_KEY = 'customCategory';
const PRODUCT_OTHER_SLUG = 'outros';
const SERVICE_OTHER_SLUG = 'servicos-outros';
const PRICING: Array<{value:ClassifiedCatalogPricingStrategy;label:string}> = [
  {value:'BASE',label:'Preço base'},
  {value:'SUM',label:'Somar opções'},
  {value:'HIGHEST_SELECTION',label:'Maior valor escolhido'},
  {value:'LOWEST_SELECTION',label:'Menor valor escolhido'},
  {value:'AVERAGE_SELECTION',label:'Média das escolhas'},
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
  attributes: Record<string,string>;
  images: string[];
  publicationChannels: ClassifiedPublicationChannel[];
  optionGroups: ClassifiedCatalogOptionGroup[];
  inventoryMode: 'SINGLE'|'TRACKED'|'UNLIMITED';
  stockQuantity: string;
};

type Patch = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

export default function ClassifiedPublishPageV2() {
  const { profile } = useAuth();
  const { data } = useClassifiedsWorkspace();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const business = data?.activeIdentity === 'COMPANY';
  const company = data?.company;
  const [categories,setCategories] = useState<ClassifiedCategory[]>([]);
  const [step,setStep] = useState(0);
  const [draftId,setDraftId] = useState<string|null>(null);
  const [photoLimit,setPhotoLimit] = useState(3);
  const [saving,setSaving] = useState(false);
  const [publishing,setPublishing] = useState(false);
  const [uploading,setUploading] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const locationTouched = useRef(false);

  const [form,setForm] = useState<FormState>({
    listingType:'PRODUCT',categorySlug:'',title:'',description:'',price:'',priceType:'FIXED',condition:'USED',
    city:profile?.city || '',state:profile?.state || '',neighborhood:'',zipCode:'',contactPhone:'',contactWhatsapp:'',
    attributes:{},images:[],publicationChannels:business ? company?.defaultPublicationChannels || ['CLASSIFIEDS','COMPANY_PAGE'] : ['CLASSIFIEDS'],
    optionGroups:[],inventoryMode:'SINGLE',stockQuantity:'1',
  });

  const patch: Patch = (key,value) => { setForm((current) => ({...current,[key]:value})); setError(''); setNotice(''); };
  const category = useMemo(() => categories.find((item) => item.slug === form.categorySlug),[categories,form.categorySlug]);

  useEffect(() => {
    api.get('/classifieds/categories').then((r) => setCategories(Array.isArray(r.data)?r.data:[])).catch(() => setCategories([]));
    api.get('/classifieds/me/limits').then((r) => setPhotoLimit(Math.max(1,Math.min(10,Number(r.data?.photoLimit)||3)))).catch(() => setPhotoLimit(3));
  },[data?.activeIdentity,data?.company?.id]);

  useEffect(() => {
    if (!editId) return;
    let active = true;
    api.get('/classifieds/me/listings').then((response) => {
      if (!active) return;
      const rows = Array.isArray(response.data) ? response.data : Array.isArray(response.data?.items) ? response.data.items : [];
      const listing = rows.find((item:any) => item.id === editId);
      if (!listing) return;
      const stock = listing.commerceConfig?.onlineCheckout?.stockQuantity;
      locationTouched.current = true;
      setDraftId(listing.id);
      setForm((current) => ({...current,
        listingType:listing.listingType || 'PRODUCT',categorySlug:listing.categorySlug || '',title:listing.title || '',description:listing.description || '',
        price:listing.price == null ? '' : String(listing.price),priceType:listing.priceType || 'FIXED',condition:listing.condition || 'USED',
        city:listing.city || '',state:listing.state || '',neighborhood:listing.neighborhood || '',zipCode:listing.zipCode || '',
        contactPhone:listing.contactPhone || '',contactWhatsapp:listing.contactWhatsapp || '',
        attributes:Object.fromEntries(Object.entries(listing.attributes || {}).map(([k,v]) => [k,v == null ? '' : String(v)])),
        images:Array.isArray(listing.images) ? listing.images.map((img:any) => img.url).filter(Boolean) : [],
        publicationChannels:Array.isArray(listing.publicationChannels) ? listing.publicationChannels : current.publicationChannels,
        optionGroups:listing.catalogConfig?.optionGroups || [],
        inventoryMode:stock == null ? 'UNLIMITED' : Number(stock) === 1 ? 'SINGLE' : 'TRACKED',stockQuantity:stock == null ? '' : String(stock),
      }));
    }).catch(() => setError('Não foi possível carregar o anúncio para edição.'));
    return () => { active = false; };
  },[editId]);

  useEffect(() => {
    if (editId) return;
    let active = true;
    api.get('/classifieds/me/listings').then((response) => {
      if (!active || locationTouched.current) return;
      const rows = Array.isArray(response.data) ? response.data : Array.isArray(response.data?.items) ? response.data.items : [];
      const recent = rows.find((item:any) => item.city && item.state);
      if (!recent) return;
      setForm((current) => ({...current,city:recent.city || current.city,state:String(recent.state || current.state).toUpperCase().slice(0,2),neighborhood:recent.neighborhood || '',zipCode:recent.zipCode || ''}));
    }).catch(() => undefined);
    return () => { active = false; };
  },[editId,data?.activeIdentity,data?.company?.id]);

  const uploadImages = async (files: FileList|null) => {
    if (!files?.length) return;
    const selected = Array.from(files).slice(0,Math.max(0,photoLimit-form.images.length));
    if (!selected.length) { setError(`Você pode usar até ${photoLimit} foto${photoLimit === 1 ? '' : 's'} neste anúncio.`); return; }
    setUploading(true); setError('');
    try {
      const urls:string[] = [];
      for (const file of selected) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 10*1024*1024) throw new Error(`${file.name} ultrapassa 10 MB.`);
        const body = new FormData(); body.append('file',file);
        const response = await api.post('/uploads',body,{headers:{'Content-Type':'multipart/form-data'}});
        if (response.data?.url) urls.push(response.data.url);
      }
      patch('images',[...form.images,...urls]);
    } catch (uploadError:any) { setError(uploadError?.response?.data?.message || uploadError?.message || 'Não foi possível enviar as fotos.'); }
    finally { setUploading(false); }
  };

  const moveImage = (from:number,to:number) => {
    if (from === to || from < 0 || to < 0 || from >= form.images.length || to >= form.images.length) return;
    setForm((current) => {
      const images = [...current.images];
      const [moved] = images.splice(from,1);
      images.splice(to,0,moved);
      return {...current,images};
    });
    setNotice(to === 0 ? 'Capa alterada. A primeira foto será usada como principal.' : 'Ordem das fotos atualizada.');
  };

  const validate = (all = false) => {
    if (!form.categorySlug) return 'Escolha uma categoria.';
    if (isOther(form) && !customCategory(form).trim()) return 'Descreva a categoria.';
    if (step >= 1 || all) {
      if (!form.title.trim()) return 'Informe o título.';
      if (!form.description.trim()) return 'Informe a descrição.';
      if (form.listingType === 'PRODUCT' && form.priceType === 'CONTACT') return 'Produtos precisam ter preço.';
      if (form.priceType !== 'CONTACT' && (!form.price || Number(form.price.replace(',','.')) < 0)) return 'Informe um preço válido.';
    }
    if ((step >= 5 || all) && (!form.city.trim() || form.state.trim().length !== 2)) return 'Informe cidade e UF.';
    if (all && !form.publicationChannels.length) return 'Escolha onde o anúncio será exibido.';
    return '';
  };

  const payload = () => ({
    ...form,state:form.state.toUpperCase(),price:form.priceType === 'CONTACT' ? null : form.price,
    publicationChannels:business ? form.publicationChannels : ['CLASSIFIEDS'],
    catalogConfig:form.optionGroups.length ? {optionGroups:form.optionGroups,pricingStrategy:'BASE'} : null,
    commerceConfig:business && form.listingType === 'PRODUCT' ? {onlineCheckout:{stockQuantity:form.inventoryMode === 'UNLIMITED' ? null : form.inventoryMode === 'SINGLE' ? 1 : Number(form.stockQuantity || 0)}} : undefined,
  });

  const saveDraft = async () => {
    const problem = validate(true); if (problem) { setError(problem); return null; }
    setSaving(true); setError('');
    try {
      const response = draftId ? await api.patch(`/classifieds/me/listings/${draftId}`,payload()) : await api.post('/classifieds/me/listings',{...payload(),status:'DRAFT'});
      const id = response.data?.id || draftId; if (id) setDraftId(id); setNotice('Rascunho salvo.'); return id as string|null;
    } catch (requestError:any) { setError(requestError?.response?.data?.message || 'Não foi possível salvar o rascunho.'); return null; }
    finally { setSaving(false); }
  };

  const publish = async () => {
    const problem = validate(true); if (problem) { setError(problem); return; }
    setPublishing(true); setError('');
    try {
      let id = draftId;
      if (id) await api.patch(`/classifieds/me/listings/${id}`,payload());
      else { const created = await api.post('/classifieds/me/listings',{...payload(),status:'DRAFT'}); id = created.data?.id; }
      if (!id) throw new Error('Rascunho não identificado.');
      const response = await api.post(`/classifieds/me/listings/${id}/publish`);
      navigate(`/classificados/explorar/${response.data.slug}`);
    } catch (requestError:any) { setError(requestError?.response?.data?.message || requestError?.message || 'Não foi possível publicar.'); }
    finally { setPublishing(false); }
  };

  const next = () => { const problem = validate(false); if (problem) { setError(problem); return; } setStep((current) => Math.min(STEPS.length-1,current+1)); window.scrollTo({top:0,behavior:'smooth'}); };

  return <div className="mx-auto max-w-5xl pb-12 text-[#2d211c]">
    <header className="mb-6 flex items-center gap-3"><Link to="/classificados/painel" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/[.06]"><ArrowLeft className="h-4 w-4" /></Link><div><p className={`text-[9px] font-black uppercase tracking-[.16em] ${business ? 'text-[#397c75]' : 'text-[#b06448]'}`}>PiraNegócios {business ? 'Business' : 'Personal'}</p><h1 className="font-serif text-2xl font-black">{draftId ? 'Editar anúncio' : 'Criar anúncio'}</h1></div><button type="button" disabled={saving} onClick={() => void saveDraft()} className="ml-auto hidden items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-stone-600 ring-1 ring-stone-200 sm:inline-flex">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar</button></header>
    <div className="h-1.5 overflow-hidden rounded-full bg-black/[.08]"><div className="h-full bg-stone-900 transition-all" style={{width:`${((step+1)/STEPS.length)*100}%`}} /></div><div className="mt-3 flex justify-between text-[9px] font-black uppercase tracking-[.12em] text-stone-400"><span>Etapa {step+1} de {STEPS.length}</span><span>{STEPS[step]}</span></div>
    {error && <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}{notice && <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div>}
    <section className="mt-5 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-black/[.06] sm:p-8">
      {step === 0 && <TypeStep form={form} patch={patch} categories={categories} business={business} company={company} />}
      {step === 1 && <InfoStep form={form} patch={patch} />}
      {step === 2 && <PhotosStep images={form.images} limit={photoLimit} uploading={uploading} upload={uploadImages} remove={(index) => patch('images',form.images.filter((_,i)=>i!==index))} move={moveImage} />}
      {step === 3 && <AttributesStep schema={category?.attributeSchema} values={form.attributes} onChange={(key,value) => patch('attributes',{...form.attributes,[key]:value})} />}
      {step === 4 && <OptionsStep groups={form.optionGroups} onChange={(groups) => patch('optionGroups',groups)} />}
      {step === 5 && <LocationStep form={form} patch={(key,value) => { locationTouched.current = true; patch(key as any,value as any); }} />}
      {step === 6 && <ReviewStep form={form} business={business} category={category} patch={patch} />}
    </section>
    <div className="mt-5 flex items-center justify-between"><button type="button" disabled={step === 0} onClick={() => setStep((current)=>Math.max(0,current-1))} className="rounded-2xl px-4 py-3 text-sm font-bold text-stone-500 disabled:opacity-30">Voltar</button><div className="flex gap-2"><button type="button" disabled={saving || publishing} onClick={() => void saveDraft()} className="hidden rounded-2xl bg-white px-5 py-3 text-sm font-black ring-1 ring-stone-200 sm:block">Salvar rascunho</button>{step < STEPS.length-1 ? <button type="button" onClick={next} className="inline-flex items-center gap-2 rounded-2xl bg-stone-900 px-6 py-3 text-sm font-black text-white">Continuar <ArrowRight className="h-4 w-4" /></button> : <button type="button" disabled={publishing} onClick={() => void publish()} className="inline-flex items-center gap-2 rounded-2xl bg-[#0d4542] px-6 py-3 text-sm font-black text-white disabled:opacity-50">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Publicar</button>}</div></div>
  </div>;
}

function TypeStep({form,patch,categories,business,company}:{form:FormState;patch:Patch;categories:ClassifiedCategory[];business:boolean;company:any}) {
  const visible = form.listingType === 'SERVICE' ? categories.filter((item)=>item.parentSlug === 'servicos') : categories.filter((item)=>!item.parentSlug && item.slug !== 'servicos');
  const chooseType = (type:ClassifiedListingType) => patch('listingType',type);
  return <div><Heading eyebrow="Natureza do anúncio" title="Produto ou serviço?" text="A escolha define categoria, preço, estoque e como o anúncio aparece nas buscas." /><div className="mt-6 grid gap-3 sm:grid-cols-2"><Choice active={form.listingType === 'PRODUCT'} disabled={business && company?.canSellProducts === false} onClick={()=>chooseType('PRODUCT')} icon={<ShoppingBag className="h-6 w-6" />} title="Produto" text="Itens físicos, novos, usados ou com variações." /><Choice active={form.listingType === 'SERVICE'} disabled={business && company?.canOfferServices === false} onClick={()=>chooseType('SERVICE')} icon={<Wrench className="h-6 w-6" />} title="Serviço" text="Atendimento, mão de obra, orçamento ou valor fixo." /></div><div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visible.map((item)=><button key={item.slug} type="button" onClick={()=>patch('categorySlug',item.slug)} className={`flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-2xl p-3 text-xs font-black ring-1 ${form.categorySlug === item.slug ? 'bg-stone-900 text-white ring-stone-900' : 'bg-stone-50 text-stone-600 ring-stone-200'}`}><ClassifiedCategoryIcon name={item.icon} className="h-6 w-6" />{item.name}</button>)}</div>{isOther(form) && <div className="mt-4"><Field label="Qual categoria?"><input value={customCategory(form)} onChange={(event)=>patch('attributes',{...form.attributes,[CUSTOM_CATEGORY_KEY]:event.target.value})} className={inputClass} /></Field></div>}</div>;
}

function InfoStep({form,patch}:{form:FormState;patch:Patch}) { const service = form.listingType === 'SERVICE'; return <div><Heading eyebrow="Informações principais" title="Conte o que está oferecendo" text="Título direto, descrição útil e preço claro ajudam o cliente a decidir." /><div className="mt-6 space-y-4"><Field label="Título"><input value={form.title} maxLength={160} onChange={(event)=>patch('title',event.target.value)} className={inputClass} /></Field><Field label="Descrição"><textarea value={form.description} rows={7} onChange={(event)=>patch('description',event.target.value)} className={`${inputClass} h-auto py-3`} /></Field><div className="grid gap-4 sm:grid-cols-2">{!service && <Field label="Condição"><select value={form.condition} onChange={(event)=>patch('condition',event.target.value as ClassifiedCondition)} className={inputClass}><option value="NEW">Novo</option><option value="USED">Usado</option><option value="REFURBISHED">Recondicionado</option></select></Field>}<Field label="Preço"><select value={form.priceType} onChange={(event)=>patch('priceType',event.target.value as ClassifiedPriceType)} className={inputClass}><option value="FIXED">Preço fixo</option><option value="NEGOTIABLE">Negociável</option>{service && <option value="STARTING_AT">A partir de</option>}{service && <option value="CONTACT">Solicite orçamento</option>}</select></Field></div>{form.priceType !== 'CONTACT' && <Field label="Valor"><input type="number" min="0" step="0.01" value={form.price} onChange={(event)=>patch('price',event.target.value)} className={inputClass} /></Field>}{!service && <div className="rounded-2xl bg-stone-50 p-4"><p className="text-xs font-black">Estoque</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{([['SINGLE','Produto único'],['TRACKED','Controlar estoque'],['UNLIMITED','Sem controle']] as const).map(([value,label])=><button key={value} type="button" onClick={()=>{patch('inventoryMode',value);if(value==='SINGLE')patch('stockQuantity','1');}} className={`rounded-xl px-3 py-3 text-xs font-black ${form.inventoryMode === value ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}>{label}</button>)}</div>{form.inventoryMode === 'TRACKED' && <input type="number" min="0" value={form.stockQuantity} onChange={(event)=>patch('stockQuantity',event.target.value)} className={`${inputClass} mt-3 max-w-xs`} placeholder="Quantidade" />}</div>}</div></div>; }

function PhotosStep({images,limit,uploading,upload,remove,move}:{images:string[];limit:number;uploading:boolean;upload:(files:FileList|null)=>void;remove:(index:number)=>void;move:(from:number,to:number)=>void}) {
  const [dragIndex,setDragIndex] = useState<number|null>(null);
  const [pointerIndex,setPointerIndex] = useState<number|null>(null);
  const pointerMove = (event:React.PointerEvent) => {
    if (pointerIndex == null) return;
    const target = document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-photo-index]') as HTMLElement|null;
    const to = target ? Number(target.dataset.photoIndex) : NaN;
    if (Number.isInteger(to) && to !== pointerIndex) { move(pointerIndex,to); setPointerIndex(to); }
  };
  return <div><Heading eyebrow="A capa começa aqui" title="Ordene suas fotos" text="Arraste para mudar a ordem. A primeira foto sempre vira a capa do produto ou serviço." /><div className="mt-4 rounded-2xl bg-[#f3f7f6] p-4 text-xs leading-5 text-[#376662]"><strong>Padrão recomendado: 4:3, 1200×900 ou maior.</strong> Mantenha o assunto centralizado. O PiraNegócios preserva a foto inteira; quando a proporção não encaixa, a própria imagem preenche o fundo desfocada.</div><div onPointerMove={pointerMove} onPointerUp={()=>setPointerIndex(null)} onPointerCancel={()=>setPointerIndex(null)} className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{images.map((url,index)=><div key={`${url}-${index}`} data-photo-index={index} draggable onDragStart={()=>setDragIndex(index)} onDragOver={(event)=>event.preventDefault()} onDrop={()=>{if(dragIndex!=null)move(dragIndex,index);setDragIndex(null);}} className={`group relative aspect-[4/3] overflow-hidden rounded-[20px] bg-stone-100 ring-2 transition ${dragIndex === index || pointerIndex === index ? 'ring-[#2f8b7d]' : 'ring-transparent'}`}><ClassifiedMediaFrame src={url} alt={`Foto ${index+1}`} className="h-full w-full" />{index===0 && <span className="absolute left-2 top-2 z-10 rounded-full bg-stone-900/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-white">Capa</span>}<button type="button" title="Arraste para reposicionar" onPointerDown={(event)=>{event.preventDefault();setPointerIndex(index);(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);}} className="absolute bottom-2 left-2 z-10 flex h-9 w-9 touch-none items-center justify-center rounded-full bg-white/95 text-stone-700 shadow"><GripVertical className="h-4 w-4" /></button><button type="button" onClick={()=>remove(index)} className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-red-600 shadow"><Trash2 className="h-4 w-4" /></button><div className="absolute bottom-2 right-2 z-10 flex gap-1"><button type="button" disabled={index===0} onClick={()=>move(index,index-1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 shadow disabled:opacity-35"><ChevronLeft className="h-3.5 w-3.5" /></button><button type="button" disabled={index===images.length-1} onClick={()=>move(index,index+1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 shadow disabled:opacity-35"><ChevronRight className="h-3.5 w-3.5" /></button></div></div>)}{images.length<limit && <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-stone-300 bg-stone-50 text-stone-500"><input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={(event)=>{upload(event.target.files);event.currentTarget.value='';}} />{uploading?<Loader2 className="h-7 w-7 animate-spin"/>:<ImagePlus className="h-7 w-7"/>}<span className="text-xs font-black">Adicionar fotos</span></label>}</div><div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-xs text-amber-800"><UploadCloud className="mt-0.5 h-4 w-4 shrink-0" />Até {limit} foto{limit===1?'':'s'}, 10 MB por arquivo. Arraste a foto desejada para a primeira posição para trocar a capa.</div></div>;
}

function AttributesStep({schema,values,onChange}:{schema:ClassifiedCategory['attributeSchema'];values:Record<string,string>;onChange:(key:string,value:string)=>void}) { const fields = Array.isArray(schema)?schema:[]; return <div><Heading eyebrow="Detalhes da categoria" title="Características" text={fields.length?'Preencha o que ajuda o cliente a comparar e encontrar o anúncio.':'Esta categoria não exige detalhes adicionais.'}/>{fields.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2">{fields.map((field)=><Field key={field.key} label={field.label}>{field.type==='select'&&field.options?.length?<select value={values[field.key]||''} onChange={(event)=>onChange(field.key,event.target.value)} className={inputClass}><option value="">Selecione</option>{field.options.map((option)=><option key={option}>{option}</option>)}</select>:<input type={field.type==='number'?'number':'text'} value={values[field.key]||''} onChange={(event)=>onChange(field.key,event.target.value)} className={inputClass}/>}</Field>)}</div>:<div className="mt-5 rounded-2xl bg-stone-50 p-6 text-sm text-stone-500">Nada obrigatório por aqui.</div>}</div>; }

function OptionsStep({groups,onChange}:{groups:ClassifiedCatalogOptionGroup[];onChange:(groups:ClassifiedCatalogOptionGroup[])=>void}) { const add=()=>onChange([...groups,{id:crypto.randomUUID(),name:'',kind:'MODIFIER',selectionType:'SINGLE',minSelections:0,maxSelections:1,pricingStrategy:'BASE',options:[]}]); return <div><Heading eyebrow="Opcional" title="Variações e adicionais" text="Tamanho, cor, sabor, acabamento e outras escolhas podem ficar organizadas em grupos."/><div className="mt-5 space-y-4">{groups.map((group,index)=><GroupEditor key={group.id} group={group} onChange={(next)=>onChange(groups.map((item,i)=>i===index?next:item))} onRemove={()=>onChange(groups.filter((_,i)=>i!==index))}/>) }<button type="button" onClick={add} className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-3 text-xs font-black text-stone-600"><Plus className="h-4 w-4"/> Adicionar grupo</button></div></div>; }
function GroupEditor({group,onChange,onRemove}:{group:ClassifiedCatalogOptionGroup;onChange:(group:ClassifiedCatalogOptionGroup)=>void;onRemove:()=>void}) { const options=group.options||[]; return <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200"><div className="flex gap-2"><Layers3 className="mt-3 h-4 w-4 text-stone-400"/><input value={group.name} onChange={(event)=>onChange({...group,name:event.target.value})} placeholder="Nome do grupo" className={`${inputClass} flex-1`}/><button type="button" onClick={onRemove} className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-red-500"><Trash2 className="h-4 w-4"/></button></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><select value={group.selectionType} onChange={(event)=>onChange({...group,selectionType:event.target.value as any})} className={inputClass}><option value="SINGLE">Uma opção</option><option value="MULTIPLE">Várias opções</option></select><input type="number" min="1" value={group.maxSelections||1} onChange={(event)=>onChange({...group,maxSelections:Number(event.target.value)||1})} className={inputClass}/><select value={group.pricingStrategy||'BASE'} onChange={(event)=>onChange({...group,pricingStrategy:event.target.value as ClassifiedCatalogPricingStrategy})} className={inputClass}>{PRICING.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div className="mt-3 space-y-2">{options.map((option,index)=><div key={option.id} className="grid grid-cols-[1fr_110px_40px] gap-2"><input value={option.label} onChange={(event)=>onChange({...group,options:options.map((item,i)=>i===index?{...item,label:event.target.value}:item)})} placeholder="Opção" className={inputClass}/><input type="number" step="0.01" value={option.priceDelta||0} onChange={(event)=>onChange({...group,options:options.map((item,i)=>i===index?{...item,priceDelta:Number(event.target.value)||0}:item)})} className={inputClass}/><button type="button" onClick={()=>onChange({...group,options:options.filter((_,i)=>i!==index)})} className="rounded-xl bg-white text-red-500"><Trash2 className="mx-auto h-4 w-4"/></button></div>)}<button type="button" onClick={()=>onChange({...group,options:[...options,{id:crypto.randomUUID(),label:'',priceDelta:0}]})} className="rounded-xl bg-white px-3 py-2 text-[10px] font-black ring-1 ring-stone-200"><Plus className="mr-1 inline h-3 w-3"/> Opção</button></div></div>; }

function LocationStep({form,patch}:{form:FormState;patch:(key:keyof FormState,value:any)=>void}) { return <div><Heading eyebrow="Região" title="Onde está o anúncio?" text="Cidade e bairro ajudam na descoberta. O endereço exato não aparece publicamente."/><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Cidade"><input value={form.city} onChange={(event)=>patch('city',event.target.value)} className={inputClass}/></Field><Field label="UF"><input value={form.state} maxLength={2} onChange={(event)=>patch('state',event.target.value.toUpperCase().slice(0,2))} className={inputClass}/></Field><Field label="Bairro"><input value={form.neighborhood} onChange={(event)=>patch('neighborhood',event.target.value)} className={inputClass}/></Field><Field label="CEP"><input value={form.zipCode} onChange={(event)=>patch('zipCode',event.target.value)} className={inputClass}/></Field></div><div className="mt-6 border-t border-stone-100 pt-5"><p className="text-sm font-black">Contatos externos opcionais</p><p className="mt-1 text-xs text-stone-500">O chat interno continua sendo o canal principal.</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><Field label="Telefone"><input value={form.contactPhone} onChange={(event)=>patch('contactPhone',event.target.value)} className={inputClass}/></Field><Field label="WhatsApp"><input value={form.contactWhatsapp} onChange={(event)=>patch('contactWhatsapp',event.target.value)} className={inputClass}/></Field></div></div></div>; }

function ReviewStep({form,business,category,patch}:{form:FormState;business:boolean;category?:ClassifiedCategory;patch:Patch}) { const toggle=(channel:ClassifiedPublicationChannel)=>patch('publicationChannels',form.publicationChannels.includes(channel)?form.publicationChannels.filter((item)=>item!==channel):[...form.publicationChannels,channel]); return <div><Heading eyebrow="Conferência" title="Pronto para publicar" text="A ordem das fotos abaixo é a ordem final. A primeira é a capa."/><div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]"><ClassifiedMediaFrame src={form.images[0]} alt="Capa" className="aspect-[4/3] rounded-[22px]" empty={<div className="flex h-full items-center justify-center text-stone-300"><ImagePlus className="h-10 w-10"/></div>}/><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">{isOther(form)?customCategory(form):category?.name || 'Categoria'}</p><h2 className="mt-1 text-2xl font-black">{form.title || 'Sem título'}</h2><p className="mt-2 text-3xl font-black">{form.priceType==='CONTACT'?'Solicite orçamento':money(form.price)}</p><p className="mt-3 text-sm leading-6 text-stone-500">{form.description}</p><div className="mt-4 flex flex-wrap gap-2">{form.images.map((url,index)=><ClassifiedMediaFrame key={`${url}-${index}`} src={url} alt="" className={`h-16 w-20 rounded-lg ring-2 ${index===0?'ring-[#2f8b7d]':'ring-transparent'}`}/>)}</div>{business && <div className="mt-5"><p className="text-[9px] font-black uppercase text-stone-400">Onde exibir</p><div className="mt-2 flex gap-2"><button type="button" onClick={()=>toggle('CLASSIFIEDS')} className={`rounded-xl px-3 py-2 text-xs font-black ${form.publicationChannels.includes('CLASSIFIEDS')?'bg-[#0d4542] text-white':'bg-stone-100 text-stone-500'}`}>Classificados</button><button type="button" onClick={()=>toggle('COMPANY_PAGE')} className={`rounded-xl px-3 py-2 text-xs font-black ${form.publicationChannels.includes('COMPANY_PAGE')?'bg-[#0d4542] text-white':'bg-stone-100 text-stone-500'}`}><Building2 className="mr-1 inline h-3 w-3"/> Página da empresa</button></div></div>}</div></div></div>; }

function Choice({active,disabled,onClick,icon,title,text}:{active:boolean;disabled?:boolean;onClick:()=>void;icon:React.ReactNode;title:string;text:string}) { return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-[22px] p-5 text-left ring-1 disabled:opacity-40 ${active?'bg-stone-900 text-white ring-stone-900':'bg-stone-50 text-stone-700 ring-stone-200'}`}><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">{icon}</span><p className="mt-3 text-lg font-black">{title}</p><p className="mt-1 text-xs leading-5 opacity-65">{text}</p></button>; }
function Heading({eyebrow,title,text}:{eyebrow:string;title:string;text:string}) { return <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-stone-400">{eyebrow}</p><h2 className="mt-1 font-serif text-3xl font-black">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{text}</p></div>; }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[.12em] text-stone-400">{label}</span>{children}</label>; }
const inputClass='h-12 w-full rounded-2xl border-0 bg-stone-50 px-4 text-sm font-semibold text-stone-800 outline-none ring-1 ring-stone-200 focus:ring-2 focus:ring-stone-400/40';
function customCategory(form:FormState){return String(form.attributes[CUSTOM_CATEGORY_KEY]||'');}
function isOther(form:FormState){return form.listingType==='SERVICE'?form.categorySlug===SERVICE_OTHER_SLUG:form.categorySlug===PRODUCT_OTHER_SLUG;}
function money(value:string){const n=Number(String(value||0).replace(',','.'));return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number.isFinite(n)?n:0);}
