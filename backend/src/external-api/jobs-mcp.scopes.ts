export const JOBS_MCP_SCOPES = ['jobs:read', 'jobs:write'] as const;

export type JobsMcpScope = (typeof JOBS_MCP_SCOPES)[number];
