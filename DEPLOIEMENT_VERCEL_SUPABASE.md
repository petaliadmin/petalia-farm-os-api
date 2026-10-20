# Déploiement Vercel + Supabase

L'API peut tourner sur **Vercel** (fonctions serverless) avec **Supabase** (PostgreSQL + PostGIS) et **Upstash** (Redis), sans rien retirer de la configuration AWS (`Dockerfile`, `docker-compose*.yml`, `infrastructure/`, `deploy.yml`). La plateforme se choisit avec une variable GitHub.

## Choisir la plateforme

Variable de dépôt `DEPLOY_TARGET` (Settings → Secrets and variables → Actions → Variables) :

| Valeur | CI : image Docker | Déploiement AWS (`deploy.yml`) | Déploiement Vercel (`deploy-vercel.yml`) |
|---|---|---|---|
| *(absente)* ou `aws` | ✅ | ✅ | — |
| `vercel` | — | — | ✅ |
| `both` | ✅ | ✅ | ✅ |

Revenir sur AWS = remettre `DEPLOY_TARGET=aws` (ou la supprimer).

## Ce qui change selon le runtime

Le mode est détecté automatiquement (`VERCEL=1`), ou forcé avec `RUNTIME_MODE=server|serverless`.

| | AWS (server) | Vercel (serverless) |
|---|---|---|
| HTTP | `node dist/main.js` | `api/index.ts` → `dist/main.js` (même build `nest build`) |
| Files Bull (NDVI, PDF, WhatsApp, webhooks) | workers en continu | vidées par Vercel Cron chaque minute : `GET /api/internal/queues/drain` |
| `@Cron` (alertes, purges) | `ScheduleModule` en process | Vercel Cron → `GET /api/internal/cron/<Classe.méthode>` (planning dans `vercel.json`) |
| Base | `DB_*` | `DATABASE_URL` (+ `DATABASE_MIGRATION_URL`) |
| Redis | `REDIS_HOST/PORT/PASSWORD` | `REDIS_URL` (`rediss://`) |

Les routes `/api/internal/*` n'existent qu'en serverless et exigent `Authorization: Bearer $CRON_SECRET` (envoyé automatiquement par Vercel Cron). `GET /api/internal/cron` liste les jobs disponibles.

## Mise en place

### 1. Supabase

1. Créer le projet (région la plus proche : `eu-west`/`eu-central` pour le Sénégal).
2. *Database → Extensions* : rien à faire, la première migration crée `postgis` et `uuid-ossp`.
3. *Connect* : récupérer deux chaînes du **pooler (Supavisor)** :
   - **Transaction** (port 6543) → `DATABASE_URL` (Vercel)
   - **Session** (port 5432) → `SUPABASE_DB_MIGRATION_URL` (GitHub). La connexion directe `db.<ref>.supabase.co` est IPv6 uniquement : les runners GitHub ne la joignent pas.
4. Optionnel : télécharger le certificat SSL (*Database settings*) et le mettre dans `DB_SSL_CA` pour vérifier le certificat serveur.

### 2. Upstash Redis

Créer une base Redis (même région), copier l'URL `rediss://default:…@….upstash.io:6379` → `REDIS_URL`.
Le vidage des files chaque minute consomme quelques dizaines de milliers de commandes par jour : prévoir l'offre pay-as-you-go plutôt que le quota gratuit.

### 3. Vercel

1. Importer le dépôt (Framework : *Other*). `vercel.json` gère le build (`vercel-build` → `nest build`), le routage et les crons.
2. Variables d'environnement (Production) :

   | Variable | Valeur |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | pooler transaction Supabase (6543) |
   | `REDIS_URL` | URL Upstash |
   | `CRON_SECRET` | chaîne aléatoire (`openssl rand -hex 32`) |
   | `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `PUBLIC_API_JWT_SECRET` | nouveaux secrets |
   | `CORS_ORIGIN`, `API_BASE_URL`, `APP_PUBLIC_URL` | URLs publiques |
   | `METRICS_TOKEN` | obligatoire pour lire `/api/metrics` (pas d'accès « réseau privé » sur Vercel) |
   | Intégrations | `SENTINEL_HUB_*`, `OPENWEATHERMAP_API_KEY`, `ORANGE_*`, `WHATSAPP_*`, `ANTHROPIC_API_KEY`, `FIREBASE_*`, `SLACK_WEBHOOK_URL`… (mêmes valeurs qu'AWS) |

3. **Plan Pro requis** : en Hobby, Vercel n'accepte que des crons quotidiens et refuse le déploiement avec le planning `* * * * *`. Sans Pro, retirer les crons de `vercel.json` et appeler les mêmes URL depuis un planificateur externe avec l'en-tête `Authorization`.

### 4. GitHub (environnement `production`)

Secrets : `SUPABASE_DB_MIGRATION_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (ces deux derniers dans `.vercel/project.json` après `vercel link`).
Puis `DEPLOY_TARGET=vercel`.

À chaque push sur `main` : CI → migrations Supabase → déploiement Vercel production. Les déploiements Git automatiques de `main` sont désactivés dans `vercel.json` pour que le code ne passe jamais en ligne avant son schéma ; les branches gardent leurs previews.

⚠️ Les previews utilisent les variables *Preview* de Vercel : leur donner une base Supabase distincte (branche Supabase ou projet de staging), jamais la base de production.

## Migrations

Le schéma n'est plus créé par `synchronize` mais par les migrations :

1. `1714600000000-InitialSchema` : schéma de base (27 tables), généré depuis les entités. Sur une base déjà créée par `synchronize` (AWS), elle détecte la table `users` et ne fait rien.
2. `1714694400000-AddPerformanceIndexes`
3. `1792435700310-PublicApiFoundation`

Vérifié sur PostGIS 16 : base vide → schéma identique aux entités ; base créée par `synchronize` → migrations appliquées sans erreur.

```bash
npm run migration:run        # dev (ts-node, src/)
npm run migration:run:prod   # après build (dist/) — CI Vercel et conteneur AWS
npm run migration:show
```

`synchronize` reste actif en dev uniquement avec la configuration `DB_*` historique ; avec `DATABASE_URL` il est désactivé (forçable par `DB_SYNCHRONIZE`).

## Migrer les données AWS → Supabase

```bash
# 1. Schéma sur Supabase
DATABASE_MIGRATION_URL=<session 5432> npm run migration:run:prod
# 2. Données seulement (le schéma vient des migrations)
pg_dump --data-only --no-owner --exclude-table=migrations \
  -h <ec2> -U petalia petalia > data.sql
psql "<session 5432>" -f data.sql
```

Faire un essai sur un projet Supabase de test, comparer les comptages (`select count(*)`) des tables principales, puis basculer le DNS et `DEPLOY_TARGET`.

## Limites de Vercel à connaître

- **Corps de requête : 4,5 Mo maximum.** L'upload photo du diagnostic accepte 8 Mo : les photos de plus de 4,5 Mo seront rejetées par Vercel (compresser côté mobile, ou upload direct vers Supabase Storage).
- **Durée : 60 s par fonction** (`maxDuration`). Les jobs plus longs (gros PDF, NDVI) restent dans la file et sont repris au vidage suivant ; chaque vidage s'arrête après `QUEUE_DRAIN_BUDGET_MS` (45 s).
- **Délai des tâches de fond** : jusqu'à une minute entre la mise en file et le traitement.
- **Rate limiting** (`@nestjs/throttler`) : compteur en mémoire par instance, donc approximatif sur Vercel. Les quotas des clés partenaires, eux, sont dans Redis et restent exacts.
- **Système de fichiers** en lecture seule (sauf `/tmp`) : rien dans le code n'écrit sur disque aujourd'hui.
