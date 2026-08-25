import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { ClassifiedIdentityType, ClassifiedPublicationChannel, ClassifiedWorkspaceContextData } from '../types/classifieds';

type CompanySetup = {
  acceptedTerms?: boolean;
  canSellProducts?: boolean;
  canOfferServices?: boolean;
  businessSegments?: string[];
  defaultPublicationChannels?: ClassifiedPublicationChannel[];
  pageSectionLabel?: string | null;
};

type WorkspaceContextValue = {
  data: ClassifiedWorkspaceContextData | null;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  selectIdentity: (identity: ClassifiedIdentityType) => Promise<void>;
  acceptPersonalTerms: () => Promise<void>;
  configureCompany: (setup: CompanySetup) => Promise<void>;
};

const ClassifiedsWorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function ClassifiedsWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<ClassifiedWorkspaceContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/classifieds/me/context');
      setData(response.data as ClassifiedWorkspaceContextData);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar seu espaço nos Classificados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const selectIdentity = useCallback(async (identity: ClassifiedIdentityType) => {
    setError('');
    try {
      const response = await api.post('/classifieds/me/context/select', { identity });
      setData(response.data as ClassifiedWorkspaceContextData);
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message || 'Não foi possível trocar de identidade.';
      setError(message);
      throw requestError;
    }
  }, []);

  const acceptPersonalTerms = useCallback(async () => {
    setError('');
    try {
      const response = await api.post('/classifieds/me/terms/personal', { accepted: true });
      setData(response.data as ClassifiedWorkspaceContextData);
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message || 'Não foi possível concluir o aceite.';
      setError(message);
      throw requestError;
    }
  }, []);

  const configureCompany = useCallback(async (setup: CompanySetup) => {
    setError('');
    try {
      const response = await api.post('/classifieds/me/company-profile', setup);
      setData(response.data as ClassifiedWorkspaceContextData);
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message || 'Não foi possível configurar os Classificados da empresa.';
      setError(message);
      throw requestError;
    }
  }, []);

  const value = useMemo(() => ({ data, loading, error, reload, selectIdentity, acceptPersonalTerms, configureCompany }), [data, loading, error, reload, selectIdentity, acceptPersonalTerms, configureCompany]);
  return <ClassifiedsWorkspaceContext.Provider value={value}>{children}</ClassifiedsWorkspaceContext.Provider>;
}

export function useClassifiedsWorkspace() {
  const context = useContext(ClassifiedsWorkspaceContext);
  if (!context) throw new Error('useClassifiedsWorkspace precisa estar dentro de ClassifiedsWorkspaceProvider.');
  return context;
}
