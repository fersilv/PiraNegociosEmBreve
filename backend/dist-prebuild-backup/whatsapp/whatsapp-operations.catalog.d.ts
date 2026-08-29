export type WppCapabilityRisk = 'read' | 'write' | 'destructive';
export type WppOperationCapability = {
    scope: string;
    method: string;
    category: string;
    label: string;
    description: string;
    risk: WppCapabilityRisk;
    signature: string;
    event?: boolean;
    experimental?: boolean;
};
export declare const WPP_OPERATION_CAPABILITIES: WppOperationCapability[];
export declare const WPP_DEPRECATED_METHODS: string[];
export declare const WPP_SENSITIVE_METHODS: string[];
