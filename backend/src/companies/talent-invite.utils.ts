import { createHash, randomBytes } from 'node:crypto';

export const normalizeInviteEmail = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

export const hashInviteToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const createInviteToken = () => {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInviteToken(token) };
};

export const maskInviteEmail = (email: string): string => {
  const [local = '', domain = ''] = email.split('@');
  if (!local || !domain) return 'e-mail convidado';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
};
