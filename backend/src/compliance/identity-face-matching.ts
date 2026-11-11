/** Non-decisional biometric triage through the loopback-only CompreFace service. */
export type FaceTriage={status:'LIKELY_MATCH'|'POSSIBLE_MISMATCH'|'INCONCLUSIVE'|'UNAVAILABLE';reason:string;similarity:number|null};
export async function compareIdentityFaces(selfie:{buffer:Buffer;mimeType:string},document:{buffer:Buffer;mimeType:string}):Promise<FaceTriage>{
 const key=process.env.COMPREFACE_API_KEY;
 if(!key)return {status:'UNAVAILABLE',reason:'SERVICE_NOT_CONFIGURED',similarity:null};
 let url:URL;
 try{url=new URL(process.env.COMPREFACE_URL||'http://127.0.0.1:18080')}catch{return {status:'UNAVAILABLE',reason:'INVALID_URL',similarity:null}}
 if(url.protocol!=='http:'||!['127.0.0.1','localhost','::1'].includes(url.hostname))return {status:'UNAVAILABLE',reason:'NON_LOCAL_SERVICE',similarity:null};
 if([selfie,document].some(x=>!x?.buffer||!x.mimeType.startsWith('image/')))return {status:'INCONCLUSIVE',reason:'IMAGES_REQUIRED',similarity:null};
 if([selfie,document].some(x=>x.buffer.length>5*1024*1024))return {status:'INCONCLUSIVE',reason:'IMAGE_TOO_LARGE',similarity:null};
 try{
  const body=new FormData();body.append('source_image',new Blob([new Uint8Array(selfie.buffer)],{type:selfie.mimeType}),'selfie.jpg');body.append('target_image',new Blob([new Uint8Array(document.buffer)],{type:document.mimeType}),'document.jpg');
  const response=await fetch(new URL('/api/v1/verification/verify',url),{method:'POST',headers:{'x-api-key':key},body,signal:AbortSignal.timeout(20000)});
  if(!response.ok)return {status:'UNAVAILABLE',reason:'SERVICE_HTTP_'+response.status,similarity:null};
  const data=await response.json() as any;const faces=Array.isArray(data?.result)?data.result:[];
  if(faces.length!==1)return {status:'INCONCLUSIVE',reason:faces.length?'MULTIPLE_FACES':'NO_FACE_DETECTED',similarity:null};
  const s=faces[0]?.similarity;
  if(typeof s!=='number'||!Number.isFinite(s))return {status:'INCONCLUSIVE',reason:'NO_SCORE',similarity:null};
  const similarity=Math.max(0,Math.min(1,s));
  return {status:similarity>=0.85?'LIKELY_MATCH':similarity<0.45?'POSSIBLE_MISMATCH':'INCONCLUSIVE',reason:'UNCALIBRATED_SCORE',similarity};
 }catch{return {status:'UNAVAILABLE',reason:'SERVICE_TIMEOUT_OR_FAILURE',similarity:null}}
}
