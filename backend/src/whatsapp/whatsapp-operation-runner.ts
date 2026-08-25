import { BadRequestException } from '@nestjs/common';
import { WPP_OPERATION_CAPABILITIES } from './whatsapp-operations.catalog';
import { WhatsAppService } from './whatsapp.service';

export async function executeWppOperation(
  whatsapp: WhatsAppService,
  instanceId: string,
  scope: string,
  args: unknown[] = [],
) {
  const capability = WPP_OPERATION_CAPABILITIES.find((item) => item.scope === scope);
  if (!capability) throw new BadRequestException('Operação WPPConnect não autorizada pelo catálogo.');
  if (!Array.isArray(args) || args.length > 20) {
    throw new BadRequestException('arguments deve ser um array com no máximo 20 parâmetros.');
  }

  // A sessão é propriedade do WhatsAppService. O acesso permanece encapsulado
  // neste runner allowlisted; o cliente MCP nunca escolhe um nome de método fora
  // do catálogo WPP_OPERATION_CAPABILITIES.
  const client = (whatsapp as any).clients?.get(instanceId);
  if (!client) throw new BadRequestException('Este número não está conectado ao WhatsApp.');

  const method = (client as any)[capability.method];
  if (typeof method !== 'function') {
    throw new BadRequestException(`A versão atual do WPPConnect não disponibiliza ${capability.method}.`);
  }

  try {
    const value = await method.apply(client, args);
    return {
      operation: capability.method,
      scope: capability.scope,
      signature: capability.signature,
      result: normalizeWppResult(value),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BadRequestException(`${capability.method} falhou: ${message.slice(0, 2000)}`);
  }
}

function normalizeWppResult(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) return { type: 'buffer', base64: value.toString('base64') };
  if (value instanceof Date) return value.toISOString();
  if (depth > 6) return '[max-depth]';

  if (Array.isArray(value)) {
    return value.slice(0, 500).map((item) => normalizeWppResult(item, depth + 1, seen));
  }

  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if (seen.has(object)) return '[circular]';
    seen.add(object);
    const safe: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(object).slice(0, 300)) {
      if (['page', 'waPage', 'session', 'browser', 'client'].includes(key)) continue;
      if (typeof nested === 'function') continue;
      safe[key] = normalizeWppResult(nested, depth + 1, seen);
    }
    return safe;
  }

  return String(value);
}
