const actionsTab = tabs.push('Actions recommandées') - 1;
const technologies = {
  'Microsoft 365': /\b(?:microsoft 365|office 365|m365|o365|exchange online|sharepoint|teams|outlook|onedrive)\b/i,
  Azure: /\b(?:azure|entra id)\b/i,
  Fortinet: /\b(?:fortinet|fortios|fortigate|fortiproxy|fortimanager|fortiweb|forticlient|fortisiem)\b/i,
  Linux: /\b(?:linux|ubuntu|debian|red hat|rhel|suse|fedora)\b/i,
  GitHub: /\bgithub\b/i,
  Intune: /\bintune\b/i,
  Oracle: /\boracle\b/i
};
let selectedTechnologies = (pref('technologies') || []).filter(name=>Object.hasOwn(technologies,name));
let technologiesOpen = false, activeAction = '';

function matchesTechnologies(text) {
  return !selectedTechnologies.length || selectedTechnologies.some(name=>technologies[name].test(text));
}

const rowTechnology = row=>row.slice(0,6).join(' ');

function technologyFilter() {
  return `<details class="panel technology-filter" ${technologiesOpen?'open':''}>
    <summary>Mes technologies · ${selectedTechnologies.length ? esc(selectedTechnologies.join(', ')) : 'Tout afficher'}</summary>
    <div class="filters">${Object.keys(technologies).map(name=>`<label><input type="checkbox" data-technology="${name}" ${selectedTechnologies.includes(name)?'checked':''}> ${name}</label>`).join('')}
    <button type="button" data-all-technologies>Tout afficher</button></div></details>`;
}

function saveTechnologies(focus) {
  technologiesOpen = true;
  put('technologies', selectedTechnologies);
  render();
  $(focus)?.focus();
}

document.addEventListener('toggle', event=>{
  if (event.target.matches?.('.technology-filter')) technologiesOpen = event.target.open;
}, true);

document.addEventListener('change', ({target})=>{
  const name = target.dataset.technology;
  if (!Object.hasOwn(technologies,name)) return;
  selectedTechnologies = target.checked ? [...selectedTechnologies,name] : selectedTechnologies.filter(value=>value!==name);
  saveTechnologies(`[data-technology="${name}"]`);
});

const fortinetAction = {
  type:'Vulnérabilité',
  title:'Fortinet FortiOS et FortiProxy · CVE-2024-21762',
  origin:'https://cert.cyber.gouv.fr/alerte/CERTFR-2024-ALE-004/',
  originLabel:'Alerte CERT-FR CERTFR-2024-ALE-004',
  source:'https://www.fortiguard.com/psirt/FG-IR-24-015',
  sourceLabel:'Fortinet PSIRT FG-IR-24-015',
  updated:'2024-07-01',
  editors:[
    ['Correctif disponible','FortiOS : 6.2.16, 6.4.15, 7.0.14, 7.2.7 et 7.4.3 au minimum dans les branches citées. FortiProxy : 2.0.14, 7.0.15, 7.2.9 et 7.4.3 au minimum. Pour FortiOS 6.0 et FortiProxy 1.0, 1.1 et 1.2, migrer vers une branche corrigée selon le chemin de mise à niveau de Fortinet.'],
    ['Mesure temporaire','Si la mise à jour doit attendre, Fortinet recommande de désactiver le VPN SSL en entier. La désactivation de son interface web est insuffisante.']
  ],
  affected:'VPN SSL de FortiOS 6.0 et de FortiProxy 1.0, 1.1 et 1.2, toutes versions. Pour les autres branches ci-dessous, les versions antérieures au minimum corrigé sont concernées.',
  impact:'La faille critique concerne le service VPN SSL. Sa désactivation coupe cet accès distant.',
  continuity:'Prévenir les équipes et utiliser uniquement un accès de remplacement déjà approuvé par l’organisation. Reporter les opérations qui dépendent du VPN SSL si aucun accès autorisé ne peut prendre le relais.',
  verification:'Vérifier la version effectivement installée sur chaque équipement, y compris les nœuds de secours. Tester ensuite un accès distant autorisé et vérifier que la journalisation fonctionne.',
  changes:[
    {at:'2024-02-09', text:'Première publication de l’alerte.'},
    {at:'2024-02-15', text:'Le CERT-FR a ajouté FortiProxy et de nouvelles versions à la liste des systèmes affectés.'},
    {at:'2024-03-19', text:'Le CERT-FR a ajouté des informations sur les tentatives d’exploitation.'},
    {at:'2024-07-01', text:'Le CERT-FR a clôturé l’alerte et rappelle que la mise à jour reste nécessaire.'}
  ]
};

const githubStatuses = {
  investigating:'En cours d’investigation', identified:'Cause identifiée', monitoring:'Sous surveillance',
  resolved:'Service rétabli', postmortem:'Compte rendu publié'
};
let githubHistory = pref('githubHistory') || {};

function recordGithubHistory(incidents) {
  const oldest = Date.now()-190*day;
  for (const incident of incidents) {
    if (!/^https:\/\//i.test(incident.shortlink) || !Number.isFinite(Date.parse(incident.updated_at))) continue;
    const id = incident.shortlink.replace(/\/$/,'');
    const snapshots = [...(githubHistory[id] || []), {
      at:incident.updated_at, status:incident.status, title:incident.name,
      components:(incident.components || []).map(component=>component.name).filter(Boolean)
    }];
    const ordered = [...new Map(snapshots.map(snapshot=>[snapshot.at,snapshot])).values()]
      .sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    githubHistory[id] = ordered.filter((snapshot,index)=>index===0 || snapshot.status!==ordered[index-1].status ||
      snapshot.components.join()!==ordered[index-1].components.join()).slice(-12);
  }
  githubHistory = Object.fromEntries(Object.entries(githubHistory).filter(([,entries])=>Date.parse(entries.at(-1).at)>=oldest));
  put('githubHistory',githubHistory);
}

function githubActionCards() {
  const incidents = new Map();
  const add = (url,update)=>{
    if (!/^https:\/\//i.test(url) || !Number.isFinite(Date.parse(update.at))) return;
    const key = url.replace(/\/$/,'');
    if (!incidents.has(key)) incidents.set(key,new Map());
    const updates = incidents.get(key);
    const known = updates.get(update.at);
    updates.set(update.at, {...known,...update, body:update.body || known?.body, components:update.components?.length ? update.components : known?.components});
  };
  for (const row of archiveState?.rows || []) {
    if (row[0]==='Incident IT') add(row[5],{at:row[2],status:row[6],title:row[3],body:row[4],components:row[11]});
  }
  for (const [url,entries] of Object.entries(githubHistory)) for (const entry of entries) add(url,entry);
  for (const incident of db[3]?.inc || []) {
    const components = (incident.components || []).map(component=>component.name).filter(Boolean);
    for (const update of incident.incident_updates || []) {
      add(incident.shortlink,{at:update.created_at,status:update.status,title:incident.name,body:update.body,components:(update.affected_components || []).map(component=>component.name).filter(Boolean)});
    }
    add(incident.shortlink,{at:incident.updated_at,status:incident.status,title:incident.name,components});
  }
  return [...incidents].map(([origin,updates])=>{
    const history = [...updates.values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    const last = history.at(-1), components = [...history].reverse().find(update=>update.components?.length)?.components || [];
    const resolved = ['resolved','postmortem'].includes(last.status);
    const relatedUpdate = [...history].reverse().find(update=>update.body);
    const changes = history.flatMap((update,index)=>{
      const previous = history[index-1];
      const status = githubStatuses[update.status];
      if (!previous) return [];
      const details = [];
      if (status && update.status!==previous.status) details.push(status+'.');
      if (update.components?.length && previous.components?.length && update.components.join()!==previous.components.join()) {
        details.push('Composants signalés par GitHub : '+update.components.join(', ')+'.');
      }
      return details.length ? [{at:update.at,text:details.join(' ')}] : [];
    });
    return {
      type:'Panne', title:last.title || 'Incident GitHub', origin, originLabel:'Incident GitHub Status',
      source:origin, sourceLabel:'GitHub Status', updated:last.at, changes,
      affected:components.length ? 'GitHub · '+components.join(', ') : 'GitHub · le détail des composants ou des régions n’est pas disponible dans les données reçues.',
      impact:relatedUpdate ? 'Dernier état publié : '+(githubStatuses[last.status] || 'voir l’incident')+'. Le bulletin officiel précise quelles opérations sont touchées.' :
        'GitHub signale un incident. Vérifier sur le bulletin si les opérations en cours sont touchées.',
      officialUpdate:relatedUpdate,
      editors:[['Correctif ou contournement','Aucun correctif ou contournement exploitable n’est renseigné dans les données structurées reçues. Consulter le dernier message officiel pour les instructions propres à cet incident.']],
      continuity:resolved ? 'Le service est annoncé rétabli. Vérifier les tâches restées en attente avant de reprendre.' :
        'Pour le travail de développement, continuer localement si le dépôt est déjà disponible. Reporter les opérations qui nécessitent le composant touché et conserver la liste des tâches en attente.',
      verification:'Vérifier l’état des opérations interrompues. Relancer uniquement les tâches en échec après vérification et éviter de répéter un envoi ou un déploiement déjà exécuté.'
    };
  });
}

const guidanceCards = ()=>[fortinetAction,...githubActionCards()].sort((a,b)=>Date.parse(b.updated)-Date.parse(a.updated));

function actionButton(row, cards) {
  const id = publicationId(row);
  const hasCard = bulletinReference(row[5])==='CERTFR-2024-ALE-004' ||
    (row[1]===sources[3] && (cards || guidanceCards()).some(card=>publicationKey(card.origin)===id));
  return hasCard ? ` <button type="button" data-action-card="${esc(id)}">Que faire ?</button>` : '';
}

function renderActions() {
  const cards = guidanceCards();
  const active = cards.find(card=>publicationKey(card.origin)===activeAction);
  const filtered = cards.filter(card=>matchesTechnologies([card.title,card.affected,card.sourceLabel].join(' ')));
  function cardMarkup(card) {
    const recovery = card.type==='Panne' ? 'À reprendre après le rétablissement' : 'À vérifier après correction';
    return `<article id="action-detail"><span class="tag">${card.type}</span><h3 tabindex="-1">${esc(card.title)}</h3>
      <p><small>Dernière mise à jour · ${(card.type==='Vulnérabilité' ? date(card.updated) : time(card.updated))} · ${link(card.origin,card.originLabel)}${card.source!==card.origin ? ' · '+link(card.source,card.sourceLabel) : ''}</small></p>
      <h4>Suis-je concernée ?</h4><p>${esc(card.affected)}</p><p>${esc(card.impact)}</p>
      <h4>Que faire maintenant ?</h4><p><strong>Informations et recommandations officielles</strong></p>
      ${card.editors.map(([label,text])=>`<p><strong>${label}</strong> · ${esc(text)}</p>`).join('')}
      ${card.officialUpdate ? `<p><small>Message de GitHub · ${time(card.officialUpdate.at)}</small></p><p>${esc(card.officialUpdate.body)}</p>` : ''}
      <h4>Comment continuer à travailler ?</h4>
      <p><strong>Conseil pratique proposé par le site</strong> · ${esc(card.continuity)}</p>
      <p><strong>${recovery}</strong> · ${esc(card.verification)}</p></article>`;
  }
  view.innerHTML = '<h2>Actions recommandées</h2>'+technologyFilter()+
    (active ? '<button type="button" data-back-actions>Voir toutes les fiches</button>'+cardMarkup(active) :
    filtered.map(card=>`<article><span class="tag">${card.type}</span><h3>${esc(card.title)}</h3><p><small>Dernière mise à jour · ${card.type==='Vulnérabilité' ? date(card.updated) : time(card.updated)}</small></p>
    <button type="button" data-action-card="${esc(publicationKey(card.origin))}">Que faire ?</button></article>`).join('') ||
    '<div class="panel">Aucune fiche pour les technologies sélectionnées.</div>');
}

function changesPanel() {
  const cutoff = notes[0]?.ts;
  const changes = guidanceCards().flatMap(card=>card.changes.slice(-1).map(change=>({...change,card})))
    .filter(change=>Number.isFinite(Date.parse(change.at)) && (!cutoff || Date.parse(change.at)>cutoff)).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,8);
  return `<section class="panel" aria-labelledby="verified-changes"><h2 id="verified-changes">Ce qui a changé</h2>
    ${changes.length ? changes.map(({at,text,card})=>`<p><small>${date(at)}</small> · ${link(card.origin,card.title)} · ${esc(text)}</p>`).join('') :
    '<p>Aucune évolution vérifiable depuis la précédente mise à jour connue.</p>'}</section>`;
}

document.addEventListener('click', event=>{
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-all-technologies')) {
    selectedTechnologies = [];
    saveTechnologies('[data-all-technologies]');
  }
  if (button.dataset.actionCard) {
    activeAction = button.dataset.actionCard;
    go(actionsTab);
    $('#action-detail h3')?.focus();
  }
  if (button.hasAttribute('data-back-actions')) {
    activeAction = '';
    renderActions();
  }
});
