const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
process.chdir(root);

const file = 'backend/src/payments/payment-provider-config.service.ts';
let source = fs.readFileSync(file, 'utf8');
const original = source;
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
}
if (source !== original) { fs.writeFileSync(file, source); console.log(`updated ${file}`); }
if (!source.includes('marketplaceClientIdConfigured') || !source.includes('marketplaceClientSecretConfigured')) throw new Error('Mercado Pago marketplace vault fields missing.');

const marketplace = fs.readFileSync('backend/src/classifieds/classifieds-marketplace-payments.service.ts', 'utf8');
for (const invariant of ['PaymentProviderConfigService','marketplaceConfig()','code_challenge','code_challenge_method','code_verifier','ONLINE_PAYMENT_SELLER']) {
  if (!marketplace.includes(invariant)) throw new Error(`Mercado Pago marketplace invariant missing: ${invariant}`);
}
if (!marketplace.includes("getSecretConfig<MercadoPagoProviderConfig>('MERCADO_PAGO')")) throw new Error('Marketplace OAuth is not reading encrypted provider config.');
console.log('Mercado Pago marketplace OAuth verified: encrypted config + seller terms + PKCE.');
