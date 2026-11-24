# Car AI

Application mobile où l'utilisateur se connecte, ajoute sa voiture avec son **numéro VIN**, et obtient un tableau de bord avec toutes ses caractéristiques et un **modèle 3D** de la voiture. Les caractéristiques sont trouvées par un **agent IA** (Claude).

## Architecture

```
apps/
├── api/      Backend Node.js + TypeScript (Fastify, PostgreSQL/Prisma, Redis, BullMQ)
│   ├── src/server.ts       API HTTP (sans état, se duplique derrière un load balancer)
│   ├── src/worker.ts       Worker qui exécute l'agent IA (se duplique séparément)
│   └── src/agent/          Agent IA : décodage NHTSA + recherche web Claude → fiche structurée
└── mobile/   Application Expo (React Native) iOS / Android
    ├── src/app/            Écrans (Expo Router) : login, garage, ajout, tableau de bord
    └── src/components/Car3D.tsx   Vue 3D (three.js / react-three-fiber)
```

### Parcours

1. **Connexion** : email → code à 6 chiffres (valable 10 min, 5 essais max, haché en base). Le VIN seul ne suffit pas pour se connecter car il n'est pas secret (visible sur le pare-brise).
2. **Ajout de la voiture** : l'utilisateur saisit le VIN et choisit la couleur (un VIN n'indique pas la couleur).
3. **Agent IA** (en arrière-plan) :
   - décode le VIN avec l'API gratuite NHTSA vPIC (complète pour les voitures nord-américaines, partielle pour les européennes) ;
   - Claude complète par recherche web (modèle, génération, moteur, boîte…) sans rien inventer ;
   - le résultat est validé par un schéma strict (Zod) puis enregistré.
4. **Tableau de bord** : fiche technique, niveau de fiabilité, sources, et modèle 3D dans la couleur de la voiture.

### Prévu pour des milliers d'utilisateurs

- **Une recherche par VIN** : le résultat est mis en cache en base (table `VehicleSpec`) et partagé ; la file déduplique les VIN identiques.
- **Agent IA hors de l'API** : les recherches passent par une file Redis (BullMQ) avec reprises automatiques ; l'API reste rapide et on ajoute des workers selon la charge (`AGENT_CONCURRENCY`).
- **API sans état** : JWT courts (15 min) + refresh tokens rotatifs (détection de vol) ; limites de débit partagées dans Redis entre toutes les instances.
- **Sécurité** : validation de toutes les entrées (Zod), Helmet, CORS fermé par défaut, secrets jamais en clair dans les logs, configuration validée au démarrage.
- **Arrêt propre** (SIGTERM) et route `/health` pour l'orchestrateur.

### Modèle 3D

Aucune base publique ne fournit le modèle 3D exact d'une voiture à partir de son VIN. L'application fonctionne en deux niveaux :

- **Modèle exact (glTF/GLB)** : dès qu'un modèle sous licence est ajouté au catalogue (`apps/api/src/lib/model3d.ts`), il est affiché et repeint dans la couleur de l'utilisateur (matériau nommé `paint`).
- **Modèle générique** : en attendant, une voiture 3D du bon type de carrosserie (berline, SUV, pick-up…) est dessinée dans la bonne couleur.

## Démarrer en local

Prérequis : Node.js 22+, Docker.

```bash
# 1. Base de données et Redis (PostgreSQL sur le port 5433)
docker compose up -d

# 2. API
cd apps/api
cp .env.example .env        # puis remplir JWT_SECRET et ANTHROPIC_API_KEY
npm install
npx prisma migrate deploy
npm run dev                 # API sur http://localhost:3100
npm run dev:worker          # dans un 2e terminal : l'agent IA

# 3. Application mobile
cd apps/mobile
cp .env.example .env        # sur un vrai téléphone : remplacer localhost par l'IP du PC
npm install
npx expo start
```

En développement, sans `SMTP_URL`, le code de connexion s'affiche dans les logs de l'API.

## Tests

```bash
cd apps/api && npm test && npm run typecheck
cd apps/mobile && npm run typecheck
```
