"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentProviderVaultService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
let PaymentProviderVaultService = class PaymentProviderVaultService {
    keyPath = (0, path_1.join)(process.cwd(), '.secrets', 'payment-provider-vault.key');
    masterKey = null;
    getKey() {
        if (this.masterKey)
            return this.masterKey;
        try {
            if (!(0, fs_1.existsSync)(this.keyPath)) {
                (0, fs_1.mkdirSync)((0, path_1.dirname)(this.keyPath), { recursive: true, mode: 0o700 });
                const generated = (0, crypto_1.randomBytes)(32);
                (0, fs_1.writeFileSync)(this.keyPath, generated.toString('base64'), {
                    encoding: 'utf8',
                    mode: 0o600,
                    flag: 'wx',
                });
            }
            (0, fs_1.chmodSync)(this.keyPath, 0o600);
            const decoded = Buffer.from((0, fs_1.readFileSync)(this.keyPath, 'utf8').trim(), 'base64');
            if (decoded.length !== 32)
                throw new Error('invalid key length');
            this.masterKey = decoded;
            return decoded;
        }
        catch (error) {
            throw new common_1.ServiceUnavailableException(`Não foi possível abrir o cofre das formas de pagamento: ${error instanceof Error ? error.message : 'erro desconhecido'}.`);
        }
    }
    encrypt(value) {
        const iv = (0, crypto_1.randomBytes)(12);
        const cipher = (0, crypto_1.createCipheriv)('aes-256-gcm', this.getKey(), iv);
        const encrypted = Buffer.concat([
            cipher.update(JSON.stringify(value), 'utf8'),
            cipher.final(),
        ]);
        const envelope = {
            v: 1,
            alg: 'aes-256-gcm',
            iv: iv.toString('base64'),
            tag: cipher.getAuthTag().toString('base64'),
            data: encrypted.toString('base64'),
        };
        return JSON.stringify(envelope);
    }
    decrypt(payload) {
        if (!payload)
            return {};
        try {
            const envelope = JSON.parse(payload);
            if (envelope.v !== 1 || envelope.alg !== 'aes-256-gcm') {
                throw new Error('formato de cofre não suportado');
            }
            const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', this.getKey(), Buffer.from(envelope.iv, 'base64'));
            decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(envelope.data, 'base64')),
                decipher.final(),
            ]).toString('utf8');
            return JSON.parse(decrypted);
        }
        catch {
            throw new common_1.ServiceUnavailableException('As credenciais da forma de pagamento não puderam ser descriptografadas. Verifique a chave local do cofre.');
        }
    }
    status() {
        return {
            encryptedAtRest: true,
            algorithm: 'AES-256-GCM',
            keyStorage: 'SERVER_LOCAL_FILE',
            keyPathHint: '.secrets/payment-provider-vault.key',
        };
    }
};
exports.PaymentProviderVaultService = PaymentProviderVaultService;
exports.PaymentProviderVaultService = PaymentProviderVaultService = __decorate([
    (0, common_1.Injectable)()
], PaymentProviderVaultService);
//# sourceMappingURL=payment-provider-vault.service.js.map