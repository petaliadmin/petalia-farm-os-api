# Petalia AgroAssist — Backend API v2.0
## Étude Complète · NestJS + MongoDB · Compatible Web & Mobile

> **Base URL production :** `https://api.agroassist.sn/api`  
> **Flutter dart-define :** `PETALIA_REMOTE_BASE_URL=https://api.agroassist.sn`  
> **Sources analysées :** `petalia-field-pro` (Flutter 3.x / Riverpod / Hive AES-256) + `p-agro-web` (Angular 17 / Signals / HttpClient)  
> **Garantie :** Contrats HTTP pixel-perfect, offline/online vérifié ligne par ligne

---

## Table des matières

1. [Analyse Compatibilité Clients](#1)
2. [Contrats HTTP Exacts par Client](#2)
3. [Architecture Globale](#3)
4. [Stack Technique](#4)
5. [Modèles MongoDB](#5)
6. [Endpoints — Compatibilité 100%](#6)
7. [Authentification & Tokens](#7)
8. [Protocole Offline/Online Mobile](#8)
9. [RBAC & Permissions](#9)
10. [Interopérabilité Externe](#10)
11. [Moteur de Recommandations](#11)
12. [Notifications & Push FCM](#12)
13. [NDVI & Satellite Sentinel-2](#13)
14. [Infrastructure & DevOps](#14)
15. [Sécurité](#15)
16. [Configurations Manuelles](#16)
17. [Roadmap](#17)

---

## 1. Analyse Compatibilité Clients

### 1.1 Angular Web (`p-agro-web`) — Comportements critiques

**Intercepteurs HTTP (ordre strict)**

```
Requête sortante :
  loadingInterceptor   → start()
  authInterceptor      → Authorization: Bearer {user.token}
                         X-App-Version: 1.0.0
                         Accept-Language: fr
                         bypass: sentinel-hub.com
  retryInterceptor     → GET only, ×2, délai 1s puis 2s, NO retry 4xx

Réponse :
  errorInterceptor     → 401  : auth.logout() + navigate(/login)
                         403  : toast + navigate(/403)
                         404  : toast
                         0    : toast "impossible de contacter serveur"
                         500+ : toast + navigate(/500)
                         bypass: sentinel-hub.com
  loadingInterceptor   → stop() (finalize)
```

**Token Web — stockage localStorage**
```typescript
// authInterceptor lit exactement :
const token = JSON.parse(localStorage.getItem("agroassist_user")).token;
// → Authorization: Bearer <token>
// Le token EST dans l'objet user retourné par /api/auth/login
```

> ⚠️ **CRITIQUE** : `auth/login` doit retourner `{ success: true, user: { ...User, token: string } }`.  
> Un HTTP 401 sur mauvais mot de passe déclencherait le logout automatique. Retourner 200 + `{ success: false, error }`.

---

### 1.2 Flutter Mobile (`petalia-field-pro`) — Comportements critiques

**Activation API distante**
```bash
# L'API NestJS N'EST ACTIVÉE QUE si dart-define est passé au build
flutter run --dart-define=PETALIA_REMOTE_BASE_URL=https://api.agroassist.sn
flutter build apk --dart-define=PETALIA_REMOTE_BASE_URL=https://api.agroassist.sn

# Sans dart-define → AppConstants.remoteApiEnabled = false
# → 100% local (Hive + assets JSON) — ZÉRO appel réseau
```

**DioClient — timeouts stricts**
```dart
connectTimeout: Duration(seconds: 12)   // Nginx doit router en < 12s
receiveTimeout: Duration(seconds: 15)   // Serveur doit répondre en < 15s
sendTimeout:    Duration(seconds: 15)   // Upload photos en < 15s
baseUrl:        "https://api.agroassist.sn"  // sans /api, sans /v1
```

**Hive AES-256 — boxes chiffrées**
```
box_auth              → session utilisateur
box_parcels           → Parcel[] + Farm[] + FieldPOI[] + Tour[] (même box)
box_observations      → observations terrain saisies offline
box_reports           → rapports PDF locaux
box_alerts            → alertes phytosanitaires
box_sync_queue        → ⭐ file d'actions à pousser vers le serveur
box_expert_requests   → demandes expert offline
box_agro_rules_cache  → règles agronomiques (NON chiffrée)
box_checklists        → checklists terrain
box_weather           → météo cache (NON chiffrée)
box_settings          → préférences UI (NON chiffrée)
```

**SyncService — cycle de vie**
```dart
// 1. Action offline → SyncService.enqueue(action)
//    → Hive.box("box_sync_queue").add(action)
// 2. Réseau revient → ConnectivityService émet NetworkStatus.online
//    → SyncService.flush() déclenché automatiquement
// 3. flush() → iterate box_sync_queue.keys
//    → pour chaque clé: await POST /v1/sync/push
//    → succès: await box.delete(key)
//    → erreur: state = SyncState.error (retry prochain "online")
// SyncStatus: { state: idle|syncing|error, pending: int, lastSync: DateTime? }
```

**Endpoints Flutter — préfixe `/v1/`**

| Source | Endpoint | Format attendu |
|---|---|---|
| `HttpAgroRulesRemoteSource` | `GET /v1/agro_rules?since=<ISO>` | `{ schemaVersion, updatedAt, rules[] }` |
| `HttpExpertRequestRemoteSource` | `POST /v1/expert_requests` | `{ id, status: "received", receivedAt }` |
| `SyncService.flush()` | `POST /v1/sync/push` | `{ processed, errors[], conflicts[], serverTimestamp }` |
| Sync pull | `GET /v1/sync/pull?since=&resources=` | `{ parcels[], agro_rules[], serverTimestamp }` |

---

## 2. Contrats HTTP Exacts par Client

### 2.1 Auth — Web & Mobile

**POST `/api/auth/login`** (Angular)
```json
// REQUEST
{ "email": "user@example.com", "password": "motdepasse" }

// RESPONSE 200 — succès
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "tech@coop.sn",
    "nom": "Diallo",
    "prenom": "Mamadou",
    "role": "technicien",
    "equipeId": "eq001",
    "avatar": "https://cdn.cloudinary.com/...",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}

// RESPONSE 200 — mauvais mdp (PAS 401 !)
{ "success": false, "error": "Email ou mot de passe incorrect" }
```

**POST `/api/auth/logout`** (Angular — fire-and-forget)
```
REQUEST: {}  (body vide)
RESPONSE: {} (ignorée par le client)
```

---

### 2.2 Parcelles — Contrat Angular

**GET `/api/parcelles`**
```typescript
// RESPONSE: Parcelle[] avec ces champs OBLIGATOIRES pour Angular
interface ParcelleResponse {
  id: string;                    // _id MongoDB converti (virtual)
  code: string;
  nom: string;
  superficie: number;
  culture: string;
  stade: string;
  statut: "sain"|"attention"|"urgent"|"recolte";
  technicienId: string;
  producteurNom: string;
  coordonnees: { lat: number; lng: number };   // ← virtual depuis centroid
  geometry?: { lat: number; lng: number }[];   // ← virtual depuis boundary ring
  zone: string;
  typesSol: string;              // label lisible
  derniereVisite: string;        // ISO8601
  prochaineVisite: string;
  rendementPrecedent: number;
  createdAt: string;
  // optionnels
  exploitantNom?: string;
  localite?: string;
  zoneAgroecologique?: string;
  typeSol?: string;
  modeAccesTerre?: string;
  sourceEau?: string;
  variete?: string;
  typeCampagne?: string;
  dateSemis?: string;
  densite?: string;
  culturePrecedente?: string;
  rotationPrevue?: string;
}
```

**GET `/api/parcelles/stats`**
```json
{ "data": { "total": 47, "urgentes": 3, "enAttention": 8, "totalHa": 312.5 } }
```

---

### 2.3 Visites — Contrats Exacts

**GET `/api/visites/recentes?limit=5`**
```
Query param: limit (entier) — toujours passé par Angular VisiteService.getRecentes()
Response: Visite[] triée par date DESC, slicée à limit
```

**GET `/api/visites/activite-semaine`**
```json
{
  "data": [
    { "jour": "Lun", "count": 4 },
    { "jour": "Mar", "count": 2 },
    { "jour": "Mer", "count": 0 },
    { "jour": "Jeu", "count": 3 },
    { "jour": "Ven", "count": 1 },
    { "jour": "Sam", "count": 0 },
    { "jour": "Dim", "count": 0 }
  ]
}
// Semaine ISO courante, lundi 00:00 UTC → dimanche 23:59 UTC
// Ordre STRICT: Lun, Mar, Mer, Jeu, Ven, Sam, Dim
```

**GET `/api/visites/stats`**
```json
{ "data": { "total": 98, "completees": 74, "planifiees": 15, "enCours": 9 } }
```

**PATCH `/api/visites/:id`** — auto-génération rapport
```
Si body.statut === "completee" && ancienStatut !== "completee"
→ Enqueue Bull job "generate-rapport-pdf"
→ Réponse immédiate (async)
→ Mise à jour visite.rapport = URL PDF quand terminé
```

---

### 2.4 Tâches — Contrats Exacts

**PATCH `/api/taches/:id/statut`** (appel de updateStatut())
```json
// REQUEST — body strict, UN SEUL CHAMP
{ "statut": "en_cours" }

// RESPONSE: Tache complète
{ "data": { "id": "...", "statut": "en_cours", ... } }
```

**GET `/api/taches/stats`**
```json
{ "data": { "total": 52, "urgentes": 5, "enCours": 12, "terminees": 30 } }
```

---

### 2.5 Intrants — Contrats Exacts

**GET `/api/intrants/consommation`**
```json
// Sorties 30 derniers jours, type avec 1ère lettre MAJUSCULE
{ "data": [
  { "type": "Engrais", "quantite": 450 },
  { "type": "Pesticide", "quantite": 12.5 },
  { "type": "Semence", "quantite": 200 }
]}
// ⚠️ type = i.type.charAt(0).toUpperCase() + i.type.slice(1) (convention Angular)
```

**GET `/api/intrants/stats`**
```json
{ "data": {
  "totalReferences": 18,
  "alertesStock": 3,        // quantiteStock <= seuilAlerte
  "alertesExpiration": 2,   // dateExpiration <= now + 30j
  "valeurTotale": 2850000   // FCFA: sum(quantiteStock * prixUnitaire)
}}
```

**POST `/api/intrants/:id/mouvements`**
```json
// REQUEST
{
  "date": "2026-04-19T10:00:00.000Z",
  "type": "sortie",
  "quantite": 50,
  "parcelleId": "p001",
  "motif": "Application parcelle Walo Nord",
  "operateurId": "user001"
}
// RESPONSE: Intrant avec quantiteStock recalculé
// quantiteStock -= 50 (sortie) | += 50 (entree)
// ⚠️ Rejeter si quantiteStock < 0 après déduction
```

---

### 2.6 Récoltes — Calculs Serveur OBLIGATOIRES

```typescript
// Le client Angular RecolteService.create() pré-calcule ET envoie ces champs.
// Le serveur DOIT recalculer et ÉCRASER les valeurs client pour cohérence.

// Formules EXACTES (identiques au service Angular) :
rendement = superficie > 0
  ? Math.round((quantiteRecoltee / 1000 / superficie) * 100) / 100
  : 0;

tauxPerte = quantiteRecoltee > 0
  ? Math.round((pertesPostRecolte / quantiteRecoltee) * 1000) / 10
  : 0;

revenuTotal = prixVente
  ? (quantiteRecoltee - pertesPostRecolte) * prixVente
  : undefined;
```

---

### 2.7 Rapports — Contrats Exacts

**GET `/api/rapports/kpis?periode=mois`**
```json
{ "data": {
  "visitesRealisees": 24,
  "haCouvertes": 89,
  "tachesClosees": 18,
  "coutIntrants": 1840000,
  "rendementMoyen": 4.1,
  "tauxAlertesResolues": 82
}}
// periode: "semaine" | "mois" | "saison"  (défaut: "mois")
```

**GET `/api/rapports/graphiques`**
```json
{ "data": {
  "rendementParCulture": [
    { "culture": "Riz",      "rendement": 4.8, "objectif": 5.0, "emoji": "🌾" },
    { "culture": "Arachide", "rendement": 1.4, "objectif": 1.5, "emoji": "🥜" },
    { "culture": "Maïs",     "rendement": 3.2, "objectif": 4.0, "emoji": "🌽" },
    { "culture": "Oignon",   "rendement": 18.5,"objectif": 20.0,"emoji": "🧅" },
    { "culture": "Tomate",   "rendement": 22.0,"objectif": 25.0,"emoji": "🍅" },
    { "culture": "Mil",      "rendement": 0.9, "objectif": 1.0, "emoji": "🌿" }
  ],
  "topProblemes": [
    { "nom": "Pyriculariose",       "count": 5, "type": "maladie"  },
    { "nom": "Foreur de tige",      "count": 3, "type": "ravageur" },
    { "nom": "Mildiou",             "count": 3, "type": "maladie"  },
    { "nom": "Chenille légionnaire","count": 2, "type": "ravageur" },
    { "nom": "Stress hydrique",     "count": 2, "type": "stress"   }
  ],
  "activiteMensuelle": [
    { "semaine": "S40", "visites": 8,  "taches": 12 },
    { "semaine": "S41", "visites": 12, "taches": 15 },
    { "semaine": "S42", "visites": 6,  "taches": 9  },
    { "semaine": "S43", "visites": 10, "taches": 11 }
  ]
}}
```

**POST `/api/rapports/export`**
```json
// REQUEST
{ "format": "pdf", "type": "visites", "periode": "mois" }
// RESPONSE
{ "data": {
  "url": "https://cdn.cloudinary.com/petalia/rapports/Rapport_PetaliaFarmOS_2026-04-19.pdf",
  "nom": "Rapport_PetaliaFarmOS_2026-04-19.pdf"
}}
```

---

### 2.8 Campagnes — Contrats Exacts

**POST `/api/campagnes/:id/cloture`**
```json
// REQUEST — tous les champs optionnels (CampagneService.cloturerCampagne)
{
  "dateFin": "2026-04-19",              // optionnel
  "rendementFinal": 4.2,               // optionnel
  "observationsCloture": "Bonne campagne malgré sécheresse S3"  // optionnel
}
// RESPONSE: Campagne avec statut="terminee", progressionPct=100
```

**POST `/api/campagnes/:id/activer`**
```json
// REQUEST: {} (body vide)
// RESPONSE: Campagne avec statut="en_cours"
```

---

### 2.9 Notifications — Contrats Exacts

```json
// ⚠️ Angular NotificationService utilise .date (pas .createdAt)
// Le serveur DOIT exposer un virtual "date" = createdAt

// GET /api/notifications/count
{ "data": { "count": 7 } }

// PATCH /api/notifications/:id/lue
// REQUEST: {} (body vide — Angular marquerLue() ne passe pas de body)
// RESPONSE: { "data": Notification }

// Notification object (virtual date = createdAt)
{
  "id": "...",
  "type": "alerte",
  "titre": "Stock critique",
  "message": "Le stock de NPK est sous le seuil d'alerte",
  "date": "2026-04-19T10:00:00.000Z",   // ← virtual = createdAt
  "lue": false,
  "lienId": "int001",
  "lienType": "intrant"
}
```

---

### 2.10 Flutter — Contrats `/v1/`

**GET `/v1/agro_rules?since=2026-01-01T00:00:00.000Z`**
```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-04-19T06:00:00.000Z",
  "rules": [
    {
      "id": "ARA-R1-YELLOW-SAHEL-RAINY",
      "crop": "arachide",
      "stages": ["vegetative", "flowering"],
      "symptom": "yellow_leaves",
      "season": "hivernage",
      "regions": ["thies", "kaolack"],
      "severityMin": 0.3,
      "diagnosis": "Carence en fer...",
      "recommendation": {
        "title": "Apport fer + soufre",
        "actions": ["Pulvériser sulfate de fer 2g/L", "Répéter J+7"],
        "costFcfaPerHa": 15000,
        "delayBeforeHarvestDays": 0,
        "ppeRequired": false,
        "followupDays": 7
      },
      "validatedBy": "ISRA Bambey"
    }
  ]
}
```

**POST `/v1/expert_requests`**
```json
// REQUEST (ExpertRequest.toJson())
{
  "id": "local-uuid-xyz",
  "parcelId": "p-001",
  "photoPaths": ["/storage/img1.jpg"],
  "context": "Taches brunes sur feuilles arachide...",
  "createdAt": "2026-04-19T09:45:00.000Z",
  "remoteId": null,
  "status": "queued",
  "answer": null,
  "answeredAt": null
}

// RESPONSE 201
{
  "id": "507f1f77bcf86cd799439011",
  "status": "received",
  "receivedAt": "2026-04-19T10:00:00.000Z"
}
// Flutter: request.copyWith(remoteId: data["id"], status: ExpertRequestStatus.sent)
```

**GET `/v1/sync/pull?since=2026-04-15T00:00:00Z&resources=parcels,agro_rules`**
```json
{
  "parcels": [
    {
      "id": "507f...",
      "name": "Parcelle Walo Nord",
      "owner": "Mamadou Diallo",
      "village": "Ross Béthio",
      "crop": "riz",
      "growthStage": "tallage",
      "irrigation": "canal",
      "healthScore": 0.82,
      "lastVisit": "2026-04-17T00:00:00.000Z",
      "estimatedYield": 4.8,
      "boundary": [[14.7921, -16.9287], [14.7921, -16.9265]],
      "variety": "Sahel 108",
      "semisDate": "2026-08-15T00:00:00.000Z",
      "region": "saint-louis",
      "soilType": "argileux",
      "previousCrop": "tomate"
    }
  ],
  "agro_rules": [],
  "serverTimestamp": "2026-04-19T10:00:00.000Z"
}
// ⚠️ Clé "parcels" (anglais) et non "parcelles" (français Angular)
// ⚠️ boundary = [[lat, lng], ...] (format Dart LatLng: lat d'abord)
```

---

## 3. Architecture Globale

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                      │
│                                                                      │
│  Angular PWA (p-agro-web)      Flutter Mobile (petalia-field-pro)   │
│  /api/* ← authInterceptor       /v1/* ← DioClient                   │
│  token: localStorage.user.token  dart-define: PETALIA_REMOTE_BASE_URL│
│  retry GET ×2 · errorInterceptor Hive AES-256 · SyncService         │
└───────────────┬────────────────────────────┬─────────────────────────┘
                │                            │
                ▼                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│               Nginx — Reverse Proxy SSL (Let's Encrypt)              │
│  /api/* → NestJS :3000   /v1/* → NestJS :3000                       │
│  Rate limit: auth 5r/m · OTP 3r/m · global 60r/m · sync 30r/m      │
│  CORS: https://app.agroassist.sn · *.agroassist.sn                  │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
          ┌──────────────────┼────────────────────┐
          ▼                  ▼                     ▼
  ┌─────────────┐   ┌──────────────┐   ┌───────────────────┐
  │ NestJS API  │   │ NestJS Worker│   │ Webhook Service   │
  │ /api + /v1  │   │ Bull Queues  │   │ Interop partenaires│
  │ :3000       │   │ NDVI·PDF·FCM │   │ Banque/Assur/État │
  └──────┬──────┘   └──────┬───────┘   └──────────┬────────┘
         └────────┬─────────┘                      │
                  ▼                                ▼
        ┌──────────────────┐           ┌──────────────────┐
        │  MongoDB Atlas   │           │   Redis :6379     │
        │  Replica Set ×3  │           │  Cache·Queues·Pub │
        └──────────────────┘           └──────────────────┘
```

---

## 4. Stack Technique

| Couche | Tech | Version | Rôle |
|---|---|---|---|
| Runtime | Node.js | 20 LTS | — |
| Framework | NestJS | 10.x | DI, modules, décorateurs |
| Langage | TypeScript | 5.x | Cohérence Angular |
| ODM | Mongoose | 8.x | Schemas, hooks, virtuals GeoJSON |
| Base | MongoDB | 7.x | Docs flexibles, 2dsphere |
| Cache/Queue | Redis | 7.x | Bull, sessions, pub/sub |
| Jobs | Bull | 4.x | NDVI, PDF, webhooks, SMS |
| Auth | Passport.js + JWT | — | Local + JWT strategies |
| Validation | class-validator + zod | — | DTOs + schemas partenaires |
| Upload | Multer + Sharp | — | Photos terrain (WebP 1200px) |
| PDF | PDFKit | — | Rapports visite |
| Push | Firebase Admin | 12.x | FCM Android + iOS |
| SMS | Orange Developer API | — | OTP Sénégal |
| Proxy | Nginx | alpine | SSL, rate limit, CORS |
| Conteneurs | Docker Compose | 24.x | Dev + prod |
| CI/CD | GitHub Actions | — | Lint, test, build, deploy |

---

## 5. Modèles MongoDB

### 5.1 Collection `users`

```typescript
@Schema({ timestamps: true })
export class User {
  @Prop({ unique: true, sparse: true, lowercase: true })
  email?: string;

  @Prop({ unique: true, sparse: true })
  phone?: string;                // +221XXXXXXXXX

  @Prop({ required: true, select: false })
  passwordHash: string;          // bcrypt r=12

  @Prop({ required: true }) nom: string;
  @Prop({ required: true }) prenom: string;

  @Prop({ enum: ["directeur","superviseur","technicien","admin","partenaire"] })
  role: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Organisation" })
  organisationId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Equipe", sparse: true })
  equipeId?: Types.ObjectId;

  @Prop() avatar?: string;
  @Prop({ default: true }) actif: boolean;

  // OTP mobile
  @Prop({ select: false }) otpCode?: string;
  @Prop() otpExpiry?: Date;
  @Prop({ default: 0, select: false }) loginAttempts: number;
  @Prop() lockedUntil?: Date;

  // Refresh token web
  @Prop({ select: false }) refreshTokenHash?: string;

  // API Key partenaire
  @Prop({ select: false, unique: true, sparse: true }) apiKeyHash?: string;
  @Prop({ type: [String], default: [] }) apiScopes: string[];

  // FCM token (push mobile)
  @Prop() fcmToken?: string;
}

// Virtual id = _id.toString()
UserSchema.virtual("id").get(function() { return this._id.toHexString(); });
UserSchema.set("toJSON", { virtuals: true });
```

---

### 5.2 Collection `parcelles`

```typescript
@Schema({ timestamps: true })
export class Parcelle {
  @Prop({ required: true, unique: true }) code: string;
  @Prop({ required: true }) nom: string;
  @Prop({ required: true }) producteurNom: string;
  @Prop() exploitantNom?: string;
  @Prop() localite?: string;

  // GeoJSON Polygon — boundary (index 2dsphere OBLIGATOIRE)
  @Prop({
    type: { type: String, enum: ["Polygon"] },
    coordinates: { type: [[[Number]]] }
  })
  boundary: { type: "Polygon"; coordinates: number[][][] };

  // GeoJSON Point — centroïde calculé (index 2dsphere)
  @Prop({
    type: { type: String, enum: ["Point"] },
    coordinates: { type: [Number] }
  })
  centroid: { type: "Point"; coordinates: [number, number] };

  @Prop({ required: true }) superficie: number;     // ha
  @Prop() zone: string;
  @Prop() typesSol: string;                          // label lisible

  @Prop({ enum: ["riz","mais","mil","arachide","oignon","tomate","autre"] }) culture: string;
  @Prop({ enum: ["semis","levee","vegetative","tallage","floraison","fruiting","maturation","recolte"] }) stade: string;
  @Prop({ enum: ["sain","attention","urgent","recolte"], default: "sain" }) statut: string;

  @Prop({ enum: ["hivernage","contre_saison_froide","contre_saison_chaude"] }) typeCampagne?: string;
  @Prop() dateSemis?: Date;
  @Prop() variete?: string;
  @Prop() densite?: string;
  @Prop({ enum: ["riz","mais","mil","arachide","oignon","tomate"] }) culturePrecedente?: string;
  @Prop({ enum: ["riz","mais","mil","arachide","oignon","tomate"] }) rotationPrevue?: string;

  @Prop({ enum: ["dior","deck","argileux","sableux","argilo-sableux","lateritique","limoneux","sablo-humifere","sandy","sandy_loam","loam","clay_loam","clay","silt"] }) typeSol?: string;
  @Prop({ enum: ["Niayes","Casamance","Vallée du Fleuve Sénégal","Bassin Arachidier","Sénégal Oriental","Zone Sylvopastorale"] }) zoneAgroecologique?: string;
  @Prop() region?: string;
  @Prop({ enum: ["pluie","forage","canal","fleuve","bassin","puits","goutte_a_goutte","aspersion","submersion","gravitaire","rainfed"] }) sourceEau?: string;
  @Prop({ enum: ["propriete","pret","location","communautaire"] }) modeAccesTerre?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User" }) technicienId: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Organisation" }) organisationId: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Equipe", sparse: true }) equipeId?: Types.ObjectId;

  @Prop({ default: 0 }) healthScore: number;
  @Prop() rendementPrecedent?: number;
  @Prop() derniereVisite?: Date;
  @Prop() prochaineVisite?: Date;
  @Prop({ default: false }) deleted: boolean;         // soft delete
}

// Hook: calculer centroïde avant save
ParcelleSchema.pre("save", function(next) {
  if (this.boundary?.coordinates?.[0]) {
    const ring = this.boundary.coordinates[0];
    const n = ring.length - 1;
    const lng = ring.slice(0, n).reduce((s, p) => s + p[0], 0) / n;
    const lat = ring.slice(0, n).reduce((s, p) => s + p[1], 0) / n;
    this.centroid = { type: "Point", coordinates: [lng, lat] };
  }
  next();
});

// Virtual Angular: coordonnees { lat, lng }
ParcelleSchema.virtual("coordonnees").get(function() {
  if (!this.centroid?.coordinates) return undefined;
  return { lat: this.centroid.coordinates[1], lng: this.centroid.coordinates[0] };
});

// Virtual Angular: geometry [{ lat, lng }] depuis boundary ring
ParcelleSchema.virtual("geometry").get(function() {
  if (!this.boundary?.coordinates?.[0]) return undefined;
  return this.boundary.coordinates[0]
    .slice(0, -1)
    .map(([lng, lat]) => ({ lat, lng }));
});

ParcelleSchema.set("toJSON", { virtuals: true });

// Indexes OBLIGATOIRES (à créer AVANT la première insertion)
ParcelleSchema.index({ boundary: "2dsphere" });
ParcelleSchema.index({ centroid: "2dsphere" });
ParcelleSchema.index({ organisationId: 1, statut: 1, culture: 1 });
ParcelleSchema.index({ technicienId: 1, statut: 1 });
ParcelleSchema.index({ code: 1 }, { unique: true });
ParcelleSchema.index({ deleted: 1, organisationId: 1 });
```

---

### 5.3 Collections Complémentaires

```typescript
// notifications — virtual date = createdAt (requis par Angular)
NotificationSchema.virtual("date").get(function() { return this.createdAt; });
NotificationSchema.set("toJSON", { virtuals: true });
// TTL 90 jours
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
NotificationSchema.index({ userId: 1, lue: 1, createdAt: -1 });

// agro_rules — index updatedAt pour sync différentielle Flutter
AgroRuleSchema.index({ crop: 1, symptom: 1, actif: 1 });
AgroRuleSchema.index({ updatedAt: 1 });

// recoltes — 3 champs calculés par le serveur
RecolteSchema.pre("save", function(next) {
  this.rendement = this.superficie > 0
    ? Math.round((this.quantiteRecoltee / 1000 / this.superficie) * 100) / 100 : 0;
  this.tauxPerte = this.quantiteRecoltee > 0
    ? Math.round((this.pertesPostRecolte / this.quantiteRecoltee) * 1000) / 10 : 0;
  if (this.prixVente) {
    this.revenuTotal = (this.quantiteRecoltee - this.pertesPostRecolte) * this.prixVente;
  }
  next();
});

// audit_logs — TTL 1 an
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });
```

---

## 6. Endpoints — Compatibilité 100%

### Format enveloppe standard

```json
// Liste
{ "data": [], "meta": { "total": 47, "page": 1, "limit": 20 }, "success": true }
// Objet
{ "data": {}, "success": true }
// Erreur (sauf auth/login)
{ "success": false, "error": { "code": "PARCELLE_NOT_FOUND", "message": "...", "statusCode": 404 } }
```

### Tous les endpoints Angular (`/api/`)

```
# AUTH
POST   /api/auth/login                        → { success, user: User & { token } }
POST   /api/auth/login/otp/send               → { success, expiresIn: 300 }
POST   /api/auth/login/otp/verify             → { success, user: User & { token } }
POST   /api/auth/refresh                      → { token, expiresIn: 900 }
POST   /api/auth/logout                       → {} (fire-and-forget)
GET    /api/auth/me                           → { data: User }
PATCH  /api/auth/me                           → { data: User }
POST   /api/auth/change-password              → { success: true }
POST   /api/auth/forgot-password              → { success: true, message }

# PARCELLES
GET    /api/parcelles                         → { data: Parcelle[], meta }
GET    /api/parcelles/stats                   → { data: ParcelleStats }
GET    /api/parcelles/urgentes                → { data: Parcelle[] }
GET    /api/parcelles/carte                   → GeoJSON FeatureCollection
GET    /api/parcelles/nearby?lat=&lng=&rayon= → { data: Parcelle[] }
GET    /api/parcelles/:id                     → { data: Parcelle }
POST   /api/parcelles                         → { data: Parcelle }
PATCH  /api/parcelles/:id                     → { data: Parcelle }
DELETE /api/parcelles/:id                     → { data: true }  (soft delete)
GET    /api/parcelles/:id/visites             → { data: Visite[], meta }
GET    /api/parcelles/:id/taches              → { data: Tache[], meta }
GET    /api/parcelles/:id/campagnes           → { data: Campagne[], meta }
GET    /api/parcelles/:id/recoltes            → { data: Recolte[], meta }
GET    /api/parcelles/:id/ndvi                → { data: NdviData[] }
POST   /api/parcelles/:id/poi                 → { data: FieldPOI }
GET    /api/parcelles/:id/poi                 → { data: FieldPOI[] }

# VISITES
GET    /api/visites                           → { data: Visite[], meta }
GET    /api/visites/recentes?limit=N          → { data: Visite[] }
GET    /api/visites/stats                     → { data: VisiteStats }
GET    /api/visites/activite-semaine          → { data: [{jour,count}] }
GET    /api/visites/:id                       → { data: Visite }
POST   /api/visites                           → { data: Visite }
PATCH  /api/visites/:id                       → { data: Visite }
DELETE /api/visites/:id                       → { data: true }
POST   /api/visites/:id/photos                → { data: { photos: string[] } }
GET    /api/visites/:id/rapport               → { data: { url, nom } }
POST   /api/visites/:id/rapport               → { data: { url, nom } }
GET    /api/visites/parcelle/:parcelleId      → { data: Visite[] }

# TACHES
GET    /api/taches                            → { data: Tache[], meta }
GET    /api/taches/stats                      → { data: TacheStats }
GET    /api/taches/urgentes                   → { data: Tache[] }
GET    /api/taches/kanban                     → { data: { todo, en_cours, done, reporte } }
GET    /api/taches/:id                        → { data: Tache }
POST   /api/taches                            → { data: Tache }
PATCH  /api/taches/:id                        → { data: Tache }
PATCH  /api/taches/:id/statut                 → { data: Tache }  body: { statut }
DELETE /api/taches/:id                        → { data: true }

# INTRANTS
GET    /api/intrants                          → { data: Intrant[], meta }
GET    /api/intrants/stats                    → { data: IntrantStats }
GET    /api/intrants/alertes                  → { data: Intrant[] }
GET    /api/intrants/consommation             → { data: [{type,quantite}] }
GET    /api/intrants/:id                      → { data: Intrant }
POST   /api/intrants                          → { data: Intrant }
PATCH  /api/intrants/:id                      → { data: Intrant }
DELETE /api/intrants/:id                      → { data: true }
POST   /api/intrants/:id/mouvements           → { data: Intrant }  (stock recalculé)
GET    /api/intrants/:id/mouvements           → { data: Mouvement[], meta }

# RECOLTES
GET    /api/recoltes                          → { data: Recolte[], meta }
POST   /api/recoltes                          → { data: Recolte }  (calculs serveur)
GET    /api/recoltes/:id                      → { data: Recolte }
PATCH  /api/recoltes/:id                      → { data: Recolte }  (recalcul)
DELETE /api/recoltes/:id                      → { data: true }
GET    /api/recoltes/parcelle/:id             → { data: Recolte[] }  (date DESC)
POST   /api/recoltes/:id/valider              → { data: Recolte }
GET    /api/recoltes/:id/attestation          → { data: Attestation }

# CAMPAGNES
GET    /api/campagnes                         → { data: Campagne[], meta }
POST   /api/campagnes                         → { data: Campagne }
GET    /api/campagnes/:id                     → { data: Campagne }
PATCH  /api/campagnes/:id                     → { data: Campagne }
POST   /api/campagnes/:id/cloture             → { data: Campagne }  body: partiel optionnel
POST   /api/campagnes/:id/activer             → { data: Campagne }  body: {}
GET    /api/campagnes/:id/taches              → { data: Tache[] }
POST   /api/campagnes/:id/taches/generer      → { data: Tache[] }
GET    /api/campagnes/parcelle/:id            → { data: Campagne[] }

# EQUIPES & MEMBRES
GET    /api/equipes                           → { data: Equipe[], meta }
POST   /api/equipes                           → { data: Equipe }
GET    /api/equipes/:id                       → { data: Equipe }
PATCH  /api/equipes/:id                       → { data: Equipe }
DELETE /api/equipes/:id                       → { data: true }
GET    /api/equipes/:id/membres               → { data: Membre[] }
GET    /api/membres                           → { data: Membre[], meta }
GET    /api/membres/disponibles               → { data: Membre[] }
GET    /api/membres/:id                       → { data: Membre }
POST   /api/membres                           → { data: Membre }
PATCH  /api/membres/:id                       → { data: Membre }
DELETE /api/membres/:id                       → { data: true }

# RAPPORTS
GET    /api/rapports/kpis?periode=            → { data: KpiRapport }
GET    /api/rapports/graphiques               → { data: GraphiquesRapport }
POST   /api/rapports/export                   → { data: { url, nom } }
GET    /api/rapports/economiques              → { data: EconomicReport }

# NOTIFICATIONS
GET    /api/notifications                     → { data: Notification[], meta }
GET    /api/notifications/non-lues            → { data: Notification[] }
GET    /api/notifications/count               → { data: { count } }
PATCH  /api/notifications/:id/lue             → { data: Notification }  body: {}
POST   /api/notifications/marquer-toutes-lues → { data: { updated: N } }
DELETE /api/notifications/:id                 → { data: true }

# NDVI
GET    /api/ndvi/parcelle/:id                 → { data: NdviData[] }
GET    /api/ndvi/parcelle/:id/latest          → { data: NdviData | null }
POST   /api/ndvi/parcelle/:id/fetch           → { data: { jobId } }  202 Accepted
GET    /api/ndvi/dashboard                    → { data: [{zone, ndviMoyen, tendance}] }

# METEO
GET    /api/meteo?lat=&lng=                   → { data: MeteoJour }
GET    /api/meteo/:ville                      → { data: MeteoJour }
GET    /api/meteo/previsions/:ville           → { data: MeteoJour[] }

# WEBHOOKS (configuration partenaires)
GET    /api/webhooks                          → { data: Webhook[] }
POST   /api/webhooks                          → { data: Webhook }
PATCH  /api/webhooks/:id                      → { data: Webhook }
DELETE /api/webhooks/:id                      → { data: true }
POST   /api/webhooks/:id/test                 → { data: { sent: true } }
GET    /api/webhooks/:id/logs                 → { data: WebhookLog[], meta }
```

### Endpoints Flutter (`/v1/`)

```
GET    /v1/agro_rules?since=<ISO>             → { schemaVersion, updatedAt, rules[] }
POST   /v1/expert_requests                    → { id, status: "received", receivedAt }
POST   /v1/sync/push                          → { processed, errors[], conflicts[], serverTimestamp }
GET    /v1/sync/pull?since=&resources=        → { parcels[], agro_rules[], serverTimestamp }
GET    /v1/sync/status                        → { pending: N, lastSync: ISO }
```

### Endpoints Interopérabilité

```
GET    /api/interop/banque/agriculteur/:nationalId  → score + profil
GET    /api/interop/banque/recoltes/:nationalId     → historique certifié
GET    /api/interop/banque/score-credit/:nationalId → score numérique signé HMAC
POST   /api/interop/banque/credit/notification      → webhook entrant
GET    /api/interop/assurance/index-ndvi            → index zonal NDVI
POST   /api/interop/assurance/sinistre              → déclaration sinistre
POST   /api/interop/assurance/indemnisation/webhook → indemnisation entrant
GET    /api/interop/etat/statistiques               → stats anonymisées
GET    /api/interop/etat/production-region/:region  → prod par région
POST   /api/interop/etat/declaration-campagne       → déclaration officielle
```

---

## 7. Authentification & Tokens

```typescript
// Durée JWT recommandée pour compatibilité Angular (pas de refresh auto)
JWT_EXPIRES_IN = "8h"   // journée de travail complète sans déconnexion

// OTP Mobile — contraintes Orange API
OTP_LENGTH  = 6         // chiffres
OTP_EXPIRY  = 300       // secondes (5 minutes)
MAX_ATTEMPTS = 3        // avant lockout 30min

// Refresh token (mobile uniquement)
REFRESH_EXPIRES_IN = "30d"

// Lockout progressif
// 3 tentatives   → OTP invalide → lockout 5min
// 5 tentatives   → password     → lockout 30min
// admin peut reset manuellement
```

---

## 8. Protocole Offline/Online Mobile

### Types d'actions sync queue

```typescript
// Tout ce que Flutter peut créer offline et pousser via POST /v1/sync/push
type SyncActionType =
  | "observation.create"       // nouvelle observation terrain
  | "observation.update"       // modification observation
  | "parcel.create"            // nouvelle parcelle dessinée sur carte
  | "parcel.update"            // boundary ou infos parcelle
  | "expert_request.submit"    // demande d'avis expert
  | "poi.create"               // nouveau point d'intérêt (puits, forage...)
  | "poi.delete"               // suppression POI
  | "tour.save"                // tournée enregistrée
  | "checklist.complete";      // checklist complétée
```

### Politique de résolution de conflits

```
observation.create  → ACCEPT toujours (nouvelle data terrain précieuse)
parcel.update       → LAST-WRITE-WINS + notification superviseur si boundary modifié
parcel.create       → ACCEPT, vérifier code unique côté serveur
expert_request      → ACCEPT toujours
poi.*               → LAST-WRITE-WINS
tour.save           → ACCEPT toujours
```

### Conversion MongoDB → Flutter Parcel

```typescript
// GET /v1/sync/pull → parcels[] au format Flutter
function toFlutterParcel(p: ParcelleDocument): FlutterParcel {
  return {
    id:           p._id.toString(),
    name:         p.nom,
    owner:        p.producteurNom,
    village:      p.localite || "",
    crop:         p.culture,
    growthStage:  p.stade || "vegetative",
    irrigation:   p.sourceEau || "Rainfed",
    healthScore:  p.healthScore || 0,
    lastVisit:    p.derniereVisite?.toISOString() || new Date().toISOString(),
    estimatedYield: p.rendementPrecedent || 0,
    // boundary: [[lat, lng], ...] (Dart LatLng: lat d'abord)
    boundary: p.boundary?.coordinates?.[0]
      ?.slice(0, -1)
      .map(([lng, lat]) => [lat, lng]) || [],
    variety:      p.variete,
    semisDate:    p.dateSemis?.toISOString(),
    region:       p.region,
    soilType:     p.typeSol,
    previousCrop: p.culturePrecedente,
  };
}
```

---

## 9. RBAC & Permissions

| Ressource | admin | directeur | superviseur | technicien | partenaire |
|---|:---:|:---:|:---:|:---:|:---:|
| Parcelles READ | ✅ all | ✅ org | ✅ org | ✅ assignées | ❌ |
| Parcelles WRITE | ✅ | ✅ | ✅ | ✅ | ❌ |
| DELETE Parcelle | ✅ | ✅ | ✅ | ❌ | ❌ |
| Visites WRITE | ✅ | ✅ | ✅ | ✅ siennes | ❌ |
| Récolte VALIDER | ✅ | ✅ | ✅ | ❌ | ❌ |
| PATCH tâche statut | ✅ | ✅ | ✅ | ✅ | ❌ |
| KPIs rapports | ✅ | ✅ | ✅ | ❌ | ❌ |
| Interop endpoints | ✅ | ✅ | ❌ | ❌ | ✅ scope |
| AgroRules WRITE | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 10. Interopérabilité Externe

### Événements domaine webhooks

```typescript
// Émis par EventEmitter → adapters → Bull Queue → HTTP POST partenaire
// Signature: X-Petalia-Signature: sha256=<HMAC-SHA256>
// Retry: 3 tentatives (5min, 30min, 2h)

enum DomainEvent {
  RECOLTE_CREATED   = "recolte.created",
  RECOLTE_VALIDATED = "recolte.validated",
  VISITE_COMPLETED  = "visite.completed",
  PARCELLE_CREATED  = "parcelle.created",
  NDVI_ALERT        = "ndvi.alerte",
  CAMPAGNE_CLOSED   = "campagne.terminee",
}
```

### Score crédit agricole (Banque)

```json
// GET /api/interop/banque/score-credit/:nationalId
{
  "identifiant": "SN-1234567890",
  "score_agricole": 74,
  "niveau_risque": "FAIBLE",
  "capacite_remboursement_fcfa": 850000,
  "surface_exploitee_ha": 5.2,
  "productions": [
    { "annee": 2024, "culture": "arachide", "rendement_t_ha": 1.4, "qualite": "B" },
    { "annee": 2025, "culture": "riz",      "rendement_t_ha": 4.8, "qualite": "A" }
  ],
  "nb_visites_12_mois": 8,
  "parcelles_certifiees": 3,
  "certifie_par": "Petalia AgroAssist",
  "date_rapport": "2026-04-19",
  "signature_hmac": "sha256=abc123..."
}
```

---

## 11. Moteur de Recommandations

```typescript
// Algorithme identique à Flutter AgroRulesRepository.matchRules()
// POST /api/agro-rules/match
// GET /v1/agro_rules (retourne toutes les règles actives)

function specificityScore(rule: AgroRule): number {
  let score = 0;
  if (rule.crop !== "*") score += 4;
  if (!rule.stages.includes("*")) score += 2;
  if (rule.season !== "*") score += 1;
  if (!rule.regions.includes("*")) score += 1;
  return score;
}

// Matching: crop ∈ [rule.crop, "*"] 
//           stage ∈ rule.stages || stages = ["*"]
//           symptom === rule.symptom
//           season ∈ [rule.season, "*"]
//           region ∈ rule.regions || regions = ["*"]
//           severity >= rule.severityMin
// Sort: specificityScore DESC → top 5
```

---

## 12. Notifications & Push

```typescript
// Notifications créées automatiquement sur:
// 1. quantiteStock <= seuilAlerte → type:"alerte", lienType:"intrant"
// 2. ndviActuel - ndviPrecedent > 0.15 → type:"alerte", lienType:"parcelle"
//    titre: "Stress végétatif détecté"
//    message: "Parcelle X: NDVI en chute de Y à Z (-delta)"
// 3. Tâche dateFin dépassée → type:"avertissement"
// 4. Visite complétée → type:"succes"
// 5. Credit banque approuvé/refusé → type:"info"

// Push FCM (mobile) pour alertes urgentes
await admin.messaging().send({
  token: user.fcmToken,
  notification: { title: notif.titre, body: notif.message },
  data: { type: notif.type, lienType: notif.lienType, lienId: notif.lienId },
  android: { priority: "high" },
  apns: { payload: { aps: { badge: countNonLues } } },
});

// ⚠️ Angular NotificationService.startSimulation() génère 1 notif/60s en dev
// En prod → remplacer par polling /count toutes les 30s ou SSE (Phase 2)
```

---

## 13. NDVI & Satellite

```typescript
// Cron bi-hebdomadaire (lundi et jeudi, 6h UTC = Africa/Dakar)
// @Cron("0 6 * * 1,4", { timeZone: "Africa/Dakar" })

// Alerte automatique si chute NDVI > 0.15 entre 2 mesures consécutives
// Compatible Angular NdviService.checkAlerts() qui fait la même chose côté mock

// NdviData — format compatible Angular ET Flutter
{
  id: string,
  parcelleId: string,      // Angular utilise parcelleId
  date: Date,
  ndviMoyen: number,       // 0-1
  ndviMin: number,
  ndviMax: number,
  resolution: number,      // mètres (10 pour S2)
  source: "sentinel-2",
  zones: [{ lat, lng, valeur }],
  tileUrl?: string,        // URL WMS pour Leaflet Angular
  tileType?: "wms",
  imageUrl?: string,
  cloudCoverage?: number
}

// Classe NDVI (compatible Angular getNdviClasse())
// < 0.3 → "stress"
// 0.3-0.6 → "attention"
// > 0.6 → "sain"
```

---

## 14. Infrastructure & DevOps

### `docker-compose.yml` Production

```yaml
version: "3.9"
services:
  api:
    build: { context: ., dockerfile: Dockerfile }
    env_file: .env.production
    ports: ["3000:3000"]
    depends_on: [redis]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  worker:
    build: .
    env_file: .env.production
    environment: { WORKER_MODE: "true" }
    depends_on: [redis]
    restart: unless-stopped
    command: node dist/worker.js

  redis:
    image: redis:7-alpine
    volumes: [redis_data:/data]
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    depends_on: [api]
    restart: unless-stopped

volumes:
  redis_data:
```

---

## 15. Sécurité

### Checklist Compatibilité

```
ANGULAR WEB
✅ CORS: https://app.agroassist.sn uniquement
✅ auth/login → 200+success:false (pas 401) sur mauvais mdp
✅ 401 sur token expiré → logout auto Angular ✓
✅ 403 → navigate /403 ✓
✅ 500+ → navigate /500 ✓
✅ Headers CORS: Authorization, X-App-Version, Accept-Language, Content-Type
✅ GET retry ×2 côté Angular → serveur idempotent sur GET ✓
✅ POST/PATCH/DELETE non retentés → opérations non idempotentes sûres

FLUTTER MOBILE
✅ Timeouts: connectTimeout 12s, receiveTimeout 15s STRICTEMENT RESPECTÉS
✅ /v1/* préfixe distinct de /api/* — pas de collision
✅ format agro_rules: { schemaVersion, updatedAt, rules[] }
✅ expert_request 201: { id, status: "received", receivedAt }
✅ sync/push réponse < 30s (Nginx timeout)
✅ boundary: [[lat,lng],...] format Flutter (lat d'abord)
✅ "parcels" (pas "parcelles") dans /v1/sync/pull

PARTENAIRES
✅ X-API-Key hashée SHA256 en DB
✅ HMAC-SHA256 webhooks sortants
✅ IP whitelist /api/interop/* dans Nginx
✅ Données ANSD anonymisées (RGPD/loi 2021-15 Sénégal)
```

---

## 16. Configurations Manuelles

### Démarrage Développement

```bash
# 1. Cloner et installer
git clone https://github.com/petaliadmin/petalia-backend.git
cd petalia-backend && npm install

# 2. Config
cp .env.example .env.development
# Éditer: MONGODB_URI, REDIS_URL, JWT_SECRET...

# 3. Infra
docker compose up redis -d

# 4. MongoDB (Option local avec Docker)
docker run -d --name mongo-dev -p 27017:27017 mongo:7 --replSet rs0
sleep 3
docker exec mongo-dev mongosh --eval "rs.initiate()"

# 5. Init + seed
npm run migration:run       # Indexes MongoDB
npm run seed:dev            # Admin + agro_rules depuis assets Flutter

# 6. Démarrer
npm run start:dev           # :3000 avec hot reload
# Swagger: http://localhost:3000/api/docs
```

### Basculer Angular en mode réel

```typescript
// p-agro-web/src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: "http://localhost:3000/api",
  mock: false,   // ← false pour activer vrais appels HTTP
};
```

### Basculer Flutter en mode réel

```bash
flutter run --dart-define=PETALIA_REMOTE_BASE_URL=http://192.168.x.x:3000
# Production:
flutter build apk --dart-define=PETALIA_REMOTE_BASE_URL=https://api.agroassist.sn --release
```

### Orange SMS (OTP mobile)

```bash
# Test token
curl -X POST https://api.orange.com/oauth/v3/token \
  -H "Authorization: Basic $(echo -n 'CLIENT_ID:SECRET' | base64 -w0)" \
  -d "grant_type=client_credentials"

# Test SMS
curl -X POST https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B221XXXXXXXXXX/requests \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"outboundSMSMessageRequest":{"address":"tel:+221YYYYYYYYY","senderAddress":"tel:+221XXXXXXXXXX","outboundSMSTextMessage":{"message":"Votre code Petalia: 123456"}}}'
```

### SSL Let's Encrypt

```bash
sudo apt install certbot -y
sudo certbot certonly --standalone -d api.agroassist.sn
sudo cp /etc/letsencrypt/live/api.agroassist.sn/fullchain.pem /opt/petalia/nginx/certs/
sudo cp /etc/letsencrypt/live/api.agroassist.sn/privkey.pem /opt/petalia/nginx/certs/
# Renouvellement auto hebdomadaire
echo "0 3 * * 0 certbot renew --quiet" | sudo crontab -
```

### MongoDB Init Script

```javascript
// scripts/mongo-init.js
db = db.getSiblingDB("petalia");

// ⭐ GEO INDEXES (avant toute insertion)
db.parcelles.createIndex({ "boundary": "2dsphere" });
db.parcelles.createIndex({ "centroid": "2dsphere" });
db.parcelles.createIndex({ organisationId: 1, statut: 1, culture: 1 });
db.parcelles.createIndex({ technicienId: 1, statut: 1 });
db.parcelles.createIndex({ code: 1 }, { unique: true });
db.parcelles.createIndex({ deleted: 1, organisationId: 1 });

db.visites.createIndex({ parcelleId: 1, date: -1 });
db.visites.createIndex({ technicienId: 1, statut: 1 });
db.visites.createIndex({ organisationId: 1, date: -1 });
db.visites.createIndex({ "gpsLocation": "2dsphere" }, { sparse: true });

db.taches.createIndex({ parcelleId: 1, statut: 1 });
db.taches.createIndex({ equipeId: 1, statut: 1 });
db.taches.createIndex({ organisationId: 1, priorite: 1, statut: 1 });

db.intrants.createIndex({ organisationId: 1, type: 1 });
db.intrants.createIndex({ organisationId: 1, quantiteStock: 1 });
db.intrants.createIndex({ dateExpiration: 1 }, { sparse: true });

db.recoltes.createIndex({ parcelleId: 1, dateRecolte: -1 });
db.recoltes.createIndex({ organisationId: 1, dateRecolte: -1 });

// Sync différentielle Flutter
db.agro_rules.createIndex({ crop: 1, symptom: 1, actif: 1 });
db.agro_rules.createIndex({ updatedAt: 1 });

// TTL notifications 90 jours
db.notifications.createIndex({ userId: 1, lue: 1, createdAt: -1 });
db.notifications.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// TTL audit 1 an
db.audit_logs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

print("✅ Petalia MongoDB initialisé");
```

---

## 17. Roadmap

### Phase 1 — Branchement (S1-S6)
*`mock: false` Angular + `--dart-define` Flutter*

- [ ] Auth email+password (web) + OTP SMS Orange (mobile)
- [ ] CRUD Parcelles — GeoJSON + virtuals Angular + format Flutter
- [ ] CRUD Visites + upload photos Cloudinary (WebP 1200px)
- [ ] GET /v1/agro_rules — sync différentielle Flutter
- [ ] POST /v1/expert_requests — mobile offline queue
- [ ] POST /v1/sync/push + GET /v1/sync/pull — SyncService Flutter
- [ ] Notifications in-app auto (stock, NDVI, tâches)
- [ ] MongoDB init script + seed agro_rules depuis Flutter assets
- [ ] Docker Compose dev + CI/CD GitHub Actions

### Phase 2 — Fonctionnel (S7-S14)
*Tous les services Angular branchés*

- [ ] Campagnes (create, activer, cloture, taches/generer)
- [ ] PATCH /taches/:id/statut (Kanban Angular)
- [ ] Intrants : mouvements, stats, alertes, consommation
- [ ] Récoltes : calculs serveur, validation, attestation
- [ ] Équipes & Membres
- [ ] Rapports KPIs + graphiques + export PDF
- [ ] NDVI Sentinel Hub (cron bi-hebdo)
- [ ] Météo OpenWeatherMap
- [ ] Push FCM mobile + compteur badge
- [ ] SSE notifications temps réel (remplace simulation Angular)

### Phase 3 — Interopérabilité (S15-S20)
*Connexion banques, assurances, État*

- [ ] Webhooks sortants HMAC (retry Bull)
- [ ] Adapter Banque (score crédit FCFA)
- [ ] Adapter Assurance CNAAS (index NDVI indiciel)
- [ ] Adapter État (DAPSA, ANSD, SAED)
- [ ] OAuth2 Server partenaires (client_credentials)
- [ ] API Key management + scopes
- [ ] IP whitelist Nginx par partenaire

### Phase 4 — IA & Analytics (S21-S30)
*Recommandations intelligentes + aide à la décision*

- [ ] Microservice Python FastAPI (prédiction rendement ML)
- [ ] Détection anomalies NDVI automatique
- [ ] Score risque crédit ML (rendement + NDVI + météo)
- [ ] Prévisions prix marchés sénégalais
- [ ] Dashboard analytics temps réel

---

*Backend.md v2.0 — Petalia AgroAssist*  
*Compatibilité vérifiée ligne par ligne : Angular 17 intercepteurs + Flutter Hive/Riverpod/DioClient*  
*Analyse source : 27 fichiers TypeScript Angular + 18 fichiers Dart Flutter*