'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict');
const dotenv=require('dotenv');
const {initializeApp,cert,deleteApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {Pool}=require('pg');
if(process.env.ENABLE_REAL_FIREBASE_QA!=='YES')throw Error('Requires explicit ENABLE_REAL_FIREBASE_QA=YES');
const root=path.resolve(__dirname,'..');
const appEnv=dotenv.parse(fs.readFileSync(path.join(root,'.env')));
const splashEnv=dotenv.parse(fs.readFileSync('/srv/splash-laser-e-eventos/.env'));
const publicFirebase=JSON.parse(fs.readFileSync(path.join(root,'../firebase-applet-config.json'),'utf8'));
const serviceAccount=JSON.parse(fs.readFileSync(path.resolve(root,appEnv.FIREBASE_CREDENTIALS),'utf8'));
const firebase=initializeApp({credential:cert(serviceAccount)},'splash-qa-'+Date.now());
const auth=getAuth(firebase);
const pool=new Pool({connectionString:splashEnv.DATABASE_URL,max:1});
const uid='qa-splash-'+crypto.randomUUID();
const email=uid+'@example.invalid';
(async()=>{
 let created=false,dbCreated=false;
 try{
  await auth.createUser({uid,email,emailVerified:true,displayName:'Splash QA Firebase'});
  created=true;
  console.log('PASS synthetic verified Firebase user created');
  const custom=await auth.createCustomToken(uid);
  const key=publicFirebase.apiKey;
  assert(key,'Firebase API key missing from public config');
  const signIn=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key='+encodeURIComponent(key),{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:custom,returnSecureToken:true}),
   signal:AbortSignal.timeout(20000)
  });
  const response=await signIn.json().catch(()=>({}));
  if(!signIn.ok||!response.idToken)throw Error('Firebase rejected synthetic test credential: '+String(response.error?.message||signIn.status));
  console.log('PASS Firebase Identity Toolkit exchanged valid custom credential for real Firebase ID token');
  const site='https://splash.piranegocios.com.br';
  const first=await fetch(site+'/api/auth/piranegocios',{
   method:'POST',headers:{'Origin':'https://piranegocios.com.br','Content-Type':'application/json'},
   body:JSON.stringify({idToken:response.idToken}),signal:AbortSignal.timeout(15000)
  });
  const data=await first.json().catch(()=>({}));
  assert.equal(first.status,200,'Splash federated auth rejected real Firebase token');
  assert.equal(data.user.email,email);
  assert.equal(data.user.piranegocios_linked,true);
  const cookie=first.headers.get('set-cookie')?.split(';')[0];
  assert(cookie?.startsWith('splash_session='));
  dbCreated=true;
  console.log('PASS Splash created federated session and httpOnly cookie');
  const me=await fetch(site+'/api/me',{headers:{Cookie:cookie},signal:AbortSignal.timeout(15000)});
  const got=await me.json();
  assert.equal(got.user.id,data.user.id);
  console.log('PASS Splash session bootstrap returned same user');
  const again=await fetch(site+'/api/auth/piranegocios',{method:'POST',headers:{'Origin':'https://piranegocios.com.br','Content-Type':'application/json'},body:JSON.stringify({idToken:response.idToken})});
  assert.equal(again.status,200);
  const againBody=await again.json();
  assert.equal(againBody.user.id,data.user.id,'Federated login duplicated account');
  console.log('PASS repeated federated login reused existing identity');
  console.log('FIREBASE_SPLASH_REAL_PROVIDER_E2E_PASS');
 }finally{
  await pool.query("DELETE FROM users WHERE firebase_uid=$1 AND email=$2",[uid,email]).catch(e=>console.error('QA database cleanup failed:',e.code||e.name));
  if(created)await auth.deleteUser(uid).catch(e=>console.error('QA Firebase cleanup failed:',e.code||e.name));
  await deleteApp(firebase);
  await pool.end();
  console.log('QA synthetic user removal attempted in both providers');
 }
})().catch(e=>{console.error('FIREBASE_SPLASH_REAL_PROVIDER_E2E_FAILED:',e.message);process.exitCode=1});