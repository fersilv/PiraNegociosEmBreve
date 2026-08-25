import '../contexts/AuthContext';

declare module '../contexts/AuthContext' {
  interface UserProfile {
    whatsappPhoneE164?: string;
  }
}

export {};
