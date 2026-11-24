const topics=['Azure','Entra ID','Intune','Microsoft 365','Outlook','Oracle','GitHub','IA','Cybersécurité'];
const pref=k=>JSON.parse(localStorage.getItem('signal.'+k)||'null');
const put=(k,v)=>localStorage.setItem('signal.'+k,JSON.stringify(v));
let scope=pref('scope')??topics.slice(0,6), read=pref('read')||{},book=pref('book')||[],previous=pref('visit')||0,mode='all',archiveState=null,archiveError=false;
put('visit',Date.now());
tabs.push('Événements','Mon périmètre');
async function loadArchive(){try{const r=await fetch('/archive');if(!r.ok)throw Error();archiveState=await r.json();archiveError=false}catch{archiveError=true}redraw()}
function groupKey(r){if(r[0]==='Incident IT'&&r[7])return r[5];if(r[6]==='signal'&&/^https?:/.test(r[7]))return r[7].replace(/\/$/,'');return r[5].replace(/\/$/,'')}
function groups(){
 const seen=new Map(),all=[...items(),...(archiveState?.rows||[])];
 for(const r of all){const id=r[5]+'|'+(r[0]==='Incident IT'?r[2]:'');seen.set(id,r)}
 const groups=new Map();
 for(const r of seen.values()){const id=groupKey(r);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r)}
 return [...groups].map(([id,rows])=>{rows.sort((a,b)=>Date.parse(b[2])-Date.parse(a[2]));const first=rows[0],incident=rows.find(r=>r[0]==='Incident IT'),official=rows.some(r=>r[0]!=='Réseaux sociaux'),ts=Date.parse(first[2]);return {id,rows,ts,title:first[3],status:incident?(incident[6]==='resolved'?'Résolu':'Confirmé par l’éditeur'):official?'Publication officielle':'Signalé',match:scope.some(t=>rows.some(r=>r.slice(0,5).join(' ').toLowerCase().includes(t.toLowerCase())||(t==='Cybersécurité'&&r[0]==='Alertes cyber'))),updated:rows.length>1&&previous&&rows.some(r=>Date.parse(r[2])<=previous)}}).sort((a,b)=>b.ts-a.ts)
}
function scheduleReport(){let rows=[];for(let i=0;i<3;i++){let start=new Date(2026,10,23);for(let n=1;n<1000;n++){let end=new Date(start);if(i===0)end.setDate(end.getDate()+7);else end.setMonth(end.getMonth()+1);if(+end>Date.now())break;rows.push({i,end,done:notes.some(x=>x.i===i&&x.ts>+start&&x.ts<=+end)});start=end}}return rows}
function eventMode(m){mode=m;go(4)}
function selectScope(i,checked){scope=checked?[...new Set([...scope,topics[i]])]:scope.filter(t=>t!==topics[i]);put('scope',scope)}
function mark(id){read[id]=Date.now();put('read',read);render()}
function addBook(id,i){let g=groups().find(g=>g.id===id);if(!g||book.some(x=>x.id===id&&x.i===i))return;book.push({id,i,title:g.title,url:g.rows[0][5],ts:g.ts});put('book',book);render()}
function writeSummary(i){let refs=book.filter(x=>x.i===i);let text=prompt('Ton analyse H'+(i+1)+' · Les références sélectionnées seront jointes automatiquement.');if(!text?.trim())return;notes.unshift({i,ts:Date.now(),text:[text.trim(),...refs.map(x=>date(x.ts)+' · '+x.title+' '+x.url)].join('\n')});book=book.filter(x=>x.i!==i);put('book',book);localStorage.signalNotes=JSON.stringify(notes);render()}
const modeLabels={all:'Tous les événements',visit:'Depuis ma dernière visite',pending:'Signaux à confirmer',unread:'Mon périmètre à lire',calendar:'Échéances de synthèse'};
function extras(){
 let gs=groups(),cal=scheduleReport();
 if(!tab){const tiles=[['visit',previous?gs.filter(g=>g.ts>previous).length:'—'],['pending',gs.filter(g=>g.status==='Signalé').length],['unread',gs.filter(g=>g.match&&!(read[g.id]>=g.ts)).length],['calendar',cal.filter(x=>x.done).length+'/'+cal.length]];
 document.querySelector('.grid').insertAdjacentHTML('afterend','<h2>Suivi personnel</h2><div class="grid">'+tiles.map(([k,v])=>'<button class="card" data-mode="'+k+'">'+modeLabels[k]+'<strong>'+v+'</strong></button>').join('')+'</div>')}
 if(tab===2)view.insertAdjacentHTML('afterbegin','<h2>Carnet de veille</h2>'+[0,1,2].map(i=>'<article><b>H'+(i+1)+' · '+horizons[i]+'</b>'+book.filter(x=>x.i===i).map(x=>'<p>'+link(x.url,x.title)+' · '+date(x.ts)+'</p>').join('')+'<p><button onclick="writeSummary('+i+')">Rédiger avec mes références ('+book.filter(x=>x.i===i).length+')</button></p></article>').join(''));
 if(tab===3)view.insertAdjacentHTML('afterbegin','<article><b>Archive serveur</b><p>'+ (archiveError?'Archive indisponible':archiveState?'Dernier contrôle · '+time(archiveState.at)+' · '+archiveState.sources.filter(s=>s.ok).length+'/5 sources reçues':'Chargement…')+'</p></article>');
 if(tab===5)view.innerHTML='<h2>Mon périmètre</h2><p>Choisis les sujets qui alimentent ton indicateur « à lire » sur cet appareil.</p><div class="panel">'+topics.map((t,i)=>'<label style="display:inline-block;padding:10px"><input type="checkbox" onchange="selectScope('+i+',this.checked)" '+(scope.includes(t)?'checked':'')+'> '+t+'</label>').join('')+'</div><button data-mode="unread">Voir mes événements à lire</button>';
 if(tab===4){const rows=gs.filter(g=>mode==='all'||mode==='visit'&&previous&&g.ts>previous||mode==='pending'&&g.status==='Signalé'||mode==='unread'&&g.match&&!(read[g.id]>=g.ts));
 view.innerHTML='<h2>Événements</h2><div class="filters">'+Object.entries(modeLabels).map(([k,v])=>'<button aria-pressed="'+(k===mode)+'" data-mode="'+k+'">'+v+'</button>').join('')+'</div>'+(mode==='calendar'?(cal.length?cal.map(x=>'<article>H'+(x.i+1)+' · '+date(x.end)+' · '+(x.done?'À temps':'Échéance manquée')+'</article>').join(''):'Aucune échéance écoulée.'):rows.map(g=>{const id=esc(g.id);return '<article><span class="tag">'+esc(g.status)+(mode==='visit'?' · '+(g.status==='Résolu'?'Résolution':g.updated?'Mise à jour':'Nouveau'):'')+'</span><h3>'+esc(g.title)+'</h3><details><summary>Chronologie et sources ('+g.rows.length+')</summary>'+g.rows.map(r=>'<p>'+time(r[2])+' · '+link(r[5],r[1])+' · '+esc(r[6]||r[0])+'<br>'+esc(r[4])+'</p>').join('')+'</details><div class="filters"><button data-read="'+id+'">'+(read[g.id]>=g.ts?'Lu':'Marquer comme lu')+'</button>'+[0,1,2].map(i=>'<button data-book="'+id+'" data-i="'+i+'" '+(book.some(x=>x.id===g.id&&x.i===i)?'disabled':'')+'>Ajouter à H'+(i+1)+'</button>').join('')+'</div></article>'}).join('')||(mode==='visit'&&!previous?'Première visite sur cet appareil. Les nouveautés apparaîtront à ton retour.':'Aucun événement pour cette sélection.'))}
}
document.addEventListener('click',e=>{let b=e.target.closest('button');if(!b)return;if(b.dataset.mode)eventMode(b.dataset.mode);if(b.dataset.read)mark(b.dataset.read);if(b.dataset.book)addBook(b.dataset.book,+b.dataset.i)});
const baseRender=render;render=function(){baseRender();extras()};
setTimeout(loadArchive,0);setInterval(loadArchive,600000);
