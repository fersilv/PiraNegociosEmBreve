import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Camera,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

type Context = 'PERSONAL' | 'COMPANY';
type Verification = {
  id: string;
  context: Context;
  relationship: 'PERSONAL' | 'EMPLOYEE' | 'PARTNER';
  selectedQsaName?: string | null;
  selectedQsaQualification?: string | null;
  declaresAtLeast25Percent?: boolean;
  status: 'DRAFT'|'PENDING'|'APPROVED'|'REJECTED'|'NEEDS_CHANGES';
  reviewReason?: string | null;
  documents?: Array<{ id:string; kind:string; originalName:string; uploadedAt:string }>;
};

type PermissionKey = 'companyProfile'|'recruitment'|'marketplace'|'finance'|'team';
const permissionLabels: Record<PermissionKey,string> = {
  companyProfile: 'Editar perfil da empresa',
  recruitment: 'Recrutamento',
  marketplace: 'Marketplace',
  finance: 'Financeiro',
  team: 'Gerenciar equipe',
};

export default function IdentityVerificationPage() {
  const location = useLocation();
  const context: Context = location.pathname.startsWith('/company/') ? 'COMPANY' : 'PERSONAL';
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState('');
  const [message,setMessage]=useState('');
  const [accepted,setAccepted]=useState(false);
  const [cnpj,setCnpj]=useState('');
  const [isPartner25,setIsPartner25]=useState<boolean|null>(null);
  const [selectedQsaName,setSelectedQsaName]=useState('');
  const [partnerEmail,setPartnerEmail]=useState('');
  const [partnerPhone,setPartnerPhone]=useState('');
  const [grantFullPowers,setGrantFullPowers]=useState(true);
  const [permissions,setPermissions]=useState<Record<PermissionKey,boolean>>({companyProfile:true,recruitment:true,marketplace:true,finance:false,team:false});
  const [commercialName,setCommercialName]=useState('');
  const [sameAddress,setSameAddress]=useState(true);
  const [commercialAddress,setCommercialAddress]=useState('');
  const [commercialCity,setCommercialCity]=useState('');
  const [commercialState,setCommercialState]=useState('');

  const load=async()=>{
    setLoading(true);
    try{
      const response=await api.get('/compliance/me');
      const next=response.data;
      setData(next);
      if(next?.company){
        setCnpj(next.company.cnpj||'');
        setCommercialName(next.company.name||'');
        setSameAddress(next.company.commercialAddressSameAsLegal!==false);
        setCommercialAddress(next.company.commercialAddress||'');
        setCommercialCity(next.company.commercialCity||'');
        setCommercialState(next.company.commercialState||'');
      }
      const current=(next?.verifications||[]).find((item:Verification)=>item.context===context);
      if(current?.relationship==='PARTNER'){
        setIsPartner25(Boolean(current.declaresAtLeast25Percent));
        setSelectedQsaName(current.selectedQsaName||'');
      }
    }catch(error:any){setMessage(error?.response?.data?.message||'Não foi possível carregar a verificação.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load()},[context]);

  const verification:Verification|undefined=useMemo(()=>data?.verifications?.find((item:Verification)=>item.context===context),[data,context]);
  const selfie=verification?.documents?.find(item=>item.kind==='SELFIE');
  const company=data?.company;
  const qsa=Array.isArray(company?.cnpjSnapshot?.qsa)?company.cnpjSnapshot.qsa:[];
  const latestAuthorization=company?.authorizations?.[0]||null;
  const locked=verification?.status==='PENDING'||verification?.status==='APPROVED';

  const lookupCnpj=async()=>{
    if(!cnpj.trim())return;
    setWorking('cnpj');setMessage('');
    try{
      await api.get(`/compliance/company/cnpj/${encodeURIComponent(cnpj)}`);
      setMessage('Dados públicos do CNPJ atualizados.');
      await load();
    }catch(error:any){setMessage(error?.response?.data?.message||'Não foi possível consultar o CNPJ.');}
    finally{setWorking('');}
  };

  const saveCommercial=async()=>{
    setWorking('commercial');setMessage('');
    try{
      await api.patch('/compliance/company/commercial-profile',{
        name:commercialName,
        commercialAddressSameAsLegal:sameAddress,
        address:commercialAddress,
        city:commercialCity,
        state:commercialState,
      });
      setMessage('Dados comerciais salvos.');
      await load();
    }catch(error:any){setMessage(error?.response?.data?.message||'Não foi possível salvar os dados comerciais.');}
    finally{setWorking('');}
  };

  const uploadSelfie=async(file:File|null)=>{
    if(!file)return;
    setWorking('selfie');setMessage('');
    try{
      const body=new FormData();body.append('file',file);body.append('context',context);
      await api.post('/compliance/me/documents/SELFIE',body,{headers:{'Content-Type':'multipart/form-data'}});
      setMessage('Selfie recebida.');await load();
    }catch(error:any){setMessage(error?.response?.data?.message||'Não foi possível enviar a selfie.');}
    finally{setWorking('');}
  };

  const submitSelfVerification=async()=>{
    setWorking('submit');setMessage('');
    try{
      if(context==='COMPANY'){
        if(!selectedQsaName&&qsa.length)throw new Error('Selecione seu nome no quadro societário.');
        await api.patch('/compliance/me/profile',{
          context:'COMPANY',relationship:'PARTNER',selectedQsaName,
          declaresAtLeast25Percent:true,
        });
      }else{
        await api.patch('/compliance/me/profile',{context:'PERSONAL',relationship:'PERSONAL'});
      }
      await api.post('/compliance/me/submit',{context,accepted,consentVersion:data?.consentVersion});
      setAccepted(false);setMessage('Enviado para análise manual. Prazo estimado de até 48 horas.');await load();
    }catch(error:any){setMessage(error?.response?.data?.message||error?.message||'Não foi possível enviar a verificação.');}
    finally{setWorking('');}
  };

  const sendPartnerAuthorization=async()=>{
    setWorking('invite');setMessage('');
    try{
      const name=selectedQsaName.trim();
      if(!name||!partnerEmail.trim())throw new Error('Selecione o sócio responsável e informe o e-mail.');
      const response=await api.post('/compliance/company/responsible-authorization',{
        partnerName:name,partnerEmail,partnerPhone,grantFullPowers,
        permissions:grantFullPowers?undefined:permissions,
      });
      setMessage(response.data?.emailStatus==='NOT_CONFIGURED'
        ? `Autorização criada. E-mail transacional não configurado; link temporário: ${response.data?.inviteUrl||''}`
        : 'Convite enviado ao sócio responsável.');
      await load();
    }catch(error:any){setMessage(error?.response?.data?.message||error?.message||'Não foi possível enviar a autorização.');}
    finally{setWorking('');}
  };

  if(loading)return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400"/></div>;
  if(context==='COMPANY'&&!company)return <EmptyCompany/>;

  return <div className="mx-auto max-w-6xl space-y-6 pb-16">
    <header className="rounded-[30px] bg-stone-950 p-6 text-white sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">Segurança sem burocracia</p><h1 className="mt-2 font-serif text-3xl font-black sm:text-4xl">Verificação cadastral</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Para comprar não precisa verificar. Para vender, validamos quem está por trás do anúncio. No fluxo padrão não pedimos RG, contrato social nem comprovante de endereço.</p></div>
        <StatusBadge status={context==='COMPANY'&&company?.verified?'APPROVED':verification?.status||'DRAFT'}/>
      </div>
    </header>

    {message&&<div className="break-words rounded-2xl bg-stone-900 px-4 py-3 text-sm font-bold text-white">{message}</div>}
    {verification?.reviewReason&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Retorno da análise:</strong> {verification.reviewReason}</div>}

    <ContactCard user={data?.user}/>

    {context==='PERSONAL'
      ? <PersonalVerification selfie={selfie} locked={locked} working={working} accepted={accepted} setAccepted={setAccepted} consentVersion={data?.consentVersion} onSelfie={file=>void uploadSelfie(file)} onSubmit={()=>void submitSelfVerification()}/>
      : <>
        <section className="rounded-[28px] bg-white p-5 ring-1 ring-stone-200 sm:p-6">
          <div className="flex items-start gap-3"><Building2 className="mt-0.5 h-5 w-5 text-[#397c75]"/><div><h2 className="text-xl font-black">A empresa tem CNPJ?</h2><p className="mt-1 text-xs leading-5 text-stone-500">Sem CNPJ ela pode existir na plataforma, mas permanece não verificada e com recursos limitados. Com CNPJ, buscamos os dados públicos automaticamente.</p></div></div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row"><input value={cnpj} onChange={e=>setCnpj(e.target.value.toUpperCase())} placeholder="CNPJ" className={`${inputClass} flex-1`}/><button type="button" onClick={()=>void lookupCnpj()} disabled={working==='cnpj'||!cnpj.trim()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 text-sm font-black text-white disabled:opacity-50">{working==='cnpj'?<Loader2 className="h-4 w-4 animate-spin"/>:<Search className="h-4 w-4"/>}{company?.cnpjSnapshot?'Atualizar consulta':'Consultar CNPJ'}</button></div>
          {!company?.hasCnpj&&<div className="mt-4 rounded-2xl bg-stone-50 p-4 text-xs leading-5 text-stone-600"><strong>Não tenho CNPJ:</strong> tudo bem. Continue usando o perfil da empresa. Recursos que exigem empresa verificada ficam bloqueados até existir uma verificação empresarial.</div>}
        </section>

        {company?.cnpjSnapshot&&<>
          {company?.cnpjChangeAlert&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><div><strong>Os dados públicos do CNPJ mudaram desde a consulta anterior.</strong><p className="mt-1 text-xs">Confira razão social, endereço jurídico ou QSA antes de continuar.</p></div></div></div>}
          <RegistryCard company={company}/>
          <CommercialCard company={company} name={commercialName} setName={setCommercialName} same={sameAddress} setSame={setSameAddress} address={commercialAddress} setAddress={setCommercialAddress} city={commercialCity} setCity={setCommercialCity} state={commercialState} setState={setCommercialState} working={working==='commercial'} onSave={()=>void saveCommercial()}/>

          {!company.verified&&<section className="rounded-[28px] bg-white p-5 ring-1 ring-stone-200 sm:p-6">
            <div className="flex items-start gap-3"><UsersRound className="mt-0.5 h-5 w-5 text-blue-700"/><div><h2 className="text-xl font-black">Quem autoriza a empresa?</h2><p className="mt-1 text-xs leading-5 text-stone-500">O QSA é público. Só precisamos descobrir quem assume a responsabilidade pela liberação da empresa no PiraNegócios.</p></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><Choice selected={isPartner25===true} title="Sou sócio(a) com 25% ou mais" text="Selecione seu nome no QSA, tire uma selfie, aceite os termos e envie para análise." onClick={()=>setIsPartner25(true)}/><Choice selected={isPartner25===false} title="Não sou o sócio responsável" text="Indique um sócio responsável. Ele recebe um link simples para selfie e autorização." onClick={()=>setIsPartner25(false)}/></div>

            {isPartner25!==null&&<div className="mt-5"><Field label="Sócio no QSA">{qsa.length?<select value={selectedQsaName} onChange={e=>setSelectedQsaName(e.target.value)} className={inputClass}><option value="">Selecione</option>{qsa.map((item:any)=><option key={`${item.name}-${item.qualification||''}`} value={item.name}>{item.name}{item.qualification?` · ${item.qualification}`:''}</option>)}</select>:<input value={selectedQsaName} onChange={e=>setSelectedQsaName(e.target.value)} placeholder="Nome completo do sócio responsável" className={inputClass}/>}<p className="mt-2 text-[10px] leading-4 text-stone-400">A consulta pública normalmente informa quem são os sócios e suas qualificações, mas não o percentual societário. O critério de 25% é declarado por quem solicita a verificação.</p></Field></div>}

            {isPartner25===true&&<div className="mt-5"><SimpleSelfie selfie={selfie} locked={locked} working={working==='selfie'} onFile={file=>void uploadSelfie(file)}/><Consent accepted={accepted} setAccepted={setAccepted} version={data?.consentVersion}/><button type="button" onClick={()=>void submitSelfVerification()} disabled={!accepted||!selfie||working==='submit'||!data?.user?.contactReady} className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white disabled:opacity-40">{working==='submit'?<Loader2 className="h-4 w-4 animate-spin"/>:<BadgeCheck className="h-4 w-4"/>}Enviar para análise</button></div>}

            {isPartner25===false&&<div className="mt-5 rounded-[24px] bg-stone-50 p-5 ring-1 ring-stone-200"><div className="grid gap-4 sm:grid-cols-2"><Field label="E-mail do sócio responsável"><input type="email" value={partnerEmail} onChange={e=>setPartnerEmail(e.target.value)} className={inputClass} placeholder="socio@empresa.com.br"/></Field><Field label="Telefone / WhatsApp"><input value={partnerPhone} onChange={e=>setPartnerPhone(e.target.value)} className={inputClass} placeholder="(00) 00000-0000"/></Field></div><div className="mt-4"><Choice selected={grantFullPowers} title="Dar plenos poderes ao administrador" text="O sócio autoriza o administrador atual a operar perfil, recrutamento, Marketplace, financeiro e equipe." onClick={()=>setGrantFullPowers(true)}/><div className="mt-2"><Choice selected={!grantFullPowers} title="Limitar os poderes" text="O sócio escolhe quais áreas o administrador poderá operar." onClick={()=>setGrantFullPowers(false)}/></div></div>{!grantFullPowers&&<div className="mt-4 grid gap-2 sm:grid-cols-2">{(Object.keys(permissionLabels) as PermissionKey[]).map(key=><label key={key} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-bold ring-1 ring-stone-200"><input type="checkbox" checked={permissions[key]} onChange={e=>setPermissions(current=>({...current,[key]:e.target.checked}))}/>{permissionLabels[key]}</label>)}</div>}<button type="button" onClick={()=>void sendPartnerAuthorization()} disabled={!selectedQsaName||!partnerEmail.trim()||working==='invite'} className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-black text-white disabled:opacity-40">{working==='invite'?<Loader2 className="h-4 w-4 animate-spin"/>:<Mail className="h-4 w-4"/>}Enviar autorização ao sócio</button>{latestAuthorization&&<AuthorizationStatus item={latestAuthorization}/>}</div>}
          </section>}

          {company.verified&&<div className="rounded-[26px] border border-emerald-200 bg-emerald-50 p-6"><div className="flex gap-3"><CheckCircle2 className="h-6 w-6 text-emerald-700"/><div><h2 className="text-lg font-black text-emerald-950">Empresa verificada</h2><p className="mt-1 text-xs leading-5 text-emerald-800">A empresa está liberada. Você pode atualizar periodicamente a consulta do CNPJ sem refazer a verificação inteira; mudanças relevantes geram alerta para conferência.</p></div></div></div>}
        </>}
      </>}
  </div>;
}

function ContactCard({user}:{user:any}){return <section className="grid gap-3 sm:grid-cols-2"><MiniStatus icon={<Mail className="h-4 w-4"/>} ok={Boolean(user?.email)} title="E-mail" text={user?.email||'Cadastre um e-mail'}/><MiniStatus icon={<Phone className="h-4 w-4"/>} ok={Boolean(user?.phoneVerified)} title="Telefone / WhatsApp" text={user?.phoneVerified?(user?.phone||'Validado'):'Validação necessária antes de enviar'}/></section>}
function PersonalVerification({selfie,locked,working,accepted,setAccepted,consentVersion,onSelfie,onSubmit}:{selfie:any;locked:boolean;working:string;accepted:boolean;setAccepted:(v:boolean)=>void;consentVersion:string;onSelfie:(f:File|null)=>void;onSubmit:()=>void}){return <section className="rounded-[28px] bg-white p-5 ring-1 ring-stone-200 sm:p-6"><div className="flex gap-3"><UserRound className="h-5 w-5 text-[#b06448]"/><div><h2 className="text-xl font-black">Verificação para vender como pessoa</h2><p className="mt-1 text-xs leading-5 text-stone-500">Uma selfie, e-mail cadastrado, telefone validado e aceite. Sem upload obrigatório de RG ou comprovante.</p></div></div><div className="mt-5"><SimpleSelfie selfie={selfie} locked={locked} working={working==='selfie'} onFile={onSelfie}/></div><Consent accepted={accepted} setAccepted={setAccepted} version={consentVersion}/><button type="button" onClick={onSubmit} disabled={!selfie||!accepted||working==='submit'||locked} className="mt-4 inline-flex h-12 items-center gap-2 rounded-2xl bg-[#b85f42] px-5 text-sm font-black text-white disabled:opacity-40">{working==='submit'?<Loader2 className="h-4 w-4 animate-spin"/>:<ShieldCheck className="h-4 w-4"/>}Enviar para análise</button></section>}
function RegistryCard({company}:{company:any}){const qsa=Array.isArray(company?.cnpjSnapshot?.qsa)?company.cnpjSnapshot.qsa:[];return <section className="rounded-[28px] bg-white p-5 ring-1 ring-stone-200 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Dados jurídicos · consulta pública</p><h2 className="mt-1 text-xl font-black">{company.legalName||'Razão social'}</h2><p className="mt-1 text-xs text-stone-500">CNPJ {company.cnpj} · {company.cnpjSituation||'situação não informada'}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase text-emerald-700">{company.cnpjDataSource||'CNPJ'}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Data label="Nome fantasia cadastral" value={company.registryTradeName||'Não informado'}/><Data label="Endereço jurídico" value={company.legalAddress||'Não informado'}/></div>{qsa.length>0&&<div className="mt-5"><p className="text-[10px] font-black uppercase tracking-[.12em] text-stone-400">Quadro de Sócios e Administradores</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{qsa.map((item:any)=><div key={`${item.name}-${item.qualification||''}`} className="rounded-2xl bg-stone-50 p-3"><p className="text-sm font-black">{item.name}</p><p className="mt-1 text-[10px] text-stone-500">{item.qualification||'Qualificação não informada'}</p></div>)}</div></div>}<p className="mt-4 text-[10px] leading-4 text-stone-400">Estes dados são referência cadastral e não são editados manualmente no PiraNegócios. Para atualizar, refaça a consulta do CNPJ.</p></section>}
function CommercialCard({company,name,setName,same,setSame,address,setAddress,city,setCity,state,setState,working,onSave}:{company:any;name:string;setName:(v:string)=>void;same:boolean;setSame:(v:boolean)=>void;address:string;setAddress:(v:string)=>void;city:string;setCity:(v:string)=>void;state:string;setState:(v:string)=>void;working:boolean;onSave:()=>void}){return <section className="rounded-[28px] bg-white p-5 ring-1 ring-stone-200 sm:p-6"><div className="flex gap-3"><MapPin className="h-5 w-5 text-[#397c75]"/><div><h2 className="text-xl font-black">Como a empresa aparece para o público</h2><p className="mt-1 text-xs text-stone-500">Nome e endereço comerciais podem ser diferentes dos dados jurídicos.</p></div></div><div className="mt-5"><Field label="Nome comercial"><input value={name} onChange={e=>setName(e.target.value)} className={inputClass} placeholder={company.registryTradeName||company.legalName||'Nome comercial'}/></Field></div><label className="mt-4 flex items-start gap-3 rounded-2xl bg-stone-50 p-4"><input type="checkbox" checked={same} onChange={e=>setSame(e.target.checked)} className="mt-1"/><span className="text-xs leading-5 text-stone-600"><strong className="block text-stone-900">Endereço comercial igual ao jurídico</strong>Quando marcado, mudanças futuras no endereço jurídico consultado também atualizam a referência comercial.</span></label>{!same&&<div className="mt-4 grid gap-3"><Field label="Endereço comercial"><input value={address} onChange={e=>setAddress(e.target.value)} className={inputClass}/></Field><div className="grid gap-3 sm:grid-cols-[1fr_100px]"><Field label="Cidade"><input value={city} onChange={e=>setCity(e.target.value)} className={inputClass}/></Field><Field label="UF"><input value={state} onChange={e=>setState(e.target.value.toUpperCase())} maxLength={2} className={inputClass}/></Field></div></div>}<button type="button" onClick={onSave} disabled={working||!name.trim()} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0d4542] px-4 text-xs font-black text-white disabled:opacity-40">{working?<Loader2 className="h-4 w-4 animate-spin"/>:<CheckCircle2 className="h-4 w-4"/>}Salvar dados comerciais</button></section>}
function SimpleSelfie({selfie,locked,working,onFile}:{selfie:any;locked:boolean;working:boolean;onFile:(f:File|null)=>void}){return <div className={`rounded-[24px] border p-5 ${selfie?'border-emerald-200 bg-emerald-50':'border-stone-200 bg-stone-50'}`}><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm"><Camera className="h-5 w-5"/></span><div className="flex-1"><h3 className="text-sm font-black">Selfie atual</h3><p className="mt-1 text-xs text-stone-500">{selfie?'Selfie recebida e guardada no cofre privado.':'Foto frontal, atual e nítida.'}</p></div>{selfie&&<CheckCircle2 className="h-5 w-5 text-emerald-600"/>}</div>{!locked&&<label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white"><input type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="hidden" onChange={e=>{onFile(e.target.files?.[0]||null);e.currentTarget.value=''}} disabled={working}/>{working?<Loader2 className="h-4 w-4 animate-spin"/>:<Camera className="h-4 w-4"/>}{selfie?'Trocar selfie':'Tirar/enviar selfie'}</label>}</div>}
function Consent({accepted,setAccepted,version}:{accepted:boolean;setAccepted:(v:boolean)=>void;version:string}){return <label className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1"/><span className="text-xs leading-5 text-emerald-950">Li e aceito os <Link to="/classificados/termos" className="font-black underline">termos de verificação e Marketplace</Link>, versão {version}. A selfie e os dados cadastrais são usados para segurança e prevenção de fraude.</span></label>}
function AuthorizationStatus({item}:{item:any}){return <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200"><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">Última autorização</p><p className="mt-1 text-sm font-black">{item.partnerName} · {statusLabel(item.status)}</p>{item.reviewReason&&<p className="mt-1 text-xs text-red-600">{item.reviewReason}</p>}</div>}
function MiniStatus({icon,ok,title,text}:{icon:React.ReactNode;ok:boolean;title:string;text:string}){return <div className={`rounded-2xl border p-4 ${ok?'border-emerald-200 bg-emerald-50':'border-amber-200 bg-amber-50'}`}><div className="flex items-center gap-3"><span className={ok?'text-emerald-700':'text-amber-700'}>{icon}</span><div><p className="text-xs font-black">{title}</p><p className="mt-0.5 text-[10px] text-stone-600">{text}</p></div></div></div>}
function Choice({selected,title,text,onClick}:{selected:boolean;title:string;text:string;onClick:()=>void}){return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left ${selected?'border-[#397c75] bg-[#eef8f6] ring-2 ring-[#397c75]/10':'border-stone-200 bg-white hover:bg-stone-50'}`}><div className="flex items-center justify-between"><strong className="text-sm">{title}</strong><span className={`h-4 w-4 rounded-full border-4 ${selected?'border-[#397c75]':'border-stone-300'}`}/></div><p className="mt-2 text-xs leading-5 text-stone-500">{text}</p></button>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="mb-2 block text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{label}</span>{children}</label>}
function Data({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-stone-50 p-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{label}</p><p className="mt-1 text-sm font-bold text-stone-800">{value}</p></div>}
function StatusBadge({status}:{status:string}){const approved=status==='APPROVED';const pending=status==='PENDING';return <span className={`w-fit rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[.12em] ${approved?'bg-emerald-400/15 text-emerald-300':pending?'bg-amber-400/15 text-amber-200':'bg-white/10 text-white/65'}`}>{approved?'Verificado':pending?'Em análise':status==='REJECTED'?'Reprovado':'Não verificado'}</span>}
function statusLabel(value:string){return value==='APPROVED'?'Aprovada':value==='SUBMITTED'?'Aguardando análise':value==='REJECTED'?'Reprovada':value==='EXPIRED'?'Expirada':value==='REVOKED'?'Substituída':'Aguardando o sócio'}
function EmptyCompany(){return <div className="mx-auto max-w-2xl rounded-3xl bg-amber-50 p-7 text-amber-900"><Building2 className="h-6 w-6"/><h1 className="mt-3 font-serif text-3xl font-black">Cadastre uma empresa primeiro</h1><p className="mt-2 text-sm">A verificação empresarial aparece depois que existe um perfil de empresa.</p><Link to="/company/perfil" className="mt-4 inline-flex rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-black text-white">Ir para Empresa</Link></div>}
const inputClass='h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm outline-none focus:border-[#397c75] focus:ring-2 focus:ring-[#397c75]/10';
