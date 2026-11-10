import {Controller,Get,Query,ServiceUnavailableException} from '@nestjs/common';

type SplashProperty={
 id:string;title:string;description?:string;city:string;state:string;
 price_cents:number;capacity:number;category:string;photos?:string[];rating?:number;reviews?:number;
 bedrooms?:number;host_name?:string;
};
const PUBLIC_SPLASH='https://splash.piranegocios.com.br';
const INTERNAL_SPLASH='http://127.0.0.1:3194/api/properties';
let lastFetch=0,cache:SplashProperty[]|null=null;

function asMedia(value:unknown):string|null{
 if(typeof value!=='string'||!value.trim())return null;
 try{
  const u=new URL(value,PUBLIC_SPLASH);
  if(u.protocol!=='https:'||u.hostname!=='splash.piranegocios.com.br')return null;
  return u.toString();
 }catch{return null}
}
@Controller('classifieds/splash')
export class ClassifiedsSplashController {
 @Get()
 async listings(@Query() q:Record<string,unknown>){
  if(cache===null||Date.now()-lastFetch>60000){
   try{
    const r=await fetch(INTERNAL_SPLASH,{signal:AbortSignal.timeout(5500),headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error('upstream unavailable');
    const body=await r.json() as {properties?:SplashProperty[]};
    if(!Array.isArray(body.properties))throw new Error('invalid upstream');
    cache=body.properties.filter(p=>typeof p.id==='string'&&typeof p.title==='string'&&
      typeof p.city==='string'&&Number.isInteger(p.price_cents)&&p.price_cents>=0).slice(0,80);
    lastFetch=Date.now();
   }catch{
    if(cache===null)throw new ServiceUnavailableException('Imóveis Splash temporariamente indisponíveis');
   }
  }
  const search=String(q.q||'').trim().toLocaleLowerCase('pt-BR').slice(0,80);
  const city=String(q.city||'').trim().toLocaleLowerCase('pt-BR').slice(0,80);
  const state=String(q.state||'').trim().toLocaleLowerCase('pt-BR').slice(0,2);
  const limit=Math.max(1,Math.min(80,Number(q.limit)||24));
  const items=(cache||[]).filter(p=>
   (!search||[p.title,p.city,p.state,p.description||'','aluguel temporada eventos chácaras imóveis splash'].join(' ').toLocaleLowerCase('pt-BR').includes(search))&&
   (!city||p.city.toLocaleLowerCase('pt-BR').includes(city))&&
   (!state||p.state.toLocaleLowerCase('pt-BR')===state)
  ).map(p=>({
   id:'splash:'+p.id,source:'SPLASH',propertyId:p.id,title:p.title,
   description:String(p.description||'').slice(0,240),
   city:p.city,state:p.state,priceCents:p.price_cents,
   capacity:p.capacity,category:'Espaços para eventos e temporada',
   image:asMedia(p.photos?.[0]),rating:Number(p.rating)||0,reviews:Number(p.reviews)||0,
   url:PUBLIC_SPLASH+'/espaco/'+encodeURIComponent(p.id),
   reservationPlatform:'SPLASH'
  }));
  return{items:items.slice(0,limit),total:items.length,source:'SPLASH',updatedAt:new Date(lastFetch).toISOString()};
 }
}