import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { api } from "../lib/api";

export interface ExperienceTimelineEntry {
  id?: string;
  role: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  skills?: string[];
}

export interface ProfessionalExperience {
  id?: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  skills?: string[];
  timeline?: ExperienceTimelineEntry[];
}

export interface ExtraCourse {
  id?: string;
  name: string;
  institution: string;
  year: string;
  type?: "COURSE" | "CERTIFICATION";
  description?: string;
  skills?: string[];
}

export interface AcademicEducation {
  id?: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear: string;
  endYear: string;
  current: boolean;
  status?: "CONCLUIDO" | "EM_ANDAMENTO" | "TRANCADO" | "INTERROMPIDO";
  description?: string;
  skills?: string[];
}

export interface ResumeAIAnalysis {
  score?: number;
  strengths?: string[];
  suggestions: string[];
  feedbackText: string;
  missingSections?: string[];
  parsedAt?: string;
}

export interface ResumePreferences {
  nameMode?: "SOCIAL" | "CIVIL";
  showHeadline?: boolean;
  headline?: string;
  showPhoto?: boolean;
  template?: "modern" | "creative" | "classic" | "minimalist";
  color?: string;
}

export interface UploadedResumeFile {
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  uploadedAt: string;
}

export interface PublishedResumeSnapshot {
  version?: number;
  publishedAt?: string;
  fullName?: string;
  socialName?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  address?: string;
  bio?: string;
  experiences?: ProfessionalExperience[];
  education?: AcademicEducation[];
  skills?: string[];
  courses?: ExtraCourse[];
  languages?: Language[];
  salaryExpectation?: string;
  resumePhotoURL?: string;
  resumePreferences?: ResumePreferences;
  score?: number | null;
}

export interface Language {
  name: string;
  level: string;
}

export interface WorkLocationPreference {
  city: string;
  state: string;
}

export type PcdDeclaration = "NOT_INFORMED" | "YES" | "NO";
export type PcdDocumentationStatus =
  | "NOT_INFORMED"
  | "HAS_REPORT"
  | "NO_REPORT"
  | "IN_PROGRESS";

export interface JobPreferences {
  preferredLocations?: WorkLocationPreference[];
  hasDriverLicense?: boolean | null;
  driverLicenseCategories?: string[];
  hasOwnVehicle?: boolean | null;
  ownVehicles?: string[];
  includeExclusivePcdJobs?: boolean;
  pcdDeclaration?: PcdDeclaration;
  pcdDocumentationStatus?: PcdDocumentationStatus;
  pcdDataConsent?: boolean;
}

export interface UserProfile {
  name?: string;
  displayName?: string;
  fullName?: string;
  socialName?: string;
  birthDate?: string | Date;
  treatment: string;
  phone: string;
  email: string;
  type: "COMPANY" | "CANDIDATE" | "ADMIN";
  companyId?: string;
  isCompanyAdmin?: boolean;
  companyName?: string;
  companyDescription?: string;
  companyLogo?: string;
  photoURL?: string;
  bio?: string;
  resumeURL?: string;
  resumeStatus?: "DRAFT" | "PUBLISHED";
  resumePublishedAt?: string;
  publishedResumeSnapshot?: PublishedResumeSnapshot | null;
  uploadedResumeFile?: UploadedResumeFile | null;
  isOpenToWork?: boolean;
  isVerified?: boolean;
  acceptedTerms?: boolean;
  linkedinURL?: string;
  aiAnalysisLimit?: number;
  aiAnalysisCount?: number;
  resumeScoreUnlocked?: boolean;
  additionalPhones?: string[];
  experiences?: ProfessionalExperience[];
  skills?: string[];
  courses?: ExtraCourse[];
  education?: AcademicEducation[];
  aiAnalysis?: ResumeAIAnalysis;
  hasAiAnalyzed?: boolean;
  savedDocs?: Record<string, string>;
  languages?: Language[];
  salaryExpectation?: string;
  address?: string;
  city?: string;
  state?: string;
  jobPreferences?: JobPreferences;
  resumePhotoURL?: string;
  resumePreferences?: ResumePreferences;
}

export function getFirstName(fullName: string | undefined | null): string {
  if (!fullName) return "";
  return fullName.trim().split(/\s+/)[0];
}

export function getGreetingName(
  profile: UserProfile | undefined | null,
): string {
  if (!profile) return "Usuário";
  const nameToUse =
    profile.socialName && profile.socialName.trim() !== ""
      ? profile.socialName
      : profile.displayName || profile.fullName || profile.name || "";
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
      const response = await api.get("/users/me");
      const data = response.data as UserProfile;
      setProfile(data);
    } catch (error) {
      console.error("Erro ao buscar perfil da API:", error);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (auth.currentUser) await fetchProfile(auth.currentUser);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) await fetchProfile(user);
      else setProfile(null);
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
