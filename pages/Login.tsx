import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration fields
  const [name, setName] = useState('');
  const [socialName, setSocialName] = useState('');
  const [treatment, setTreatment] = useState('ele/dele');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const [acceptedTerms, setAcceptedTerms] = useState(true);

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setAcceptedTerms(!isLogin); // If switching to register, set false. If switching to login, set true.
  };

  const handleGoogleLogin = async () => {
    if (!acceptedTerms) {
      setError('Você precisa aceitar os Termos de Uso e LGPD para continuar.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user profile exists
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        // Check for pre-existing invitation
        let invitedData: any = {};
        let inviteDocId: string | null = null;
        if (user.email) {
          try {
            const q = query(collection(db, 'users'), where('email', '==', user.email.trim().toLowerCase()));
            const inviteSnap = await getDocs(q);
            if (!inviteSnap.empty) {
              inviteDocId = inviteSnap.docs[0].id;
              invitedData = inviteSnap.docs[0].data();
            }
          } catch (err) {
            console.error("Error looking up invitation:", err);
          }
        }

        // Create basic profile from Google info
        const profileData: any = {
          name: user.displayName || '',
          fullName: user.displayName || '',
          email: user.email,
          createdAt: new Date().toISOString()
        };

        // If they were invited to a company, link them immediately
        if (invitedData.companyId) {
          profileData.companyId = invitedData.companyId;
          profileData.companyName = invitedData.companyName || '';
          profileData.type = 'COMPANY';
          profileData.isCompanyAdmin = invitedData.isCompanyAdmin || false;
          profileData.status = 'ACTIVE';
        }

        await setDoc(docRef, profileData);

        // Delete the temporary invitation document if it's different from user.uid
        if (inviteDocId && inviteDocId !== user.uid) {
          try {
            await deleteDoc(doc(db, 'users', inviteDocId));
          } catch (delErr) {
            console.error("Error deleting placeholder invitation document:", delErr);
          }
        }
      }
      
      await refreshProfile();
      navigate(returnTo || '/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao fazer login com o Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        await refreshProfile();
        navigate(returnTo || '/dashboard');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        try {
          await sendEmailVerification(user);
        } catch (verifyErr) {
          console.error("Failed to send verification email:", verifyErr);
        }
        
        // Check for pre-existing invitation
        let invitedData: any = {};
        let inviteDocId: string | null = null;
        try {
          const q = query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase()));
          const inviteSnap = await getDocs(q);
          if (!inviteSnap.empty) {
            inviteDocId = inviteSnap.docs[0].id;
            invitedData = inviteSnap.docs[0].data();
          }
        } catch (err) {
          console.error("Error looking up invitation:", err);
        }

        const profileData: any = {
          name: socialName || name, // prefer social name if provided
          fullName: name,
          socialName,
          treatment,
          phone,
          email: email.trim().toLowerCase(),
          createdAt: new Date().toISOString()
        };

        // If they were invited to a company, link them immediately
        if (invitedData.companyId) {
          profileData.companyId = invitedData.companyId;
          profileData.companyName = invitedData.companyName || '';
          profileData.type = 'COMPANY';
          profileData.isCompanyAdmin = invitedData.isCompanyAdmin || false;
          profileData.status = 'ACTIVE';
        }

        // Save initial profile
        await setDoc(doc(db, 'users', user.uid), profileData);

        // Delete the temporary invitation document if it's different from the user.uid
        if (inviteDocId && inviteDocId !== user.uid) {
          try {
            await deleteDoc(doc(db, 'users', inviteDocId));
          } catch (delErr) {
            console.error("Error deleting placeholder invitation document:", delErr);
          }
        }

        await refreshProfile();
        
        // If they were invited, redirect directly to dashboard as they are already a company member!
        if (invitedData.companyId) {
          navigate(returnTo || '/dashboard');
        } else {
          navigate(`/dashboard/onboarding${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`); // to select Candidate or Company
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-offwhite flex flex-col items-center justify-center p-4">
      <Link to="/" className="absolute top-6 left-6 flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors">
        <ArrowLeft className="w-5 h-5" />
        Voltar para Home
      </Link>
      
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-stone-100">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-stone-900 mb-2">
            {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
          </h1>
          <p className="text-stone-500 text-sm">
            {isLogin ? 'Acesse o portal de vagas' : 'Cadastre-se para anunciar ou encontrar vagas'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6 border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Nome Completo *</label>
                <input 
                  type="text" 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 focus:ring-2 focus:ring-terracotta-200 outline-none transition-all"
                  placeholder="Seu nome oficial"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Nome Social (Opcional)</label>
                <input 
                  type="text" 
                  value={socialName}
                  onChange={(e) => setSocialName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 focus:ring-2 focus:ring-terracotta-200 outline-none transition-all"
                  placeholder="Como prefere ser chamado"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Tratamento</label>
                  <select 
                    value={treatment}
                    onChange={(e) => setTreatment(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 focus:ring-2 focus:ring-terracotta-200 outline-none transition-all bg-white"
                  >
                    <option value="ele/dele">Ele/Dele</option>
                    <option value="ela/dela">Ela/Dela</option>
                    <option value="elu/delu">Elu/Delu</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Telefone *</label>
                  <input 
                    type="tel" 
                    required 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 focus:ring-2 focus:ring-terracotta-200 outline-none transition-all"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">E-mail *</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 focus:ring-2 focus:ring-terracotta-200 outline-none transition-all"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Senha *</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 focus:ring-2 focus:ring-terracotta-200 outline-none transition-all"
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <div className="pt-2 mb-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="flex items-center h-5 mt-0.5">
                <input 
                  type="checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="w-5 h-5 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500"
                />
              </div>
              <span className="text-sm text-stone-600 leading-relaxed">
                Eu li e concordo com os <Link to="/termos" target="_blank" className="text-terracotta-600 hover:underline font-bold">Termos de Uso e Política de Privacidade (LGPD)</Link>.
              </span>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={loading || !acceptedTerms}
            className="w-full bg-terracotta-600 hover:bg-terracotta-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md mt-6 flex justify-center items-center h-14 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Entrar' : 'Criar Conta')}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between">
          <span className="w-1/5 border-b border-stone-200 lg:w-1/4"></span>
          <span className="text-xs text-center text-stone-500 uppercase tracking-widest font-bold">ou</span>
          <span className="w-1/5 border-b border-stone-200 lg:w-1/4"></span>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading || !acceptedTerms}
          className="w-full bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 font-bold py-3.5 rounded-xl transition-all shadow-sm mt-6 flex justify-center items-center gap-3 h-14 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {isLogin ? 'Entrar com Google' : 'Criar Conta com Google'}
        </button>

        <div className="mt-8 text-center text-sm text-stone-500">
          {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}{' '}
          <button 
            type="button" 
            onClick={toggleMode}
            className="text-terracotta-600 font-bold hover:underline"
          >
            {isLogin ? "Cadastre-se" : "Entre aqui"}
          </button>
        </div>
      </div>
    </div>
  );
}
