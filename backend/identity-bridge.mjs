/** Loopback-only canonical identity bridge. Never accepts biometric files. */
import 'dotenv/config';
import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

const secret=process.env.IDENTITY_BRIDGE_SECRET;
if(!secret||secret.length<48)throw new Error('Missing identity bridge secret');
const pool=new pg.Pool({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||5432),user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME,max:4,connectionTimeoutMillis:3500});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const valid=(req,body)=>{
 const stamp=Number(req.headers['x-identity-timestamp']);
 if(!Number.isSafeInteger(stamp)||Math.abs(Date.now()-stamp)>60000)return false;
 const expected=crypto.createHmac('sha256',secret).update(`${stamp}\n${req.method}\n${req.url}\n${hash(body)}`).digest('hex');
 const supplied=String(req.headers['x-identity-signature']||'');
 return supplied.length===expected.length&&crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected));
};
const reply=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body))};
const getIdentity=async c=>{
 if(typeof c.uid!=='string'||!c.uid||c.uid.length>128||typeof c.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))return null;
 const rows=await pool.query(`SELECT id,email FROM users WHERE id::text=$1 OR lower(email)=lower($2) ORDER BY CASE WHEN id::text=$1 THEN 0 ELSE 1 END LIMIT 1`,[c.uid,c.email.toLowerCase()]);
 const u=rows.rows[0];
 // If matching Firebase UID already exists, email must agree, preventing cross-account grants.
 if(!u||String(u.email||'').toLowerCase()!==c.email.toLowerCase())return null;
 return u;
};
const current=async id=>{const r=await pool.query(`SELECT status,"verificationMethod","reviewedAt" FROM identity_verifications WHERE "userId"=$1 AND context='PERSONAL' AND "companyId" IS NULL ORDER BY "updatedAt" DESC LIMIT 1`,[id]);return r.rows[0]||null};
const server=http.createServer(async(req,res)=>{
 if(req.method!=='POST'||!['/status','/approve'].includes(req.url))return reply(res,404,{error:'Not found'});
 let chunks=[],size=0;
 try{
  for await(const x of req){size+=x.length;if(size>8192)throw Error('PAYLOAD_TOO_LARGE');chunks.push(x)}
  const body=Buffer.concat(chunks);
  if(!valid(req,body))return reply(res,403,{error:'Authentication required'});
  let c;try{c=JSON.parse(body.toString())}catch{return reply(res,400,{error:'Invalid JSON'})}
  const u=await getIdentity(c);
  if(!u)return reply(res,404,{found:false,approved:false});
  if(req.url==='/status'){
   const verification=await current(u.id);
   return reply(res,200,{found:true,approved:verification?.status==='APPROVED',status:verification?.status||'NOT_SUBMITTED',method:verification?.verificationMethod||null});
  }
  if(!['MANUAL','DOCUMENTS'].includes(c.method)||typeof c.auditId!=='string'||c.auditId.length<8||c.auditId.length>128)return reply(res,400,{error:'Invalid approval payload'});
  // Only an authenticated Splash admin action can request this call. We never accept model scores as approval.
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   await client.query(`INSERT INTO identity_verifications("userId","companyId",context,relationship,status,"verificationMethod","reviewedAt","reviewReason","updatedAt") VALUES ($1,NULL,'PERSONAL','PERSONAL','APPROVED',$2,now(),$3,now()) ON CONFLICT ("userId",COALESCE("companyId",'00000000-0000-0000-0000-000000000000'::uuid),context) DO UPDATE SET status='APPROVED',"verificationMethod"=$2,"reviewedAt"=now(),"reviewReason"=$3,"updatedAt"=now()`,[u.id,'SPLASH_'+c.method,'Aprovação administrativa no Splash. Auditoria: '+c.auditId]);
   await client.query(`UPDATE users SET "isVerified"=true,"updatedAt"=now() WHERE id=$1`,[u.id]);
   await client.query('COMMIT');return reply(res,200,{found:true,approved:true});
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
 }catch(e){console.error('identity_bridge_error',String(e.code||e.message).slice(0,80));return reply(res,e.message==='PAYLOAD_TOO_LARGE'?413:503,{error:'Identity synchronization unavailable'})}
});
server.listen(Number(process.env.IDENTITY_BRIDGE_PORT||3299),'127.0.0.1',()=>console.log('Identity bridge listening on loopback'));
