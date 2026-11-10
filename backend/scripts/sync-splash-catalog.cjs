// Sincronização unidirecional e idempotente: Splash -> projeção pública no catálogo.
// Não move reservas, pagamentos, documentos nem permissões administrativas.
const fs=require('fs');const path=require('path');const {Client}=require('pg');
function envFile(file){const o={};for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){if(!line||line.trim().startsWith('#'))continue;const i=line.indexOf('=');if(i<1)continue;const k=line.slice(0,i).trim();let v=line.slice(i+1).trim();if((v[0]==='"'&&v.at(-1)==='"')||(v[0]==="'"&&v.at(-1)==="'"))v=v.slice(1,-1);o[k]=v;}return o;}
const pira=envFile(path.resolve(__dirname,'../.env'));
const dst=new Client({host:pira.DB_HOST||'localhost',port:Number(pira.DB_PORT||5432),user:pira.DB_USER||'postgres',password:pira.DB_PASS,database:pira.DB_NAME||'piranegocios',ssl:pira.DB_SSL==='true'?{rejectUnauthorized:false}:undefined});
(async()=>{await dst.connect();try{
 const response=await fetch('http://127.0.0.1:3194/api/properties',{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Splash indisponível para sincronização');
 const payload=await response.json();
 if(!Array.isArray(payload?.properties))throw Error('Resposta Splash inválida');
 const rows=payload.properties;
 await dst.query('BEGIN');let published=0,hidden=0;
 for(const p of rows){const visible=true; // A API Splash já aplica aprovação, host verificado e regras de plano.
 const urls=(p.photos||[]).filter(x=>typeof x==='string'&&x.startsWith('/')).map(x=>'https://splash.piranegocios.com.br'+x);
 const {rows:[l]}=await dst.query(`INSERT INTO marketplace.listings(module_code,origin,origin_id,title,description,city,state,price_cents,category,capacity,media,status,destination_url) VALUES('rentals','splash',$1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) ON CONFLICT(origin,origin_id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,city=EXCLUDED.city,state=EXCLUDED.state,price_cents=EXCLUDED.price_cents,category=EXCLUDED.category,capacity=EXCLUDED.capacity,media=EXCLUDED.media,status=EXCLUDED.status,destination_url=EXCLUDED.destination_url,updated_at=now() RETURNING id`,[p.id,p.title,p.description||'',p.city,p.state,p.price_cents,p.category,p.capacity,JSON.stringify(urls),visible?'PUBLISHED':'PAUSED','https://splash.piranegocios.com.br/espaco/'+encodeURIComponent(p.id)]);
 await dst.query(`INSERT INTO marketplace.rental_projection(listing_id,rental_property_id,bedrooms,bathrooms,amenities,instant_booking) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(listing_id) DO UPDATE SET bedrooms=EXCLUDED.bedrooms,bathrooms=EXCLUDED.bathrooms,amenities=EXCLUDED.amenities,instant_booking=EXCLUDED.instant_booking`,[l.id,p.id,p.bedrooms,p.bathrooms,p.amenity_keys||p.amenities||[],p.instant_booking]);
 for(const channel of ['splash','piranegocios'])await dst.query(`INSERT INTO marketplace.listing_channels(listing_id,channel_code,enabled) VALUES($1,$2,$3) ON CONFLICT(listing_id,channel_code) DO UPDATE SET enabled=EXCLUDED.enabled`,[l.id,channel,visible]);
 if(visible)published++;else hidden++;
 }
 // Revoga projeções de propriedades excluídas da Splash, sem apagar auditoria.
 const ids=rows.map(p=>String(p.id));
 const missed= rows.length<80 ? await dst.query(`UPDATE marketplace.listings SET status='ARCHIVED',updated_at=now() WHERE origin='splash' AND NOT(origin_id=ANY($1::text[])) RETURNING id`,[ids]) : {rows:[],rowCount:0};
 await dst.query(`UPDATE marketplace.listing_channels SET enabled=false WHERE listing_id=ANY($1::uuid[])`,[missed.rows.map(r=>r.id)]);
 await dst.query('COMMIT');console.log(JSON.stringify({sourceCount:rows.length,published,hidden,archived:missed.rowCount}));
 }catch(e){await dst.query('ROLLBACK');throw e;}finally{await dst.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});
