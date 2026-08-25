export type SupportAudience = 'PUBLIC' | 'CANDIDATE' | 'COMPANY' | 'ADMIN';

export type SupportConsult = {
  label: string;
  source: string;
  rule: string;
};

export type SupportProcedure = {
  title: string;
  intents: string[];
  steps: string[];
  notes?: string[];
};

export type SupportKnowledgeTopic = {
  id: string;
  title: string;
  audiences: SupportAudience[];
  routes: string[];
  keywords: string[];
  summary: string;
  functions: string[];
  procedures: SupportProcedure[];
  consults?: SupportConsult[];
  boundaries?: string[];
  related?: string[];
};

export type SupportKnowledgeBundle = {
  audience: Exclude<SupportAudience, 'PUBLIC'>;
  currentScreen: string;
  contextIds: string[];
  restrictedRequest: boolean;
  liveFacts: Record<string, unknown>;
  knowledge: string;
};
