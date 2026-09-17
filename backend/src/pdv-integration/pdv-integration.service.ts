import { BadRequestException, ForbiddenException, Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
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
  webhookUrl() { return `${this.publicBaseUrl()}/api/pdv-integration/webhooks`; }

  async startOAuth(uid: string, companyId: string, rawBase?: unknown) {
    await this.identities.assertCompanyOperator(uid, companyId);
    const pdvBaseUrl = this.normalizeBase(rawBase);
    const registration = await this.httpJson(`${pdvBaseUrl}/oauth/piranegocios/register`, {
      method: 'POST', body: JSON.stringify({ client_name: 'PiraNegócios', redirect_uris: [this.callbackUrl()], webhook_uri: this.webhookUrl() }),
      headers: { 'Content-Type': 'application/json' },
    });
    const clientId = String(registration?.client_id || '');
    const webhookSecret = String(registration?.webhook_secret || '');
    if (!clientId) throw new ServiceUnavailableException('O PDV não devolveu um client_id OAuth válido.');
    if (!webhookSecret) throw new ServiceUnavailableException('O PDV não devolveu o segredo de assinatura do webhook.');
    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const state = `pn_pdv_${randomBytes(30).toString('hex')}`;
    await this.dataSource.query(
      `INSERT INTO pdv_oauth_states(id,"stateHash","companyId","userId","pdvBaseUrl","clientId","codeVerifierEncrypted","webhookSecretEncrypted",scopes,"expiresAt") VALUES($1,$2,$3::uuid,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
      [randomUUID(), this.hash(state), companyId, uid, pdvBaseUrl, clientId, this.encrypt(verifier), this.encrypt(webhookSecret), JSON.stringify(PDV_SCOPES), new Date(Date.now() + 10 * 60 * 1000)],
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
        `INSERT INTO pdv_integrations(id,"companyId","connectedByUserId","pdvBaseUrl","clientId","webhookSecretEncrypted","accessTokenEncrypted","refreshTokenEncrypted","accessExpiresAt",scopes,settings,status)
         VALUES($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,'CONNECTED')
         ON CONFLICT ("companyId") DO UPDATE SET "connectedByUserId"=EXCLUDED."connectedByUserId","pdvBaseUrl"=EXCLUDED."pdvBaseUrl","clientId"=EXCLUDED."clientId","webhookSecretEncrypted"=EXCLUDED."webhookSecretEncrypted","accessTokenEncrypted"=EXCLUDED."accessTokenEncrypted","refreshTokenEncrypted"=EXCLUDED."refreshTokenEncrypted","accessExpiresAt"=EXCLUDED."accessExpiresAt",scopes=EXCLUDED.scopes,status='CONNECTED',"lastError"=NULL,"updatedAt"=now()`,
        [randomUUID(), pending.companyId, pending.userId, pending.pdvBaseUrl, pending.clientId, pending.webhookSecretEncrypted, this.encrypt(String(token.access_token)), this.encrypt(String(token.refresh_token)), new Date(Date.now() + Number(token.expires_in || 3600) * 1000), JSON.stringify(scopes), JSON.stringify(DEFAULT_SETTINGS)],
      );
    });
    return { companyId: pending.companyId, connected: true, scopes };
  }

  async status(uid: string, companyId: string) {
    await this.identities.assertCompanyOperator(uid, companyId);
    const connection = await this.connection(companyId, false);
    if (!connection) return { connected: false, settings: DEFAULT_SETTINGS };
    const counts = await this.dataSource.query(`SELECT count(*)::int AS total,count(*) FILTER (WHERE "listingId" IS NOT NULL)::int AS linked,count(*) FILTER (WHERE visible=true AND "remoteAvailable"=true)::int AS visible,count(*) FILTER (WHERE "conflictState"='PENDING')::int AS conflicts,count(*) FILTER (WHERE "remoteAvailable"=false)::int AS unavailable FROM pdv_product_links WHERE "companyId"=$1::uuid`, [companyId]);
    return { connected: connection.status === 'CONNECTED', status: connection.status, pdvBaseUrl: connection.pdvBaseUrl, scopes: this.json(connection.scopes, []), settings: { ...DEFAULT_SETTINGS, ...this.json(connection.settings, {}) }, lastManualSyncAt: connection.lastManualSyncAt, lastAutoSyncAt: connection.lastAutoSyncAt, lastSalesSyncAt: connection.lastSalesSyncAt, lastWebhookAt: connection.lastWebhookAt, lastError: connection.lastError, products: counts[0] || { total:0, linked:0, visible:0, conflicts:0, unavailable:0 } };
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
    const connection = await this.connection(companyId, false);
    if (connection?.status === 'CONNECTED') {
      await this.pdvJson(companyId, '/integrations/piranegocios/disconnect', { method: 'POST' }).catch((error:any) => {
        this.logger.warn(`Não foi possível revogar imediatamente o cliente OAuth no PDV: ${error?.message || error}`);
      });
    }
    await this.dataSource.query(`UPDATE pdv_integrations SET status='DISCONNECTED',"accessTokenEncrypted"='',"refreshTokenEncrypted"='',"webhookSecretEncrypted"=NULL,"updatedAt"=now() WHERE "companyId"=$1::uuid`, [companyId]);
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

  async categories(uid:string,companyId:string){
    await this.identities.integrationCompany(uid,companyId,true);
    const [remote,local,links]=await Promise.all([
      this.remoteCategories(companyId),
      this.dataSource.query(`SELECT slug,name,"parentSlug","isActive" FROM classified_categories WHERE "isActive"=true ORDER BY "sortOrder",name`),
      this.dataSource.query(`SELECT * FROM pdv_category_links WHERE "companyId"=$1::uuid`,[companyId]),
    ]);
    return { remote, local, links };
  }

  async mapCategory(uid:string,companyId:string,pdvCategoryIdRaw:unknown,categorySlugRaw:unknown){
    await this.identities.integrationCompany(uid,companyId,true);
    const pdvCategoryId=String(pdvCategoryIdRaw||'').trim(),categorySlug=String(categorySlugRaw||'').trim();
    if(!pdvCategoryId||!categorySlug) throw new BadRequestException('pdvCategoryId e categorySlug são obrigatórios.');
    const local=(await this.dataSource.query(`SELECT slug,name FROM classified_categories WHERE slug=$1 AND "isActive"=true LIMIT 1`,[categorySlug]))[0];
    if(!local) throw new BadRequestException('Categoria do PiraNegócios inválida ou inativa.');
    const remote=(await this.remoteCategories(companyId)).find((item:any)=>String(item.id)===pdvCategoryId);
    if(!remote) throw new BadRequestException('Categoria do PDV não encontrada.');
    await this.upsertCategoryLink(companyId,pdvCategoryId,categorySlug,remote);
    return { pdvCategoryId, categorySlug, remote, local };
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
    if(link.listingId && patch.visible!==undefined) await this.classifieds.setVisibilityForCompanyIntegration(uid,companyId,link.listingId,next.visible && link.remoteAvailable!==false);
    return { ...link, ...next };
  }

  async sync(uid:string, companyId:string, options:Record<string,unknown>={}, mode:SyncMode='MANUAL') {
    await this.identities.integrationCompany(uid, companyId, true);
    const connection=await this.connection(companyId,true);
    const settings={...DEFAULT_SETTINGS,...this.json(connection.settings,{})} as any;
    const selected=Array.isArray(options.productIds)?new Set(options.productIds.map(String)):null;
    const remote=await this.remoteProducts(companyId);
    const links=await this.dataSource.query(`SELECT * FROM pdv_product_links WHERE "companyId"=$1::uuid`,[companyId]);
    const results:any[]=[];
    const remoteIds=new Set<string>();
    for(const product of remote){
      const pdvProductId=String(product.id||''); if(!pdvProductId) continue;
      remoteIds.add(pdvProductId);
      let link=links.find((item:any)=>String(item.pdvProductId)===pdvProductId);
      if(selected&&!selected.has(pdvProductId)) continue;
      if(!link&&!selected&&settings.importAllProducts!==true) continue;
      try{
        if(!link){
          const match=await this.findExistingMatch(companyId,product);
          if(match){
            await this.upsertLink(companyId,pdvProductId,match.id,{visible:settings.visibleByDefault,syncEnabled:true,syncPrice:settings.syncPrice,syncStock:settings.syncStock});
            link={pdvProductId,listingId:match.id,visible:settings.visibleByDefault,syncEnabled:true,syncPrice:settings.syncPrice,syncStock:settings.syncStock,remoteAvailable:true};
          }
        }
        if(link&&link.syncEnabled===false){ results.push({pdvProductId,status:'SKIPPED',reason:'sync_disabled'}); continue; }
        if(link?.listingId&&mode==='AUTO'){
          const disposition=await this.syncDisposition(companyId,link,product,false);
          if(disposition.status==='UNCHANGED'){ results.push({pdvProductId,status:'SKIPPED',reason:'remote_unchanged'}); continue; }
          if(disposition.status==='CONFLICT'){ results.push({pdvProductId,listingId:link.listingId,status:'CONFLICT',fields:disposition.fields}); continue; }
        }
        const visiblePreference=link?Boolean(link.visible):Boolean(settings.visibleByDefault);
        const remoteAvailable=product.active!==false;
        const effectiveVisible=visiblePreference&&remoteAvailable;
        const syncPrice=link?Boolean(link.syncPrice):Boolean(settings.syncPrice);
        const syncStock=link?Boolean(link.syncStock):Boolean(settings.syncStock);
        const categorySlug=await this.resolveCategorySlug(companyId,product,settings);
        const currentListing=link?.listingId?(await this.dataSource.query(`SELECT price,"catalogConfig","commerceConfig" FROM classified_listings WHERE id=$1::uuid AND "companyId"=$2::uuid LIMIT 1`,[link.listingId,companyId]))[0]:null;
        const initialImport=!link?.listingId;
        const payload=this.toListingPayload(product,settings,{syncPrice:initialImport||syncPrice,syncStock:initialImport||syncStock,visible:effectiveVisible},categorySlug,currentListing?.catalogConfig);
        let listing:any;
        if(link?.listingId){ delete payload.attributes; listing=await this.classifieds.updateForCompanyIntegration(uid,companyId,String(link.listingId),payload); }
        else{
          listing=await this.classifieds.createForCompanyIntegration(uid,companyId,payload);
          await this.upsertLink(companyId,pdvProductId,listing.id,{visible:visiblePreference,syncEnabled:true,syncPrice,syncStock});
        }
        await this.classifieds.setVisibilityForCompanyIntegration(uid,companyId,listing.id,effectiveVisible);
        await this.dataSource.query(`UPDATE pdv_product_links SET "remoteSnapshot"=$3::jsonb,"lastPdvUpdatedAt"=$4,"lastSyncedAt"=now(),"remoteAvailable"=$5,"lastDirection"='PDV_TO_PIRA',"conflictState"='NONE',"conflictSnapshot"=NULL,"updatedAt"=now() WHERE "companyId"=$1::uuid AND "pdvProductId"=$2`,[companyId,pdvProductId,JSON.stringify(product),product.updatedAt||null,remoteAvailable]);
        results.push({pdvProductId,listingId:listing.id,status:'SYNCED',remoteAvailable});
      }catch(error:any){ results.push({pdvProductId,status:'ERROR',error:String(error?.message||error)}); }
    }
    if(!selected){
      for(const link of links){
        const pdvProductId=String(link.pdvProductId||'');
        if(!pdvProductId||remoteIds.has(pdvProductId)||link.remoteAvailable===false) continue;
        try{
          if(link.listingId&&link.syncEnabled!==false) await this.classifieds.setVisibilityForCompanyIntegration(uid,companyId,String(link.listingId),false);
          await this.dataSource.query(`UPDATE pdv_product_links SET "remoteAvailable"=false,"lastSyncedAt"=now(),"lastDirection"='PDV_TO_PIRA',"updatedAt"=now() WHERE id=$1::uuid`,[link.id]);
          results.push({pdvProductId,listingId:link.listingId||null,status:'REMOTE_REMOVED'});
        }catch(error:any){ results.push({pdvProductId,status:'ERROR',error:String(error?.message||error)}); }
      }
    }
    const stamp=mode==='AUTO'?'"lastAutoSyncAt"':'"lastManualSyncAt"';
    const hasError=results.some(r=>r.status==='ERROR');
    await this.dataSource.query(`UPDATE pdv_integrations SET ${stamp}=now(),"lastError"=$2,"updatedAt"=now() WHERE "companyId"=$1::uuid`,[companyId,hasError?'Alguns produtos falharam na sincronização.':null]);
    await this.recordEvent(companyId,'PDV_TO_PIRA','PRODUCT_SYNC',null,hasError?'PARTIAL':'SUCCESS',{mode,total:results.length,results});
    return {mode,total:results.length,synced:results.filter(r=>r.status==='SYNCED').length,skipped:results.filter(r=>r.status==='SKIPPED').length,conflicts:results.filter(r=>r.status==='CONFLICT').length,removed:results.filter(r=>r.status==='REMOTE_REMOVED').length,failed:results.filter(r=>r.status==='ERROR').length,results};
  }

  async receiveWebhook(headers:Record<string,string|string[]|undefined>, body:any) {
    const clientId=this.header(headers,'x-pdv-client-id');
    const eventId=this.header(headers,'x-pdv-event-id');
    const eventType=this.header(headers,'x-pdv-event-type');
    const timestamp=this.header(headers,'x-pdv-timestamp');
    const signature=this.header(headers,'x-pdv-signature');
    if(!clientId||!eventId||!eventType||!timestamp||!signature) throw new UnauthorizedException('Webhook PDV sem cabeçalhos de assinatura obrigatórios.');
    if(String(body?.eventId||'')!==eventId||String(body?.type||'')!==eventType) throw new UnauthorizedException('Identidade do evento diverge dos cabeçalhos assinados.');
    const timestampNumber=Number(timestamp);
    if(!Number.isFinite(timestampNumber)||Math.abs(Date.now()-timestampNumber)>5*60*1000) throw new UnauthorizedException('Webhook PDV expirado ou com timestamp inválido.');
    const connection=(await this.dataSource.query(`SELECT * FROM pdv_integrations WHERE "clientId"=$1 AND status='CONNECTED' LIMIT 1`,[clientId]))[0];
    if(!connection?.webhookSecretEncrypted) throw new UnauthorizedException('Integração PDV não reconhecida para este webhook.');
    const data=body?.data??{};
    const expected=this.webhookSignature(this.decrypt(String(connection.webhookSecretEncrypted)),timestamp,eventId,eventType,data);
    if(!this.safeEqual(expected,signature)) throw new UnauthorizedException('Assinatura do webhook PDV inválida.');
    const payloadHash=this.hash(this.stableJson(data));
    const inserted=await this.dataSource.query(`INSERT INTO pdv_integration_events(id,"companyId",direction,kind,"externalId","sourceEventId","payloadHash",status,payload) VALUES($1,$2::uuid,'PDV_TO_PIRA',$3,$4,$5,$6,'PROCESSING',$7::jsonb) ON CONFLICT DO NOTHING RETURNING id`,[randomUUID(),connection.companyId,eventType,String(body?.aggregateId||'')||null,eventId,payloadHash,JSON.stringify(body||{})]);
    let eventRow=inserted[0];
    if(!eventRow){
      const existing=(await this.dataSource.query(`SELECT id,status FROM pdv_integration_events WHERE "companyId"=$1::uuid AND "sourceEventId"=$2 LIMIT 1`,[connection.companyId,eventId]))[0];
      if(!existing) throw new ServiceUnavailableException('Não foi possível registrar a idempotência do webhook.');
      if(existing.status!=='ERROR') return {accepted:true,duplicate:true,eventId};
      await this.dataSource.query(`UPDATE pdv_integration_events SET status='PROCESSING',error=NULL,"updatedAt"=now() WHERE id=$1::uuid`,[existing.id]);
      eventRow=existing;
    }
    const settings={...DEFAULT_SETTINGS,...this.json(connection.settings,{})} as any;
    if(settings.automaticSync!==true){
      await this.dataSource.query(`UPDATE pdv_integration_events SET status='IGNORED',"processedAt"=now(),"updatedAt"=now() WHERE id=$1::uuid`,[eventRow.id]);
      await this.dataSource.query(`UPDATE pdv_integrations SET "lastWebhookAt"=now(),"updatedAt"=now() WHERE id=$1::uuid`,[connection.id]);
      return {accepted:true,ignored:true,eventId};
    }
    try{
      const result=await this.processWebhookEvent(connection,eventType,String(body?.aggregateId||''),data);
      await this.dataSource.query(`UPDATE pdv_integration_events SET status='SUCCESS',"processedAt"=now(),error=NULL,"updatedAt"=now() WHERE id=$1::uuid`,[eventRow.id]);
      await this.dataSource.query(`UPDATE pdv_integrations SET "lastWebhookAt"=now(),"lastError"=NULL,"updatedAt"=now() WHERE id=$1::uuid`,[connection.id]);
      return {accepted:true,eventId,result};
    }catch(error:any){
      const message=String(error?.message||error).slice(0,2000);
      await this.dataSource.query(`UPDATE pdv_integration_events SET status='ERROR',error=$2,"updatedAt"=now() WHERE id=$1::uuid`,[eventRow.id,message]).catch(()=>undefined);
      await this.dataSource.query(`UPDATE pdv_integrations SET "lastError"=$2,"updatedAt"=now() WHERE id=$1::uuid`,[connection.id,message]).catch(()=>undefined);
      throw error;
    }
  }

  private async processWebhookEvent(connection:any,eventType:string,aggregateId:string,data:any){
    const uid=String(connection.connectedByUserId),companyId=String(connection.companyId);
    if(['product.created','product.updated','product.stock_updated'].includes(eventType)){
      const productId=aggregateId||String(data?.id||'');
      if(!productId) throw new BadRequestException('Webhook de produto sem productId.');
      return this.syncRemoteProduct(uid,companyId,productId,{eventType});
    }
    if(eventType==='product.removed'){
      const productId=aggregateId||String(data?.id||'');
      if(!productId) throw new BadRequestException('Webhook de remoção sem productId.');
      const parentProductId=String(data?.parentProductId||'').trim();
      if(parentProductId) return this.syncRemoteProduct(uid,companyId,parentProductId,{eventType:'product.updated',force:true});
      const link=(await this.dataSource.query(`SELECT * FROM pdv_product_links WHERE "companyId"=$1::uuid AND "pdvProductId"=$2 LIMIT 1`,[companyId,productId]))[0];
      if(!link) return {status:'UNLINKED',pdvProductId:productId};
      if(link.listingId&&link.syncEnabled!==false) await this.classifieds.setVisibilityForCompanyIntegration(uid,companyId,String(link.listingId),false);
      await this.dataSource.query(`UPDATE pdv_product_links SET "remoteAvailable"=false,"remoteSnapshot"=$3::jsonb,"lastPdvUpdatedAt"=now(),"lastSyncedAt"=now(),"lastDirection"='PDV_TO_PIRA',"updatedAt"=now() WHERE "companyId"=$1::uuid AND "pdvProductId"=$2`,[companyId,productId,JSON.stringify(data||{})]);
      return {status:'REMOTE_REMOVED',pdvProductId:productId,listingId:link.listingId||null};
    }
    if(eventType.startsWith('sale.')){
      const saleId=aggregateId||String(data?.id||'');
      if(!saleId) throw new BadRequestException('Webhook de venda sem saleId.');
      await this.dataSource.query(`INSERT INTO pdv_sale_links(id,"companyId","pdvSaleId","remoteSnapshot",status,"lastSyncedAt") VALUES($1,$2::uuid,$3,$4::jsonb,'OBSERVED',now()) ON CONFLICT ("companyId","pdvSaleId") DO UPDATE SET "remoteSnapshot"=EXCLUDED."remoteSnapshot",status='OBSERVED',"lastSyncedAt"=now(),"updatedAt"=now()`,[randomUUID(),companyId,saleId,JSON.stringify(data||{})]);
      await this.dataSource.query(`UPDATE pdv_integrations SET "lastSalesSyncAt"=now(),"updatedAt"=now() WHERE "companyId"=$1::uuid`,[companyId]);
      return {status:'OBSERVED',pdvSaleId:saleId,createdOrder:false,eventType};
    }
    return {status:'IGNORED_EVENT_TYPE',eventType};
  }

  private async syncRemoteProduct(uid:string,companyId:string,pdvProductId:string,options:{eventType?:string;force?:boolean}={}){
    await this.identities.integrationCompany(uid,companyId,true);
    const connection=await this.connection(companyId,true);
    const settings={...DEFAULT_SETTINGS,...this.json(connection.settings,{})} as any;
    const product=await this.remoteProduct(companyId,pdvProductId);
    const canonicalPdvProductId=String(product?.id||pdvProductId);
    let link=(await this.dataSource.query(`SELECT * FROM pdv_product_links WHERE "companyId"=$1::uuid AND "pdvProductId"=$2 LIMIT 1`,[companyId,canonicalPdvProductId]))[0];
    if(!link){
      const match=await this.findExistingMatch(companyId,product);
      if(match){
        await this.upsertLink(companyId,canonicalPdvProductId,match.id,{visible:settings.visibleByDefault,syncEnabled:true,syncPrice:settings.syncPrice,syncStock:settings.syncStock});
        link={pdvProductId:canonicalPdvProductId,listingId:match.id,visible:settings.visibleByDefault,syncEnabled:true,syncPrice:settings.syncPrice,syncStock:settings.syncStock,remoteAvailable:true};
      }
    }
    if(link&&link.syncEnabled===false) return {pdvProductId:canonicalPdvProductId,status:'SKIPPED',reason:'sync_disabled'};
    if(link?.listingId&&!options.force){
      const disposition=await this.syncDisposition(companyId,link,product,options.eventType==='product.stock_updated');
      if(disposition.status==='UNCHANGED') return {pdvProductId:canonicalPdvProductId,listingId:link.listingId,status:'SKIPPED',reason:'remote_unchanged'};
      if(disposition.status==='CONFLICT') return {pdvProductId:canonicalPdvProductId,listingId:link.listingId,status:'CONFLICT',fields:disposition.fields};
    }
    const visiblePreference=link?Boolean(link.visible):Boolean(settings.visibleByDefault);
    const remoteAvailable=product.active!==false;
    const effectiveVisible=visiblePreference&&remoteAvailable;
    const syncPrice=link?Boolean(link.syncPrice):Boolean(settings.syncPrice);
    const syncStock=link?Boolean(link.syncStock):Boolean(settings.syncStock);
    const categorySlug=await this.resolveCategorySlug(companyId,product,settings);
    const currentListing=link?.listingId?(await this.dataSource.query(`SELECT price,"catalogConfig","commerceConfig" FROM classified_listings WHERE id=$1::uuid AND "companyId"=$2::uuid LIMIT 1`,[link.listingId,companyId]))[0]:null;
    let payload:any;
    if(options.eventType==='product.stock_updated'&&link?.listingId){
      if(!syncStock) return {pdvProductId:canonicalPdvProductId,listingId:link.listingId,status:'SKIPPED',reason:'stock_sync_disabled'};
      payload={commerceConfig:{onlineCheckout:{stockQuantity:this.productStock(product)}}};
      const variants=this.variantCatalogConfig(product,currentListing?.catalogConfig,{syncPrice:false,syncStock:true});
      if(variants) payload.catalogConfig=variants;
    }else{
      const initialImport=!link?.listingId;
      payload=this.toListingPayload(product,settings,{syncPrice:initialImport||syncPrice,syncStock:initialImport||syncStock,visible:effectiveVisible},categorySlug,currentListing?.catalogConfig);
      if(link?.listingId) delete payload.attributes;
    }
    let listing:any;
    if(link?.listingId) listing=await this.classifieds.updateForCompanyIntegration(uid,companyId,String(link.listingId),payload);
    else{
      listing=await this.classifieds.createForCompanyIntegration(uid,companyId,payload);
      await this.upsertLink(companyId,canonicalPdvProductId,listing.id,{visible:visiblePreference,syncEnabled:true,syncPrice,syncStock});
    }
    if(options.eventType!=='product.stock_updated') await this.classifieds.setVisibilityForCompanyIntegration(uid,companyId,listing.id,effectiveVisible);
    await this.dataSource.query(`UPDATE pdv_product_links SET "remoteSnapshot"=$3::jsonb,"lastPdvUpdatedAt"=$4,"lastSyncedAt"=now(),"remoteAvailable"=$5,"lastDirection"='PDV_TO_PIRA',"conflictState"='NONE',"conflictSnapshot"=NULL,"updatedAt"=now() WHERE "companyId"=$1::uuid AND "pdvProductId"=$2`,[companyId,canonicalPdvProductId,JSON.stringify(product),product.updatedAt||null,remoteAvailable]);
    return {pdvProductId:canonicalPdvProductId,listingId:listing.id,status:'SYNCED',remoteAvailable,sourceProductId:pdvProductId};
  }

  async resolveConflict(uid:string,companyId:string,pdvProductId:string,strategyRaw:unknown){
    await this.identities.integrationCompany(uid,companyId,true);
    const strategy=String(strategyRaw||'').toUpperCase();
    if(!['PDV','PIRA'].includes(strategy)) throw new BadRequestException('Escolha PDV ou PIRA para resolver o conflito.');
    const link=(await this.dataSource.query(`SELECT * FROM pdv_product_links WHERE "companyId"=$1::uuid AND "pdvProductId"=$2 LIMIT 1`,[companyId,pdvProductId]))[0];
    if(!link?.listingId) throw new BadRequestException('Produto não possui vínculo com o catálogo do Pira.');
    if(link.conflictState!=='PENDING') return {resolved:false,reason:'no_pending_conflict'};
    if(strategy==='PDV'){
      const result=await this.syncRemoteProduct(uid,companyId,pdvProductId,{eventType:'product.updated',force:true});
      return {resolved:true,strategy,result};
    }
    const result=await this.pushProduct(uid,companyId,String(link.listingId));
    return {resolved:true,strategy,result};
  }

  async sales(uid:string,companyId:string,updatedSince?:string){ await this.identities.assertCompanyOperator(uid,companyId); const query=updatedSince?`?updatedSince=${encodeURIComponent(updatedSince)}`:''; return this.pdvJson(companyId,`/integrations/piranegocios/sales${query}`); }

  async syncSales(uid:string,companyId:string){ await this.identities.assertCompanyOperator(uid,companyId); const c=await this.connection(companyId,true); const since=c.lastSalesSyncAt?new Date(c.lastSalesSyncAt).toISOString():undefined; const rows=await this.sales(uid,companyId,since); for(const sale of Array.isArray(rows)?rows:[]){ if(!sale?.id) continue; await this.dataSource.query(`INSERT INTO pdv_sale_links(id,"companyId","pdvSaleId","remoteSnapshot",status,"lastSyncedAt") VALUES($1,$2::uuid,$3,$4::jsonb,'OBSERVED',now()) ON CONFLICT ("companyId","pdvSaleId") DO UPDATE SET "remoteSnapshot"=EXCLUDED."remoteSnapshot","lastSyncedAt"=now(),"updatedAt"=now()`,[randomUUID(),companyId,String(sale.id),JSON.stringify(sale)]); } await this.dataSource.query(`UPDATE pdv_integrations SET "lastSalesSyncAt"=now(),"updatedAt"=now() WHERE "companyId"=$1::uuid`,[companyId]); return {observed:Array.isArray(rows)?rows.length:0,createdOrders:0,note:'Vendas do PDV são observadas sem criar pedidos automaticamente no PiraNegócios nesta fase, preservando as regras comerciais atuais.'}; }


  async localProducts(uid:string, companyId:string) {
    await this.identities.integrationCompany(uid, companyId, true);
    return this.dataSource.query(`
      SELECT l.id,l.title,l.description,l.price,l.status,l.attributes,l."commerceConfig",l."updatedAt",
             img.url AS image,
             link."pdvProductId",link."syncEnabled",link.visible,link."syncPrice",link."syncStock",link."lastSyncedAt",link."remoteAvailable",link."conflictState",link."conflictSnapshot",link."lastDirection"
      FROM classified_listings l
      LEFT JOIN pdv_product_links link ON link."companyId"=l."companyId" AND link."listingId"=l.id
      LEFT JOIN LATERAL (
        SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC,"createdAt" ASC LIMIT 1
      ) img ON true
      WHERE l."companyId"=$1::uuid AND l."listingType"='PRODUCT' AND l.status<>'ARCHIVED' AND l."deletedAt" IS NULL
      ORDER BY l."updatedAt" DESC
    `,[companyId]);
  }

  async pushProduct(uid:string, companyId:string, listingId:string) {
    await this.identities.integrationCompany(uid, companyId, true);
    const rows=await this.dataSource.query(`
      SELECT l.*,img.url AS image,link."pdvProductId",link."syncEnabled",link.visible,link."syncPrice",link."syncStock",link."remoteAvailable",link."conflictState",link."conflictSnapshot",link."lastSyncedAt"
      FROM classified_listings l
      LEFT JOIN pdv_product_links link ON link."companyId"=l."companyId" AND link."listingId"=l.id
      LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC,"createdAt" ASC LIMIT 1) img ON true
      WHERE l.id=$1::uuid AND l."companyId"=$2::uuid AND l."listingType"='PRODUCT' AND l.status<>'ARCHIVED' AND l."deletedAt" IS NULL LIMIT 1
    `,[listingId,companyId]);
    const listing=rows[0];
    if(!listing) throw new BadRequestException('Produto do PiraNegócios não encontrado para esta empresa.');
    const attrs=this.json(listing.attributes,{}), commerce=this.json(listing.commerceConfig,{}), catalog=this.json(listing.catalogConfig,{});
    const stock=Number(commerce?.onlineCheckout?.stockQuantity ?? 0);
    const pdvCategoryId=await this.resolvePdvCategoryId(companyId,String(listing.categorySlug||''));
    const variants=this.piraVariants(catalog);
    const payload:any={
      externalProductId: listing.id,
      product:{
        name:listing.title,
        description:listing.description||'',
        sku:attrs.sku||attrs.pdvSku||undefined,
        barcode:attrs.barcode||attrs.pdvBarcode||undefined,
        salePrice:Number(listing.price||0),
        stock:Number.isFinite(stock)?stock:0,
        brand:attrs.brand||undefined,
        unit:attrs.unit||undefined,
        image:listing.image||undefined,
        ...(pdvCategoryId?{categoryId:pdvCategoryId}:{}),
        type:variants.length?'variable':'simple',
        hasVariations:variants.length>0,
        ...(variants.length?{variations:variants}:{}),
      },
    };
    if(listing.pdvProductId) payload.pdvProductId=String(listing.pdvProductId);
    const result=await this.pdvJson(companyId,'/integrations/piranegocios/products/upsert',{method:'POST',body:JSON.stringify(payload)});
    const pdvProductId=String(result?.product?.id||listing.pdvProductId||'').trim();
    if(!pdvProductId) throw new ServiceUnavailableException('O PDV não devolveu o ID do produto sincronizado.');
    const connection=await this.connection(companyId,true), settings={...DEFAULT_SETTINGS,...this.json(connection.settings,{})} as any;
    await this.upsertLink(companyId,pdvProductId,listing.id,{syncEnabled:listing.syncEnabled===undefined?true:listing.syncEnabled,visible:listing.visible===undefined?listing.status==='PUBLISHED':listing.visible,syncPrice:listing.syncPrice===undefined?settings.syncPrice:listing.syncPrice,syncStock:listing.syncStock===undefined?settings.syncStock:listing.syncStock});
    await this.dataSource.query(`UPDATE pdv_product_links SET "lastSyncedAt"=now(),"lastPiraUpdatedAt"=$3,"lastPdvUpdatedAt"=$4,"remoteSnapshot"=$5::jsonb,"remoteAvailable"=true,"lastDirection"='PIRA_TO_PDV',"conflictState"='NONE',"conflictSnapshot"=NULL,"updatedAt"=now() WHERE "companyId"=$1::uuid AND "pdvProductId"=$2`,[companyId,pdvProductId,listing.updatedAt||new Date(),result?.product?.updatedAt||null,JSON.stringify(result?.product||{})]);
    await this.recordEvent(companyId,'PIRA_TO_PDV','PRODUCT_UPSERT',listing.id,'SUCCESS',{pdvProductId,action:result?.action,matchedBy:result?.matchedBy});
    return {listingId:listing.id,pdvProductId,action:result?.action||'updated',matchedBy:result?.matchedBy||null,product:result?.product||null};
  }

  async pushProducts(uid:string,companyId:string,listingIds?:string[]) {
    await this.identities.integrationCompany(uid, companyId, true);
    const local=await this.localProducts(uid,companyId);
    const selected=Array.isArray(listingIds)&&listingIds.length?new Set(listingIds.map(String)):null;
    const results:any[]=[];
    for(const item of local){ if(selected&&!selected.has(String(item.id))) continue; try{results.push({status:'SYNCED',...(await this.pushProduct(uid,companyId,String(item.id)))});}catch(error:any){results.push({status:'ERROR',listingId:item.id,error:String(error?.message||error)});} }
    return {total:results.length,synced:results.filter(r=>r.status==='SYNCED').length,failed:results.filter(r=>r.status==='ERROR').length,results};
  }

  private async autoSyncTick(){ const rows=await this.dataSource.query(`SELECT "companyId","connectedByUserId",settings FROM pdv_integrations WHERE status='CONNECTED'`); for(const row of rows){ const settings={...DEFAULT_SETTINGS,...this.json(row.settings,{})}; if(settings.automaticSync!==true) continue; try{ await this.sync(String(row.connectedByUserId),String(row.companyId),{},'AUTO'); await this.syncSales(String(row.connectedByUserId),String(row.companyId)); }catch(error:any){ this.logger.warn(`Falha auto-sync PDV ${row.companyId}: ${error?.message||error}`); await this.dataSource.query(`UPDATE pdv_integrations SET "lastError"=$2,"updatedAt"=now() WHERE "companyId"=$1::uuid`,[row.companyId,String(error?.message||error).slice(0,2000)]).catch(()=>undefined); } } }

  private async syncDisposition(companyId:string,link:any,product:any,stockOnly=false){
    if(!link?.listingId||!link.lastSyncedAt) return {status:'APPLY',fields:[] as string[]};
    const lastSync=new Date(link.lastSyncedAt).getTime();
    const remoteTime=product?.updatedAt?new Date(product.updatedAt).getTime():0;
    if(remoteTime&&remoteTime<=lastSync) return {status:'UNCHANGED',fields:[] as string[]};
    const listing=(await this.dataSource.query(`SELECT id,title,description,price,attributes,"catalogConfig","commerceConfig","updatedAt" FROM classified_listings WHERE id=$1::uuid AND "companyId"=$2::uuid LIMIT 1`,[link.listingId,companyId]))[0];
    if(!listing) return {status:'APPLY',fields:[] as string[]};
    const localTime=listing.updatedAt?new Date(listing.updatedAt).getTime():0;
    if(localTime<=lastSync||!remoteTime||remoteTime<=lastSync) return {status:'APPLY',fields:[] as string[]};
    const previous=this.json(link.remoteSnapshot,{});
    const fields=this.localDivergenceFields(listing,previous,link,stockOnly);
    if(!fields.length) return {status:'APPLY',fields};
    const snapshot={detectedAt:new Date().toISOString(),lastSyncedAt:link.lastSyncedAt,fields,local:listing,remote:product,previousRemote:previous};
    await this.dataSource.query(`UPDATE pdv_product_links SET "conflictState"='PENDING',"conflictSnapshot"=$3::jsonb,"updatedAt"=now() WHERE "companyId"=$1::uuid AND "pdvProductId"=$2`,[companyId,String(link.pdvProductId),JSON.stringify(snapshot)]);
    return {status:'CONFLICT',fields};
  }

  private localDivergenceFields(listing:any,previous:any,link:any,stockOnly=false){
    const fields:string[]=[];
    const money=(value:any)=>Number(Number(value??0).toFixed(2));
    const stock=Number(this.json(listing.commerceConfig,{})?.onlineCheckout?.stockQuantity??0);
    if(link.syncStock!==false&&stock!==this.productStock(previous)) fields.push('stock');
    const variantsDiffer=this.variantFingerprintFromListing(listing,link.syncPrice!==false,link.syncStock!==false,stockOnly)!==this.variantFingerprintFromProduct(previous,link.syncPrice!==false,link.syncStock!==false,stockOnly);
    if(variantsDiffer) fields.push('variants');
    if(stockOnly) return fields.filter((field)=>field==='stock'||field==='variants');
    if(String(listing.title||'')!==String(previous?.name||'')) fields.push('title');
    const expectedDescription=String(previous?.description||'Produto sincronizado com o PDV Inteligente.');
    if(String(listing.description||'')!==expectedDescription) fields.push('description');
    if(link.syncPrice!==false&&money(listing.price)!==money(previous?.salePrice??previous?.price??0)) fields.push('price');
    const attrs=this.json(listing.attributes,{});
    for(const [field,remoteKey] of [['sku','sku'],['barcode','barcode'],['brand','brand'],['unit','unit']] as Array<[string,string]>){
      const localValue=attrs[field]??attrs[`pdv${field.charAt(0).toUpperCase()}${field.slice(1)}`]??null;
      if(String(localValue??'')!==String(previous?.[remoteKey]??'')) fields.push(field);
    }
    return [...new Set(fields)];
  }

  private toListingPayload(product:any,settings:any,flags:{syncPrice:boolean;syncStock:boolean;visible:boolean},categorySlug?:string,existingCatalog:any=null) {
    const body:any={
      categorySlug:String(categorySlug||settings.defaultCategorySlug||'outros'),
      listingType:'PRODUCT',
      title:String(product.name||'Produto PDV').slice(0,160),
      description:String(product.description||`Produto sincronizado com o PDV Inteligente.`),
      condition:'NEW',
      attributes:{integrationSource:'PDV_INTELIGENTE',pdvProductId:String(product.id||''),sku:product.sku||null,barcode:product.barcode||null,brand:product.brand||null,unit:product.unit||null},
      status:flags.visible?'PUBLISHED':'DRAFT',
    };
    if(flags.syncPrice) body.price=Number(product.salePrice??product.price??0);
    if(flags.syncStock) body.commerceConfig={onlineCheckout:{stockQuantity:this.productStock(product)}};
    const variants=this.variantCatalogConfig(product,existingCatalog,{syncPrice:flags.syncPrice,syncStock:flags.syncStock});
    body.catalogConfig=variants;
    if(product.image) body.images=[product.image];
    return body;
  }

  private productStock(product:any){
    const variants=Array.isArray(product?.variations)?product.variations:[];
    if(variants.length) return variants.filter((item:any)=>item?.active!==false).reduce((sum:number,item:any)=>sum+Math.max(0,Number(item?.stock||0)),0);
    return Math.max(0,Number(product?.stock||0));
  }

  private variationAttributes(value:any):Record<string,string|number|boolean|null>{
    const parsed=this.json(value,{});
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)) return {};
    const output:Record<string,string|number|boolean|null>={};
    for(const [key,item] of Object.entries(parsed).slice(0,20)){
      if(item===null||typeof item==='string'||typeof item==='number'||typeof item==='boolean') output[String(key).slice(0,80)]=item as any;
    }
    return output;
  }

  private variantLabel(variation:any,attributes:Record<string,any>){
    const values=Object.values(attributes).map((value)=>String(value??'').trim()).filter(Boolean);
    return (values.length?values.join(' · '):String(variation?.name||variation?.sku||'Variação')).slice(0,120);
  }

  private variantCatalogConfig(product:any,existingCatalog:any=null,flags:{syncPrice:boolean;syncStock:boolean}={syncPrice:true,syncStock:true}){
    const variants=Array.isArray(product?.variations)?product.variations:[];
    const existingGroups=Array.isArray(existingCatalog?.optionGroups)?existingCatalog.optionGroups:[];
    const existingGroup=existingGroups.find((item:any)=>String(item?.id)==='pdv-variants');
    const otherGroups=existingGroups.filter((item:any)=>String(item?.id)!=='pdv-variants');
    const existingOptions=Array.isArray(existingGroup?.options)?existingGroup.options:[];
    if(!variants.length){
      if(!otherGroups.length) return null;
      return {...(existingCatalog&&typeof existingCatalog==='object'?existingCatalog:{}),optionGroups:otherGroups};
    }
    const pdvGroup={
      id:'pdv-variants',name:'Variação',kind:'VARIANT',selectionType:'SINGLE',minSelections:1,maxSelections:1,pricingStrategy:'BASE',
      options:variants.map((variation:any)=>{
        const id=String(variation?.id||'');
        const attributes=this.variationAttributes(variation?.variationAttributes);
        const existing=existingOptions.find((item:any)=>String(item?.externalProductId||item?.id||'')===id);
        const remotePrice=Math.max(0,Number(variation?.salePrice??variation?.price??product?.salePrice??0));
        const remoteStock=Math.max(0,Number(variation?.stock||0));
        return {
          ...(existing||{}),id,externalProductId:id,label:this.variantLabel(variation,attributes),
          ...(variation?.sku?{sku:String(variation.sku)}:{sku:undefined}),...(variation?.barcode?{barcode:String(variation.barcode)}:{barcode:undefined}),
          price:flags.syncPrice||existing?.price===undefined?remotePrice:Number(existing.price),
          stockQuantity:flags.syncStock||existing?.stockQuantity===undefined?remoteStock:existing.stockQuantity,
          attributes,active:variation?.active!==false,
        };
      }).filter((item:any)=>item.id),
    };
    return {...(existingCatalog&&typeof existingCatalog==='object'?existingCatalog:{}),pricingStrategy:'BASE',optionGroups:[...otherGroups,pdvGroup]};
  }

  private piraVariants(catalog:any){
    const group=Array.isArray(catalog?.optionGroups)?catalog.optionGroups.find((item:any)=>String(item?.id)==='pdv-variants'):null;
    const options=Array.isArray(group?.options)?group.options:[];
    return options.map((option:any)=>({
      pdvProductId:String(option?.externalProductId||option?.id||''),name:String(option?.label||'Variação'),sku:option?.sku||undefined,barcode:option?.barcode||undefined,
      salePrice:Math.max(0,Number(option?.price||0)),stock:Math.max(0,Number(option?.stockQuantity||0)),variationAttributes:option?.attributes||{},active:option?.active!==false,
    })).filter((item:any)=>item.pdvProductId||item.sku||item.barcode);
  }

  private variantComparable(options:any[],includePrice:boolean,includeStock:boolean,stockOnly=false){
    return options.map((option:any)=>({
      id:String(option?.externalProductId||option?.id||''),
      ...(stockOnly?{}:{label:String(option?.label||''),sku:String(option?.sku||''),barcode:String(option?.barcode||''),attributes:option?.attributes||{},active:option?.active!==false}),
      ...(includePrice&&!stockOnly?{price:Number(option?.price||0)}:{}),
      ...(includeStock?{stockQuantity:Math.max(0,Number(option?.stockQuantity||0))}:{}),
    })).sort((a:any,b:any)=>a.id.localeCompare(b.id));
  }
  private variantFingerprintFromProduct(product:any,includePrice=true,includeStock=true,stockOnly=false){
    const config=this.variantCatalogConfig(product,null,{syncPrice:true,syncStock:true});
    return this.hash(this.stableJson(this.variantComparable(config?.optionGroups?.[0]?.options||[],includePrice,includeStock,stockOnly)));
  }
  private variantFingerprintFromListing(listing:any,includePrice=true,includeStock=true,stockOnly=false){
    const catalog=this.json(listing?.catalogConfig,{}); const group=Array.isArray(catalog?.optionGroups)?catalog.optionGroups.find((item:any)=>String(item?.id)==='pdv-variants'):null;
    return this.hash(this.stableJson(this.variantComparable(Array.isArray(group?.options)?group.options:[],includePrice,includeStock,stockOnly)));
  }

  private normalizeLabel(value:any){ return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' '); }
  private async resolveCategorySlug(companyId:string,product:any,settings:any){
    const pdvCategoryId=String(product?.categoryId||product?.category?.id||'').trim();
    if(!pdvCategoryId) return String(settings.defaultCategorySlug||'outros');
    const existing=(await this.dataSource.query(`SELECT "categorySlug" FROM pdv_category_links WHERE "companyId"=$1::uuid AND "pdvCategoryId"=$2 LIMIT 1`,[companyId,pdvCategoryId]))[0];
    if(existing?.categorySlug) return String(existing.categorySlug);
    const remoteName=this.normalizeLabel(product?.category?.name);
    if(remoteName){
      const locals=await this.dataSource.query(`SELECT slug,name FROM classified_categories WHERE "isActive"=true`);
      const exact=locals.find((item:any)=>this.normalizeLabel(item.name)===remoteName);
      if(exact){ await this.upsertCategoryLink(companyId,pdvCategoryId,String(exact.slug),product?.category||{id:pdvCategoryId,name:product?.category?.name}); return String(exact.slug); }
    }
    return String(settings.defaultCategorySlug||'outros');
  }
  private async resolvePdvCategoryId(companyId:string,categorySlug:string){
    if(!categorySlug) return undefined;
    const existing=(await this.dataSource.query(`SELECT "pdvCategoryId" FROM pdv_category_links WHERE "companyId"=$1::uuid AND "categorySlug"=$2 ORDER BY "updatedAt" DESC LIMIT 1`,[companyId,categorySlug]))[0];
    if(existing?.pdvCategoryId) return String(existing.pdvCategoryId);
    try{
      const local=(await this.dataSource.query(`SELECT name FROM classified_categories WHERE slug=$1 LIMIT 1`,[categorySlug]))[0];
      const remote=await this.remoteCategories(companyId); const name=this.normalizeLabel(local?.name);
      const exact=remote.find((item:any)=>this.normalizeLabel(item?.name)===name);
      if(exact?.id){ await this.upsertCategoryLink(companyId,String(exact.id),categorySlug,exact); return String(exact.id); }
    }catch{}
    return undefined;
  }
  private async upsertCategoryLink(companyId:string,pdvCategoryId:string,categorySlug:string,remote:any){
    await this.dataSource.query(`INSERT INTO pdv_category_links(id,"companyId","pdvCategoryId","categorySlug","remoteSnapshot") VALUES($1,$2::uuid,$3,$4,$5::jsonb) ON CONFLICT ("companyId","pdvCategoryId") DO UPDATE SET "categorySlug"=EXCLUDED."categorySlug","remoteSnapshot"=EXCLUDED."remoteSnapshot","updatedAt"=now()`,[randomUUID(),companyId,pdvCategoryId,categorySlug,JSON.stringify(remote||{})]);
  }
  private async remoteCategories(companyId:string){ const value=await this.pdvJson(companyId,'/integrations/piranegocios/categories'); return Array.isArray(value)?value:[]; }


  private async findExistingMatch(companyId:string,product:any){ const sku=String(product.sku||'').trim(),barcode=String(product.barcode||'').trim(); if(!sku&&!barcode) return null; const rows=await this.dataSource.query(`SELECT id,title FROM classified_listings WHERE "companyId"=$1::uuid AND "listingType"='PRODUCT' AND status<>'ARCHIVED' AND ((NULLIF($2,'') IS NOT NULL AND (attributes->>'sku'=$2 OR attributes->>'pdvSku'=$2)) OR (NULLIF($3,'') IS NOT NULL AND (attributes->>'barcode'=$3 OR attributes->>'pdvBarcode'=$3))) ORDER BY "updatedAt" DESC LIMIT 2`,[companyId,sku,barcode]); return rows.length===1?rows[0]:null; }
  private async upsertLink(companyId:string,pdvProductId:string,listingId:string,opts:any){ await this.dataSource.query(`INSERT INTO pdv_product_links(id,"companyId","pdvProductId","listingId","syncEnabled",visible,"syncPrice","syncStock") VALUES($1,$2::uuid,$3,$4::uuid,$5,$6,$7,$8) ON CONFLICT ("companyId","pdvProductId") DO UPDATE SET "listingId"=EXCLUDED."listingId","syncEnabled"=EXCLUDED."syncEnabled",visible=EXCLUDED.visible,"syncPrice"=EXCLUDED."syncPrice","syncStock"=EXCLUDED."syncStock","remoteAvailable"=true,"updatedAt"=now()`,[randomUUID(),companyId,pdvProductId,listingId,opts.syncEnabled===undefined?true:Boolean(opts.syncEnabled),opts.visible===undefined?true:Boolean(opts.visible),opts.syncPrice===undefined?true:Boolean(opts.syncPrice),opts.syncStock===undefined?true:Boolean(opts.syncStock)]); }
  private async remoteProduct(companyId:string,pdvProductId:string){ return this.pdvJson(companyId,`/integrations/piranegocios/products/${encodeURIComponent(pdvProductId)}`); }
  private async remoteProducts(companyId:string){ const value=await this.pdvJson(companyId,'/integrations/piranegocios/products'); return Array.isArray(value)?value:[]; }
  private async pdvJson(companyId:string,path:string,init:RequestInit={}){ const connection=await this.ensureFreshToken(await this.connection(companyId,true)); const headers:any={...(init.headers||{}),Authorization:`Bearer ${this.decrypt(connection.accessTokenEncrypted)}`,'Content-Type':'application/json'}; return this.httpJson(`${connection.pdvBaseUrl}${path}`,{...init,headers}); }
  private async ensureFreshToken(connection:any){ if(new Date(connection.accessExpiresAt).getTime()>Date.now()+60000) return connection; const resource=`${connection.pdvBaseUrl}/integrations/piranegocios`; const token=await this.httpJson(`${connection.pdvBaseUrl}/oauth/piranegocios/token`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'refresh_token',refresh_token:this.decrypt(connection.refreshTokenEncrypted),client_id:connection.clientId,resource})}); await this.dataSource.query(`UPDATE pdv_integrations SET "accessTokenEncrypted"=$2,"refreshTokenEncrypted"=$3,"accessExpiresAt"=$4,scopes=$5::jsonb,"updatedAt"=now() WHERE id=$1::uuid`,[connection.id,this.encrypt(String(token.access_token)),this.encrypt(String(token.refresh_token)),new Date(Date.now()+Number(token.expires_in||3600)*1000),JSON.stringify(String(token.scope||'').split(/\s+/).filter((s:string)=>s&&s!=='offline_access'))]); return (await this.dataSource.query(`SELECT * FROM pdv_integrations WHERE id=$1::uuid`,[connection.id]))[0]; }
  private async connection(companyId:string,required=true){ const row=(await this.dataSource.query(`SELECT * FROM pdv_integrations WHERE "companyId"=$1::uuid LIMIT 1`,[companyId]))[0]; if(required&&(!row||row.status!=='CONNECTED')) throw new BadRequestException('Conecte o PDV Inteligente antes de sincronizar.'); return row||null; }
  private normalizeBase(raw:unknown){ const text=String(raw||process.env.PDV_INTEGRATION_BASE_URL||DEFAULT_PDV).trim().replace(/\/+$/,''); let url:URL; try{url=new URL(text);}catch{throw new BadRequestException('URL do PDV inválida.');} if(url.protocol!=='https:' && !(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))) throw new BadRequestException('Use uma URL HTTPS para o PDV.'); return url.toString().replace(/\/+$/,''); }
  private async httpJson(url:string,init:RequestInit={}){ let response:Response; try{response=await fetch(url,init);}catch(error:any){throw new ServiceUnavailableException(`Não foi possível acessar o PDV: ${error?.message||error}`);} const text=await response.text(); let payload:any={}; try{payload=text?JSON.parse(text):{};}catch{payload={message:text};} if(!response.ok) throw new ServiceUnavailableException(payload?.message||`PDV respondeu HTTP ${response.status}.`); return payload; }
  private encryptionKey(){ const secret=String(process.env.PDV_INTEGRATION_ENCRYPTION_KEY||process.env.JWT_SECRET||'').trim(); if(!secret) throw new ServiceUnavailableException('Configure PDV_INTEGRATION_ENCRYPTION_KEY antes de usar a integração.'); return createHash('sha256').update(secret).digest(); }
  private encrypt(value:string){ const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.encryptionKey(),iv); const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]); return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`; }
  private decrypt(value:string){ const [ivRaw,tagRaw,dataRaw]=String(value||'').split('.'); if(!ivRaw||!tagRaw||!dataRaw) throw new ServiceUnavailableException('Credencial do PDV inválida.'); const decipher=createDecipheriv('aes-256-gcm',this.encryptionKey(),Buffer.from(ivRaw,'base64url')); decipher.setAuthTag(Buffer.from(tagRaw,'base64url')); return Buffer.concat([decipher.update(Buffer.from(dataRaw,'base64url')),decipher.final()]).toString('utf8'); }
  private header(headers:Record<string,string|string[]|undefined>,name:string){ const value=headers[name]??headers[name.toLowerCase()]??headers[name.toUpperCase()]; return Array.isArray(value)?String(value[0]||''):String(value||''); }
  private stableJson(value:any):string{ if(value===null||value===undefined)return JSON.stringify(value??null); if(Array.isArray(value))return `[${value.map((item)=>this.stableJson(item)).join(',')}]`; if(typeof value==='object'){ const entries=Object.entries(value).sort(([a],[b])=>a.localeCompare(b)); return `{${entries.map(([key,item])=>`${JSON.stringify(key)}:${this.stableJson(item)}`).join(',')}}`; } return JSON.stringify(value); }
  private webhookSignature(secret:string,timestamp:string,eventId:string,eventType:string,data:any){ const digest=this.hash(this.stableJson(data)); return createHmac('sha256',secret).update(`${timestamp}.${eventId}.${eventType}.${digest}`).digest('hex'); }
  private safeEqual(a:string,b:string){ const left=Buffer.from(a),right=Buffer.from(b); return left.length===right.length&&timingSafeEqual(left,right); }
  private hash(value:string){return createHash('sha256').update(value).digest('hex');}
  private json(value:any,fallback:any){ if(value===null||value===undefined)return fallback; if(typeof value==='object')return value; try{return JSON.parse(value);}catch{return fallback;} }
  private async recordEvent(companyId:string,direction:string,kind:string,externalId:string|null,status:string,payload:any,error?:string){ await this.dataSource.query(`INSERT INTO pdv_integration_events(id,"companyId",direction,kind,"externalId",status,payload,error) VALUES($1,$2::uuid,$3,$4,$5,$6,$7::jsonb,$8)`,[randomUUID(),companyId,direction,kind,externalId,status,JSON.stringify(payload||{}),error||null]).catch(()=>undefined); }
}
