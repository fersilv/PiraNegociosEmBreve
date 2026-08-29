import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { MercadoPagoProviderConfig, PaymentProviderConfigService } from '../payments/payment-provider-config.service';
import { PaymentProviderVaultService } from '../payments/payment-provider-vault.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsMarketplaceTermsService } from './classifieds-marketplace-terms.service';

type MercadoPagoSellerCredentials = {accessToken:string;refreshToken?:string|null;publicKey?:string|null;tokenType?:string|null;userId?:string|null;scope?:string|null;obtainedAt:string};

@Injectable()
export class ClassifiedsMarketplacePaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: ClassifiedsIdentityService,
    private readonly providerConfig: PaymentProviderConfigService,
    private readonly vault: PaymentProviderVaultService,
    private readonly terms: ClassifiedsMarketplaceTermsService,
  ) {}

  async connections(uid:string){const identity=await this.identities.active(uid);if(identity.type!=='COMPANY')return[];return this.dataSource.query(`SELECT provider,status,"externalUserId",scopes,"tokenExpiresAt","connectedAt","lastRefreshedAt","updatedAt" FROM company_classified_payment_connections WHERE "companyId"=$1 ORDER BY provider`,[identity.company!.id]).catch(()=>[])}

  async startMercadoPago(uid:string){
    const identity=await this.assertVerifiedCompany(uid);await this.terms.assertAccepted(uid,'ONLINE_PAYMENT_SELLER');
    const marketplace=await this.marketplaceConfig();
    const state=randomBytes(32).toString('base64url');const codeVerifier=randomBytes(48).toString('base64url');const codeChallenge=createHash('sha256').update(codeVerifier).digest('base64url');
    await this.dataSource.query(`DELETE FROM company_classified_payment_oauth_states WHERE "expiresAt"<=now() OR "usedAt" IS NOT NULL`).catch(()=>undefined);
    await this.dataSource.query(`INSERT INTO company_classified_payment_oauth_states("companyId","userId",provider,"stateHash","codeVerifierEncrypted","expiresAt") VALUES ($1,$2,'MERCADO_PAGO',$3,$4,now()+interval '15 minutes')`,[identity.company!.id,uid,this.hash(state),this.vault.encrypt({codeVerifier})]);
    const url=new URL('https://auth.mercadopago.com.br/authorization');url.searchParams.set('client_id',marketplace.clientId);url.searchParams.set('response_type','code');url.searchParams.set('platform_id','mp');url.searchParams.set('redirect_uri',marketplace.redirectUri);url.searchParams.set('state',state);url.searchParams.set('scope','offline_access');url.searchParams.set('code_challenge',codeChallenge);url.searchParams.set('code_challenge_method','S256');
    return{provider:'MERCADO_PAGO',authorizationUrl:url.toString(),pkce:true};
  }

  async completeMercadoPago(uid:string,stateRaw:unknown,codeRaw:unknown){
    const identity=await this.assertVerifiedCompany(uid);await this.terms.assertAccepted(uid,'ONLINE_PAYMENT_SELLER');const state=String(stateRaw||'').trim();const code=String(codeRaw||'').trim();if(!state||!code)throw new BadRequestException('Autorização Mercado Pago incompleta.');
    const rows=await this.dataSource.query(`SELECT * FROM company_classified_payment_oauth_states WHERE "stateHash"=$1 AND "companyId"=$2 AND "userId"=$3 AND provider='MERCADO_PAGO' AND "usedAt" IS NULL AND "expiresAt">now() LIMIT 1`,[this.hash(state),identity.company!.id,uid]);const oauth=rows[0];if(!oauth)throw new BadRequestException('Autorização Mercado Pago inválida ou expirada.');if(!oauth.codeVerifierEncrypted)throw new BadRequestException('Autorização sem PKCE. Inicie a conexão novamente.');
    const verifier=this.vault.decrypt<{codeVerifier?:string}>(oauth.codeVerifierEncrypted).codeVerifier;if(!verifier)throw new BadRequestException('Verificador PKCE inválido.');
    const token=await this.exchangeMercadoPagoCode(code,verifier);const expiresIn=Number(token.expires_in||0);const tokenExpiresAt=expiresIn>0?new Date(Date.now()+expiresIn*1000):null;
    let externalUserName: string | null = null;
    let externalUserEmail: string | null = null;
    try {
      const userRes = await fetch('https://api.mercadopago.com/users/me', { headers: { authorization: `Bearer ${token.access_token}` } });
      if (userRes.ok) {
        const userData = await userRes.json();
        externalUserEmail = userData.email || null;
        externalUserName = [userData.first_name, userData.last_name].filter(Boolean).join(' ') || null;
      }
    } catch (e) {
      // Ignora erro de fetch, dados opcionais
    }
    const credentials:MercadoPagoSellerCredentials={accessToken:String(token.access_token||''),refreshToken:token.refresh_token?String(token.refresh_token):null,publicKey:token.public_key?String(token.public_key):null,tokenType:token.token_type?String(token.token_type):null,userId:token.user_id==null?null:String(token.user_id),scope:token.scope?String(token.scope):null,obtainedAt:new Date().toISOString()};if(!credentials.accessToken)throw new ServiceUnavailableException('Mercado Pago não retornou credencial válida.');
    await this.dataSource.transaction(async manager=>{await manager.query(`INSERT INTO company_classified_payment_connections("companyId",provider,status,"externalUserId","encryptedCredentials",scopes,"tokenExpiresAt","connectedByUserId","connectedAt","lastRefreshedAt","externalUserName","externalUserEmail") VALUES ($1,'MERCADO_PAGO','CONNECTED',$2,$3,$4,$5,$6,now(),now(),$7,$8) ON CONFLICT ("companyId",provider) DO UPDATE SET status='CONNECTED',"externalUserId"=EXCLUDED."externalUserId","externalUserName"=EXCLUDED."externalUserName","externalUserEmail"=EXCLUDED."externalUserEmail","encryptedCredentials"=EXCLUDED."encryptedCredentials",scopes=EXCLUDED.scopes,"tokenExpiresAt"=EXCLUDED."tokenExpiresAt","connectedByUserId"=EXCLUDED."connectedByUserId","connectedAt"=now(),"lastRefreshedAt"=now(),"updatedAt"=now()`,[identity.company!.id,credentials.userId,this.vault.encrypt(credentials as unknown as Record<string,unknown>),credentials.scope,tokenExpiresAt,uid,externalUserName,externalUserEmail]);await manager.query(`UPDATE company_classified_payment_oauth_states SET "usedAt"=now(),"codeVerifierEncrypted"=NULL WHERE id=$1`,[oauth.id])});
    return{connected:true,provider:'MERCADO_PAGO',externalUserId:credentials.userId,tokenExpiresAt,pkce:true};
  }

  async disconnectMercadoPago(uid:string){const identity=await this.assertVerifiedCompany(uid);const companyId=identity.company!.id;await this.dataSource.transaction(async manager=>{await manager.query(`UPDATE company_classified_payment_connections SET status='REVOKED',"updatedAt"=now() WHERE "companyId"=$1 AND provider='MERCADO_PAGO'`,[companyId]);await manager.query(`UPDATE classified_listings SET "commerceConfig"=COALESCE("commerceConfig",'{}'::jsonb)||jsonb_build_object('onlineCheckout',COALESCE("commerceConfig"->'onlineCheckout','{}'::jsonb)||'{"enabled":false}'::jsonb),"updatedAt"=now() WHERE "companyId"=$1 AND COALESCE(("commerceConfig"->'onlineCheckout'->>'enabled')::boolean,false)=true`,[companyId]);await manager.query(`UPDATE classified_auctions SET "onlinePaymentEnabled"=false,"updatedAt"=now() WHERE "companyId"=$1 AND "onlinePaymentEnabled"=true AND "settlementPaymentStatus" NOT IN ('PENDING','IN_PROCESS','APPROVED')`,[companyId]).catch(()=>undefined)});return{disconnected:true}}

  async sellerMercadoPagoCredentials(companyId:string){const rows=await this.dataSource.query(`SELECT * FROM company_classified_payment_connections WHERE "companyId"=$1 AND provider='MERCADO_PAGO' AND status='CONNECTED' LIMIT 1`,[companyId]);const connection=rows[0];if(!connection)throw new BadRequestException('A empresa não possui Mercado Pago conectado.');let credentials=this.vault.decrypt<MercadoPagoSellerCredentials>(connection.encryptedCredentials);if(!credentials.accessToken)throw new BadRequestException('A conexão Mercado Pago está sem access token válido.');const expiresAt=connection.tokenExpiresAt?new Date(connection.tokenExpiresAt).getTime():0;if(expiresAt&&expiresAt-Date.now()<=7*24*60*60*1000){if(!credentials.refreshToken){await this.markConnectionError(connection.id);throw new BadRequestException('A autorização Mercado Pago precisa ser renovada pela empresa.')}credentials=await this.refreshMercadoPago(connection,credentials)}return credentials}

  private async refreshMercadoPago(connection:any,current:MercadoPagoSellerCredentials){const marketplace=await this.marketplaceConfig();const response=await fetch('https://api.mercadopago.com/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',accept:'application/json'},body:new URLSearchParams({client_id:marketplace.clientId,client_secret:marketplace.clientSecret,grant_type:'refresh_token',refresh_token:String(current.refreshToken||'')}),signal:AbortSignal.timeout(20000)});const text=await response.text();if(!response.ok){await this.markConnectionError(connection.id);throw new ServiceUnavailableException(`Não foi possível renovar a autorização Mercado Pago (${response.status}).`)}let token:any;try{token=JSON.parse(text||'{}')}catch{throw new ServiceUnavailableException('Resposta de renovação inválida do Mercado Pago.')}const refreshed:MercadoPagoSellerCredentials={accessToken:String(token.access_token||current.accessToken||''),refreshToken:token.refresh_token?String(token.refresh_token):current.refreshToken||null,publicKey:token.public_key?String(token.public_key):current.publicKey||null,tokenType:token.token_type?String(token.token_type):current.tokenType||null,userId:token.user_id==null?current.userId||null:String(token.user_id),scope:token.scope?String(token.scope):current.scope||null,obtainedAt:new Date().toISOString()};const expiresIn=Number(token.expires_in||0);const tokenExpiresAt=expiresIn>0?new Date(Date.now()+expiresIn*1000):null;await this.dataSource.query(`UPDATE company_classified_payment_connections SET "encryptedCredentials"=$2,"externalUserId"=$3,scopes=$4,"tokenExpiresAt"=$5,"lastRefreshedAt"=now(),status='CONNECTED',"updatedAt"=now() WHERE id=$1`,[connection.id,this.vault.encrypt(refreshed as unknown as Record<string,unknown>),refreshed.userId,refreshed.scope,tokenExpiresAt]);return refreshed}

  private async exchangeMercadoPagoCode(code:string,codeVerifier:string){const marketplace=await this.marketplaceConfig();const response=await fetch('https://api.mercadopago.com/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',accept:'application/json'},body:new URLSearchParams({client_id:marketplace.clientId,client_secret:marketplace.clientSecret,grant_type:'authorization_code',code,redirect_uri:marketplace.redirectUri,code_verifier:codeVerifier}),signal:AbortSignal.timeout(20000)});const text=await response.text();if(!response.ok)throw new ServiceUnavailableException(`Mercado Pago recusou a conexão (${response.status}).`);try{return JSON.parse(text||'{}')}catch{throw new ServiceUnavailableException('Resposta OAuth inválida do Mercado Pago.')}}

  private async marketplaceConfig(){const config=await this.providerConfig.getSecretConfig<MercadoPagoProviderConfig>('MERCADO_PAGO').catch(()=>({} as MercadoPagoProviderConfig));const clientId=String(config.marketplaceClientId||process.env.MERCADO_PAGO_MARKETPLACE_CLIENT_ID||'').trim();const clientSecret=String(config.marketplaceClientSecret||process.env.MERCADO_PAGO_MARKETPLACE_CLIENT_SECRET||'').trim();const redirectUri=String(config.marketplaceRedirectUri||process.env.MERCADO_PAGO_MARKETPLACE_REDIRECT_URI||'').trim();if(!clientId||!clientSecret||!redirectUri)throw new ServiceUnavailableException('Marketplace Mercado Pago incompleto. Configure Client ID, Client Secret e Redirect URI em Admin → Pagamentos → Formas de pagamento → Mercado Pago.');return{clientId,clientSecret,redirectUri}}
  private async markConnectionError(id:string){await this.dataSource.query(`UPDATE company_classified_payment_connections SET status='ERROR',"updatedAt"=now() WHERE id=$1`,[id]).catch(()=>undefined)}
  private async assertVerifiedCompany(uid:string){const identity=await this.identities.active(uid);if(identity.type!=='COMPANY')throw new ForbiddenException('Recebimento online é exclusivo do workspace Business.');if(!(identity.company!.isVerified||identity.company!.verificationStatus==='VERIFIED'))throw new ForbiddenException('Somente empresas verificadas podem conectar pagamentos.');return identity}
  private hash(value:string){return createHash('sha256').update(value).digest('hex')}
}
