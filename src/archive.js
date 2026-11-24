const feeds=['https://www.cert.ssi.gouv.fr/alerte/feed/','https://www.cnil.fr/fr/rss.xml','https://www.microsoft.com/en-us/research/feed/','https://www.githubstatus.com/api/v2/incidents.json','https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=did:plc:kbdifeeymt5ppkl4gtq3i7be&limit=50'];
const labels=['CERT-FR','CNIL','Microsoft Research','GitHub Status','BleepingComputer · Bluesky'];
function clean(s){return String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g,' ').trim()}
function records(i,raw){
 if(i===3){return JSON.parse(raw).incidents.flatMap(x=>(x.incident_updates||[]).map(u=>['Incident IT',labels[i],u.created_at,x.name,clean(u.body).slice(0,480),x.shortlink,u.status,x.id]))}
 if(i===4){return JSON.parse(raw).feed.filter(x=>x.post.author.did==='did:plc:kbdifeeymt5ppkl4gtq3i7be').map(({post:p})=>['Réseaux sociaux',labels[i],p.record.createdAt,p.record.embed?.external?.title||p.record.text, '', 'https://bsky.app/profile/'+p.author.did+'/post/'+p.uri.split('/').pop(),'signal',p.record.embed?.external?.uri||''])}
 if(!/<rss|<feed|<rdf:RDF/.test(raw))throw Error();
 return [...raw.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(m=>{const field=k=>clean(m[1].match(new RegExp('<'+k+'(?: [^>]*)?>([\\s\\S]*?)</'+k+'>','i'))?.[1]);return [i===0?'Alertes cyber':i===2?'IA':/intelligence artificielle|\bIA\b/i.test(field('title'))?'IA':'Réglementation',labels[i],field('pubDate')||field('dc:date'),field('title'),field('description').slice(0,400),field('link'),'publication','']}).filter(x=>i!==2||/AI\b|machine learning|language model|artificial intelligence/i.test(x[3]+' '+x[4]))
}
async function archive(env){
 const bucket=env.BUCKET;if(!bucket)return Response.json({error:'Stockage indisponible'},{status:503});
 let obj=await bucket.get('veille.json'),old=obj?await obj.json():{rows:[],sources:[]};
 if(Date.now()-(old.at||0)<600000)return Response.json(old);
 let results=await Promise.all(feeds.map(async(url,i)=>{try{let r=await fetch(url,{signal:AbortSignal.timeout(9000)});if(!r.ok)throw Error();return {rows:records(i,await r.text()),ok:true,ts:Date.now()}}catch{return {rows:[],ok:false,ts:old.sources[i]?.ts||0}}}));
 const now=Date.now(),merged=new Map();for(let x of [...old.rows,...results.flatMap(y=>y.rows)]){let ts=Date.parse(x[2]);if(/^https?:\/\//i.test(x[5])&&ts<=now&&ts>now-190*86400000)merged.set(x[5]+'|'+x[2],x)}
 let state={at:now,rows:[...merged.values()].sort((a,b)=>Date.parse(b[2])-Date.parse(a[2])).slice(0,2500),sources:results.map(({ok,ts})=>({ok,ts}))};
 await bucket.put('veille.json',JSON.stringify(state));return Response.json(state)
}
export default {async fetch(req,env){let path=new URL(req.url).pathname;if(path==='/archive')return archive(env);if(/^\/feed\/[0-4]$/.test(path)){let i=+path.slice(-1),url=i===3?feeds[i].replace('incidents.json','incidents/unresolved.json'):feeds[i];try{let r=await fetch(url,{cf:{cacheTtl:15,cacheEverything:true}});return new Response(r.body,{status:r.status,headers:{'content-type':i>=3?'application/json':'application/xml'}})}catch{return new Response('',{status:503})}}let key=path==='/'?'index.html':path.slice(1);return Object.hasOwn(assets,key)?new Response(assets[key],{headers:{'content-type':key.endsWith('js')?'application/javascript; charset=utf-8':'text/html; charset=utf-8'}}):new Response('',{status:404})},async scheduled(_,env){await archive(env)}}
