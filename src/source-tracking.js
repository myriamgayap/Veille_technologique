const sourceThemes = ['Alertes cyber', 'IA et réglementation', 'IA', 'Incidents IT', 'Réseaux sociaux'];
const sourceEndpoints = [
  'https://www.cert.ssi.gouv.fr/alerte/feed/', 'https://www.cnil.fr/fr/rss.xml',
  'https://www.microsoft.com/en-us/research/feed/', 'https://www.githubstatus.com/api/v2/incidents/unresolved.json',
  'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor='+socialDid+'&limit=50'
];
const manualSources = [
  ['Publications ANSSI', 'Alertes cyber et métiers tech', 'https://cyber.gouv.fr/actualites/'],
  ['EUR-Lex', 'Réglementation', 'https://eur-lex.europa.eu/'],
  ['Observatoire des métiers', 'Nouveaux métiers tech', seed[2][5]],
  ['Microsoft 365', 'Incidents IT', 'https://status.cloud.microsoft/'],
  ['Azure', 'Incidents IT', 'https://azure.status.microsoft/fr-fr/status']
];

let sourceMonth = monthKey(Date.now()), sourceTheme = '';
const sourceState = pref('sourceTracking') ?? {attempts:{}, records:{}, opened:{}, associations:[]};
const saveSources = ()=>put('sourceTracking', sourceState);
const publicationId = row=>row[5].replace(/\/$/, '');
const socialSignal = row=>row[0]===names[4];
const measuredTime = value=>value ? time(value) : 'Non mesuré';
const isPublication = row=>Array.isArray(row) && /^https?:\/\//i.test(row[5]) &&
  Number.isFinite(Date.parse(row[9] || row[2]));
const archivePublication = row=>row[9] ? [...row.slice(0,2),row[9],...row.slice(3)] : row;

function githubPublications(incidents) {
  return (incidents || []).map(x=>['Incident IT', sources[3], x.created_at, x.name, x.status, x.shortlink, x.status, x.id]).filter(isPublication);
}

function feedCandidates() {
  return [...seed, ...Object.values(db).flatMap(source=>source.rows || []), ...githubPublications(db[3]?.inc)];
}

function rememberPublications(rows, detected, enterFeed) {
  let count = 0;
  for (const row of rows.filter(isPublication)) {
    const id = publicationId(row);
    if (!Object.hasOwn(sourceState.records,id)) {
      sourceState.records[id] = {published:row[9] || row[2], detected:detected ?? row[8] ?? null, added:null};
      count++;
    }
    const record = sourceState.records[id];
    if (socialSignal(row) && record.decision!=='dismissed') record.signal = row;
    if (enterFeed && !socialSignal(row) && !record.inFeed) {
      record.inFeed = true;
      record.added = detected;
    }
  }
  return count;
}

function rememberArchive(state) {
  const rows = state.rows.filter(isPublication).map(archivePublication);
  rememberPublications(rows, null, false);
  rememberPublications(rows.filter(row=>row[0]==='Incident IT' || row[1]===sources[0]), Date.now(), true);
  saveSources();
}

function knownPublication(row) {
  const record = sourceState.records[publicationId(row)];
  return record ? [...row.slice(0,2),record.published,...row.slice(3)] : archivePublication(row);
}

function visiblePublication(row) {
  return !socialSignal(row) || sourceState.records[publicationId(row)]?.decision === 'accepted';
}

function savedSignals() {
  return Object.values(sourceState.records).flatMap(record=>record.signal ? [record.signal] : []);
}

function startSourceAttempt(index) {
  const at = Date.now();
  const stats = sourceState.attempts[index] ??= {months:{}};
  const month = stats.months[monthKey(at)] ??= {attempted:0, succeeded:0};
  month.attempted++;
  stats.lastAttempt = at;
  stats.result = 'Collecte en cours';
  stats.newCount = null;
  saveSources();
  return month;
}

function endSourceAttempt(index, month, rows) {
  const stats = sourceState.attempts[index];
  if (rows) {
    const now = Date.now();
    month.succeeded++;
    stats.lastSuccess = now;
    stats.newCount = rememberPublications(rows, now, true);
    stats.result = stats.newCount ? 'Collecte réussie' : 'Aucun nouvel élément';
  } else {
    stats.result = 'Échec de collecte';
  }
  saveSources();
}

function publicationDates(row) {
  const record = sourceState.records[publicationId(row)];
  return 'Publication · '+time(record?.published || row[9] || row[2])+
    ' · Première détection · '+measuredTime(record?.detected)+
    ' · Ajout au fil · '+measuredTime(record?.added);
}

function trackedPublications() {
  const rows = new Map();
  for (const raw of [...(archiveState?.rows || []), ...feedCandidates(), ...savedSignals()].filter(isPublication)) {
    const row = knownPublication(raw);
    const id = publicationId(row);
    const previous = rows.get(id);
    // Retain the external association if only one copy includes it.
    if (!previous?.[7] || row[7]) rows.set(id,row);
  }
  return [...rows.values()].sort((a,b)=>Date.parse(b[2])-Date.parse(a[2]));
}

function eventComparisons(rows) {
  const parents = new Map();
  function root(id) {
    while (parents.has(id)) id = parents.get(id);
    return id;
  }
  function join(a,b) {
    const first = root(a), second = root(b);
    if (first !== second) parents.set(second, first);
  }
  for (const row of rows) {
    const id = publicationId(row);
    const key = groupKey(row);
    if (id !== key) join(id,key);
  }
  for (const [a,b] of sourceState.associations) join(a,b);
  const events = new Map();
  for (const row of rows) {
    const key = root(publicationId(row));
    if (!events.has(key)) events.set(key,[]);
    events.get(key).push(row);
  }
  return [...events.values()].flatMap(event=>{
    if (new Set(event.map(row=>row[1])).size<2 || (sourceTheme && !event.some(row=>row[0]===sourceTheme))) return [];
    event.sort((a,b)=>Date.parse(a[2])-Date.parse(b[2]));
    const firstTime = Date.parse(event[0][2]);
    if (monthKey(firstTime)!==sourceMonth) return [];
    const first = event.filter(row=>Date.parse(row[2])===firstTime);
    const official = event.find(row=>row[0]==='Incident IT' || row[1]==='CERT-FR');
    return [{event, first, official, firstTime}];
  });
}

function delayText(ms) {
  if (ms === 0) return 'Simultanés';
  if (ms < 60000) return 'Moins d’une minute';
  const minutes = Math.floor(ms / 60000);
  return [Math.floor(minutes/1440) && Math.floor(minutes/1440)+' j',
    Math.floor(minutes%1440/60) && Math.floor(minutes%1440/60)+' h', minutes%60 && minutes%60+' min'].filter(Boolean).join(' ');
}

function sourceTable(label, headings, body) {
  return '<div class="kpi-scroll" role="region" tabindex="0" aria-label="'+label+'"><table aria-label="'+label+'"><thead><tr>'+
    headings.map(heading=>'<th scope="col">'+heading+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>';
}

function renderSourceTracking() {
  const rows = trackedPublications();
  const comparableRows = rows.filter(row=>sourceState.records[publicationId(row)]?.decision!=='dismissed');
  const events = eventComparisons(comparableRows);
  const openSections = [...view.querySelectorAll('[data-source-details][open]')].map(node=>node.dataset.sourceDetails);
  const priorSelections = [$('#source-link-first')?.value, $('#source-link-second')?.value];
  const attempts = sources.map((name,i)=>{
    const stats = sourceState.attempts[i];
    const result = stats?.result === 'Collecte en cours' && !busy ? 'Collecte interrompue' : stats?.result || (db[i]?.ok === false ? 'Échec de collecte' : 'Non mesuré');
    return `<tr><th scope="row">${link(sourceEndpoints[i],name)}</th><td>${esc(sourceThemes[i])}</td>
      <td>${measuredTime(stats?.lastAttempt)}</td><td>${measuredTime(stats?.lastSuccess || db[i]?.ts)}</td>
      <td>${result || 'Non mesuré'}</td><td>${stats?.newCount ?? '—'}</td></tr>`;
  }).join('');
  const manual = manualSources.map(([name,theme,url],i)=>`<article><h3><a href="${esc(url)}" target="_blank" rel="noopener" data-manual-source="${i}">${name}</a></h3>
    <small>${theme}<span data-manual-status="${i}">${manualStatus(url)}</span></small></article>`).join('');

  const pending = rows.filter(row=>socialSignal(row) && !sourceState.records[publicationId(row)]?.decision);
  const signals = pending.map(row=>`<article><h3>${esc(row[3])}</h3><p>${esc(row[1])} · ${link(row[5],'Ouvrir la source')}</p>
    <p><small>${publicationDates(row)}</small></p>
    <div class="filters"><button data-signal="accepted" data-id="${esc(publicationId(row))}">Ajouter au fil</button>
    <button data-signal="dismissed" data-id="${esc(publicationId(row))}">Écarter</button></div></article>`).join('') || '<p>Aucun signal à vérifier.</p>';

  const ratings = monthlyReviews[sourceMonth]?.ratings ?? {};
  const eventPublications = new Set(events.flatMap(({event})=>event.map(publicationId)));
  const ranking = sources.map((name,i)=>{
    const compared = events.filter(({event})=>event.some(row=>row[1]===name));
    const wins = compared.filter(({first})=>first.some(row=>row[1]===name)).length;
    const stats = sourceState.attempts[i]?.months[sourceMonth];
    const rated = comparableRows.filter(row=>row[1]===name && monthKey(row[2])===sourceMonth &&
      (!sourceTheme || row[0]===sourceTheme || eventPublications.has(publicationId(row))) && ratings[publicationId(row)]);
    const relevant = rated.filter(row=>ratings[publicationId(row)]==='yes').length;
    return `<tr><th scope="row">${esc(name)}</th><td>${compared.length}</td>
      <td>${compared.length ? wins+' / '+compared.length+' premiers signalements'+(compared.length===1?' · Données insuffisantes':'') : 'Données insuffisantes'}</td>
      <td>${stats ? stats.succeeded+' / '+stats.attempted+' · '+percentage.format(stats.succeeded/stats.attempted) : 'Données insuffisantes'}</td>
      <td>${rated.length ? relevant+' / '+rated.length+' évaluées · '+percentage.format(relevant/rated.length) : 'Données insuffisantes'}</td></tr>`;
  }).join('');
  const comparisons = events.map(({event,first,official,firstTime})=>`<article>
    <h3>${esc(event[0][3])}</h3>
    <p>Premier signalement · ${esc([...new Set(first.map(row=>row[1]))].join(', '))} · ${time(firstTime)}</p>
    <p>Confirmation officielle · ${official ? esc(official[1])+' · '+time(official[2]) : 'Non identifiée'}</p>
    <p>Délai · ${official ? delayText(Date.parse(official[2])-firstTime) : 'Non mesuré'}</p>
    <details data-source-details="${esc(publicationId(event[0]))}"><summary>Publications associées (${event.length})</summary>${event.map(row=>`<p>${link(row[5],row[3])} · ${esc(row[1])}<br><small>${publicationDates(row)}</small></p>`).join('')}</details></article>`).join('');
  const options = comparableRows.map(row=>`<option value="${esc(publicationId(row))}">${esc(row[3])} · ${esc(row[1])} · ${date(row[2])}</option>`).join('');

  view.innerHTML = `<section class="kpi-panel source-tracking">
    <div class="row"><h2>Suivi des sources</h2><button onclick="collect()" ${busy?'disabled':''}>${busy?'Actualisation…':'Actualiser les flux'}</button></div>
    <p>Tentatives et résultats mesurés sur cet appareil. Bluesky en direct · ${esc(streamStatus)}.</p>
    ${sourceTable('Collectes automatiques',['Source interrogée','Thème','Dernière tentative','Dernier succès','Résultat','Nouveaux éléments'],attempts)}
    <p>Archive serveur · ${archiveError?'Indisponible':archiveState?'Dernier contrôle '+time(archiveState.at):'Chargement…'}</p>
    <h2>Consultation manuelle</h2><div class="source-manual">${manual}</div>
    <h2>Signaux à vérifier</h2>${signals}
    <h2>Quelle source suivre en priorité ?</h2>
    <div class="filters"><label>Thème <select id="source-theme"><option value="">Tous les thèmes</option>${opts([...names,'Incident IT'],sourceTheme)}</select></label>
    <label>Mois <input type="month" id="source-month" value="${esc(sourceMonth)}" required></label></div>
    <p>${events.length} événement(s) comparé(s). La rapidité suit les dates publiées. La fiabilité couvre toutes les tentatives du mois pour chaque source.</p>
    ${sourceTable('Critères par source',['Source','Événements comparés','Rapidité','Fiabilité de la collecte','Pertinence'],ranking)}
    <p>Les confirmations officielles proviennent du CERT-FR ou de GitHub Status. Le mois est celui du premier signalement.</p>
    ${comparisons || '<p>Données insuffisantes pour comparer des événements sur cette période.</p>'}
    <h3>Relier deux publications au même événement</h3>
    <form id="source-link-form" class="filters source-associations">
      <label>Première publication <select id="source-link-first" required><option value="">Choisir une publication</option>${options}</select></label>
      <label>Deuxième publication <select id="source-link-second" required><option value="">Choisir une publication</option>${options}</select></label>
      <button type="submit">Relier</button><span id="source-link-message" role="status"></span>
    </form>
    <details data-source-details="observed"><summary>Publications observées (${rows.length})</summary>${rows.map(row=>`<p>${link(row[5],row[3])} · ${esc(row[1])}<br><small>${publicationDates(row)}</small></p>`).join('')}</details>
    </section>`;
  for (const detail of view.querySelectorAll('[data-source-details]')) detail.open = openSections.includes(detail.dataset.sourceDetails);
  $('#source-theme').onchange = event=>{sourceTheme=event.target.value;renderSourceTracking();$('#source-theme').focus()};
  $('#source-month').onchange = event=>{
    if (event.target.value) sourceMonth=event.target.value;
    renderSourceTracking();
    $('#source-month').focus();
  };
  for (const [i,id] of ['#source-link-first','#source-link-second'].entries()) {
    const field = $(id);
    if (priorSelections[i] && [...field.options].some(option=>option.value===priorSelections[i])) field.value=priorSelections[i];
  }
  $('#source-link-form').onsubmit = event=>{
    event.preventDefault();
    const a = $('#source-link-first').value, b = $('#source-link-second').value;
    if (a===b) {$('#source-link-message').textContent='Choisis deux publications distinctes.';return}
    if (!sourceState.associations.some(pair=>pair.includes(a) && pair.includes(b))) {
      sourceState.associations.push([a,b]);
      saveSources();
    }
    renderSourceTracking();
    $('#source-link-message').textContent='Publications reliées.';
  };
}

function manualStatus(url) {
  return sourceState.opened[url] ? ' · Lien ouvert · '+time(sourceState.opened[url]) : '';
}

function recordManualClick(event) {
  if (event.type==='auxclick' && event.button!==1) return;
  const anchor = event.target.closest('[data-manual-source]');
  if (!anchor) return;
  const i = +anchor.dataset.manualSource;
  const url = manualSources[i][2];
  sourceState.opened[url] = Date.now();
  saveSources();
  const status = $(`[data-manual-status="${i}"]`);
  if (status) status.textContent = manualStatus(url);
}
document.addEventListener('click', recordManualClick);
document.addEventListener('auxclick', recordManualClick);
document.addEventListener('click', event=>{
  const button = event.target.closest('button[data-signal]');
  if (!button) return;
  const record = sourceState.records[button.dataset.id];
  if (!record?.signal || record.decision) return;
  record.decision = button.dataset.signal;
  if (record.decision==='accepted') record.added ??= Date.now();
  else delete record.signal;
  saveSources();
  render();
});

rememberPublications(feedCandidates(), null, true);
saveSources();
