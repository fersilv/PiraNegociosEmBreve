'use strict';
if(process.env.ENABLE_AUTH_QA!=='YES')throw new Error('Explicit ENABLE_AUTH_QA=YES required');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base='/srv/piranegocios-staging/project',deps=base+'/backend/node_modules';
const dotenv=require(deps+'/dotenv');
const fbApp=require('firebase-admin/app');
const getAuth=require('firebase-admin/auth').getAuth;
const Pool=require(deps+'/pg').Pool;
const env=dotenv.parse(fs.readFileSync(base+'/backend/.env'));
const cert=JSON.parse(fs.readFileSync(path.resolve(base+'/backend',env.FIREBASE_CREDENTIALS)));
const app=fbApp.initializeApp({credential:fbApp.cert(cert)},'pira-nav-qa-'+Date.now()),auth=getAuth(app);
const uid='qa-navigation-'+crypto.randomUUID(),email=uid+'@example.invalid';
const password=crypto.randomBytes(25).toString('base64url')+'9!';
const db=new Pool({host:'127.0.0.1',port:5432,user:env.DB_USER,database:env.DB_NAME,password:env.DB_PASS,max:1});
const splashEnv=dotenv.parse(fs.readFileSync('/srv/splash-laser-e-eventos/.env'));
const splashDb=new Pool({connectionString:splashEnv.DATABASE_URL,max:1});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const routes=process.env.PIRA_QA_SHORT==='YES'?['/vagas','/classificados/explorar','/splash/entrar?returnTo=%2Fperfil']:['/user','/carreiras','/vagas','/classificados','/classificados/explorar','/classificados/favoritos','/classificados/anuncios','/classificados/publicar','/classificados/compras','/classificados/conversas','/classificados/ofertas','/classificados/servicos','/classificados/avaliacoes','/classificados/analytics','/classificados/configuracoes','/splash/entrar?returnTo=%2Fperfil'];
let socket,chrome,seq=0,current='',waiters=new Map(),errors=[],httpErrors=[],records=[],signedIn=false,created=false;
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;waiters.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));setTimeout(()=>{if(waiters.has(id)){waiters.delete(id);reject(Error('CDP timeout '+method))}},17000).unref()});
const evalJs=async code=>{const r=await send('Runtime.evaluate',{expression:code,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error('CDP runtime: '+JSON.stringify(r.exceptionDetails).slice(0,130));return r.result.value};
const get=()=>evalJs("(()=>{const s=document.querySelector('#root')?.innerText||document.body?.innerText||'';return {url:location.href,len:s.length,text:s.slice(0,230),width:document.documentElement.scrollWidth,viewport:innerWidth,buttons:document.querySelectorAll('button').length}})()");
const navigate=async url=>{await send('Page.navigate',{url});await sleep(1950);return get()};
const fill=(selector,value)=>evalJs("(()=>{const e=document.querySelector("+JSON.stringify(selector)+");if(!e)return false;const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(e,"+JSON.stringify(value)+");e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()");
(async()=>{
 try{
  await auth.createUser({uid,email,password,emailVerified:true,displayName:'QA Pira Navigation'});created=true;
  console.log('QA_FIREBASE_CREATED');
  chrome=require('node:child_process').spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-proxy-server','--remote-allow-origins=*','--remote-debugging-port=19729','--window-size=390,844','--user-data-dir=/tmp/pira-auth-test-'+process.pid,'about:blank'],{stdio:'ignore'});
  let tab;
  for(let i=0;i<70;i++){await sleep(160);try{tab=(await(await fetch('http://127.0.0.1:19729/json/list')).json()).find(x=>x.type==='page'&&x.webSocketDebuggerUrl);if(tab)break}catch{}}
  if(!tab)throw Error('Chrome debugging not available');
  socket=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok,no)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',no,{once:true})});
  socket.addEventListener('message',e=>{const d=JSON.parse(e.data);if(d.id&&waiters.has(d.id)){const o=waiters.get(d.id);waiters.delete(d.id);d.error?o.reject(Error(d.error.message)):o.resolve(d.result)}else if(d.method==='Runtime.exceptionThrown')errors.push({route:current,message:d.params?.exceptionDetails?.text||'uncaught JS exception'});else if(d.method==='Network.responseReceived'){const r=d.params?.response;if(r?.status>=400&&r?.url?.includes('piranegocios.com.br'))httpErrors.push({route:current,status:r.status,url:r.url.split('?')[0].slice(0,120)})}});
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  current='/login';let p=await navigate('https://piranegocios.com.br/login?returnTo=%2Fclassificados%2Fexplorar');
  console.log('LOGIN_RENDER '+JSON.stringify({url:p.url,len:p.len,text:p.text.slice(0,110)}));
  if(!p.url.includes('/login'))throw Error('Login page missing');
  if(!await fill('form input[type="email"]',email)||!await fill('form input[type="password"]',password))throw Error('Missing login fields');
  await evalJs("(()=>{document.querySelector('form button[type=submit]')?.click();return true})()");
  for(let i=0;i<20;i++){await sleep(500);p=await get();if(!p.url.includes('/login')){signedIn=true;break}}
  console.log('LOGIN_RESULT '+JSON.stringify({signedIn,url:p.url,text:p.text.slice(0,180)}));
  if(!signedIn)throw Error('Login form failed to authenticate');
  for(const route of routes){
   current=route;
   try{const data=await navigate('https://piranegocios.com.br'+route);records.push({route,...data});console.log('AUTH_ROUTE '+JSON.stringify({route,finalUrl:data.url.slice(0,130),len:data.len,width:data.width,viewport:data.viewport,text:data.text.slice(0,105)}))}
   catch(e){records.push({route,error:e.message});console.log('AUTH_ROUTE_FAIL '+route+' '+e.message)}
  }
  console.log('AUTH_JS_ERRORS '+JSON.stringify(errors.slice(0,25)));
  console.log('AUTH_HTTP_ERRORS '+JSON.stringify(httpErrors.slice(0,35)));
  fs.writeFileSync('/srv/piranegocios-staging/authenticated-qa-report.json',JSON.stringify({signedIn,at:new Date().toISOString(),routes:records,jsErrors:errors,httpErrors},null,2));
  console.log('AUTHENTICATED_QA_REPORT_SAVED');
 }catch(e){console.error('AUTH_QA_FAILED '+(e.stack||e));process.exitCode=1}
 finally{
  socket?.close();chrome?.kill('SIGTERM');
  try{await db.query('DELETE FROM users WHERE id=$1 AND email=$2',[uid,email]);console.log('PIRA_QA_DB_CLEANUP_OK')}catch(e){console.error('PIRA_QA_DB_CLEANUP_ERROR',e.code)}
  try{const r=await splashDb.query("DELETE FROM users WHERE firebase_uid=$1 AND email=$2 AND role='CLIENT' RETURNING id",[uid,email]);console.log('SPLASH_QA_ACCOUNT_REMOVED',r.rowCount)}catch(e){console.error('SPLASH_QA_CLEANUP_FAILED',e.code)}
  if(created)try{await auth.deleteUser(uid);console.log('FIREBASE_QA_USER_DELETED')}catch(e){console.error('FIREBASE_QA_DELETE_FAILED',e.code)}
  await db.end();await splashDb.end();await fbApp.deleteApp(app);
 }
})();