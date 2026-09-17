import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type IntegrationStatus = {
  connected: boolean;
  status?: string;
  pdvBaseUrl?: string;
  scopes?: string[];
  settings?: Record<string, any>;
  lastManualSyncAt?: string | null;
  lastAutoSyncAt?: string | null;
  lastSalesSyncAt?: string | null;
  lastError?: string | null;
  products?: { total?: number; linked?: number; visible?: number };
};

type RemoteProduct = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  salePrice?: number | string;
  stock?: number;
  active?: boolean;
  integration?: any;
  suggestedMatches?: Array<{ id:string; title:string; price?:string|null; status:string }>;
};

type LocalProduct = {
  id:string; title:string; price?:number|string|null; status:string; image?:string|null; pdvProductId?:string|null; syncEnabled?:boolean; visible?:boolean; syncPrice?:boolean; syncStock?:boolean; updatedAt?:string;
};

const defaults = { automaticSync:true, importAllProducts:true, visibleByDefault:true, syncPrice:true, syncStock:true, defaultCategorySlug:'outros' };

function Toggle({label,description,checked,onChange,disabled=false}:{label:string;description:string;checked:boolean;onChange:(value:boolean)=>void;disabled?:boolean}) {
  return <label className={`flex items-start justify-between gap-5 rounded-2xl border p-4 ${disabled?'bg-stone-50 opacity-60':'bg-white'}`}>
    <span><strong className="block text-sm text-stone-900">{label}</strong><small className="mt-1 block max-w-xl text-xs leading-5 text-stone-500">{description}</small></span>
    <button type="button" disabled={disabled} onClick={()=>onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked?'bg-emerald-600':'bg-stone-300'}`} aria-pressed={checked}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked?'left-6':'left-1'}`} /></button>
  </label>;
}

export function CompanyPdvIntegrationPage() {
  const { profile } = useAuth();
  const companyId = profile?.companyId || '';
  const [status,setStatus]=useState<IntegrationStatus>({connected:false,settings:defaults});
  const [settings,setSettings]=useState({...defaults});
  const [products,setProducts]=useState<RemoteProduct[]>([]);
  const [localProducts,setLocalProducts]=useState<LocalProduct[]>([]);
  const [pdvBaseUrl,setPdvBaseUrl]=useState('https://api-pdv.kria.shop/api');
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  const load=async()=>{
    if(!companyId) return;
    setLoading(true); setError('');
    try{
      const {data}=await api.get('/pdv-integration/status',{params:{companyId}});
      setStatus(data); setSettings({...defaults,...(data.settings||{})}); if(data.pdvBaseUrl) setPdvBaseUrl(data.pdvBaseUrl);
      if(data.connected){ const [p,l]=await Promise.all([api.get('/pdv-integration/products',{params:{companyId}}),api.get('/pdv-integration/local-products',{params:{companyId}})]); setProducts(Array.isArray(p.data)?p.data:[]); setLocalProducts(Array.isArray(l.data)?l.data:[]); } else { setProducts([]); setLocalProducts([]); }
    }catch(e:any){ setError(e?.response?.data?.message||'Não foi possível carregar a integração com o PDV.'); }
    finally{setLoading(false);}
  };
  useEffect(()=>{ void load(); },[companyId]);

  const changeSetting=(key:string,value:any)=>setSettings(current=>({...current,[key]:value}));
  const saveSettings=async()=>{
    setWorking('settings');setError('');setMessage('');
    try{const {data}=await api.patch('/pdv-integration/settings',{companyId,...settings});setStatus(data);setSettings({...defaults,...data.settings});setMessage('Configurações de sincronização salvas.');}
    catch(e:any){setError(e?.response?.data?.message||'Não foi possível salvar as configurações.');}finally{setWorking('');}
  };
  const connect=async()=>{
    setWorking('connect');setError('');setMessage('');
    try{const {data}=await api.post('/pdv-integration/connect',{companyId,pdvBaseUrl}); if(!data.authorizationUrl) throw new Error('URL OAuth não recebida.'); window.location.assign(data.authorizationUrl);}
    catch(e:any){setError(e?.response?.data?.message||e?.message||'Não foi possível iniciar o OAuth do PDV.');setWorking('');}
  };
  const sync=async(productIds?:string[])=>{
    setWorking(productIds?.length?`sync:${productIds[0]}`:'sync');setError('');setMessage('');
    try{const {data}=await api.post('/pdv-integration/sync',{companyId,...(productIds?{productIds}:{})});setMessage(`${data.synced||0} produto(s) sincronizado(s), ${data.failed||0} falha(s).`);await load();}
    catch(e:any){setError(e?.response?.data?.message||'Falha na sincronização.');}finally{setWorking('');}
  };
  const syncSales=async()=>{setWorking('sales');setError('');try{const {data}=await api.post('/pdv-integration/sales/sync',{companyId});setMessage(`${data.observed||0} venda(s) do PDV observada(s). Nenhum pedido do Pira foi criado automaticamente.`);await load();}catch(e:any){setError(e?.response?.data?.message||'Falha ao consultar vendas do PDV.');}finally{setWorking('');}};
  const configureProduct=async(product:RemoteProduct,key:string,value:boolean)=>{setWorking(`cfg:${product.id}:${key}`);setError('');try{await api.patch(`/pdv-integration/products/${encodeURIComponent(product.id)}`,{companyId,[key]:value});await load();}catch(e:any){setError(e?.response?.data?.message||'Não foi possível atualizar este produto.');}finally{setWorking('');}};
  const linkExisting=async(product:RemoteProduct,listingId:string)=>{setWorking(`link:${product.id}`);setError('');try{await api.post('/pdv-integration/products/link-existing',{companyId,pdvProductId:product.id,listingId});setMessage(`Produto ${product.name} associado sem duplicação.`);await load();}catch(e:any){setError(e?.response?.data?.message||'Não foi possível associar o produto.');}finally{setWorking('');}};
  const pushProduct=async(listingId:string)=>{setWorking(`push:${listingId}`);setError('');setMessage('');try{const {data}=await api.post(`/pdv-integration/push/${encodeURIComponent(listingId)}`,{companyId});setMessage(`Produto enviado ao PDV (${data.action||'sincronizado'}${data.matchedBy?`, correspondência: ${data.matchedBy}`:''}).`);await load();}catch(e:any){setError(e?.response?.data?.message||'Não foi possível enviar o produto ao PDV.');}finally{setWorking('');}};
  const pushAll=async()=>{setWorking('push-all');setError('');setMessage('');try{const {data}=await api.post('/pdv-integration/push',{companyId});setMessage(`${data.synced||0} produto(s) do Pira enviados ao PDV, ${data.failed||0} falha(s).`);await load();}catch(e:any){setError(e?.response?.data?.message||'Falha ao enviar o catálogo ao PDV.');}finally{setWorking('');}};
  const disconnect=async()=>{if(!window.confirm('Desconectar o PDV? Os vínculos de produtos serão preservados para uma futura reconexão.'))return;setWorking('disconnect');try{await api.delete('/pdv-integration/connection',{params:{companyId}});setMessage('PDV desconectado.');await load();}catch(e:any){setError(e?.response?.data?.message||'Não foi possível desconectar.');}finally{setWorking('');}};

  const linkedCount=useMemo(()=>products.filter(p=>p.integration?.listingId).length,[products]);
  if(!companyId) return <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">Vincule sua conta a uma empresa antes de configurar o PDV.</div>;

  return <div className="mx-auto max-w-7xl space-y-6 pb-16">
    <section className="overflow-hidden rounded-[28px] border border-stone-200 bg-stone-950 p-7 text-white shadow-sm sm:p-9">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">Integrações · PDV Inteligente</p><h1 className="mt-2 text-3xl font-black tracking-[-.045em] sm:text-5xl">Um catálogo, dois motores.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">O PDV continua sendo a operação de caixa. O PiraNegócios sincroniza o que você permitir sem substituir regras de checkout, publicação, pagamento ou entrega.</p></div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-3 py-2 text-[10px] font-black ${status.connected?'bg-emerald-400/15 text-emerald-300':'bg-white/10 text-white/55'}`}>{status.connected?'CONECTADO':'DESCONECTADO'}</span>{status.connected&&<span className="rounded-full bg-white/10 px-3 py-2 text-[10px] font-black text-white/65">{linkedCount} VINCULADOS</span>}</div></div>
    </section>

    {message&&<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{message}</div>}
    {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">{error}</div>}

    {!status.connected ? <section className="rounded-[26px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-black text-stone-900">Conectar via OAuth</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Você será levado ao PDV para entrar com um administrador ou gerente. Produtos e Vendas são obrigatórios; os outros módulos aparecem habilitados, mas podem ser removidos antes de autorizar.</p><label className="mt-6 block text-xs font-black text-stone-700">Endereço da API do PDV<input value={pdvBaseUrl} onChange={e=>setPdvBaseUrl(e.target.value)} className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-500" /></label><button onClick={connect} disabled={working==='connect'||loading} className="mt-5 rounded-2xl bg-stone-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{working==='connect'?'Abrindo PDV...':'Conectar PDV Inteligente'}</button></section> : <>
      <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><div className="rounded-[26px] border border-stone-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-stone-400">Sincronização</p><h2 className="mt-1 text-xl font-black">Comportamento padrão</h2></div><button onClick={saveSettings} disabled={working==='settings'} className="rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white">Salvar</button></div><div className="mt-5 space-y-3"><Toggle label="Sincronização automática" description="Reconcilia o catálogo periodicamente. Pode ser desligada para manter operações independentes." checked={settings.automaticSync} onChange={v=>changeSetting('automaticSync',v)} /><Toggle label="Importar todos os produtos" description="Produtos novos do PDV entram automaticamente. Desligue para escolher manualmente." checked={settings.importAllProducts} onChange={v=>changeSetting('importAllProducts',v)} /><Toggle label="Visível por padrão" description="Produto novo importado entra publicado. Se desligado, ele é importado mas fica oculto/rascunho." checked={settings.visibleByDefault} onChange={v=>changeSetting('visibleByDefault',v)} /><Toggle label="Sincronizar preço" description="O preço do PDV passa a atualizar o preço base no PiraNegócios." checked={settings.syncPrice} onChange={v=>changeSetting('syncPrice',v)} /><Toggle label="Sincronizar estoque" description="O saldo do PDV alimenta o estoque disponível no checkout do PiraNegócios." checked={settings.syncStock} onChange={v=>changeSetting('syncStock',v)} /></div></div><div className="rounded-[26px] border border-stone-200 bg-white p-6 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.15em] text-stone-400">Conexão</p><h2 className="mt-1 text-xl font-black">{status.pdvBaseUrl}</h2><dl className="mt-5 grid grid-cols-2 gap-3 text-xs"><div className="rounded-2xl bg-stone-50 p-4"><dt className="text-stone-400">Último manual</dt><dd className="mt-1 font-black">{status.lastManualSyncAt?new Date(status.lastManualSyncAt).toLocaleString('pt-BR'):'Ainda não'}</dd></div><div className="rounded-2xl bg-stone-50 p-4"><dt className="text-stone-400">Último automático</dt><dd className="mt-1 font-black">{status.lastAutoSyncAt?new Date(status.lastAutoSyncAt).toLocaleString('pt-BR'):'Ainda não'}</dd></div></dl>{status.lastError&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-800">{status.lastError}</p>}<div className="mt-5 flex flex-wrap gap-2"><button onClick={()=>sync()} disabled={working==='sync'} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white">{working==='sync'?'Sincronizando...':'Sincronizar catálogo agora'}</button><button onClick={syncSales} disabled={working==='sales'} className="rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-black">Ler vendas agora</button><button onClick={disconnect} className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-black text-red-700">Desconectar</button></div><p className="mt-4 text-[11px] leading-5 text-stone-400">Vendas do PDV são observadas para integração, mas não viram pedidos do Pira automaticamente enquanto o contrato de pagamento/entrega não estiver explicitamente mapeado.</p></div></section>

      <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-stone-400">Produtos do PDV</p><h2 className="mt-1 text-2xl font-black">Mapeamento do catálogo</h2><p className="mt-1 text-xs text-stone-500">Associar um produto existente evita duplicação. Título igual aparece só como sugestão, nunca é associado sozinho.</p></div><button onClick={()=>void load()} className="rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-black">Atualizar lista</button></div>
        {loading?<div className="py-14 text-center text-sm text-stone-400">Carregando catálogo...</div>:<div className="mt-6 divide-y divide-stone-100">{products.map(product=>{const link=product.integration;return <article key={product.id} className="grid gap-4 py-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,.8fr)]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-stone-900">{product.name}</h3>{link?.listingId?<span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">VINCULADO</span>:<span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-700">NÃO IMPORTADO</span>}</div><p className="mt-1 text-xs text-stone-400">SKU {product.sku||'—'} · Código {product.barcode||'—'} · Estoque {product.stock??0} · R$ {Number(product.salePrice||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</p>{!link?.listingId&&product.suggestedMatches?.length?<div className="mt-3 rounded-2xl bg-amber-50 p-3"><p className="text-[10px] font-black uppercase tracking-[.12em] text-amber-800">Possíveis produtos já existentes</p><div className="mt-2 flex flex-wrap gap-2">{product.suggestedMatches.map(match=><button key={match.id} onClick={()=>linkExisting(product,match.id)} disabled={working===`link:${product.id}`} className="rounded-lg bg-white px-3 py-2 text-[10px] font-black text-amber-900 ring-1 ring-amber-200">Associar a “{match.title}”</button>)}</div></div>:null}</div><div>{link?.listingId?<div className="grid grid-cols-2 gap-2"><Toggle label="Visível" description="Exibe na vitrine." checked={link.visible!==false} onChange={v=>configureProduct(product,'visible',v)} /><Toggle label="Sincronizar" description="Mantém o vínculo ativo." checked={link.syncEnabled!==false} onChange={v=>configureProduct(product,'syncEnabled',v)} /><Toggle label="Preço" description="Segue o PDV." checked={link.syncPrice!==false} onChange={v=>configureProduct(product,'syncPrice',v)} /><Toggle label="Estoque" description="Segue o PDV." checked={link.syncStock!==false} onChange={v=>configureProduct(product,'syncStock',v)} /></div>:<button onClick={()=>sync([product.id])} disabled={working===`sync:${product.id}`} className="w-full rounded-2xl bg-stone-950 px-4 py-3 text-xs font-black text-white">{working===`sync:${product.id}`?'Importando...':'Importar este produto'}</button>}</div></article>})}{!products.length&&<div className="py-14 text-center text-sm text-stone-400">Nenhum produto retornado pelo PDV.</div>}</div>}
      </section>

      <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-stone-400">PiraNegócios → PDV</p><h2 className="mt-1 text-2xl font-black">Produtos do catálogo local</h2><p className="mt-1 text-xs text-stone-500">Envie um produto já existente para o PDV. O PDV tenta reutilizar vínculo, ID, SKU ou código de barras antes de criar um novo.</p></div><button onClick={pushAll} disabled={working==='push-all'} className="rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white">{working==='push-all'?'Enviando...':'Enviar catálogo ao PDV'}</button></div><div className="mt-5 divide-y divide-stone-100">{localProducts.map(item=><div key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3">{item.image?<img src={item.image} alt="" className="h-12 w-12 rounded-xl border border-stone-100 object-cover"/>:<div className="h-12 w-12 rounded-xl bg-stone-100"/>}<div className="min-w-0"><strong className="block truncate text-sm text-stone-900">{item.title}</strong><span className="text-xs text-stone-400">R$ {Number(item.price||0).toLocaleString('pt-BR',{minimumFractionDigits:2})} · {item.status}{item.pdvProductId?` · PDV ${item.pdvProductId}`:' · ainda sem vínculo no PDV'}</span></div></div><button onClick={()=>pushProduct(item.id)} disabled={working===`push:${item.id}`} className="rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-black">{working===`push:${item.id}`?'Enviando...':item.pdvProductId?'Atualizar no PDV':'Enviar ao PDV'}</button></div>)}{!localProducts.length&&<div className="py-10 text-center text-sm text-stone-400">Nenhum produto empresarial disponível no PiraNegócios.</div>}</div></section>
    </>}
  </div>;
}
