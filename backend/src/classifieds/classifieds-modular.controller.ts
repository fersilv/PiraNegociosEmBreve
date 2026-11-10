import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { DataSource } from 'typeorm';

// Somente canais públicos habilitados. Este endpoint NÃO permite acesso a recursos administrativos.
@Controller('classifieds/catalog')
export class ClassifiedsModularController {
  constructor(private readonly db: DataSource) {}

  @Get('modules')
  async modules() {
    const modules = await this.db.query('SELECT code,label,enabled,capabilities FROM marketplace.modules ORDER BY code');
    const channels = await this.db.query('SELECT code,label,enabled FROM marketplace.channels WHERE public_visible=true ORDER BY code');
    return {modules, channels};
  }

  @Get()
  async search(@Query() params: Record<string,unknown>) {
    const clean=(v:unknown,n=120)=>String(v??'').trim().slice(0,n);
    const module=clean(params.module,40);
    const channel=clean(params.channel,40)||'piranegocios';
    const allowed = await this.db.query('SELECT 1 FROM marketplace.channels WHERE code=$1 AND enabled=true AND public_visible=true',[channel]);
    if(!allowed.length)throw new BadRequestException('Canal público indisponível');
    const limit=Math.min(60,Math.max(1,Number.parseInt(clean(params.limit,3),10)||24));
    const page=Math.min(10000,Math.max(1,Number.parseInt(clean(params.page,6),10)||1));
    const filters:string[]=['l.channel_code=$1'];
    const values:unknown[]=[channel];
    const add=(sql:string,value:unknown)=>{values.push(value);filters.push(sql.replace('?',`$${values.length}`));};
    if(module)add('l.module_code=?',module);
    if(params.q)add('(l.title ILIKE ? OR l.description ILIKE ?)'.replaceAll('?',`$${values.length+1}`),`%${clean(params.q)}%`);
    if(params.city)add('l.city ILIKE ?',`%${clean(params.city)}%`);
    if(params.state)add('UPPER(l.state)=?',clean(params.state,2).toUpperCase());
    for(const [key,op] of [['minPrice','>='],['maxPrice','<=']] as const){
      if(params[key]===undefined)continue;
      const n=Number(params[key]);
      if(!Number.isFinite(n)||n<0)throw new BadRequestException(`${key} inválido`);
      add(`l.price_cents ${op} ?`,Math.round(n*100));
    }
    if(params.guests!==undefined){const n=Number(params.guests);if(!Number.isInteger(n)||n<1)throw new BadRequestException('Hóspedes inválidos');add('l.capacity >= ?',n);}
    if(params.category)add('l.category=?',clean(params.category,80));
    if(params.amenities){const a=clean(params.amenities,300).split(',').map(x=>x.trim()).filter(Boolean).slice(0,20);add('l.amenities @> ?::text[]',a);}
    // Datas dependem de confirmação em tempo real pela Splash; nunca afirmar disponibilidade via cache.
    if(params.checkIn||params.checkOut)throw new BadRequestException('Filtro de datas requer serviço de disponibilidade da Splash');
    const where=filters.join(' AND ');
    const total=await this.db.query(`SELECT count(*)::int AS total FROM marketplace.public_catalog l WHERE ${where}`,values);
    const items=await this.db.query(`SELECT l.id,l.module_code AS module,l.origin,l.origin_id AS "originId",l.title,l.description,l.city,l.state,l.price_cents AS "priceCents",l.currency,l.category,l.capacity,l.media,l.public_metadata AS metadata,l.destination_url AS url,l.updated_at AS "updatedAt" FROM marketplace.public_catalog l WHERE ${where} ORDER BY l.updated_at DESC,l.id DESC LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,limit,(page-1)*limit]);
    return {items,total:total[0]?.total??0,page,limit,channel};
  }
}
