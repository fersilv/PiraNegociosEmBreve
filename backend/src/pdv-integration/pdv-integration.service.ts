import { BadRequestException, ForbiddenException, Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { ClassifiedsIdentityService } from '../classifieds/classifieds-identity.service';
import { ClassifiedsService } from '../classifieds/classifieds.service';

const DEFAULT_PDV = 'https://api-pdv.kria.shop/api';
const DEFAULT_SETTINGS = {
  automaticSync: true,
  importAllProducts: true,
  visibleByDefault: true,
  syncPrice: true,
  syncStock: true,
  defaultCategorySlug: 'outros',
};
const PDV_SCOPES = [
  'products:read','products:write','sales:read','sales:write',
  'inventory:read','inventory:write','categories:read','categories:write',
  'customers:read','customers:write','suppliers:read','suppliers:write',
  'service_orders:read','service_orders:write','financial:read','users:read','offline_access',
];

type SyncMode = 'MANUAL' | 'AUTO';

@Injectable()
export class PdvIntegrationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdvIntegrationService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: ClassifiedsIdentityService,
    private readonly classifieds: ClassifiedsService,
  ) {}

  onModuleInit() {
    const seconds = Math.max(30, Number(process.env.PDV_INTEGRATION_SYNC_SECONDS || 60));
    this.timer = setInterval(() => void this.autoSyncTick(), seconds * 1000);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  publicBaseUrl() { return String(process.env.PUBLIC_BASE_URL || 'https://piranegocios.com.br').replace(/\/+$/, ''); }
  callbackUrl() { return `${this.publicBaseUrl()}/api/pdv-integration/oauth/callback`; }

  async startOAuth(uid: string, companyId: string, rawBase?: unknown) {
    await this.identities.assertCompanyOperator(uid, companyId);
    const pdvBaseUrl = this.normalizeBase(rawBase);
    const registration = await this.httpJson(`${pdvBaseUrl}/oauth/piranegocios/register`, {
      method: 'POST', body: JSON.stringify({ client_name: 'PiraNegócios', redirect_uris: [this.callbackUrl()] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const clientId = String(registration?.client_id || '');
    if (!clientId) throw new ServiceUnavailableException('O PDV não devolveu um client_id OAuth válido.');
    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const state = `pn_pdv_${randomBytes(30).toString('hex')}`;
    await this.dataSource.query(
      `INSERT INTO pdv_oauth_states(id,"stateHash","companyId","userId","pdvBaseUrl","clientId","codeVerifierEncrypted",scopes,"expiresAt") VALUES($1,$2,$3::uuid,$4,$5,$6,$7,$8::jsonb,$9)`,
      [randomUUID(), this.hash(state), companyId, uid, pdvBaseUrl, clientId, this.encrypt(verifier), JSON.stringify(PDV_SCOPES), new Date(Date.now() + 10 * 60 * 1000)],
    );
    const url = new URL(`${pdvBaseUrl}/oauth/piranegocios/authorize`);
    url.searchParams.set('response_type', 'code'); url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', this.callbackUrl()); url.searchParams.set('scope', PDV_SCOPES.join(' '));
    url.searchParams.set('state', state); url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256'); url.searchParams.set('resource', `${pdvBaseUrl}/integrations/piranegocios`);
    return { authorizationUrl: url.toString(), pdvBaseUrl, mandatoryModules: ['products','sales'] };
  }

  async finishOAuth(codeRaw: unknown, stateRaw: unknown) {
    const code = String(codeRaw || '').trim(), state = String(stateRaw || '').trim();
    if (!code || !state) throw new BadRequestException('code e state OAuth são obrigatórios.');
    const rows = await this.dataSource.query(`SELECT * FROM pdv_oauth_states WHERE "stateHash"=$1 LIMIT 1`, [this.hash(state)]);
    const pending = rows[0];
    if (!pending || pending.usedAt || new Date(pending.expiresAt).getTime() <= Date.now()) throw new BadRequestException('Estado OAuth inválido ou expirado.');
    const verifier = this.decrypt(String(pending.codeVerifierEncrypted));
    const resource = `${pending.pdvBaseUrl}/integrations/piranegocios`;
    const token = await this.httpJson(`${pending.pdvBaseUrl}/oauth/piranegocios/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        grant_type: 'authorization_code', code, client_id: pending.clientId, redirect_uri: this.callbackUrl(), code_verifier: verifier, resource,
      }),
    });
    if (!token?.access_token || !token?.refresh_token) throw new ServiceUnavailableException('O PDV não devolveu os tokens OAuth esperados.');
    const scopes = String(token.scope || '').split(/\s+/).filter((item) => item && item !== 'offline_access');
    for (const required of ['products:read','products:write','sales:read','sales:write']) {
      if (!scopes.includes(required)) throw new BadRequestException(`A autorização não incluiu o escopo obrigatório ${required}.`);
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`UPDATE pdv_oauth_states SET "usedAt"=now() WHERE id=$1::uuid`, [pending.id]);
      await manager.query(
        `INSERT INTO pdv_integrations(id,"companyId","connectedByUserId","pdvBaseUrl","clientId","accessTokenEncrypted","refreshTokenEncrypted","accessExpiresAt",scopes,settings,status)
         VALUES($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,'CONNECTED')
         ON CONFLICT ("companyId") DO UPDATE SET "connectedByUserId"=EXCLUDED."connectedByUserId","pdvBaseUrl"=EXCLUDED."pdvBaseUrl","clientId"=EXCLUDED."clientId","accessTokenEncrypted"=EXCLUDED."accessTokenEncrypted","refreshTokenEncrypted"=EXCLUDED."refreshTokenEncrypted","accessExpiresAt"=EXCLUDED."accessExpiresAt",scopes=EXCLUDED.scopes,status='CONNECTED',"lastError"=NULL,"updatedAt"=now()`,
        [randomUUID(), pending.companyId, pending.userId, pending.pdvBaseUrl, pending.clientId, this.encrypt(String(token.access_token)), this.encrypt(String(token.refresh_token)), new Date(Date.now() + Number(token.expires_in || 3600) * 1000), JSON.stringify(scopes), JSON.stringify(DEFAULT_SETTINGS)],
      );
    });
    return { companyId: pending.companyId, connected: true, scopes };
  }

  async status(uid: string, companyId: string) {
    await this.identities.assertCompanyOperator(uid, companyId);
    const connection = await this.connection(companyId, false);
    if (!connection) return { connected: false, settings: DEFAULT_SETTINGS };
    const counts = await this.dataSource.query(`SELECT count(*)::int AS total,count(*) FILTER (WHERE "listingId" IS NOT NULL)::int AS linked,count(*) FILTER (WHERE visible=true)::int AS visible FROM pdv_product_links WHERE "companyId"=$1::uuid`, [companyId]);
    return { connected: connection.status === 'CONNECTED', status: connection.status, pdvBaseUrl: connection.pdvBaseUrl, scopes: this.json(connection.scopes, []), settings: { ...DEFAULT_SETTINGS, ...this.json(connection.settings, {}) }, lastManualSyncAt: connection.lastManualSyncAt, lastAutoSyncAt: connection.lastAutoSyncAt, lastSalesSyncAt: connection.lastSalesSyncAt, lastError: connection.lastError, products: counts[0] || { total:0, linked:0, visible:0 } };
  }

  async updateSettings(uid: string, companyId: string, patch: Record<string, unknown>) {
    await this.identities.assertCompanyOperator(uid, companyId);
    const connection = await this.connection(companyId, true);
    const current = { ...DEFAULT_SETTINGS, ...this.json(connection.settings, {}) } as any;
    for (const key of ['automaticSync','importAllProducts','visibleByDefault','syncPrice','syncStock']) if (patch[key] !== undefined) current[key] = Boolean(patch[key]);
    if (patch.defaultCategorySlug !== undefined) current.defaultCategorySlug = String(patch.defaultCategorySlug || 'outros').trim().slice(0,80) || 'outros';
    await this.dataSource.query(`UPDATE pdv_integrations SET settings=$2::jsonb,"updatedAt"=now() WHERE "companyId"=$1::uuid`, [companyId, JSON.stringify(current)]);
    return this.status(uid, companyId);
  }

  async disconnect(uid: string, companyId: string) {
    await this.identities.assertCompanyOperator(uid, companyId);
    await this.dataSource.query(`UPDATE pdv_integrations SET status='DISCONNECTED',"accessTokenEncrypted"='',"refreshTokenEncrypted"='',"updatedAt"=now() WHERE "companyId"=$1::uuid`, [companyId]);
    return { disconnected: true };
  }

  async products(uid: string, companyId: string) {
    await this.identities.integrationCompany(uid, companyId, true);
    const remote = await this.remoteProducts(companyId);
    const links = await this.dataSource.query(`SELECT * FROM pdv_product_links WHERE "companyId"=$1::uuid`, [companyId]);
    const listings = await this.dataSource.query(`SELECT id,title,price,status,attributes,"commerceConfig" FROM classified_listings WHERE "companyId"=$1::uuid AND "listingType"='PRODUCT' AND status<>'ARCHIVED'`, [companyId]);
    return remote.map((product:any) => {
      const link = links.find((item:any) => String(item.pdvProductId) === String(product.id));
      const sku=String(product.sku||''), barcode=String(product.barcode||'');
      const suggestions = listings.filter((item:any) => {
        const attrs=this.json(item.attributes,{}); return (sku && [attrs.sku,attrs.pdvSku].includes(sku)) || (barcode && [attrs.barcode,attrs.pdvBarcode].includes(barcode)) || String(item.title||'').trim().toLowerCase()===String(product.name||'').trim().toLowerCase();
      }).slice(0,5).map((item:any)=>({id:item.id,title:item.title,price:item.price,status:item.status}));
      return { ...product, integration: link || null, suggestedMatches: suggestions };
    });
  }

  async linkExisting(uid:string, companyId:string, body:Record<string,unknown>) {
    await this.identities.integrationCompany(uid, companyId, true);
    const pdvProductId=String(body.pdvProductId||'').trim(), listingId=String(body.listingId||'').trim();
    if(!pdvProductId||!listingId) throw new BadRequestException('pdvProductId e listingId são obrigatórios.');
    const listing=(await this.dataSource.query(`SELECT id FROM classified_listings WHERE id=$1::uuid AND "companyId"=$2::uuid AND "listingType"='PRODUCT' AND status<>'ARCHIVED' LIMIT 1`,[listingId,companyId]))[0];
    if(!listing) throw new BadRequestException('O produto selecionado não pertence ao catálogo desta empresa.');
    await this.upsertLink(companyId,pdvProductId,listingId,{syncEnabled:body.syncEnabled,visible:body.visible,syncPrice:body.syncPrice,syncStock:body.syncStock});
    return this.sync(uid,companyId,{productIds:[pdvProductId]},'MANUAL');
  }

  async configureProduct(uid:string, companyId:string, pdvProductId:string, patch:Record<string,unknown>) {
    await this.identities.integrationCompany(uid, companyId, true);
    const rows=await this.dataSource.query(`SELECT * FROM pdv_product_links WHERE "companyId"=$1::uuid AND "pdvProductId"=$2 LIMIT 1`,[companyId,pdvProductId]);
    const link=rows[0]; if(!link) throw new BadRequestException('Importe ou associe este produto antes de configurá-lo.');
    const next={syncEnabled:patch.syncEnabled===undefined?link.syncEnabled:Boolean(patch.syncEnabled),visible:patch.visible===undefined?link.visible:Boolean(patch.visible),syncPrice:patch.syncPrice===undefined?link.syncPrice:Boolean(patch.syncPrice),syncStock:patch.syncStock===undefined?link.syncStock:Boolean(patch.syncStock)};
    await this.upsertLink(companyId,pdvProductId,link.listingId,next);
    if(link.listingId && patch.visible!==undefined) await this.classifieds.setVisibilityForCompanyIntegration(uid,companyId,link.listingId,next.visible);
    return { ...link, ...next };
  }

  async sync(uid:string, companyId:string, options:Record<string,unknown>={}, mode:SyncMode='MANUAL') {
    await this.identities.integrationCompany(uid, companyId, true);
    const connection=await this.connection(companyId,true); const settings={...DEFAULT_SETTINGS,...this.json(connection.settings,{})} as any;
    const selected=Array.isArray(options.productIds)?new Set(options.productIds.map(String)):null;
    const remote=await this.remoteProducts(companyId); const links=await this.dataSource.query(`SELECT * FROM pdv_product_links WHERE "companyId"=$1::uuid`,[companyId]);
    const results:any[]=[];
    for(const product of remote){
      const pdvProductId=String(product.id||''); if(!pdvProductId) continue;
      let link=links.find((item:any)=>String(item.pdvProductId)===pdvProductId);
      if(selected && !selected.has(pdvProductId)) continue;
      if(!link && !selected && settings.importAllProducts!==true) continue;
      try {
        if(!link){
          const match=await this.findExistingMatch(companyId,product);
          if(match){ await this.upsertLink(companyId,pdvProductId,match.id,{visible:settings.visibleByDefault,syncEnabled:true,syncPrice:settings.syncPrice,syncStock:settings.syncStock}); link={pdvProductId,listingId:match.id,visible:settings.visibleByDefault,syncEnabled:true,syncPrice:settings.syncPrice,syncStock:settings.syncStock}; }
        }
        if(link && link.syncEnabled===false){ results.push({pdvProductId,status:'SKIPPED',reason:'sync_disabled'}); continue; }
        const visible=link?Boolean(link.visible):Boolean(settings.visibleByDefault), syncPrice=link?Boolean(link.syncPrice):Boolean(settings.syncPrice), syncStock=link?Boolean(link.syncStock):Boolean(settings.syncStock);
        const payload=this.toListingPayload(product,settings,{syncPrice,syncStock,visible});
        let listing:any;
        if(link?.listingId) { delete payload.attributes; listing=await this.classifieds.updateForCompanyIntegration(uid,companyId,String(link.listingId),payload); }
        else {
          listing=await this.classifieds.createForCompanyIntegration(uid,companyId,payload);
          await this.upsertLink(companyId,pdvProductId,listing.id,{visible,syncEnabled:true,syncPrice,syncStock});
        }
        await this.classifieds.setVisibilityForCompanyIntegration(uid,companyId,listing.id,visible);
        await this.dataSource.query(`UPDATE pdv_product_links SET "remoteSnapshot"=$3::jsonb,"lastPdvUpdatedAt"=$4,"lastSyncedAt"=now(),"updatedAt"=now() WHERE "companyId"=$1::uuid AND "pdvProductId"=$2`,[companyId,pdvProductId,JSON.stringify(product),product.updatedAt||null]);
        results.push({pdvProductId,listingId:listing.id,status:'SYNCED'});
      } catch(error:any){ results.push({pdvProductId,status:'ERROR',error:String(error?.message||error)}); }
    }
    const stamp=mode==='AUTO'?'"lastAutoSyncAt"':'"lastManualSyncAt"';
    await this.dataSource.query(`UPDATE pdv_integrations SET ${stamp}=now(),"lastError"=$2,"updatedAt"=now() WHERE "companyId"=$1::uuid`,[companyId,results.some(r=>r.status==='ERROR')?'Alguns produtos falharam na sincronização.':null]);
    await this.recordEvent(companyId,'PDV_TO_PIRA','PRODUCT_SYNC',null,results.some(r=>r.status==='ERROR')?'PARTIAL':'SUCCESS',{mode,total:results.length,results});
    return {mode,total:results.length,synced:results.filter(r=>r.status==='SYNCED').length,skipped:results.filter(r=>r.status==='SKIPPED').length,failed:results.filter(r=>r.status==='ERROR').length,results};
  }

  async sales(uid:string,companyId:string,updatedSince?:string){ await this.identities.assertCompanyOperator(uid,companyId); const query=updatedSince?`?updatedSince=${encodeURIComponent(updatedSince)}`:''; return this.pdvJson(companyId,`/integrations/piranegocios/sales${query}`); }

  async syncSales(uid:string,companyId:string){ await this.identities.assertCompanyOperator(uid,companyId); const c=await this.connection(companyId,true); const since=c.lastSalesSyncAt?new Date(c.lastSalesSyncAt).toISOString():undefined; const rows=await this.sales(uid,companyId,since); for(const sale of Array.isArray(rows)?rows:[]){ if(!sale?.id) continue; await this.dataSource.query(`INSERT INTO pdv_sale_links(id,"companyId","pdvSaleId","remoteSnapshot",status,"lastSyncedAt") VALUES($1,$2::uuid,$3,$4::jsonb,'OBSERVED',now()) ON CONFLICT ("companyId","pdvSaleId") DO UPDATE SET "remoteSnapshot"=EXCLUDED."remoteSnapshot","lastSyncedAt"=now(),"updatedAt"=now()`,[randomUUID(),companyId,String(sale.id),JSON.stringify(sale)]); } await this.dataSource.query(`UPDATE pdv_integrations SET "lastSalesSyncAt"=now(),"updatedAt"=now() WHERE "companyId"=$1::uuid`,[companyId]); return {observed:Array.isArray(rows)?rows.length:0,createdOrders:0,note:'Vendas do PDV são observadas sem criar pedidos automaticamente no PiraNegócios nesta fase, preservando as regras comerciais atuais.'}; }

  private async autoSyncTick(){ const rows=await this.dataSource.query(`SELECT "companyId","connectedByUserId",settings FROM pdv_integrations WHERE status='CONNECTED'`); for(const row of rows){ const settings={...DEFAULT_SETTINGS,...this.json(row.settings,{})}; if(settings.automaticSync!==true) continue; try{ await this.sync(String(row.connectedByUserId),String(row.companyId),{},'AUTO'); await this.syncSales(String(row.connectedByUserId),String(row.companyId)); }catch(error:any){ this.logger.warn(`Falha auto-sync PDV ${row.companyId}: ${error?.message||error}`); await this.dataSource.query(`UPDATE pdv_integrations SET "lastError"=$2,"updatedAt"=now() WHERE "companyId"=$1::uuid`,[row.companyId,String(error?.message||error).slice(0,2000)]).catch(()=>undefined); } } }

  private toListingPayload(product:any,settings:any,flags:{syncPrice:boolean;syncStock:boolean;visible:boolean}) { const body:any={categorySlug:String(settings.defaultCategorySlug||'outros'),listingType:'PRODUCT',title:String(product.name||'Produto PDV').slice(0,160),description:String(product.description||`Produto sincronizado com o PDV Inteligente.`),condition:'NEW',attributes:{integrationSource:'PDV_INTELIGENTE',pdvProductId:String(product.id||''),sku:product.sku||null,barcode:product.barcode||null,brand:product.brand||null,unit:product.unit||null},status:flags.visible?'PUBLISHED':'DRAFT'}; if(flags.syncPrice) body.price=Number(product.salePrice??product.price??0); if(flags.syncStock) body.commerceConfig={onlineCheckout:{stockQuantity:Math.max(0,Number(product.stock||0))}}; if(product.image) body.images=[product.image]; return body; }

  private async findExistingMatch(companyId:string,product:any){ const sku=String(product.sku||'').trim(),barcode=String(product.barcode||'').trim(); if(!sku&&!barcode) return null; const rows=await this.dataSource.query(`SELECT id,title FROM classified_listings WHERE "companyId"=$1::uuid AND "listingType"='PRODUCT' AND status<>'ARCHIVED' AND ((NULLIF($2,'') IS NOT NULL AND (attributes->>'sku'=$2 OR attributes->>'pdvSku'=$2)) OR (NULLIF($3,'') IS NOT NULL AND (attributes->>'barcode'=$3 OR attributes->>'pdvBarcode'=$3))) ORDER BY "updatedAt" DESC LIMIT 2`,[companyId,sku,barcode]); return rows.length===1?rows[0]:null; }
  private async upsertLink(companyId:string,pdvProductId:string,listingId:string,opts:any){ await this.dataSource.query(`INSERT INTO pdv_product_links(id,"companyId","pdvProductId","listingId","syncEnabled",visible,"syncPrice","syncStock") VALUES($1,$2::uuid,$3,$4::uuid,$5,$6,$7,$8) ON CONFLICT ("companyId","pdvProductId") DO UPDATE SET "listingId"=EXCLUDED."listingId","syncEnabled"=EXCLUDED."syncEnabled",visible=EXCLUDED.visible,"syncPrice"=EXCLUDED."syncPrice","syncStock"=EXCLUDED."syncStock","updatedAt"=now()`,[randomUUID(),companyId,pdvProductId,listingId,opts.syncEnabled===undefined?true:Boolean(opts.syncEnabled),opts.visible===undefined?true:Boolean(opts.visible),opts.syncPrice===undefined?true:Boolean(opts.syncPrice),opts.syncStock===undefined?true:Boolean(opts.syncStock)]); }
  private async remoteProducts(companyId:string){ const value=await this.pdvJson(companyId,'/integrations/piranegocios/products'); return Array.isArray(value)?value:[]; }
  private async pdvJson(companyId:string,path:string,init:RequestInit={}){ const connection=await this.ensureFreshToken(await this.connection(companyId,true)); const headers:any={...(init.headers||{}),Authorization:`Bearer ${this.decrypt(connection.accessTokenEncrypted)}`,'Content-Type':'application/json'}; return this.httpJson(`${connection.pdvBaseUrl}${path}`,{...init,headers}); }
  private async ensureFreshToken(connection:any){ if(new Date(connection.accessExpiresAt).getTime()>Date.now()+60000) return connection; const resource=`${connection.pdvBaseUrl}/integrations/piranegocios`; const token=await this.httpJson(`${connection.pdvBaseUrl}/oauth/piranegocios/token`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'refresh_token',refresh_token:this.decrypt(connection.refreshTokenEncrypted),client_id:connection.clientId,resource})}); await this.dataSource.query(`UPDATE pdv_integrations SET "accessTokenEncrypted"=$2,"refreshTokenEncrypted"=$3,"accessExpiresAt"=$4,scopes=$5::jsonb,"updatedAt"=now() WHERE id=$1::uuid`,[connection.id,this.encrypt(String(token.access_token)),this.encrypt(String(token.refresh_token)),new Date(Date.now()+Number(token.expires_in||3600)*1000),JSON.stringify(String(token.scope||'').split(/\s+/).filter((s:string)=>s&&s!=='offline_access'))]); return (await this.dataSource.query(`SELECT * FROM pdv_integrations WHERE id=$1::uuid`,[connection.id]))[0]; }
  private async connection(companyId:string,required=true){ const row=(await this.dataSource.query(`SELECT * FROM pdv_integrations WHERE "companyId"=$1::uuid LIMIT 1`,[companyId]))[0]; if(required&&(!row||row.status!=='CONNECTED')) throw new BadRequestException('Conecte o PDV Inteligente antes de sincronizar.'); return row||null; }
  private normalizeBase(raw:unknown){ const text=String(raw||process.env.PDV_INTEGRATION_BASE_URL||DEFAULT_PDV).trim().replace(/\/+$/,''); let url:URL; try{url=new URL(text);}catch{throw new BadRequestException('URL do PDV inválida.');} if(url.protocol!=='https:' && !(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))) throw new BadRequestException('Use uma URL HTTPS para o PDV.'); return url.toString().replace(/\/+$/,''); }
  private async httpJson(url:string,init:RequestInit={}){ let response:Response; try{response=await fetch(url,init);}catch(error:any){throw new ServiceUnavailableException(`Não foi possível acessar o PDV: ${error?.message||error}`);} const text=await response.text(); let payload:any={}; try{payload=text?JSON.parse(text):{};}catch{payload={message:text};} if(!response.ok) throw new ServiceUnavailableException(payload?.message||`PDV respondeu HTTP ${response.status}.`); return payload; }
  private encryptionKey(){ const secret=String(process.env.PDV_INTEGRATION_ENCRYPTION_KEY||process.env.JWT_SECRET||'').trim(); if(!secret) throw new ServiceUnavailableException('Configure PDV_INTEGRATION_ENCRYPTION_KEY antes de usar a integração.'); return createHash('sha256').update(secret).digest(); }
  private encrypt(value:string){ const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.encryptionKey(),iv); const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]); return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`; }
  private decrypt(value:string){ const [ivRaw,tagRaw,dataRaw]=String(value||'').split('.'); if(!ivRaw||!tagRaw||!dataRaw) throw new ServiceUnavailableException('Credencial do PDV inválida.'); const decipher=createDecipheriv('aes-256-gcm',this.encryptionKey(),Buffer.from(ivRaw,'base64url')); decipher.setAuthTag(Buffer.from(tagRaw,'base64url')); return Buffer.concat([decipher.update(Buffer.from(dataRaw,'base64url')),decipher.final()]).toString('utf8'); }
  private hash(value:string){return createHash('sha256').update(value).digest('hex');}
  private json(value:any,fallback:any){ if(value===null||value===undefined)return fallback; if(typeof value==='object')return value; try{return JSON.parse(value);}catch{return fallback;} }
  private async recordEvent(companyId:string,direction:string,kind:string,externalId:string|null,status:string,payload:any,error?:string){ await this.dataSource.query(`INSERT INTO pdv_integration_events(id,"companyId",direction,kind,"externalId",status,payload,error) VALUES($1,$2::uuid,$3,$4,$5,$6,$7::jsonb,$8)`,[randomUUID(),companyId,direction,kind,externalId,status,JSON.stringify(payload||{}),error||null]).catch(()=>undefined); }
}
