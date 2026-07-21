import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface ProfessionalExperience {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  skills?: string[]; // Skills linked to this experience
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
  name: string;
  fullName?: string;
  socialName?: string;
  treatment: string;
  phone: string;
  email: string;
  type: 'COMPANY' | 'CANDIDATE' | 'ADMIN';
  companyId?: string;
  bio?: string;
  resumeURL?: string;
  isVerified?: boolean;
  acceptedTerms?: boolean;
  linkedinURL?: string; // Optional LinkedIn link
  aiAnalysisLimit?: number; // Usage limit for AI analysis
  aiAnalysisCount?: number; // Number of times analyzed
  
  // LinkedIn-style fields
  additionalPhones?: string[];
  experiences?: ProfessionalExperience[];
  skills?: string[];
  courses?: ExtraCourse[];
  education?: AcademicEducation[];
  aiAnalysis?: ResumeAIAnalysis;
  hasAiAnalyzed?: boolean;
}

export function getFirstName(fullName: string | undefined | null): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0];
}

export function getGreetingName(profile: UserProfile | undefined | null): string {
  if (!profile) return 'Usuário';
  const nameToUse = profile.socialName && profile.socialName.trim() !== ''
    ? profile.socialName
    : (profile.name || '');
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

  const refreshProfile = async () => {
    if (auth.currentUser) {
      const docRef = doc(db, 'users', auth.currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        if (auth.currentUser.email === 'fernandohmonteiros@gmail.com' && data.type !== 'ADMIN') {
          await updateDoc(docRef, { type: 'ADMIN' });
          data.type = 'ADMIN';
        }
        setProfile(data);
      } else {
        setProfile(null);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          if (user.email === 'fernandohmonteiros@gmail.com' && data.type !== 'ADMIN') {
            await updateDoc(docRef, { type: 'ADMIN' });
            data.type = 'ADMIN';
          }
          setProfile(data);
        } else {
          setProfile(null);
        }
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
