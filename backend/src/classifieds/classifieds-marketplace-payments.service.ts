import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { PaymentProviderVaultService } from '../payments/payment-provider-vault.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';

@Injectable()
export class ClassifiedsMarketplacePaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: ClassifiedsIdentityService,
    private readonly vault: PaymentProviderVaultService,
  ) {}

  async connections(uid: string) {
    const identity = await this.identities.active(uid);
    if (identity.type !== 'COMPANY') return [];
    return this.dataSource.query(
      `SELECT provider,status,"externalUserId",scopes,"tokenExpiresAt","connectedAt","lastRefreshedAt","updatedAt"
       FROM company_classified_payment_connections WHERE "companyId" = $1 ORDER BY provider`,
      [identity.company!.id],
    ).catch(() => []);
  }

  async startMercadoPago(uid: string) {
    const identity = await this.assertVerifiedCompany(uid);
    const clientId = this.env('MERCADO_PAGO_MARKETPLACE_CLIENT_ID');
    const redirectUri = this.env('MERCADO_PAGO_MARKETPLACE_REDIRECT_URI');
    const state = randomBytes(32).toString('base64url');
    await this.dataSource.query(
      `INSERT INTO company_classified_payment_oauth_states
       ("companyId","userId",provider,"stateHash","expiresAt")
       VALUES ($1,$2,'MERCADO_PAGO',$3,now() + interval '15 minutes')`,
      [identity.company!.id, uid, this.hash(state)],
    );
    const url = new URL('https://auth.mercadopago.com.br/authorization');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('platform_id', 'mp');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'offline_access');
    return { provider: 'MERCADO_PAGO', authorizationUrl: url.toString() };
  }

  async completeMercadoPago(uid: string, stateRaw: unknown, codeRaw: unknown) {
    const identity = await this.assertVerifiedCompany(uid);
    const state = String(stateRaw || '').trim();
    const code = String(codeRaw || '').trim();
    if (!state || !code) throw new BadRequestException('Autorização Mercado Pago incompleta.');
    const rows = await this.dataSource.query(
      `SELECT * FROM company_classified_payment_oauth_states
       WHERE "stateHash" = $1 AND "companyId" = $2 AND "userId" = $3
         AND provider = 'MERCADO_PAGO' AND "usedAt" IS NULL AND "expiresAt" > now()
       LIMIT 1`,
      [this.hash(state), identity.company!.id, uid],
    );
    if (!rows[0]) throw new BadRequestException('Autorização Mercado Pago inválida ou expirada.');

    const token = await this.exchangeMercadoPagoCode(code);
    const expiresIn = Number(token.expires_in || 0);
    const tokenExpiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null;
    const encrypted = this.vault.encrypt({
      accessToken: String(token.access_token || ''),
      refreshToken: token.refresh_token ? String(token.refresh_token) : null,
      publicKey: token.public_key ? String(token.public_key) : null,
      tokenType: token.token_type ? String(token.token_type) : null,
      userId: token.user_id == null ? null : String(token.user_id),
      scope: token.scope ? String(token.scope) : null,
      obtainedAt: new Date().toISOString(),
    });
    if (!String(token.access_token || '')) throw new ServiceUnavailableException('Mercado Pago não retornou credencial válida.');

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO company_classified_payment_connections
         ("companyId",provider,status,"externalUserId","encryptedCredentials",scopes,"tokenExpiresAt","connectedByUserId","connectedAt","lastRefreshedAt")
         VALUES ($1,'MERCADO_PAGO','CONNECTED',$2,$3,$4,$5,$6,now(),now())
         ON CONFLICT ("companyId",provider) DO UPDATE SET
           status='CONNECTED',"externalUserId"=EXCLUDED."externalUserId",
           "encryptedCredentials"=EXCLUDED."encryptedCredentials",scopes=EXCLUDED.scopes,
           "tokenExpiresAt"=EXCLUDED."tokenExpiresAt","connectedByUserId"=EXCLUDED."connectedByUserId",
           "connectedAt"=now(),"lastRefreshedAt"=now(),"updatedAt"=now()`,
        [identity.company!.id, token.user_id == null ? null : String(token.user_id), encrypted, token.scope || null, tokenExpiresAt, uid],
      );
      await manager.query(`UPDATE company_classified_payment_oauth_states SET "usedAt" = now() WHERE id = $1`, [rows[0].id]);
    });
    return { connected: true, provider: 'MERCADO_PAGO', externalUserId: token.user_id == null ? null : String(token.user_id), tokenExpiresAt };
  }

  async disconnectMercadoPago(uid: string) {
    const identity = await this.assertVerifiedCompany(uid);
    await this.dataSource.query(
      `UPDATE company_classified_payment_connections SET status='REVOKED',"updatedAt"=now()
       WHERE "companyId"=$1 AND provider='MERCADO_PAGO'`,
      [identity.company!.id],
    );
    return { disconnected: true };
  }

  private async exchangeMercadoPagoCode(code: string) {
    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        client_id: this.env('MERCADO_PAGO_MARKETPLACE_CLIENT_ID'),
        client_secret: this.env('MERCADO_PAGO_MARKETPLACE_CLIENT_SECRET'),
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.env('MERCADO_PAGO_MARKETPLACE_REDIRECT_URI'),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    if (!response.ok) throw new ServiceUnavailableException(`Mercado Pago recusou a conexão (${response.status}).`);
    try { return JSON.parse(text || '{}'); } catch { throw new ServiceUnavailableException('Resposta OAuth inválida do Mercado Pago.'); }
  }

  private async assertVerifiedCompany(uid: string) {
    const identity = await this.identities.active(uid);
    if (identity.type !== 'COMPANY') throw new ForbiddenException('Recebimento online é exclusivo do workspace Business.');
    if (!(identity.company!.isVerified || identity.company!.verificationStatus === 'VERIFIED')) {
      throw new ForbiddenException('Somente empresas verificadas podem conectar pagamentos.');
    }
    return identity;
  }

  private env(name: string) {
    const value = String(process.env[name] || '').trim();
    if (!value) throw new ServiceUnavailableException(`Integração de marketplace incompleta: configure ${name}.`);
    return value;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
