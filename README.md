# Veille informatique by Myriam

Ce site de veille cyber et IT rassemble des bulletins de sécurité, des incidents de services en ligne et des publications sur l’IA, la réglementation et les métiers tech. Il aide à repérer ce qui concerne son environnement, à préparer une action et à garder les références pour ses synthèses.

[Consulter le site](https://myriam-veille.vercel.app)

## Les rubriques du site

| Rubrique | À quoi elle sert | Exemple d’utilisation |
| --- | --- | --- |
| Vue d’ensemble | Voir les faits marquants de la semaine, les indicateurs et le fil de veille. Le fil se filtre par texte, thème, source, période et technologies. | Ouvrir **Mes technologies**, cocher Fortinet et Linux, puis chercher un bulletin par produit ou CVE. |
| Incidents IT | Suivre automatiquement les incidents ouverts sur GitHub Status. Azure, Outlook et Microsoft 365 se vérifient manuellement sur les pages officielles de Microsoft. Les incidents propres à une organisation se consultent dans son centre d’administration. | Vérifier un incident GitHub puis ouvrir **Que faire ?** pour préparer la reprise. |
| Synthèses | Rédiger et conserver les synthèses à partir du carnet de veille. L’encadré **Ce qui a changé** affiche les évolutions vérifiables dans les historiques datés depuis la dernière synthèse enregistrée, ou les dernières évolutions connues lors d’une première consultation. | Retrouver l’annonce du rétablissement d’un composant GitHub et joindre l’incident à sa synthèse. |
| Sources | Contrôler les tentatives de collecte, ouvrir les liens manuels, comparer les sources par thème et par mois, et valider les signaux Bluesky avant leur ajout au fil. | Vérifier si le flux des avis CERT-FR est indisponible ou s’il n’a simplement rien publié de nouveau. |
| Pertinence | Évaluer les publications et les objectifs du mois, mesurer la couverture des trois thèmes et retrouver les actions correctives. | Classer les publications du mois et vérifier si la cible de pertinence de 80 % est atteinte. |
| Événements | Consulter les chronologies, les signaux à confirmer et les événements à lire, puis ajouter des références au carnet. | Retrouver les messages successifs de GitHub sur le même incident. |
| Mon périmètre | Choisir les sujets qui alimentent l’indicateur d’événements à lire sur cet appareil. | Suivre Azure et Intune dans le suivi personnel. |
| Actions recommandées | Consulter des fiches qui précisent qui est concerné, les mesures officielles disponibles et les conseils de continuité et de reprise proposés par le site. | Ouvrir la fiche de l’alerte Fortinet CVE-2024-21762 pour retrouver les versions corrigées et la mesure temporaire publiée par l’éditeur. |

Le bouton **Que faire ?** s’affiche sur les alertes et incidents associés à une fiche dans le fil, les faits marquants, **Incidents IT** ou **Événements**. Les fiches GitHub reprennent le statut et les messages disponibles auprès de l’éditeur. Les fiches de vulnérabilité sont documentées individuellement à partir du bulletin et de l’avis de l’éditeur. Chaque fiche indique la date de la source, cite le bulletin d’origine et identifie les conseils pratiques du site.

Dans **Vue d’ensemble** ou **Actions recommandées**, ouvrir **Mes technologies** pour sélectionner une ou plusieurs technologies. Une publication ou une fiche est retenue lorsqu’elle correspond à au moins une sélection. Le navigateur conserve ce choix sur cet appareil. **Tout afficher** efface ce filtre. **Mon périmètre** règle séparément le suivi personnel des événements.

## Sources et collecte

- **CERT-FR** suit deux flux distincts. Les **alertes** alimentent le compteur **Alertes prioritaires**. Les **avis de sécurité** paraissent dans le fil avec le libellé **Avis**, leur date et le lien vers le bulletin. La référence CERT-FR identifie le bulletin lors d’une mise à jour. [Flux RSS officiels du CERT-FR](https://cert.cyber.gouv.fr/flux-rss/)
- **CNIL** fournit les publications sur la réglementation et la protection des données. **Microsoft Research** alimente la veille IA. **GitHub Status** fournit les incidents confirmés. Les messages de **BleepingComputer sur Bluesky** restent dans les signaux à vérifier jusqu’à leur validation.
- Les ressources en consultation manuelle incluent les pages de statut Microsoft, l’ANSSI, son Observatoire des métiers et EUR-Lex. Le suivi local indique **Lien ouvert** lorsque le visiteur ouvre une de ces ressources.
- Le navigateur interroge les flux à l’ouverture, puis chaque minute pendant la consultation. Il consulte l’archive au démarrage puis toutes les dix minutes. Le Worker conserve jusqu’à 2 500 entrées sur 190 jours. Les dates de première détection ou d’ajout au fil inconnues sont indiquées comme **Non mesuré**.

## Lancer le projet

Avec Python 3, depuis la racine du dépôt :

```sh
python3 build.py
python3 -m http.server 8000 --directory public
```

Ouvrir `http://localhost:8000`. Sous Windows, remplacer `python3` par `py -3` si nécessaire. Ce serveur statique permet de vérifier l’interface. Les routes `/feed/*` et `/archive` nécessitent les redirections Vercel ou le Worker configuré avec son stockage. En local sans ces routes, le site affiche l’indisponibilité des flux et conserve les données déjà enregistrées dans le navigateur.

Pour contrôler la syntaxe des fichiers générés avec Node.js :

```sh
node --check public/app.js
node --check dist/server/index.js
```

## Déployer sur Vercel

1. Importer le dépôt Git dans Vercel et sélectionner **Other** comme préréglage. Pour un déploiement automatique, utiliser `main` comme branche de production.
2. Utiliser la configuration de `vercel.json`, qui exécute `python3 build.py` et publie `public/`. Les redirections conservent les routes de collecte et d’archive existantes et relaient directement le flux officiel des avis CERT-FR.
3. Pour activer aussi la collecte des nouveaux avis dans l’archive serveur, mettre à jour séparément le Worker avec `dist/server/index.js` et sa liaison de stockage `BUCKET`. Le déploiement du front Vercel suffit pour l’affichage des avis dans le fil.

[Configuration des builds Vercel](https://vercel.com/docs/builds/configure-a-build)
