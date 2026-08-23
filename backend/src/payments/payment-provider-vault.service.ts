import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';

interface VaultEnvelope {
  v: 1;
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  data: string;
}

@Injectable()
export class PaymentProviderVaultService {
  private readonly keyPath = join(process.cwd(), '.secrets', 'payment-provider-vault.key');
  private masterKey: Buffer | null = null;

  private getKey() {
    if (this.masterKey) return this.masterKey;

    try {
      if (!existsSync(this.keyPath)) {
        mkdirSync(dirname(this.keyPath), { recursive: true, mode: 0o700 });
        const generated = randomBytes(32);
        writeFileSync(this.keyPath, generated.toString('base64'), {
          encoding: 'utf8',
          mode: 0o600,
          flag: 'wx',
        });
      }
      chmodSync(this.keyPath, 0o600);
      const decoded = Buffer.from(readFileSync(this.keyPath, 'utf8').trim(), 'base64');
      if (decoded.length !== 32) throw new Error('invalid key length');
      this.masterKey = decoded;
      return decoded;
    } catch (error) {
      throw new ServiceUnavailableException(
        `Não foi possível abrir o cofre das formas de pagamento: ${error instanceof Error ? error.message : 'erro desconhecido'}.`,
      );
    }
  }

  encrypt(value: Record<string, unknown>) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);
    const envelope: VaultEnvelope = {
      v: 1,
      alg: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: encrypted.toString('base64'),
    };
    return JSON.stringify(envelope);
  }

  decrypt<T extends Record<string, unknown>>(payload?: string | null): T {
    if (!payload) return {} as T;
    try {
      const envelope = JSON.parse(payload) as VaultEnvelope;
      if (envelope.v !== 1 || envelope.alg !== 'aes-256-gcm') {
        throw new Error('formato de cofre não suportado');
      }
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.getKey(),
        Buffer.from(envelope.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(envelope.data, 'base64')),
        decipher.final(),
      ]).toString('utf8');
      return JSON.parse(decrypted) as T;
    } catch {
      throw new ServiceUnavailableException(
        'As credenciais da forma de pagamento não puderam ser descriptografadas. Verifique a chave local do cofre.',
      );
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
}
