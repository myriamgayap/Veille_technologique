# Signal · Observatoire cyber & IT de Myriam

Le tableau de bord agrège les cinq sources de veille, les événements, les indicateurs de pertinence et les notes de l’utilisateur.

## Construction

Depuis la racine du dépôt, exécuter `python3 build.py`. Le script écrit les fichiers destinés à Vercel dans `public/` et le Worker dans `dist/server/index.js`. Les sources modifiables se trouvent dans `src/`.

## Déploiement Vercel

Connecter ce dépôt au projet Vercel existant pour le domaine myriam-veille.vercel.app. Utiliser la racine du dépôt et la branche de production main. Le fichier vercel.json configure la construction et transmet les appels /archive et /feed/0 à /feed/4 au serveur existant.

Les articles archivés restent dans le stockage du serveur existant. Les notes et préférences restent dans le navigateur. Les changements apportés à src/archive.js nécessitent une mise à jour distincte du Worker et son stockage BUCKET. Le déploiement Vercel publie le tableau de bord.
