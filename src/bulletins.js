function bulletinReference(url) {
  return /^https?:\/\/(?:www\.cert\.ssi\.gouv\.fr|cert\.cyber\.gouv\.fr)\/(?:alerte|avis)\/(CERTFR-\d{4}-(?:ALE|AVI)-\d+)\/?(?:[?#]|$)/i.exec(url)?.[1].toUpperCase();
}

function publicationKey(url) {
  const reference = bulletinReference(url);
  if (!reference) return url.replace(/\/$/, '');
  const section = reference.includes('-ALE-') ? 'alerte' : 'avis';
  return 'https://cert.cyber.gouv.fr/'+section+'/'+reference;
}

function newestPublications(rows) {
  const publications = new Map();
  for (const row of rows) {
    const id = publicationKey(row[5]);
    const previous = publications.get(id);
    if (!previous || !bulletinReference(row[5]) ||
        Date.parse(row[10] || row[2]) >= Date.parse(previous[10] || previous[2])) publications.set(id,row);
  }
  return [...publications.values()];
}

function publicationLabel(row) {
  const reference = bulletinReference(row[5]);
  return reference ? (reference.includes('-ALE-') ? 'Alerte' : 'Avis') : row[0];
}
