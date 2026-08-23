import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { PaymentProviderVaultService } from './payment-provider-vault.service';

export type PaymentProviderCode = 'EFI' | 'MERCADO_PAGO';

export interface EfiProviderConfig extends Record<string, unknown> {
  clientId?: string;
  clientSecret?: string;
  pixKey?: string;
  sandbox?: boolean;
  certificateBase64?: string;
  certificateFileName?: string;
  certificatePassphrase?: string;
  pixAutomaticEnabled?: boolean;
  receiverAgency?: string;
  receiverAccount?: string;
  receiverAccountType?: 'CORRENTE' | 'POUPANCA' | 'PAGAMENTO';
  publicApiBaseUrl?: string;
  webhookSecret?: string;
  skipMtlsChecking?: boolean;
  expirationSeconds?: number;
}

export interface MercadoPagoProviderConfig extends Record<string, unknown> {
  accessToken?: string;
  publicKey?: string;
  webhookSecret?: string;
  publicApiBaseUrl?: string;
}

@Injectable()
export class PaymentProviderConfigService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly vault: PaymentProviderVaultService,
  ) {}

  private normalizeCode(value: string): PaymentProviderCode {
    const code = String(value || '').trim().toUpperCase();
    if (!['EFI', 'MERCADO_PAGO'].includes(code)) {
      throw new BadRequestException('Forma de pagamento não suportada.');
    }
    return code as PaymentProviderCode;
  }

  private text(value: unknown, max = 4000) {
    if (value === undefined) return undefined;
    if (value === null) return '';
    return String(value).trim().slice(0, max);
  }

  private bool(value: unknown, current = false) {
    return value === undefined ? current : value === true;
  }

  private publicApiBaseUrl(value: unknown, current?: string) {
    if (value === undefined) return current;
    const raw = String(value || '').trim().replace(/\/$/, '');
    if (!raw) return '';
    let parsed: URL;
    try { parsed = new URL(raw); } catch { throw new BadRequestException('URL pública da API inválida.'); }
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new BadRequestException('A URL pública precisa usar HTTP ou HTTPS.');
    if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
      throw new BadRequestException('Em produção, a URL pública da API precisa usar HTTPS.');
    }
    return raw;
  }

  private certificateFromInput(input: Record<string, unknown>, current: EfiProviderConfig) {
    if (input.removeCertificate === true) {
      return { certificateBase64: '', certificateFileName: '', certificatePassphrase: '' };
    }
    if (input.certificateBase64 === undefined) {
      return {
        certificateBase64: current.certificateBase64 || '',
        certificateFileName: current.certificateFileName || '',
        certificatePassphrase: input.certificatePassphrase === undefined
          ? current.certificatePassphrase || ''
          : this.text(input.certificatePassphrase, 500) || '',
      };
    }

    const fileName = this.text(input.certificateFileName, 240) || 'certificado.p12';
    if (!/\.(p12|pfx)$/i.test(fileName)) {
      throw new BadRequestException('O certificado Efí precisa ser um arquivo .p12 ou .pfx.');
    }
    const raw = String(input.certificateBase64 || '').trim();
    const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
    let bytes: Buffer;
    try { bytes = Buffer.from(base64.replace(/\s+/g, ''), 'base64'); } catch { bytes = Buffer.alloc(0); }
    if (!bytes.length) throw new BadRequestException('O certificado enviado está vazio ou inválido.');
    if (bytes.length > 5 * 1024 * 1024) throw new BadRequestException('O certificado excede o limite de 5 MB.');
    return {
      certificateBase64: bytes.toString('base64'),
      certificateFileName: fileName,
      certificatePassphrase: this.text(input.certificatePassphrase, 500) || '',
    };
  }

  private sanitizeEfi(input: Record<string, unknown>, current: EfiProviderConfig): EfiProviderConfig {
    const certificate = this.certificateFromInput(input, current);
    const typeRaw = input.receiverAccountType === undefined
      ? String(current.receiverAccountType || 'PAGAMENTO')
      : String(input.receiverAccountType || 'PAGAMENTO').toUpperCase();
    if (!['CORRENTE', 'POUPANCA', 'PAGAMENTO'].includes(typeRaw)) {
      throw new BadRequestException('Tipo da conta recebedora inválido.');
    }
    const expiration = input.expirationSeconds === undefined
      ? Number(current.expirationSeconds || 3600)
      : Number(input.expirationSeconds || 3600);

    return {
      clientId: this.text(input.clientId, 500) ?? current.clientId ?? '',
      clientSecret: this.text(input.clientSecret, 1000) ?? current.clientSecret ?? '',
      pixKey: this.text(input.pixKey, 180) ?? current.pixKey ?? '',
      sandbox: this.bool(input.sandbox, current.sandbox === true),
      ...certificate,
      pixAutomaticEnabled: this.bool(input.pixAutomaticEnabled, current.pixAutomaticEnabled === true),
      receiverAgency: this.text(input.receiverAgency, 40) ?? current.receiverAgency ?? '',
      receiverAccount: this.text(input.receiverAccount, 80) ?? current.receiverAccount ?? '',
      receiverAccountType: typeRaw as EfiProviderConfig['receiverAccountType'],
      publicApiBaseUrl: this.publicApiBaseUrl(input.publicApiBaseUrl, current.publicApiBaseUrl),
      webhookSecret: current.webhookSecret || randomBytes(32).toString('hex'),
      skipMtlsChecking: this.bool(input.skipMtlsChecking, current.skipMtlsChecking === true),
      expirationSeconds: Math.min(86400, Math.max(300, Math.round(expiration || 3600))),
    };
  }

  private sanitizeMercadoPago(input: Record<string, unknown>, current: MercadoPagoProviderConfig): MercadoPagoProviderConfig {
    return {
      accessToken: this.text(input.accessToken, 2000) ?? current.accessToken ?? '',
      publicKey: this.text(input.publicKey, 1000) ?? current.publicKey ?? '',
      webhookSecret: this.text(input.webhookSecret, 2000) ?? current.webhookSecret ?? '',
      publicApiBaseUrl: this.publicApiBaseUrl(input.publicApiBaseUrl, current.publicApiBaseUrl),
    };
  }

  async getRow(codeInput: string) {
    const code = this.normalizeCode(codeInput);
    const rows = await this.dataSource.query(
      `SELECT * FROM payment_providers WHERE code = $1 LIMIT 1`,
      [code],
    );
    if (!rows[0]) throw new NotFoundException('Forma de pagamento não encontrada.');
    return rows[0];
  }

  async getSecretConfig<T extends Record<string, unknown>>(codeInput: string): Promise<T> {
    const row = await this.getRow(codeInput);
    return this.vault.decrypt<T>(row.encryptedConfig);
  }

  private safeDetails(code: PaymentProviderCode, config: Record<string, any>) {
    if (code === 'EFI') {
      return {
        environment: config.sandbox ? 'HOMOLOGATION' : 'PRODUCTION',
        clientIdConfigured: Boolean(config.clientId),
        clientSecretConfigured: Boolean(config.clientSecret),
        pixKeyConfigured: Boolean(config.pixKey),
        certificateConfigured: Boolean(config.certificateBase64),
        certificateFileName: config.certificateFileName || null,
        certificateHasPassphrase: Boolean(config.certificatePassphrase),
        pixAutomaticEnabled: config.pixAutomaticEnabled === true,
        receiverAccountConfigured: Boolean(config.receiverAgency && config.receiverAccount && config.receiverAccountType),
        publicApiBaseUrl: config.publicApiBaseUrl || null,
        skipMtlsChecking: config.skipMtlsChecking === true,
        capabilities: ['PIX', 'PIX_AUTOMATICO'],
      };
    }
    return {
      environment: String(config.accessToken || '').startsWith('TEST-') ? 'TEST' : 'PRODUCTION',
      accessTokenConfigured: Boolean(config.accessToken),
      publicKeyConfigured: Boolean(config.publicKey),
      webhookSecretConfigured: Boolean(config.webhookSecret),
      publicApiBaseUrl: config.publicApiBaseUrl || null,
      capabilities: ['PIX', 'SUBSCRIPTIONS'],
      sdk: 'mercadopago',
    };
  }

  private async presentRow(row: any) {
    const code = this.normalizeCode(row.code);
    const config = this.vault.decrypt<Record<string, any>>(row.encryptedConfig);
    return {
      code,
      name: row.name,
      description: row.description,
      active: row.active === true,
      configured: Boolean(row.encryptedConfig),
      configVersion: Number(row.configVersion || 0),
      lastHealthCheckAt: row.lastHealthCheckAt,
      lastHealthCheckOk: row.lastHealthCheckOk,
      lastHealthCheckMessage: row.lastHealthCheckMessage,
      lastHealthCheckDetails: row.lastHealthCheckDetails || {},
      activatedAt: row.activatedAt,
      updatedAt: row.updatedAt,
      config: this.safeDetails(code, config),
    };
  }

  async listSafe() {
    const rows = await this.dataSource.query(`SELECT * FROM payment_providers ORDER BY name ASC`);
    return Promise.all(rows.map((row: any) => this.presentRow(row)));
  }

  async getSafe(code: string) {
    return this.presentRow(await this.getRow(code));
  }

  async saveConfig(codeInput: string, input: Record<string, unknown>, adminUserId: string) {
    const code = this.normalizeCode(codeInput);
    const row = await this.getRow(code);
    const current = this.vault.decrypt<Record<string, any>>(row.encryptedConfig);
    const next = code === 'EFI'
      ? this.sanitizeEfi(input, current as EfiProviderConfig)
      : this.sanitizeMercadoPago(input, current as MercadoPagoProviderConfig);
    const encrypted = this.vault.encrypt(next);

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE payment_providers SET
           active = false,
           "encryptedConfig" = $2,
           "configVersion" = "configVersion" + 1,
           "lastHealthCheckAt" = NULL,
           "lastHealthCheckOk" = NULL,
           "lastHealthCheckMessage" = NULL,
           "lastHealthCheckDetails" = '{}'::jsonb,
           "activatedAt" = NULL,
           "updatedBy" = $3,
           "updatedAt" = now()
         WHERE code = $1`,
        [code, encrypted, adminUserId],
      );
      await manager.query(
        `INSERT INTO payment_provider_audit ("providerCode", action, "actorUserId", metadata)
         VALUES ($1,'CONFIG_UPDATED',$2,$3::jsonb)`,
        [code, adminUserId, JSON.stringify({ configVersion: Number(row.configVersion || 0) + 1 })],
      );
    });
    return this.getSafe(code);
  }

  async recordHealth(
    codeInput: string,
    operational: boolean,
    message: string,
    details: Record<string, unknown> = {},
    adminUserId?: string,
  ) {
    const code = this.normalizeCode(codeInput);
    await this.dataSource.query(
      `UPDATE payment_providers SET
         "lastHealthCheckAt" = now(),
         "lastHealthCheckOk" = $2,
         "lastHealthCheckMessage" = $3,
         "lastHealthCheckDetails" = $4::jsonb,
         "updatedAt" = now()
       WHERE code = $1`,
      [code, operational, String(message || '').slice(0, 2000), JSON.stringify(details || {})],
    );
    if (adminUserId) {
      await this.dataSource.query(
        `INSERT INTO payment_provider_audit ("providerCode", action, "actorUserId", metadata)
         VALUES ($1,'HEALTH_CHECK',$2,$3::jsonb)`,
        [code, adminUserId, JSON.stringify({ operational, message: String(message || '').slice(0, 500) })],
      );
    }
    return this.getSafe(code);
  }

  async activate(codeInput: string, adminUserId: string) {
    const code = this.normalizeCode(codeInput);
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT * FROM payment_providers WHERE code = $1 FOR UPDATE`,
        [code],
      );
      const row = rows[0];
      if (!row) throw new NotFoundException('Forma de pagamento não encontrada.');
      if (row.lastHealthCheckOk !== true) {
        throw new BadRequestException('Esta forma de pagamento precisa passar pelo teste operacional antes de ser ativada.');
      }
      await manager.query(`UPDATE payment_providers SET active = false, "activatedAt" = NULL WHERE active = true`);
      await manager.query(
        `UPDATE payment_providers SET active = true, "activatedAt" = now(), "updatedBy" = $2, "updatedAt" = now() WHERE code = $1`,
        [code, adminUserId],
      );
      await manager.query(
        `INSERT INTO payment_provider_audit ("providerCode", action, "actorUserId", metadata)
         VALUES ($1,'ACTIVATED',$2,'{}'::jsonb)`,
        [code, adminUserId],
      );
      return { code, active: true };
    });
  }

  async deactivate(codeInput: string, adminUserId: string) {
    const code = this.normalizeCode(codeInput);
    await this.dataSource.query(
      `UPDATE payment_providers SET active = false, "activatedAt" = NULL, "updatedBy" = $2, "updatedAt" = now() WHERE code = $1`,
      [code, adminUserId],
    );
    await this.dataSource.query(
      `INSERT INTO payment_provider_audit ("providerCode", action, "actorUserId", metadata)
       VALUES ($1,'DEACTIVATED',$2,'{}'::jsonb)`,
      [code, adminUserId],
    );
    return this.getSafe(code);
  }

  async activeProvider() {
    const rows = await this.dataSource.query(
      `SELECT * FROM payment_providers WHERE active = true LIMIT 1`,
    );
    return rows[0] ? this.normalizeCode(rows[0].code) : null;
  }

  vaultStatus() {
    return this.vault.status();
  }
}
