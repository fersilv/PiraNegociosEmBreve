import React,{useEffect,useState} from 'react';
import {ArrowRight,CalendarDays,MapPin,Home,Users} from 'lucide-react';
import {api} from '../../lib/api';

type Rental={id:string;propertyId:string;title:string;description:string;city:string;state:string;priceCents:number;capacity:number;image:string|null;url:string;rating:number;reviews:number};
type Props={query?:string;city?:string;state?:string;mode?:'home'|'search'|'workspace'};
const money=(c:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
export default function SplashListingsSection({query='',city='',state='',mode='home'}:Props){
 const [items,setItems]=useState<Rental[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState(false);
 const [start,setStart]=useState('');const [end,setEnd]=useState('');const [guests,setGuests]=useState('');const [amenities,setAmenities]=useState('');
 useEffect(()=>{
  let active=true;
  const params=new URLSearchParams({limit:'24',channel:'piranegocios',module:'rentals'});
  if(start&&end){params.set('checkIn',start);params.set('checkOut',end)}
  if(guests)params.set('guests',guests);
  if(amenities)params.set('amenities',amenities);
  if(query)params.set('q',query);
  if(city)params.set('city',city);
  if(state)params.set('state',state);
  setLoading(true);setError(false);
  api.get('/classifieds/catalog?'+params.toString())
   .then(r=>{if(active)setItems(Array.isArray(r.data?.items)?r.data.items.map((p:any)=>({id:p.id,propertyId:p.originId,title:p.title,description:p.description,city:p.city,state:p.state,priceCents:Number(p.priceCents)||0,capacity:Number(p.capacity)||0,image:Array.isArray(p.media)?p.media[0]||null:null,url:p.url,rating:0,reviews:0})):[])})
   .catch(()=>{if(active){setItems([]);setError(true)}})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[query,city,state,start,end,guests,amenities]);
 
 return <section className="mx-auto max-w-7xl px-4 pb-9 sm:px-6 lg:px-8" aria-label="Espaços para alugar pelo Splash">
   <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
    <div><p className="text-[10px] font-black tracking-[.16em] uppercase text-emerald-700">Splash × PiraNegócios</p><h2 className="mt-1 font-serif text-2xl font-bold text-[#30221b]">Espaços para viver momentos especiais</h2>
     <p className="mt-2 text-sm text-stone-600">Casas de lazer, chácaras e salões. Reservas e disponibilidade confirmadas no Splash.</p>
    </div>
    <a href="https://splash.piranegocios.com.br/" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white">Ver todos no Splash <ArrowRight size={15}/></a>
   </div>
   <form className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-white p-3 ring-1 ring-stone-200 sm:grid-cols-4" onSubmit={e=>e.preventDefault()} aria-label="Filtros de locação">
     <label className="text-[11px] font-bold text-stone-600">Entrada<input type="date" value={start} onChange={e=>setStart(e.target.value)} className="mt-1 block w-full rounded-lg border border-stone-200 p-2 text-xs" /></label>
     <label className="text-[11px] font-bold text-stone-600">Saída<input type="date" min={start||undefined} value={end} onChange={e=>setEnd(e.target.value)} className="mt-1 block w-full rounded-lg border border-stone-200 p-2 text-xs" /></label>
     <label className="text-[11px] font-bold text-stone-600">Pessoas<input type="number" min="1" max="10000" placeholder="Qualquer capacidade" value={guests} onChange={e=>setGuests(e.target.value)} className="mt-1 block w-full rounded-lg border border-stone-200 p-2 text-xs" /></label>
     <label className="text-[11px] font-bold text-stone-600">Comodidade<select value={amenities} onChange={e=>setAmenities(e.target.value)} className="mt-1 block w-full rounded-lg border border-stone-200 p-2 text-xs"><option value="">Todas</option><option value="piscina">Piscina</option><option value="churrasqueira">Churrasqueira</option><option value="wifi">Wi-Fi</option></select></label>
     {(start||end||guests||amenities)&&<button type="button" onClick={()=>{setStart('');setEnd('');setGuests('');setAmenities('')}} className="col-span-2 text-left text-xs font-semibold text-emerald-700 sm:col-span-4">Limpar filtros</button>}
   </form>
   {Boolean(start)!==Boolean(end)&&<p className="mb-3 text-xs text-amber-700">Escolha entrada e saída para consultar a disponibilidade.</p>}
   {loading?<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{[1,2,3,4].map(n=><div key={n} className="h-56 rounded-2xl bg-stone-200 animate-pulse"/>)}</div>:
    error?<p className="text-sm text-stone-500">A vitrine do Splash está temporariamente indisponível. <a href="https://splash.piranegocios.com.br" className="underline">Abrir diretamente</a>.</p>:
    items.length?<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map(item=><a key={item.id} href={item.url} className="group overflow-hidden rounded-[20px] border border-stone-200 bg-white shadow-sm hover:shadow-md transition">
     <div className="relative aspect-[1.27] bg-emerald-50 overflow-hidden">{item.image?<img src={item.image} alt={item.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]"/>:<div className="w-full h-full flex items-center justify-center text-emerald-700"><Home size={45}/></div>}
      <span className="absolute top-3 left-3 rounded-full bg-emerald-700 px-2.5 py-1 text-[9px] font-bold text-white">Reserva no Splash</span>
     </div><div className="p-3.5"><h3 className="line-clamp-2 text-sm font-black text-stone-800">{item.title}</h3><p className="mt-1 flex items-center gap-1 text-[11px] text-stone-500"><MapPin size={12}/>{item.city}, {item.state}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-stone-500"><Users size={12}/>{item.capacity} pessoas</p><p className="mt-3 text-sm text-emerald-800 font-black">A partir de {money(item.priceCents)} <span className="text-[10px] font-normal">por diária</span></p><span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CalendarDays size={14}/> Ver datas e reservar <ArrowRight size={12}/></span></div>
    </a>)}</div>:
     <div className="rounded-2xl border border-dashed border-emerald-200 bg-white px-6 py-8 text-center"><Home className="mx-auto text-emerald-700" size={28}/><h3 className="mt-3 font-bold text-stone-800">Os espaços do Splash aparecerão aqui assim que forem aprovados.</h3><p className="mt-2 text-xs text-stone-500">Sem anúncios fictícios. Um único imóvel original, com disponibilidade e reserva no Splash.</p><a className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white" href="https://splash.piranegocios.com.br/entrar">Quero anunciar um espaço <ArrowRight size={14}/></a></div>}
  </section>;
}
