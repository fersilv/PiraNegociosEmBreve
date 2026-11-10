import React,{useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {ArrowRight,ShieldCheck,Home} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';

const SPLASH='https://splash.piranegocios.com.br';
function nextPath(search:string){
 const params=new URLSearchParams(search);
 const requested=params.get('returnTo')||'/';
 if(!requested.startsWith('/')||requested.startsWith('//')||requested.includes('\\')||/[\r\n]/.test(requested))return '/';
 return requested;
}
export default function SplashSsoBridge(){
 const {user,loading}=useAuth();
 const location=useLocation();
 const [issue,setIssue]=useState('');
 const [waiting,setWaiting]=useState(true);
 const isLink=new URLSearchParams(location.search).get('mode')==='link';
 useEffect(()=>{
  if(loading)return;
  if(!user){
   const next='/splash/entrar'+location.search;
   window.location.replace('/login?returnTo='+encodeURIComponent(next));
   return;
  }
  const abort=new AbortController();
  let valid=true;
  (async()=>{
   try{
    // No token is appended to the URL, persisted in local storage or logged.
    const idToken=await user.getIdToken();
    const response=await fetch(SPLASH+'/api/auth/piranegocios',{
     method:'POST',credentials:'include',signal:abort.signal,
     headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(body.error||body.message||'Não foi possível vincular as contas');
    if(valid)window.location.replace(SPLASH+nextPath(location.search));
   }catch(e:any){if(valid){setIssue(e?.message||'Falha na autenticação compartilhada');setWaiting(false)}}
  })();
  return()=>{valid=false;abort.abort()};
 },[user,loading,location.search]);
 return <div className="min-h-screen bg-[#f6f4f1] flex items-center justify-center p-5 text-[#3e2920]">
  <div className="bg-white rounded-3xl border border-stone-200 shadow-lg p-8 max-w-md w-full text-center">
   <span className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700"><Home size={30}/></span>
   <h1 className="mt-5 font-serif text-2xl font-bold">{isLink?'Vinculando contas':'Entrando no Splash'}</h1>
   <p className="mt-3 text-sm text-stone-600 leading-6">{issue||'Conectando sua conta PiraNegócios ao Splash com segurança, sem compartilhar senhas.'}</p>
   {waiting&&!issue?<div className="mx-auto mt-5 h-7 w-7 rounded-full border-4 border-emerald-200 border-t-emerald-700 animate-spin" aria-label="Conectando"/>:null}
   {issue?<div className="mt-5 flex flex-col gap-3">
     <a href={SPLASH+'/entrar'} className="rounded-xl bg-emerald-700 text-white py-3 font-bold text-sm">Entrar no Splash e vincular em Meu perfil <ArrowRight className="inline h-4 w-4"/></a>
     <Link to="/classificados" className="text-sm text-stone-500 underline">Voltar ao PiraNegócios</Link>
    </div>:null}
   <div className="flex gap-2 items-center justify-center mt-6 text-xs text-emerald-700"><ShieldCheck size={16}/> Acesso pelo Firebase do PiraNegócios</div>
  </div>
 </div>;
}