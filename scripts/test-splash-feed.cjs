const assert=require('node:assert/strict');
const {ClassifiedsSplashController}=require('../backend/dist/classifieds/classifieds-splash.controller.js');
const url='http://127.0.0.1:3194/api/properties';
let requests=0;
global.fetch=async input=>{
 assert.equal(input,url);
 requests++;
 return new Response(JSON.stringify({properties:[
  {id:'00000000-0000-4000-8000-000000000011',title:'Sítio de teste com piscina',city:'Pirassununga',state:'SP',price_cents:50000,capacity:10,category:'SITIO',photos:['/api/media/123'],reviews:4,rating:4.5},
  {id:'00000000-0000-4000-8000-000000000012',title:'Salão de eventos',city:'Leme',state:'SP',price_cents:120000,capacity:100,category:'SALAO',photos:['https://untrusted.example/image.jpg']},
  {id:'bad',title:null,city:'Nada',state:'SP',price_cents:0,capacity:0}
 ]}),{status:200,headers:{'Cache-Control':'max-age=45'}});
};
(async()=>{
 const c=new ClassifiedsSplashController();
 const all=await c.listings({});
 assert.equal(all.total,2);
 assert.equal(all.items[0].url,'https://splash.piranegocios.com.br/espaco/00000000-0000-4000-8000-000000000011');
 assert.equal(all.items[0].image,'https://splash.piranegocios.com.br/api/media/123');
 assert.equal(all.items[1].image,null);
 assert.equal((await c.listings({city:'Leme'})).total,1);
 assert.equal((await c.listings({q:'piscina'})).total,1);
 assert.equal((await c.listings({q:'moto'})).total,0);
 assert.equal(requests,1,'single upstream request within TTL');
 assert.ok(!JSON.stringify(all).includes('host_id'),'no host private fields');
 console.log('SPLASH_CLASSIFIEDS_FEED_TEST_PASS');
})().catch(err=>{console.error(err);process.exitCode=1});