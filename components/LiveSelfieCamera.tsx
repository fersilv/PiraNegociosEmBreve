import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Camera,X,ShieldCheck} from 'lucide-react';

/** Fullscreen live-capture camera. This UX does not constitute tamper-proof liveness detection. */
export default function LiveSelfieCamera({onCapture,disabled=false,label='Abrir câmera'}:{onCapture:(file:File)=>void;disabled?:boolean;label?:string}){
 const video=useRef<HTMLVideoElement|null>(null),stream=useRef<MediaStream|null>(null),alive=useRef(true);
 const [open,setOpen]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const close=()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current){video.current.pause();video.current.srcObject=null}setOpen(false);setReady(false);setSaving(false)};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;stream.current?.getTracks().forEach(t=>t.stop())}},[]);
 useEffect(()=>{if(!open)return;const original=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=original}},[open]);
 useEffect(()=>{if(!open||!stream.current||!video.current)return;const v=video.current;v.srcObject=stream.current;void v.play().then(()=>setReady(true)).catch(()=>setError('Não foi possível iniciar a prévia da câmera.'))},[open]);
 const launch=async()=>{setError('');setReady(false);setOpen(true);try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Câmera indisponível. Use HTTPS e um navegador compatível.');
  let feed:MediaStream;
  try{feed=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:1280}}})}
  catch(e:any){if(['OverconstrainedError','NotFoundError'].includes(e?.name))feed=await navigator.mediaDevices.getUserMedia({audio:false,video:true});else throw e}
  if(!alive.current){feed.getTracks().forEach(t=>t.stop());return}
  stream.current=feed;
  if(video.current){video.current.srcObject=feed;await video.current.play();setReady(true)}
 }catch(e:any){setError(e?.name==='NotAllowedError'?'Permita o acesso à câmera para tirar a selfie.':e?.message||'Câmera indisponível.')}};
 const capture=()=>{const v=video.current;if(!v?.videoWidth||saving)return;setSaving(true);const canvas=document.createElement('canvas');canvas.width=Math.min(v.videoWidth,1280);canvas.height=Math.round(canvas.width*v.videoHeight/v.videoWidth);canvas.getContext('2d')?.drawImage(v,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{if(!blob){setError('Falha ao capturar a selfie.');setSaving(false);return}onCapture(new File([blob],'selfie-camera.jpg',{type:'image/jpeg'}));close()},'image/jpeg',.85)};
 return <><button type="button" disabled={disabled} onClick={()=>void launch()} className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 text-sm font-black text-white disabled:opacity-50"><Camera className="h-5 w-5"/>{label}</button>
 {open&&createPortal(<div className="fixed inset-0 z-[9999] flex bg-[#071713] text-white" role="dialog" aria-modal="true" aria-label="Capturar selfie"><div className="relative mx-auto h-[100dvh] w-full max-w-[760px] overflow-hidden bg-[#071713]">
  <video ref={video} autoPlay playsInline muted aria-label="Prévia da câmera" className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"/>
  <div className="pointer-events-none absolute left-1/2 top-[42%] h-[43dvh] w-[min(70vw,330px)] -translate-x-1/2 -translate-y-1/2 rounded-[48%] border-2 border-dashed border-white/80 shadow-[0_0_0_200vmax_rgba(2,15,10,.35)]"/>
  <header className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-5 pb-6 pt-[max(20px,env(safe-area-inset-top))]"><span className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-5 w-5"/> Verificação facial</span><button type="button" onClick={close} aria-label="Fechar câmera" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20"><X/></button></header>
  {!ready&&!error&&<div className="absolute inset-0 flex items-center justify-center bg-black/30 text-sm">Aguardando imagem da câmera...</div>}
  <footer className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#071713] via-[#071713]/90 to-transparent px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-10 text-center"><strong className="block text-base">Enquadre seu rosto</strong><p className="mb-5 mt-2 text-xs text-white/75">Olhe para a câmera e procure um lugar iluminado.</p>{error&&<p role="alert" className="mb-4 rounded-xl bg-red-800/80 p-3 text-sm">{error}</p>}<div className="grid grid-cols-[1fr_96px_1fr] items-center gap-2"><button onClick={close} type="button" className="justify-self-start rounded-full bg-white/20 px-4 py-3 text-xs font-black">Cancelar</button><button type="button" disabled={!ready||saving} onClick={capture} aria-label="Fotografar selfie" className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-[4px] border-white p-1 disabled:opacity-40"><span className="flex h-full w-full items-center justify-center rounded-full bg-white text-emerald-800"><Camera className="h-7 w-7"/></span></button></div></footer>
 </div></div>,document.body)}
 </>
}
