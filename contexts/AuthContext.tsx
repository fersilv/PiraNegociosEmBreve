import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { api } from '../lib/api';

export interface ProfessionalExperience {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  skills?: string[];
}

export interface ExtraCourse {
  name: string;
  institution: string;
  year: string;
}

export interface AcademicEducation {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear: string;
  endYear: string;
  current: boolean;
  status?: 'CONCLUIDO' | 'EM_ANDAMENTO' | 'TRANCADO' | 'INTERROMPIDO';
}

export interface ResumeAIAnalysis {
  suggestions: string[];
  feedbackText: string;
  parsedAt?: string;
}

export interface UserProfile {
  name?: string;
  displayName?: string;
  fullName?: string;
  socialName?: string;
  treatment: string;
  phone: string;
  email: string;
  type: 'COMPANY' | 'CANDIDATE' | 'ADMIN';
  companyId?: string;
  isCompanyAdmin?: boolean;
  companyName?: string;
  companyDescription?: string;
  companyLogo?: string;
  photoURL?: string;
  bio?: string;
  resumeURL?: string;
  isVerified?: boolean;
  acceptedTerms?: boolean;
  linkedinURL?: string;
  aiAnalysisLimit?: number;
  aiAnalysisCount?: number;
  additionalPhones?: string[];
  experiences?: ProfessionalExperience[];
  skills?: string[];
  courses?: ExtraCourse[];
  education?: AcademicEducation[];
  aiAnalysis?: ResumeAIAnalysis;
  hasAiAnalyzed?: boolean;
  savedDocs?: Record<string, string>;
}

export function getFirstName(fullName: string | undefined | null): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0];
}

export function getGreetingName(profile: UserProfile | undefined | null): string {
  if (!profile) return 'Usuário';
  const nameToUse = profile.socialName && profile.socialName.trim() !== ''
    ? profile.socialName
    : (profile.displayName || profile.fullName || profile.name || '');
  return getFirstName(nameToUse);
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (currentUser: User) => {
    try {
      // Pequeno delay para garantir que o token JWT do Firebase foi injetado pelo interceptor do Axios
      const response = await api.get('/users/me');
      const data = response.data as UserProfile;
      
      setProfile(data);
    } catch (error) {
      console.error("Erro ao buscar perfil da API:", error);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (auth.currentUser) {
      await fetchProfile(auth.currentUser);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await fetchProfile(user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
