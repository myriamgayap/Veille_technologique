const feeds=['https://www.cert.ssi.gouv.fr/alerte/feed/','https://www.cnil.fr/fr/rss.xml','https://www.microsoft.com/en-us/research/feed/','https://www.githubstatus.com/api/v2/incidents.json','https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=did:plc:kbdifeeymt5ppkl4gtq3i7be&limit=50','https://cert.cyber.gouv.fr/avis/feed/'];
const labels=['CERT-FR','CNIL','Microsoft Research','GitHub Status','BleepingComputer · Bluesky','CERT-FR · Avis'];
function clean(s){return String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g,' ').trim()}
function records(i,raw){
 if(i===3){return JSON.parse(raw).incidents.flatMap(x=>(x.incident_updates||[]).map(u=>['Incident IT',labels[i],u.created_at,x.name,clean(u.body).slice(0,480),x.shortlink,u.status,x.id,null,x.created_at,null,(u.affected_components || []).map(c=>c.name).filter(Boolean)]))}
 if(i===4){return JSON.parse(raw).feed.filter(x=>x.post.author.did==='did:plc:kbdifeeymt5ppkl4gtq3i7be').map(({post:p})=>['Réseaux sociaux',labels[i],p.record.createdAt,p.record.embed?.external?.title||p.record.text, '', 'https://bsky.app/profile/'+p.author.did+'/post/'+p.uri.split('/').pop(),'signal',p.record.embed?.external?.uri||''])}
 if(!/<rss|<feed|<rdf:RDF/.test(raw))throw Error();
 return [...raw.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(m=>{
   const field = key=>clean(m[1].match(new RegExp('<'+key+'(?: [^>]*)?>([\\s\\S]*?)</'+key+'>','i'))?.[1]);
   const kind = i===0 ? 'Alerte' : i===5 ? 'Avis' : 'publication';
   const theme = i===0 ? 'Alertes cyber' : i===5 ? 'Avis cyber' : i===2 || /intelligence artificielle|\bIA\b/i.test(field('title')) ? 'IA' : 'Réglementation';
   const published = field('pubDate') || field('dc:date');
   const updated = field('updated') || field('modified');
   return [theme,labels[i],published,field('title'),field('description').slice(0,400),field('link'),kind,'',null,null,
     i!==0 && i!==5 || !Number.isFinite(Date.parse(updated)) ? null : updated];
 }).filter(x=>i!==2||/AI\b|machine learning|language model|artificial intelligence/i.test(x[3]+' '+x[4]));
}
async function archive(env){
 const bucket=env.BUCKET;if(!bucket)return Response.json({error:'Stockage indisponible'},{status:503});
 let obj=await bucket.get('veille.json'),old=obj?await obj.json():{rows:[],sources:[]};
 if(Date.now()-(old.at||0)<600000)return Response.json(old);
 let results=await Promise.all(feeds.map(async(url,i)=>{try{let r=await fetch(url,{signal:AbortSignal.timeout(9000)});if(!r.ok)throw Error();return {rows:records(i,await r.text()),ok:true,ts:Date.now()}}catch{return {rows:[],ok:false,ts:old.sources[i]?.ts||0}}}));

 const now=Date.now(), merged=new Map(), firstDetections=new Map();
 const archiveKey = row=>publicationKey(row[5])+(bulletinReference(row[5]) ? '' : '|'+row[2]);
 const merge = row=>{
   const key = archiveKey(row), previous = merged.get(key);
   if (previous && bulletinReference(row[5])) {
     const latest = newestPublications([previous,row])[0];
     const first = previous[9] || previous[2];
     const published = row[9] || row[2];
     latest[9] = Date.parse(first) <= Date.parse(published) ? first : published;
     if (latest === previous) return;
   }
   merged.set(key,row);
 };
 for (const row of old.rows) {
   const id = publicationKey(row[5]);
   if (!firstDetections.has(id)) firstDetections.set(id, row[8] ?? null);
   merge(row);
 }
 for (const result of results) {
   for (const row of result.rows) {
     if (!/^https?:\/\//i.test(row[5]) || !Number.isFinite(Date.parse(row[2]))) continue;
     const id = publicationKey(row[5]);
     if (!firstDetections.has(id)) firstDetections.set(id, result.ts);
     row[8] = firstDetections.get(id);
     merge(row);
   }
 }
 const retained = [...merged.values()].filter(row=>{
   const published = Date.parse(row[10] || row[2]);
   return published <= now && published > now-190*86400000;
 });

 let state={at:now,rows:retained.sort((a,b)=>Date.parse(b[10] || b[2])-Date.parse(a[10] || a[2])).slice(0,2500),sources:results.map(({ok,ts})=>({ok,ts}))};
 await bucket.put('veille.json',JSON.stringify(state));return Response.json(state)
}
export default {async fetch(req,env){let path=new URL(req.url).pathname;if(path==='/archive')return archive(env);if(/^\/feed\/[0-5]$/.test(path)){let i=+path.slice(-1),url=i===3?feeds[i].replace('incidents.json','incidents/unresolved.json'):feeds[i];try{let r=await fetch(url,{cf:{cacheTtl:15,cacheEverything:true}});return new Response(r.body,{status:r.status,headers:{'content-type':(i===3||i===4)?'application/json':'application/xml'}})}catch{return new Response('',{status:503})}}let key=path==='/'?'index.html':path.slice(1);return Object.hasOwn(assets,key)?new Response(assets[key],{headers:{'content-type':key.endsWith('js')?'application/javascript; charset=utf-8':'text/html; charset=utf-8'}}):new Response('',{status:404})},async scheduled(_,env){await archive(env)}}
