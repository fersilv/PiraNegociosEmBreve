export type McpManagementRisk = 'read' | 'write' | 'destructive';
export type McpManagementCapability = {
    scope: string;
    section: string;
    category: string;
    label: string;
    description: string;
    risk: McpManagementRisk;
    channels: ['mcp'];
    toolName: string;
    defaultMcp?: boolean;
};
export declare const MCP_MANAGEMENT_CAPABILITIES: McpManagementCapability[];
export declare const MCP_MANAGEMENT_SCOPES: string[];
export declare const DEFAULT_MCP_MANAGEMENT_SCOPES: string[];
