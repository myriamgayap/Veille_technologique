const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),date=s=>s?new Date(s).toLocaleDateString('fr-FR'):'—',time=s=>s?new Date(s).toLocaleString('fr-FR'):'Jamais',day=86400000;
const names=['IA','Réglementation','Métiers tech','Alertes cyber','Réseaux sociaux'], horizons=['Intelligence artificielle','Évolution réglementaire','Nouveaux métiers tech'],tabs=['Vue d’ensemble','Incidents IT','Synthèses','Sources','Pertinence'];
const seed=[
['IA','CNIL','2025-07-22','Développer une IA dans le respect du RGPD','Repères pour examiner les données personnelles utilisées dans un projet d’IA.','https://www.cnil.fr/fr/developpement-des-systemes-dia-les-recommandations-de-la-cnil-pour-respecter-le-rgpd'],
['Réglementation','CNIL','2025-06-19','IA et intérêt légitime','Recommandations pour documenter le choix de la base légale lors du développement d’un système.','https://www.cnil.fr/fr/recommandations-developpement-ia-interet-legitime'],
['Métiers tech','ANSSI','2025-01-01','Les professionnels de la cybersécurité','L’enquête étudie les parcours professionnels et plus de 23 000 offres françaises. Un point de départ pour comparer les compétences recherchées.','https://cyber.gouv.fr/offre-de-service/formations-entrainement-et-decouverte-des-metiers/observatoires-des-metiers/observatoire-des-metiers-enquete-2025/']];
const sources=['CERT-FR','CNIL','Microsoft Research','GitHub Status','BleepingComputer · Bluesky'], urls=['https://www.cert.ssi.gouv.fr/alerte/','https://www.cnil.fr/fr','https://www.microsoft.com/en-us/research/blog/','https://www.githubstatus.com/','https://bsky.app/profile/bleepingcomputer.com'];
const relevanceTab=4, eventsTab=5, scopeTab=6;
let db=JSON.parse(localStorage.signalDB||'{}'),notes=JSON.parse(localStorage.signalNotes||'[]'),tab=location.hash==='#pertinence'?relevanceTab:0,theme='',src='',q='',period=30,days=0,busy=false;
const persist=()=>{localStorage.signalDB=JSON.stringify(db)},items=()=>[...new Map([...(archiveState?.rows || []).filter(row=>row[0]==='Incident IT' || row[1]===sources[0]), ...feedCandidates(), ...savedSignals()].filter(isPublication).filter(visiblePublication).map(row=>[publicationId(row),knownPublication(row)])).values()].sort((a,b)=>Date.parse(b[2])-Date.parse(a[2])),recent=(r,n)=>Date.now()-Date.parse(r[2])<=n*day,ok=i=>db[i]?.ok&&Date.now()-db[i].ts<day/24,link=(u,t)=>/^https?:\/\//i.test(u)?'<a target="_blank" rel="noopener" href="'+esc(u)+'">'+esc(t)+'</a>':'';
async function collect() {
  if (busy) return;
  busy = true;
  const attempts = sources.map((_,i)=>startSourceAttempt(i));
  if (tab===3) redraw();
  await Promise.all(sources.map(async (_,i)=>{
    try {
      const res = await fetch('/feed/'+i,{signal:AbortSignal.timeout(15000)});
      if (!res.ok) throw Error();
      const data = {};
      let updates;
      if (i===3) {
        const {incidents} = await res.json();
        if (!Array.isArray(incidents)) throw Error();
        data.inc = incidents;
        updates = githubPublications(incidents);
      } else if (i===4) {
        const {feed} = await res.json();
        if (!Array.isArray(feed)) throw Error();
        updates = feed.filter(x=>x.post?.author?.did===socialDid)
          .map(x=>socialRow(x.post.record,x.post.uri.split('/').pop())).filter(Boolean);
      } else {
        const doc = new DOMParser().parseFromString(await res.text(),'text/xml');
        if (doc.querySelector('parsererror') || !['rss','feed','RDF'].includes(doc.documentElement.localName)) throw Error();
        updates = [...doc.querySelectorAll('item,entry')].map(entry=>{
          const get = key=>entry.querySelector(key)?.textContent || '';
          const title = get('title');
          const theme = i===0 ? names[3] : i===2 || /intelligence artificielle|\bIA\b/i.test(title) ? names[0] : names[1];
          const url = entry.querySelector('link')?.getAttribute('href') || get('link');
          const body = new DOMParser().parseFromString(get('description') || get('summary'),'text/html').body.textContent.slice(0,320);
          return [theme,sources[i],get('pubDate') || get('updated'),title,body,url];
        }).filter(row=>isPublication(row) && (i!==2 || /AI|machine learning|language model|artificial intelligence/i.test(row[3]+' '+row[4])));
      }
      if (i!==3) {
        data.rows = [...new Map([...(db[i]?.rows || []), ...updates].map(row=>[publicationId(row),row])).values()].slice(-600);
      }
      endSourceAttempt(i, attempts[i], updates);
      db[i] = {...data,ok:true,ts:Date.now()};
    } catch {
      endSourceAttempt(i, attempts[i], null);
      db[i] = {...db[i],ok:false};
    }
  }));
  persist();
  busy = false;
  redraw();
}

function go(i){tab=i;history.replaceState(null,'',location.pathname+location.search+(i===relevanceTab?'#pertinence':''));render()}function filter(t,n=0){go(0);theme=t;days=n;q='';src='';render();$('#feed').scrollIntoView()}function list(){let rows=items().filter(r=>(!theme||r[0]===theme)&&(!src||src===r[1])&&(!days||recent(r,days))&&r.slice(0,5).join(' ').toLowerCase().includes(q.toLowerCase()));$('#results').innerHTML=rows.map(r=>'<article><span class="tag">'+esc(r[0].toUpperCase())+'</span><h3>'+esc(r[3])+'</h3><p>'+esc(r[4])+'</p><small>'+esc(r[1])+' · '+esc(publicationDates(r))+' · '+link(r[5],'Lire la source')+'</small></article>').join('')||'<div class="panel">Aucune publication pour ces filtres.</div>'}
function due(i){let start=new Date(2026,10,23),last=notes.find(x=>x.i===i),d=last?new Date(last.ts):start;if(i===0)d.setDate(d.getDate()+7);else d.setMonth(d.getMonth()+1);return d}
function hz(){return horizons.map((h,i)=>'<button class="horizon" onclick="filter(names['+i+'])"><b>H'+(i+1)+'</b><span>'+h+'<small>'+(i?'Mensuel':'Hebdomadaire')+' · '+(due(i)<new Date()?'En retard':'Échéance')+' '+date(due(i))+'</small></span></button>').join('')}
function opts(a,v){return a.map(x=>'<option '+(v===x?'selected':'')+'>'+esc(x)+'</option>').join('')}
function render(){nav.innerHTML=tabs.map((t,i)=>'<button class="'+(tab===i?'active':'')+'" onclick="go('+i+')">'+t+'</button>').join('');let r=items().filter(x=>recent(x,period)),fresh=sources.filter((_,i)=>ok(i)).length;
if(!tab){view.innerHTML=weekly()+'<div class="row"><h2>Indicateurs clés</h2><select aria-label="Période des indicateurs" onchange="period=+this.value;render()">'+[7,30].map(n=>'<option value="'+n+'" '+(n===period?'selected':'')+'>'+n+' derniers jours</option>').join('')+'</select></div><div class="grid">'+[['Publications',r.length,'Sur la période','filter(\'\',period)'],['Incidents IT',ok(3)&&db[3].inc.length?db[3].inc.length:'—','Couverture partielle','go(1)'],['Alertes prioritaires',ok(0)?r.filter(x=>x[0]===names[3]).length:'—','Bulletins d’alerte CERT-FR','filter(names[3],period)'],['Sources à jour',fresh+'/'+sources.length,busy?'Collecte en cours…':'Flux automatisés','go(3)']].map(([t,v,s,a])=>'<button class="card" onclick="'+a+'">'+t+'<strong>'+v+'</strong><small>'+s+'</small></button>').join('')+'</div><div class="cols"><section id="feed"><h2>Fil de veille</h2><div class="filters"><input aria-label="Recherche" placeholder="Rechercher une publication…" oninput="q=this.value;list()" value="'+esc(q)+'"><select aria-label="Thème" onchange="theme=this.value;list()"><option value="">Tous les thèmes</option>'+opts([...names,'Incident IT'],theme)+'</select><select aria-label="Source" onchange="src=this.value;list()"><option value="">Toutes les sources</option>'+opts([...new Set(items().map(x=>x[1]))],src)+'</select><select aria-label="Dates" onchange="days=+this.value;list()">'+[0,7,30].map(n=>'<option value="'+n+'" '+(days===n?'selected':'')+'>'+(n?n+' jours':'Toutes dates')+'</option>').join('')+'</select></div><div id="results"></div></section><aside><h2>Horizons de veille</h2>'+hz()+'<h2>État des services</h2><div class="panel">Outlook & Microsoft 365<p>Vérification auprès de Microsoft.</p>'+link('https://status.cloud.microsoft/','Consulter le statut officiel')+'</div></aside></div>';list()}
if(tab===relevanceTab)renderMonthlyReview();
if(tab===1)view.innerHTML='<h2>Incidents IT</h2>'+[['Outlook & Microsoft 365','État public et périmètre des services Microsoft. Les incidents propres à ton organisation sont visibles dans le centre d’administration.','https://status.cloud.microsoft/'],['Azure','Disponibilité publique par région et service.','https://azure.status.microsoft/fr-fr/status']].map(x=>'<article><span class="tag">CONSULTATION MANUELLE</span><h3>'+x[0]+'</h3><p>'+x[1]+'</p>'+link(x[2],'Voir le statut officiel')+'</article>').join('')+'<article><h3>GitHub</h3><small>Dernière vérification réussie · '+time(db[3]?.ts)+'</small><p>'+(ok(3)?(db[3].inc.length?'Incidents signalés':'Aucun incident ouvert signalé par GitHub'):'Statut actuel indisponible')+'</p>'+(db[3]?.inc||[]).map(x=>'<p>'+link(x.shortlink,x.name)+' · '+esc(x.status)+' · '+time(x.updated_at)+'</p>').join('')+link(urls[3],'État du service')+'</article>';
if(tab===2)view.innerHTML='<h2>Calendrier des synthèses</h2>'+horizons.map((h,i)=>'<article><span class="tag">H'+(i+1)+'</span><h3>'+h+'</h3><p>Dernière synthèse · '+time(notes.find(n=>n.i===i)?.ts)+'<br>Prochaine échéance · '+date(due(i))+(due(i)<new Date()?' · En retard':'')+(i===2?'<br>Premier bilan à six mois · 23 mai 2027':'')+'</p><button onclick="saveNote('+i+')">Enregistrer une synthèse</button></article>').join('')+'<h2>Historique sur cet appareil</h2>'+ (notes.map(n=>'<article><b>H'+(n.i+1)+' · '+date(n.ts)+'</b><p>'+esc(n.text)+'</p></article>').join('')||'Aucune synthèse enregistrée.');
if(tab===3)renderSourceTracking()}
function saveNote(i){let t=prompt('Synthèse H'+(i+1)+' · Faits marquants, impact et sources');if(t?.trim()){notes.unshift({i,text:t.trim(),ts:Date.now()});localStorage.signalNotes=JSON.stringify(notes);render()}}
const socialDid = 'did:plc:kbdifeeymt5ppkl4gtq3i7be';
const socialName = 'BleepingComputer · Bluesky';
let streamStatus = 'Connexion en cours';
function socialRow(record, key) {
  const title = record.embed?.external?.title || record.text?.split('\n')[0];
  if (!title || !Number.isFinite(Date.parse(record.createdAt))) return null;
  return ['Réseaux sociaux', socialName, record.createdAt, title, 'Signal publié sur le compte du média.', 'https://bsky.app/profile/'+socialDid+'/post/'+key,'signal',record.embed?.external?.uri || ''];
}
function weekly() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (today.getDay()+6)%7);
  monday.setHours(0,0,0,0);
  const incidents = ok(3) ? db[3].inc.map(x=>['Incident confirmé','GitHub Status',x.updated_at,x.name,x.status,x.shortlink]) : [];
  const week = [...incidents,...items().filter(row=>row[0]!=='Incident IT')].filter(r=>Date.parse(r[2])>=+monday && Date.parse(r[2])<=+today);
  const priority = r=>r[0]==='Incident confirmé'?0:r[0]==='Alertes cyber'?1:r[0]==='Réseaux sociaux'?3:2;
  week.sort((a,b)=>priority(a)-priority(b)||Date.parse(b[2])-Date.parse(a[2]));
  return '<section class="weekly"><div class="row"><h2>À la une cette semaine</h2><small>Depuis le '+date(monday)+'</small></div><div class="highlights">'+(week.slice(0,3).map(r=>'<article><span class="tag">'+esc(r[0].toUpperCase())+'</span><h3>'+link(r[5],r[3])+'</h3><small>'+esc(r[1])+' · '+time(r[2])+'</small></article>').join('') || '<article>'+(busy?'Recherche des publications de la semaine…':'Aucun événement de cette semaine dans les données reçues.')+'</article>')+'</div></section>';
}
function redraw() {
  const input = document.activeElement;
  const search = input?.matches('input[aria-label="Recherche"]');
  const pos = search && input.selectionStart;
  render();
  if (search) {const field=document.querySelector('input[aria-label="Recherche"]');field?.focus({preventScroll:true});field?.setSelectionRange(pos,pos)}
}
function listen() {
  const socket = new WebSocket('wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post&wantedDids='+socialDid);
  socket.onopen=()=>{streamStatus='Connecté';if(tab===3)redraw()};
  socket.onmessage=({data})=>{
    let e;try{e=JSON.parse(data)}catch{return}
    const c=e.commit;
    if(e.did!==socialDid || c?.collection!=='app.bsky.feed.post')return;
    const url='https://bsky.app/profile/'+socialDid+'/post/'+c.rkey;
    let rows=(db[4]?.rows||[]).filter(r=>r[5]!==url);
    if(c.operation!=='delete' && c.record){const row=socialRow(c.record,c.rkey);if(row){rows.push(row);rememberPublications([row],Date.now(),false);saveSources()}}
    db[4]={...db[4],rows:rows.slice(-600)};
    persist();redraw();
  };
  socket.onclose=()=>{streamStatus='Reconnexion · relève chaque minute';if(tab===3)redraw();setTimeout(listen,15000)};
  socket.onerror=()=>socket.close();
}
let ctx=radar.getContext('2d');ctx.translate(380,135);ctx.strokeStyle='#526e46';for(let r=25;r<240;r+=29){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke()}for(let i=0;i<16;i++){ctx.rotate(Math.PI/8);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(250,0);ctx.stroke()}ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,210,-1.2,-.55);ctx.fillStyle='#bcff582a';ctx.fill();for(let [x,y] of [[48,-56],[-92,44],[136,28],[-65,-81]]){ctx.fillStyle='#c8ff6a';ctx.fillRect(x,y,5,5)}render();collect();listen();setInterval(collect,60000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)collect()});
