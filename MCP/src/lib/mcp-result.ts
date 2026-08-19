import type { ApiResult } from './api-client.js';

export function apiResultToTool(result: ApiResult, label: string) {
  const payload = {
    action: label,
    ok: result.ok,
    status: result.status,
    statusText: result.statusText,
    data: result.data,
  };

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    isError: !result.ok,
  };
}

export function configError(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}
