# Déploiement Vercel + Supabase

L'API peut tourner sur **Vercel** (fonctions serverless) avec **Supabase** (PostgreSQL + PostGIS) et **Upstash** (Redis), sans rien retirer de la configuration AWS (`Dockerfile`, `docker-compose*.yml`, `infrastructure/`, `deploy.yml`). La plateforme se choisit avec une variable GitHub.

## Choisir la plateforme

Variable de dépôt `DEPLOY_TARGET` (Settings → Secrets and variables → Actions → Variables) :

| Valeur | CI : image Docker | Déploiement AWS (`deploy.yml`) | Vercel (`supabase-migrate.yml`, `vercel-background.yml`) |
|---|---|---|---|
| *(absente)* ou `aws` | ✅ | ✅ | — |
| `vercel` | — | — | migrations Supabase + tâches de fond |
| `both` | ✅ | ✅ | migrations Supabase + tâches de fond |

Revenir sur AWS = remettre `DEPLOY_TARGET=aws` (ou la supprimer).

> **Phase de test : offre Vercel gratuite (Hobby).** Vercel déploie lui-même via son intégration Git. Les seuls crons Vercel sont quotidiens (autorisés en Hobby) ; le travail fréquent est déclenché par GitHub Actions (`vercel-background.yml`, toutes les 10 min). Tout reste dans les quotas gratuits Vercel, Supabase, Upstash et GitHub.

## Ce qui change selon le runtime

Le mode est détecté automatiquement (`VERCEL=1`), ou forcé avec `RUNTIME_MODE=server|serverless`.

| | AWS (server) | Vercel (serverless) |
|---|---|---|
| HTTP | `node dist/main.js` | `api/index.ts` → `dist/main.js` (même build `nest build`) |
| Files Bull (NDVI, PDF, WhatsApp, webhooks) | workers en continu | vidées toutes les 10 min par GitHub Actions : `GET /api/internal/queues/drain` |
| `@Cron` alertes | `ScheduleModule` en process | GitHub Actions → `GET /api/internal/cron/<Classe.méthode>` (horaire / 6 h) |
| `@Cron` purges | `ScheduleModule` en process | Vercel Cron quotidien (`vercel.json`) |
| Base | `DB_*` | `DATABASE_URL` (+ `DATABASE_MIGRATION_URL`) |
| Redis | `REDIS_HOST/PORT/PASSWORD` | `REDIS_URL` (`rediss://`) |

Les routes `/api/internal/*` n'existent qu'en serverless et exigent `Authorization: Bearer $CRON_SECRET` (envoyé automatiquement par Vercel Cron, et par le workflow GitHub). `GET /api/internal/cron` liste les jobs disponibles.

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
Avec un vidage toutes les 10 min, la consommation reste de l'ordre de quelques milliers de commandes par jour, dans le quota gratuit.

### 3. Vercel

1. Avec votre compte : *Add New → Project*, importer `petaliadmin/petalia-farm-os-api` (Framework : *Other*, laisser build/output vides). `vercel.json` gère le build (`vercel-build` → `nest build`), le routage et les 2 crons quotidiens. *Production Branch* : `main` (ou la branche de test pendant la phase d'essai).
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

3. Déployer, puis noter l'URL de production (`https://<projet>.vercel.app`). Tester : `GET /api/health` doit répondre `"status": "ok"`.
4. Passage en Pro plus tard (optionnel) : remettre des crons fréquents dans `vercel.json` (ex. `* * * * *` sur `/api/internal/queues/drain`) et désactiver `vercel-background.yml`.

### 4. GitHub (environnement `production`)

Secrets : `SUPABASE_DB_MIGRATION_URL`, `VERCEL_API_URL` (l'URL de l'étape 3), `CRON_SECRET` (même valeur que sur Vercel).
Variable de dépôt : `DEPLOY_TARGET=vercel`.

- `supabase-migrate.yml` : après chaque CI verte sur `main` (ou à la main via *Run workflow*), applique les migrations. Pour le tout premier déploiement, le lancer **avant** de déployer sur Vercel.
- `vercel-background.yml` : toutes les 10 min, vide les files ; alertes météo chaque heure, NDVI et échéances toutes les 6 h. GitHub n'exécute les plannings que depuis la branche par défaut, avec quelques minutes de retard possibles.

Vercel et les migrations partent en parallèle après un push : si une version ajoute une migration, la lancer d'abord (*Run workflow*), puis pousser.

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
- **Durée : 60 s par fonction** (`maxDuration`, maximum Hobby). Les jobs plus longs (gros PDF, NDVI) restent dans la file et sont repris au vidage suivant ; chaque vidage s'arrête après `QUEUE_DRAIN_BUDGET_MS` (45 s).
- **Délai des tâches de fond** : environ 10 min entre la mise en file et le traitement (NDVI, PDF, WhatsApp, webhooks partenaires). Pour un test immédiat : *Run workflow* sur `vercel-background.yml`, ou `curl -H "Authorization: Bearer $CRON_SECRET" https://<projet>.vercel.app/api/internal/queues/drain`.
- **Supabase gratuit** : le projet se met en pause après une semaine sans activité (le réactiver depuis le dashboard), 500 Mo de base.
- **Rate limiting** (`@nestjs/throttler`) : compteur en mémoire par instance, donc approximatif sur Vercel. Les quotas des clés partenaires, eux, sont dans Redis et restent exacts.
- **Système de fichiers** en lecture seule (sauf `/tmp`) : rien dans le code n'écrit sur disque aujourd'hui.
