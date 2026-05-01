# Petalia Farm OS API — Audit Complet
**Version auditée :** 2.0.0  
**Date :** Mai 2026  
**Stack :** NestJS 10 · PostgreSQL 16 + PostGIS · Redis 7 · TypeORM · Docker · EC2  
**Objectif :** Hub de données et services agricoles — Sénégal & Afrique

---

## Table des matières

1. [Synthèse exécutive](#1-synthèse-exécutive)
2. [Architecture actuelle](#2-architecture-actuelle)
3. [Sécurité — Findings critiques](#3-sécurité--findings-critiques)
4. [Qualité du code & dette technique](#4-qualité-du-code--dette-technique)
5. [Fonctionnalités manquantes — Hub AgriTech Afrique](#5-fonctionnalités-manquantes--hub-agritech-afrique)
6. [Performance & scalabilité](#6-performance--scalabilité)
7. [Infrastructure & DevOps](#7-infrastructure--devops)
8. [Roadmap priorisée](#8-roadmap-priorisée)
9. [Matrice ROI / Effort](#9-matrice-roi--effort)

---

## 1. Synthèse exécutive

### Score de maturité global : **62 / 100**

| Dimension | Score | Verdict |
|---|---|---|
| Architecture | 72/100 | Bonne base NestJS modulaire, TypeORM bien migré |
| Sécurité | 45/100 | **Bloquant production** — 3 critiques non résolus |
| Couverture fonctionnelle | 58/100 | MVP solide mais hub de données incomplet |
| Performance | 60/100 | Redis présent, pas encore utilisé pour caching |
| Scalabilité | 55/100 | Single EC2, pas de queue, pas de multi-tenant strict |
| Contexte Afrique/Sénégal | 70/100 | Offline-first Flutter, FCFA, Orange SMS — bien pensé |

### Verdict CTO

> L'API couvre le cœur opérationnel d'une plateforme AgriTech (parcelles, visites, récoltes, intrants, NDVI). La migration vers PostgreSQL + PostGIS est une décision architecturale excellente pour un hub de données géospatiales. Cependant, **l'ambition de "hub de données agricoles" exige 3 couches supplémentaires** : un moteur de règles agronomiques temps-réel, une couche d'analytique sectorielle, et un système d'interopérabilité standardisé (FMIS/CGIAR). Les vulnérabilités de sécurité actuelles interdisent le déploiement en production financière (score crédit, indemnisation assurance).

---

## 2. Architecture actuelle

### 2.1 Vue d'ensemble des modules (16)

```
src/
├── auth/           JWT + OTP + refresh tokens
├── users/          CRUD utilisateurs (5 rôles)
├── parcelles/      Parcelles + GeoJSON + POI
├── visites/        Visites terrain + photos + PDF
├── taches/         Tâches + Kanban
├── intrants/       Stock intrants + mouvements
├── recoltes/       Récoltes + validation + rendement
├── campagnes/      Gestion campagnes agricoles
├── ndvi/           Indices de végétation (Sentinel-2)
├── meteo/          Météo (OpenWeatherMap — stub)
├── rapports/       KPIs + exports PDF
├── notifications/  Notifications push + web
├── webhooks/       Webhooks partenaires
├── equipes/        Gestion équipes terrain
├── interop/        Banques + Assurances + État
└── sync/           Sync offline Flutter
```

### 2.2 Ce qui est bien fait

- **Modélisation domaine riche** : entités métier complètes avec énumérations agronomiques sénégalaises (cultures, stades, zones agro-écologiques)
- **PostGIS** : boundary/centroid en jsonb + index spatiaux `GIST` — base solide pour requêtes géospatiales
- **Offline-first** : endpoint `/v1/sync` conçu pour Flutter en zone rurale à faible connectivité
- **Interop financière** : score crédit bancaire + déclaration assurance — différenciant fort
- **Calculs automatiques** : rendement, taux de perte, revenu total via `@BeforeInsert/@BeforeUpdate`
- **FCFA** : calculs de coût en francs CFA — contexte UEMOA respecté

### 2.3 Problèmes architecturaux identifiés

```
❌ Pas de multi-tenancy strict (organisationId non enforced en middleware)
❌ Pas de queue pour jobs longs (NDVI fetch, génération PDF, envoi SMS)
❌ Pas de couche cache (Redis présent mais inutilisé dans les services)
❌ Pas d'audit log (qui a fait quoi, quand — exigence banque/assurance)
❌ Pas de versioning API cohérent (/api vs /v1 mélangés)
❌ Organisation entity absente mais référencée partout
❌ Pas de health check endpoint /health (docker depend_on échoue)
```

---

## 3. Sécurité — Findings critiques

### 🔴 CRITIQUE — Bloquer la mise en production

#### C1 — OTP hardcodé (auth.service.ts)
```typescript
// LIGNE ~171 — code "123456" bypass complet de l'authentification OTP
if (code !== "123456") { ... }
```
**Impact** : N'importe qui peut se connecter avec le code `123456`.  
**Fix** : Générer un code aléatoire 6 chiffres, le hasher (bcrypt/SHA256), stocker en Redis TTL 10min, comparer le hash.

#### C2 — Webhook assurance sans authentification (interop.controller.ts)
```typescript
// POST /api/interop/assurance/indemnisation/webhook — AUCUN GUARD
@Post('assurance/indemnisation/webhook')
async webhookIndemnisation(@Body() data: any) { ... }
```
**Impact** : Un attaquant peut déclencher des indemnisations frauduleuses.  
**Fix** : Valider le header `X-Insurance-Signature: sha256=<HMAC>` avec clé partagée.

#### C3 — CORS `origin: true` + `credentials: true` (main.ts)
```typescript
app.enableCors({ origin: true, credentials: true, ... });
```
**Impact** : Toute origine peut lire les cookies de session — vol de tokens.  
**Fix** : `origin: process.env.CORS_ORIGIN?.split(',')` — liste blanche explicite.

---

### 🟠 HAUTE PRIORITÉ

#### H1 — Sync API totalement non gardée
Tous les endpoints `/v1/agro_rules`, `/v1/sync/push`, `/v1/sync/pull` sont publics.  
**Fix** : Ajouter une API key d'appareil (`X-Device-Key`) générée à l'enregistrement Flutter + validée en Guard.

#### H2 — Pas de rate limiting sur les endpoints d'auth
`/api/auth/login`, `/api/auth/login/otp/send` — pas de throttle.  
**Fix** : `@nestjs/throttler` — 5 req/min sur login, 3 req/min sur OTP.

#### H3 — Body `any` non validé (8 endpoints)
`campagnes`, `equipes`, `webhooks`, `interop`, `parcelles/poi` — pas de DTO.  
**Fix** : Créer les DTOs manquants avec `class-validator`.

#### H4 — JWT sans expiry explicite dans certains sign()
`jwtService.sign(payload)` sans `expiresIn` → token valide infiniment.  
**Fix** : Toujours passer `{ expiresIn: configService.get('JWT_EXPIRES_IN') }`.

#### H5 — `forgotPassword` non implémenté (stub)
Retourne `{ success: true }` sans envoyer d'email ni générer de token.  
**Fix** : Implémenter avec token Redis TTL 1h + envoi email/SMS.

#### H6 — Politique de mot de passe trop faible
`MinLength(6)` — accepte `123456`, `azertyy`.  
**Fix** : `@Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{10,}$/)`.

---

### 🟡 MOYEN

| ID | Description | Fix rapide |
|---|---|---|
| M1 | Pas de champ `organisationId` vérifié au niveau middleware — un directeur peut voir les données d'une autre org | Interceptor `OrgScopeInterceptor` |
| M2 | Pas d'audit log pour les opérations financières (score crédit, sinistre) | Entité `AuditLog` + interceptor |
| M3 | `strictNullChecks: false` dans tsconfig — masque des bugs réels | Activer progressivement |
| M4 | Coordonnées GPS non validées (lat/lng sans bornes) | `@Min(-90) @Max(90)` sur lat |
| M5 | Refresh token non rotatif — vol silencieux possible | Rotation à chaque usage |
| M6 | Pas de blacklist JWT pour logout | Redis set `revoked_tokens:userId` |

---

## 4. Qualité du code & dette technique

### 4.1 Points positifs

- **Architecture NestJS** : modules, DI, guards, interceptors bien utilisés
- **TypeORM** : QueryBuilder cohérent, pas de raw SQL dangereux
- **Calculs métier** : `@BeforeInsert/@BeforeUpdate` sur Recolte et Parcelle — propre
- **Seed** : données réalistes Delta du Fleuve Sénégal

### 4.2 Dette technique identifiée

```
❌ 8 endpoints utilisent @Body() data: any (injection, crash, mauvais contrat API)
❌ Méteo service : 3 méthodes retournent des données hardcodées (stub)
❌ Rapports service : KPIs hardcodés, pas connectés à la vraie DB
❌ generateTaches() dans campagnes : 2 tâches hardcodées, pas de vraie logique
❌ NDVI fetchNdvi() : retourne un faux jobId, pas d'appel Sentinel Hub réel
❌ interop/banque : signature HMAC hardcodée ("sha256=abc123...")
❌ Organisation entity manquante — foreign key non contrainte
❌ Pas de tests unitaires ni d'intégration (0% coverage)
❌ tsconfig strictNullChecks: false — code peu fiable
❌ /api et /v1 mélangés — versioning incohérent
```

### 4.3 Modules à implémenter (stubs actuels)

| Module | État actuel | Ce qu'il faut faire |
|---|---|---|
| `meteo` | 3 méthodes hardcodées | Appel réel OpenWeatherMap + cache Redis 30min |
| `ndvi` | `fetchNdvi()` retourne faux jobId | Intégration Sentinel Hub API + Bull queue |
| `rapports` | KPIs statiques | Requêtes SQL agrégées réelles sur DB |
| `interop/banque` | Signature HMAC hardcodée | HMAC-SHA256 avec clé partagée par banque |
| `auth/forgotPassword` | Stub `{success: true}` | Token Redis + Orange SMS/Email |

---

## 5. Fonctionnalités manquantes — Hub AgriTech Afrique

> C'est le gap le plus important. L'API est un système de gestion opérationnelle. Pour devenir un **hub de données agricoles au Sénégal et en Afrique**, il faut les couches suivantes.

---

### 5.1 🌍 Module Organisation (MANQUANT — bloquant)

L'entité `Organisation` est référencée partout (`organisationId`) mais n'existe pas.

```typescript
// À créer : src/organisations/entities/organisation.entity.ts
Organisation {
  id, nom, sigle, type (coopérative|GIE|ONG|institution|agro-dealer),
  pays, region, adresse,
  logoUrl, siteWeb,
  subscriptionPlan (free|basic|pro|enterprise),
  subscriptionExpiry,
  apiCredentials (jsonb), // pour accès programmé
  actif, createdAt
}
```

**Endpoints manquants :**
- `POST /api/organisations` — inscription (onboarding)
- `GET /api/organisations/:id/dashboard` — tableau de bord org
- `GET /api/organisations/:id/stats` — métriques globales org

---

### 5.2 📊 Module Analytics & Reporting (critique pour hub de données)

Actuellement le module `rapports` retourne des KPIs hardcodés. Pour un hub, il faut :

**Endpoints analytiques à créer :**
```
GET /api/analytics/rendements/tendances?region=&culture=&annees=3
  → Courbe de rendement par culture/région sur N années

GET /api/analytics/cultures/distribution?organisationId=
  → Répartition surfaces par culture (pie chart data)

GET /api/analytics/meteo/correlation?parcelleId=&metric=ndvi
  → Corrélation pluie/NDVI/rendement sur une parcelle

GET /api/analytics/economique/marge-brute?campagneId=
  → Marge brute = Revenu récolte - Coût intrants - Coût main d'oeuvre

GET /api/analytics/alertes/heatmap?bbox=lng1,lat1,lng2,lat2
  → GeoJSON heatmap des parcelles en stress dans une zone

GET /api/analytics/comparatif/benchmarks?culture=riz&region=saint-louis
  → Comparer les rendements d'une org vs benchmark régional ISRA

POST /api/analytics/export/rapport-annuel
  → Génère PDF rapport bilan annuel (campagne, récoltes, intrants)
```

**Nouvelles entités :**
- `RendementReference` — benchmarks ISRA par culture/région/saison
- `CoutProduction` — saisie des coûts main d'œuvre + transport

---

### 5.3 🌦️ Module Météo — Implémentation réelle

Actuellement 100% hardcodé. Pour l'Afrique, les sources de données météo critiques :

```typescript
// Sources à intégrer :
1. OpenWeatherMap (déjà configuré) — météo actuelle + prévisions 7j
2. CHIRPS (Climate Hazards Group) — précipitations historiques
3. TAMSAT (University of Reading) — pluviométrie Afrique sub-saharienne
4. AGRHYMET (Niamey) — alertes sécheresse Sahel

// Endpoints à implémenter :
GET /api/meteo/current?lat=&lng=           → Météo actuelle (OpenWeatherMap)
GET /api/meteo/forecast/7j?lat=&lng=       → Prévisions 7 jours
GET /api/meteo/historique?lat=&lng=&annees=5  → Historique pluies CHIRPS
GET /api/meteo/alerte-secheresse?region=   → Alertes Sahel (AGRHYMET)
GET /api/meteo/etp?lat=&lng=&date=         → ETP Penman-Monteith (irrigation)
POST /api/meteo/parcelle/:id/bulletin      → Bulletin météo personnalisé parcelle
```

**Impact agronomique concret :**
- Calcul du calendrier cultural optimisé selon prévisions
- Alerte automatique si stress hydrique imminent (pluie < ETP)
- Recommandation d'irrigation préventive

---

### 5.4 🛰️ Module NDVI — Intégration réelle Sentinel Hub

Actuellement `fetchNdvi()` retourne un faux jobId.

```typescript
// Intégration Sentinel Hub Process API v2
// Les credentials sont déjà en .env !

async fetchNdvi(parcelleId: string): Promise<void> {
  // 1. Récupérer boundary de la parcelle
  // 2. Requête Sentinel Hub Evalscript NDVI
  // 3. Sauvegarder NdviData en base
  // 4. Déclencher alerte si NDVI < 0.3 (stress sévère)
}

// Endpoints supplémentaires à créer :
GET /api/ndvi/parcelle/:id/evolution      → Courbe NDVI sur 12 mois
GET /api/ndvi/parcelle/:id/carte-zones    → GeoJSON zones NDVI par intensité
GET /api/ndvi/alerte/region?region=       → Parcelles en stress dans une région
POST /api/ndvi/batch?organisationId=      → Lance fetch NDVI pour toutes parcelles org
```

**Nouveaux indices à intégrer :**
- **EVI** (Enhanced Vegetation Index) — plus précis que NDVI en zone dense
- **SAVI** (Soil Adjusted VI) — sols nus du Sahel
- **NDWI** (Water Index) — stress hydrique parcelles irriguées
- **LAI** (Leaf Area Index) — densité foliaire pour estimation rendement précoce

---

### 5.5 🌱 Module Diagnostic Phytosanitaire IA (différenciant majeur)

Le module `sync/agro_rules` contient des règles expertes statiques. Il faut un moteur de diagnostic intelligent :

```
POST /api/diagnostic/analyse
  Body: { parcelleId, photos: string[], symptomes: string[], stade, culture }
  → { diagnostic, confiance: 0.87, recommandations[], urgence, coutTraitement }

// Workflow :
1. Analyse des photos via Claude Vision API (anthropic)
2. Match avec AgroRules en base (rule engine)
3. Si confiance < 0.6 → auto-escalade vers expert humain
4. Retourne recommandation + coût FCFA/ha + délai avant récolte

// Nouvelles entités :
DiagnosticSession { parcelleId, photos[], symptomesDetectes[], 
                    diagnostic, confiance, recommandation, 
                    valideParExpert, expertId }
```

**Valeur business :** Ce module transforme l'app de "formulaire terrain" en "conseiller agronomique IA". Différenciant Fort vis-à-vis de la concurrence.

---

### 5.6 💧 Module Irrigation & Eau

Critique pour le Delta du Fleuve Sénégal (riziculture irriguée).

```
// Entités à créer :
IrrigationEvent { parcelleId, date, dureeHeures, volumeM3, source, operateurId }
SensorIoT { parcelleId, type (humidite_sol|niveau_eau|debit), valeur, timestamp }

// Endpoints :
POST /api/irrigation/evenement             → Enregistrer irrigation manuelle
GET  /api/irrigation/parcelle/:id/historique → Historique irrigations
GET  /api/irrigation/recommandation/:id    → Besoin eau estimé (ETP - pluie)
POST /api/sensors/data                     → Ingestion données IoT (capteurs sol)
GET  /api/sensors/parcelle/:id/latest      → Dernières mesures capteurs
GET  /api/irrigation/alerte/deficit        → Parcelles en déficit hydrique
```

---

### 5.7 💰 Module Financement & Marché (fort potentiel Afrique)

L'interop avec les banques est un début. Le hub doit aller plus loin :

```
// Module marché :
GET  /api/marche/prix-actuels?culture=riz&region=saint-louis
  → Prix au kg aux marchés locaux (scraping/API partenaire)

GET  /api/marche/prediction-prix?culture=&campagne=
  → Prévision prix à la récolte (modèle ML)

POST /api/financement/demande-credit
  → Génère dossier crédit complet (historique récoltes + score) pour banque partenaire

POST /api/financement/assurance-parametrique
  → Souscription assurance indiciaire NDVI automatique

GET  /api/financement/eligible-subventions?organisationId=
  → Subventions ANCAR/SODAGRI disponibles selon profil exploitation

// Nouvelles entités :
PrixMarche { culture, marche, region, prixKg, date, source }
DemandeCredit { agriculteurId, montant, objetCredit, scoreCredit, statut, banqueId }
ContratAssurance { parcelleId, type, indexDeclenchement, montantIndemnisation, saison }
```

---

### 5.8 📱 API Mobile Optimisée (Flutter/React Native)

L'API actuelle n'est pas optimisée pour le mobile Afrique (3G/Edge, appareils low-end).

```
// Endpoints mobile-first à créer :
GET /api/mobile/dashboard/:userId
  → Réponse condensée : mes parcelles urgentes + tâches du jour + météo
  → 1 seul appel réseau au lieu de 5 (parcelles + tâches + météo + notifs + visites)

GET /api/mobile/parcelle/:id/fiche-complete
  → Fiche parcelle complète : infos + dernière visite + dernier NDVI + tâches en cours
  → Optimisé pour affichage hors ligne

POST /api/mobile/sync/batch
  → Upload batch d'observations collectées offline
  → Déduplication par client_timestamp + device_id

GET /api/mobile/carte/tuiles?bbox=&zoom=
  → Tuiles vectorielles Mapbox/PMTiles des parcelles dans la bbox
  → Évite de charger tous les GeoJSON en mémoire

// Headers mobile-first :
Accept-Encoding: gzip         → Compression obligatoire
ETag + If-None-Match          → Cache côté client
X-App-Version                 → Versioning app Flutter
```

---

### 5.9 🔗 Interopérabilité Sectorielle (hub de données)

Pour être un vrai hub, il faut des connecteurs standardisés :

```
// Standards agricoles internationaux à implémenter :
1. CGIAR/FMIS API — partage de données avec systèmes de gestion agricole internationaux
2. FAO AgriFAO Gateway — reporting indicateurs FAO
3. WASCAL API — données climatiques Afrique de l'Ouest
4. TAAT (Technologies for African Agricultural Transformation) — dissémination variétés

// Nouvelles routes :
GET  /api/interop/fao/indicateurs       → Export indicateurs pour FAO
POST /api/interop/cgiar/sync            → Sync bidirectionnelle CGIAR FMIS
GET  /api/interop/wascal/climate/:zone  → Données climatiques WASCAL
GET  /api/interop/ancar/conseillers     → Conseillers ANCAR disponibles par zone

// B2B API (accès partenaires agro-dealers, ONG, ministère) :
POST /api/b2b/auth/token               → OAuth2 client_credentials
GET  /api/b2b/data/productions?region= → Données production agrégées (anonymisées)
GET  /api/b2b/data/intrants/consommation → Tendances consommation intrants
POST /api/b2b/alerts/subscribe         → Abonnement webhook alertes régionales
```

---

### 5.10 🔔 Système d'Alertes Intelligentes

Actuellement les notifications sont créées manuellement. Il faut un moteur d'alertes automatiques :

```typescript
// Règles d'alertes à implémenter (cron jobs) :
@Cron('0 6 * * *') // 6h du matin
async checkAlertes() {
  // 1. NDVI < 0.3 depuis 7 jours → alerte stress sévère
  // 2. Stock intrant <= seuilAlerte → alerte réapprovisionnement
  // 3. Tâche urgente en retard (datePlanifiee < aujourd'hui, statut != done)
  // 4. Visite planifiée aujourd'hui non démarrée à 10h
  // 5. Prévision pluie < 5mm/semaine + culture en floraison → alerte irrigation
  // 6. dateExpiration intrant dans 30 jours
  // 7. Campagne à 90% du temps écoulé mais progressionPct < 60%
}

// Canal de notification multicanal :
interface NotificationChannel {
  push: boolean;    // Firebase FCM (mobile Flutter)
  sms: boolean;     // Orange SMS API (rural sans internet)
  whatsapp: boolean; // WhatsApp Business API (très utilisé Sénégal)
  email: boolean;
}
```

**WhatsApp Business API** : Canal prioritaire en Afrique de l'Ouest — 95% de pénétration au Sénégal vs 40% email.

---

### 5.11 🗺️ Module Cartographie Avancée

Le `GET /api/parcelles/carte` retourne du GeoJSON brut. Pour un hub :

```
// Endpoints cartographiques manquants :
GET /api/carte/region/:region/overview
  → Vue d'ensemble région : surfaces, cultures, statuts santé

GET /api/carte/cluster?zoom=&bbox=
  → Clusters de parcelles pour performances carte (supercluster)

GET /api/carte/heatmap/sante
  → GeoJSON heatmap santé parcelles (couleur par healthScore)

GET /api/carte/heatmap/ndvi?date=
  → GeoJSON heatmap NDVI par zone agro-écologique

GET /api/carte/isochrone?lat=&lng=&minutes=30
  → Zone d'intervention d'un technicien à 30min (routing OSM)

GET /api/carte/sol/senegal
  → Couche sols Sénégal (WMS ISRIC SoilGrids)

// Formats d'export :
GET /api/carte/export/shapefile?organisationId=  → Export Shapefile ZIP
GET /api/carte/export/kml?organisationId=        → Export KML Google Earth
GET /api/carte/export/geojson?organisationId=    → Export GeoJSON
```

---

### 5.12 👥 Multi-tenancy & Portail Partenaires

Architecture actuelle : `organisationId` en champ simple, non enforced.

```typescript
// Ce qu'il faut :

// 1. Middleware TenantScope (PRIORITÉ HAUTE)
// Injecter automatiquement organisationId dans TOUTES les requêtes
// basé sur le JWT de l'utilisateur connecté

@Injectable()
export class TenantScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    req.organisationId = req.user.organisationId; // depuis JWT
    return next.handle();
  }
}

// 2. Plan de souscription (freemium → monetisation)
SubscriptionPlan {
  FREE:       5 parcelles, 2 users, pas d'export
  BASIC:      50 parcelles, 10 users, export CSV (15 000 FCFA/mois)
  PRO:        illimité, NDVI, analytics, API B2B (45 000 FCFA/mois)
  ENTERPRISE: white-label, SLA 99.9%, support dédié (sur devis)
}

// 3. Portail partenaires (banques, assurances, ONG)
PartnerPortal {
  API key management, quotas d'appels, logs d'accès, webhook config
}
```

---

## 6. Performance & scalabilité

### 6.1 Redis — à connecter aux services (actuellement inutilisé)

Redis est configuré dans `app.module.ts` mais aucun service ne l'utilise.

```typescript
// Caching à implémenter en priorité :

// Météo : 30 minutes (données rarement changées)
@UseInterceptors(CacheInterceptor)
@CacheTTL(1800)
async getMeteo(lat: number, lng: number) { ... }

// NDVI dernière valeur : 1 heure
async getLatestNdvi(parcelleId: string) {
  const cached = await this.cache.get(`ndvi:${parcelleId}:latest`);
  if (cached) return cached;
  // ... fetch DB ...
  await this.cache.set(`ndvi:${parcelleId}:latest`, result, 3600);
}

// AgroRules : 24 heures (données très stables)
async getAgroRules() {
  const cached = await this.cache.get('agro_rules:active');
  // ...
}

// Stats dashboard : 5 minutes
async getDashboardStats(organisationId: string) { ... }
```

### 6.2 Queue asynchrone — Bull/BullMQ (absent, critique)

Les jobs longs bloquent le thread HTTP :

| Job long actuel | Solution |
|---|---|
| Génération PDF rapport | Bull queue → worker séparé |
| Fetch NDVI Sentinel Hub | Bull queue + retry 3x |
| Envoi SMS Orange | Bull queue (timeout réseau Orange) |
| Envoi notifications FCM batch | Bull queue batches 500 |
| Export Excel/Shapefile | Bull queue → upload Cloudinary |

```bash
npm install @nestjs/bull bull ioredis
```

### 6.3 Pagination — limite non enforced

Actuellement `limit` peut être `99999` — pas de cap.

```typescript
// Ajouter dans tous les services :
const limit = Math.min(query?.limit || 20, 100); // max 100 par page
```

### 6.4 N+1 queries potentielles

`getCampagnes(parcelleId)` dans parcelles.service utilise `DataSource.getRepository()` — pas de query optimisée. À surveiller avec `logging: true` en dev.

### 6.5 Index manquants

```sql
-- À ajouter via migration :
CREATE INDEX idx_visites_date ON visites("date" DESC);
CREATE INDEX idx_recoltes_date ON recoltes("dateRecolte" DESC);
CREATE INDEX idx_notifications_user_created ON notifications("userId", "createdAt" DESC) WHERE lue = false;
CREATE INDEX idx_taches_assigned_active ON taches("assigneAId", "statut") WHERE statut != 'done';
```

---

## 7. Infrastructure & DevOps

### 7.1 Ce qui est en place ✅

- Docker multi-stage build (Dockerfile optimisé)
- GitHub Actions CI (lint + tests + Docker push)
- GitHub Actions CD (deploy EC2 via SSH)
- docker-compose.deploy.yml avec healthchecks

### 7.2 Ce qui manque

```
❌ Pas de /health endpoint → docker healthcheck échoue silencieusement
❌ Single point of failure EC2 (pas de load balancer)
❌ Pas de backup automatique PostgreSQL
❌ Pas de monitoring (aucune alerte si l'API tombe)
❌ Logs non structurés (console.log) → difficile à exploiter
❌ Pas de gestion des secrets (credentials dans .env.production)
❌ TypeORM synchronize: true en dev → dangereux si dev DB = prod
```

### 7.3 Actions infrastructure recommandées

```typescript
// 1. Health check endpoint (URGENT — docker depend_on en a besoin)
// src/health/health.controller.ts
@Get('/health')
async health() {
  return {
    status: 'ok',
    db: await this.dataSource.query('SELECT 1'),
    redis: await this.cache.get('__health__'),
    timestamp: new Date().toISOString(),
  };
}

// 2. Logger structuré (Pino — le plus performant pour NestJS)
npm install nestjs-pino pino-http

// 3. Backup PostgreSQL automatique (cron EC2)
# 0 2 * * * pg_dump petalia | gzip > /backups/petalia_$(date +%Y%m%d).sql.gz
# + upload S3 ou rsync vers serveur distant

// 4. Monitoring : Uptime Robot (gratuit) ou Better Uptime
// Alerte SMS/email si /health répond != 200 pendant 2min
```

---

## 8. Roadmap priorisée

### Sprint 1 — Sécurité & stabilité (2 semaines) 🔴
> **Objectif : rendre l'API deployable en production**

| # | Tâche | Effort | Impact |
|---|---|---|---|
| 1.1 | Supprimer OTP hardcodé — implémenter vrai OTP Redis | 1j | CRITIQUE |
| 1.2 | Sécuriser webhook assurance (HMAC-SHA256) | 0.5j | CRITIQUE |
| 1.3 | Corriger CORS — liste blanche origins | 0.5h | CRITIQUE |
| 1.4 | Ajouter rate limiting (`@nestjs/throttler`) | 0.5j | HAUTE |
| 1.5 | Créer DTOs manquants (campagnes, equipes, webhooks, interop) | 2j | HAUTE |
| 1.6 | Implémenter `/health` endpoint | 2h | HAUTE |
| 1.7 | Créer `Organisation` entity + module complet | 2j | BLOQUANT |
| 1.8 | Middleware `TenantScopeInterceptor` | 1j | HAUTE |

### Sprint 2 — Compléter les stubs (2 semaines) 🟠
> **Objectif : rendre l'API fonctionnellement complète**

| # | Tâche | Effort | Impact |
|---|---|---|---|
| 2.1 | Intégrer OpenWeatherMap réel + cache Redis | 1j | HAUTE |
| 2.2 | Intégrer Sentinel Hub NDVI réel + Bull queue | 3j | HAUTE |
| 2.3 | KPIs rapports calculés depuis DB réelle | 2j | HAUTE |
| 2.4 | Implémenter `forgotPassword` (SMS OTP) | 1j | HAUTE |
| 2.5 | Signature HMAC réelle pour interop bancaire | 1j | HAUTE |
| 2.6 | Activer Redis caching sur météo + NDVI + règles | 1j | MOYENNE |
| 2.7 | Moteur d'alertes automatiques (cron jobs) | 2j | HAUTE |

### Sprint 3 — Analytics & Cartographie (3 semaines) ✅
> **Objectif : devenir un hub de données, pas juste un CRUD** — *complété 2026-05-01*

| # | Tâche | Effort | Impact | État |
|---|---|---|---|---|
| 3.1 | Endpoints analytiques (rendements, tendances, marges) | 3j | HAUTE | ✅ |
| 3.2 | Export GeoJSON/Shapefile/KML | 2j | MOYENNE | ✅ |
| 3.3 | API mobile optimisée (`/mobile/dashboard`, batch sync) | 2j | HAUTE | ✅ |
| 3.4 | Benchmarks rendement ISRA (entité + endpoints) | 2j | HAUTE | ✅ |
| 3.5 | Tuiles vectorielles carte (cluster, heatmap) | 3j | MOYENNE | ✅ |
| 3.6 | Module irrigation + recommandation eau | 2j | HAUTE | ✅ |

### Sprint 4 — IA & Différenciation (4 semaines) 🟢
> **Objectif : avantage concurrentiel fort**

| # | Tâche | Effort | Impact |
|---|---|---|---|
| 4.1 | Module diagnostic phytosanitaire IA (Claude Vision) | 5j | TRÈS HAUTE |
| 4.2 | Prédiction prix marché (ML léger) | 4j | HAUTE |
| 4.3 | Intégration WhatsApp Business (notifications) | 2j | HAUTE |
| 4.4 | Nouvelles indices satellite (EVI, SAVI, NDWI, LAI) | 3j | HAUTE |
| 4.5 | B2B API portail partenaires (OAuth2 + quotas) | 4j | HAUTE |
| 4.6 | Système de souscription freemium | 3j | HAUTE |

### Sprint 5 — Scalabilité & Opérations (2 semaines) 🔵
> **Objectif : ops production-grade**

| # | Tâche | Effort | Impact |
|---|---|---|---|
| 5.1 | Migration workers Bull (PDF, NDVI, SMS) | 3j | HAUTE |
| 5.2 | Logger structuré Pino + ELK ou Loki | 2j | HAUTE |
| 5.3 | Backup PostgreSQL automatique + S3 | 1j | CRITIQUE |
| 5.4 | Load balancer + 2ème instance EC2 | 1j | HAUTE |
| 5.5 | Tests unitaires + intégration (cible 70% coverage) | 5j | HAUTE |
| 5.6 | Monitoring Uptime + alertes Slack | 0.5j | HAUTE |

---

## 9. Matrice ROI / Effort

```
IMPACT FORT
    │
    │  [Diagnostic IA]    [Analytics]      [Sécurité]
    │  [WhatsApp notif]   [Org module]     [NDVI réel]
    │  [Mobile optim]     [Météo réelle]
    │
    │  [B2B API]          [Irrigation]     [Alertes auto]
    │  [Marché prix]      [Cartographie]
    │
    │  [Subventions]      [CGIAR/FAO]      [IoT sensors]
    │  [Assurance param]
    │
IMPACT FAIBLE
    └─────────────────────────────────────────────────
      EFFORT FAIBLE            EFFORT FORT
```

### Top 10 actions ROI maximal

| Rang | Action | Effort | ROI métier |
|---|---|---|---|
| 🥇 1 | **Sécurité critique** (OTP, CORS, webhook) | 2j | Débloquer production |
| 🥈 2 | **Module Organisation** | 2j | Multi-tenant réel |
| 🥉 3 | **Météo + alertes automatiques** | 2j | Valeur terrain immédiate |
| 4 | **NDVI réel Sentinel Hub** | 3j | Différenciant satellite |
| 5 | **Analytics rendements** | 3j | Valeur données agrégées |
| 6 | **Diagnostic IA Claude Vision** | 5j | Différenciant fort IA |
| 7 | **WhatsApp Business** | 2j | Adoption rurale Sénégal |
| 8 | **API mobile optimisée** | 2j | Performance Flutter 3G |
| 9 | **B2B API partenaires** | 4j | Monétisation hub |
| 10 | **Backup + monitoring** | 1j | Résilience production |

---

## Annexe — Nouvelles dépendances recommandées

```json
{
  "dependencies": {
    "@nestjs/bull": "^10.x",            // Queue jobs longs
    "bull": "^4.x",
    "nestjs-pino": "^3.x",             // Logger structuré
    "@nestjs/throttler": "^5.x",       // Rate limiting
    "@nestjs/terminus": "^10.x",       // Health checks
    "@anthropic-ai/sdk": "^0.x",       // Claude Vision IA
    "axios": "^1.x",                    // HTTP clients externes
    "archiver": "^6.x",                // Export ZIP/Shapefile
    "xlsx": "^0.18.x",                 // Export Excel
    "node-cron": "^3.x",               // Crons supplémentaires
    "helmet": "^7.x",                  // HTTP headers sécurisés
    "express-rate-limit": "^7.x"       // Rate limiting Express-level
  }
}
```

---

*Audit produit par analyse statique complète du code source + revue architecturale CTO.*  
*Prochaine révision recommandée : après Sprint 2 (fonctionnalité complète).*
