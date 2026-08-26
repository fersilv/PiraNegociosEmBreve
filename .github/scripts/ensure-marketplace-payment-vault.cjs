const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
process.chdir(root);

function patch(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) { fs.writeFileSync(file, next); console.log(`updated ${file}`); }
}

patch('backend/src/payments/payment-provider-config.service.ts', (input) => {
  let source = input;
  if (!source.includes('marketplaceClientId?: string;')) {
    source = source.replace(
      '  publicApiBaseUrl?: string;\n}\n\n@Injectable()',
      '  publicApiBaseUrl?: string;\n  marketplaceClientId?: string;\n  marketplaceClientSecret?: string;\n  marketplaceRedirectUri?: string;\n}\n\n@Injectable()',
    );
  }
  if (!source.includes('marketplaceClientId: this.text')) {
    source = source.replace(
      `      publicApiBaseUrl: this.publicApiBaseUrl(input.publicApiBaseUrl, current.publicApiBaseUrl),\n    };\n  }\n\n  async getRow`,
      `      publicApiBaseUrl: this.publicApiBaseUrl(input.publicApiBaseUrl, current.publicApiBaseUrl),\n      marketplaceClientId: this.text(input.marketplaceClientId, 500) ?? current.marketplaceClientId ?? '',\n      marketplaceClientSecret: this.text(input.marketplaceClientSecret, 1000) ?? current.marketplaceClientSecret ?? '',\n      marketplaceRedirectUri: this.publicApiBaseUrl(input.marketplaceRedirectUri, current.marketplaceRedirectUri),\n    };\n  }\n\n  async getRow`,
    );
  }
  if (!source.includes('marketplaceClientIdConfigured')) {
    source = source.replace(
      `      webhookSecretConfigured: Boolean(config.webhookSecret),\n      publicApiBaseUrl: config.publicApiBaseUrl || null,`,
      `      webhookSecretConfigured: Boolean(config.webhookSecret),\n      marketplaceClientIdConfigured: Boolean(config.marketplaceClientId),\n      marketplaceClientId: config.marketplaceClientId || null,\n      marketplaceClientSecretConfigured: Boolean(config.marketplaceClientSecret),\n      marketplaceRedirectUri: config.marketplaceRedirectUri || null,\n      publicApiBaseUrl: config.publicApiBaseUrl || null,`,
    );
  } else if (!source.includes('marketplaceClientId: config.marketplaceClientId || null')) {
    source = source.replace(
      '      marketplaceClientIdConfigured: Boolean(config.marketplaceClientId),',
      '      marketplaceClientIdConfigured: Boolean(config.marketplaceClientId),\n      marketplaceClientId: config.marketplaceClientId || null,',
    );
  }
  if (!source.includes('marketplaceClientId: config.marketplaceClientId || null') || !source.includes('marketplaceClientSecretConfigured')) {
    throw new Error('Mercado Pago marketplace vault fields missing.');
  }
  return source;
});

patch('backend/src/classifieds/classifieds-marketplace-payments.service.ts', (input) => {
  let source = input;

  if (!source.includes('PaymentProviderConfigService')) {
    source = source.replace(
      "import { PaymentProviderVaultService } from '../payments/payment-provider-vault.service';",
      "import { MercadoPagoProviderConfig, PaymentProviderConfigService } from '../payments/payment-provider-config.service';\nimport { PaymentProviderVaultService } from '../payments/payment-provider-vault.service';",
    );
    source = source.replace(
      '    private readonly identities: ClassifiedsIdentityService,\n    private readonly vault: PaymentProviderVaultService,',
      '    private readonly identities: ClassifiedsIdentityService,\n    private readonly providerConfig: PaymentProviderConfigService,\n    private readonly vault: PaymentProviderVaultService,',
    );
  }

  source = source.replace(
    "    const clientId = this.env('MERCADO_PAGO_MARKETPLACE_CLIENT_ID');\n    const redirectUri = this.env('MERCADO_PAGO_MARKETPLACE_REDIRECT_URI');",
    "    const marketplace = await this.marketplaceConfig();\n    const clientId = marketplace.clientId;\n    const redirectUri = marketplace.redirectUri;",
  );

  if (!source.includes('private async refreshMercadoPago(connection: any, current: MercadoPagoSellerCredentials) {\n    const marketplace = await this.marketplaceConfig();')) {
    source = source.replace(
      '  private async refreshMercadoPago(connection: any, current: MercadoPagoSellerCredentials) {\n    const response = await fetch',
      '  private async refreshMercadoPago(connection: any, current: MercadoPagoSellerCredentials) {\n    const marketplace = await this.marketplaceConfig();\n    const response = await fetch',
    );
  }

  if (!source.includes('private async exchangeMercadoPagoCode(code: string) {\n    const marketplace = await this.marketplaceConfig();')) {
    source = source.replace(
      '  private async exchangeMercadoPagoCode(code: string) {\n    const response = await fetch',
      '  private async exchangeMercadoPagoCode(code: string) {\n    const marketplace = await this.marketplaceConfig();\n    const response = await fetch',
    );
  }

  source = source.replaceAll(
    "        client_id: this.env('MERCADO_PAGO_MARKETPLACE_CLIENT_ID'),\n        client_secret: this.env('MERCADO_PAGO_MARKETPLACE_CLIENT_SECRET'),",
    '        client_id: marketplace.clientId,\n        client_secret: marketplace.clientSecret,',
  );
  source = source.replaceAll(
    "        redirect_uri: this.env('MERCADO_PAGO_MARKETPLACE_REDIRECT_URI'),",
    '        redirect_uri: marketplace.redirectUri,',
  );

  if (!source.includes('private async marketplaceConfig()')) {
    source = source.replace(
      `  private env(name: string) {\n    const value = String(process.env[name] || '').trim();\n    if (!value) throw new ServiceUnavailableException(\`Integração de marketplace incompleta: configure \${name}.\`);\n    return value;\n  }`,
      `  private async marketplaceConfig() {\n    const config = await this.providerConfig.getSecretConfig<MercadoPagoProviderConfig>('MERCADO_PAGO').catch(() => ({} as MercadoPagoProviderConfig));\n    const clientId = String(config.marketplaceClientId || process.env.MERCADO_PAGO_MARKETPLACE_CLIENT_ID || '').trim();\n    const clientSecret = String(config.marketplaceClientSecret || process.env.MERCADO_PAGO_MARKETPLACE_CLIENT_SECRET || '').trim();\n    const redirectUri = String(config.marketplaceRedirectUri || process.env.MERCADO_PAGO_MARKETPLACE_REDIRECT_URI || '').trim();\n    if (!clientId || !clientSecret || !redirectUri) {\n      throw new ServiceUnavailableException('Marketplace Mercado Pago incompleto. Configure Client ID, Client Secret e Redirect URI em Admin → Pagamentos → Formas de pagamento → Mercado Pago.');\n    }\n    return { clientId, clientSecret, redirectUri };\n  }`,
    );
  }

  if (source.includes("this.env('MERCADO_PAGO_MARKETPLACE_")) {
    throw new Error('Mercado Pago marketplace OAuth still depends directly on environment helpers.');
  }
  if (!source.includes("getSecretConfig<MercadoPagoProviderConfig>('MERCADO_PAGO')") || !source.includes('marketplace.clientSecret')) {
    throw new Error('Marketplace Mercado Pago vault integration missing.');
  }
  return source;
});

console.log('Mercado Pago marketplace OAuth credentials are sourced from the encrypted payment-provider vault.');
