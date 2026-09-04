import { GroupLayer } from '@wppconnect-team/wppconnect/dist/api/layers/group.layer';

type MembershipActionMethod = 'approveGroupMembershipRequest' | 'rejectGroupMembershipRequest';

let installed = false;

function serializeWid(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value?._serialized === 'string') return value._serialized;
  if (value?.user && value?.server) return `${value.user}@${value.server}`;
  const text = String(value);
  return text === '[object Object]' ? '' : text;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function installMembershipAction(methodName: MembershipActionMethod) {
  const prototype = GroupLayer.prototype as any;
  const original = prototype[methodName];
  if (typeof original !== 'function') return;

  prototype[methodName] = async function (
    groupId: string,
    membershipIds: string | string[],
  ) {
    const requested = Array.isArray(membershipIds) ? membershipIds : [membershipIds];
    const aggregate: any[] = [];

    for (const requestedValue of requested) {
      const originalId = serializeWid(requestedValue);
      if (!originalId) {
        throw new Error(`Identificador inválido recebido em ${methodName}.`);
      }

      const candidates: string[] = [];
      const addCandidate = (value: any) => {
        const id = serializeWid(value);
        if (!/@(?:c\.us|lid)$/.test(id)) return;
        if (!candidates.includes(id)) candidates.push(id);
      };

      // Preserve the exact WID returned by the membership request first.
      addCandidate(originalId);

      // Modern WhatsApp can keep a pending membership request under an LID
      // even when the API surface exposes the corresponding phone-number WID.
      // WA-JS getPnLidEntry supports both directions and can query the server
      // when the mapping is not available in the local cache.
      if (typeof this.getPnLidEntry === 'function') {
        try {
          const entry = await this.getPnLidEntry(originalId);
          addCandidate(entry?.lid);
          addCandidate(entry?.phoneNumber);
        } catch {
          // Keep the original WID as a valid fallback.
        }
      }

      let succeeded = false;
      const failures: string[] = [];

      for (const candidate of candidates) {
        try {
          const result = await original.call(this, groupId, candidate);
          const rows = Array.isArray(result) ? result : [];
          const failedRows = rows.filter((row: any) => Boolean(row?.error));

          if (failedRows.length) {
            failures.push(
              `${candidate}: ${failedRows
                .map((row: any) => describeError(row?.error))
                .filter(Boolean)
                .join('; ') || 'WhatsApp recusou a ação'}`,
            );
            continue;
          }

          aggregate.push(...rows);
          succeeded = true;
          break;
        } catch (error) {
          failures.push(`${candidate}: ${describeError(error)}`);
        }
      }

      if (!succeeded) {
        const action = methodName === 'approveGroupMembershipRequest' ? 'aprovar' : 'rejeitar';
        throw new Error(
          `Não foi possível ${action} a solicitação usando os identificadores equivalentes (${candidates.join(', ')}). ${failures.join(' | ')}`.slice(0, 2000),
        );
      }
    }

    return aggregate;
  };
}

/**
 * Compatibility bridge for WhatsApp's PN/LID addressing on pending group
 * membership requests. It must run before WPPConnect clients are created.
 */
export function installWppconnectMembershipCompatibility() {
  if (installed) return;
  installMembershipAction('approveGroupMembershipRequest');
  installMembershipAction('rejectGroupMembershipRequest');
  installed = true;
}
