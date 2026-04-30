/**
 * seed-dev.ts — Development seed script (PostgreSQL + TypeORM)
 * Run: npx ts-node scripts/seed-dev.ts
 *
 * Seeds:
 *  - 1 organisation de test
 *  - 1 admin + 1 directeur + 2 techniciens
 *  - 2 équipes
 *  - 3 parcelles avec boundaries GeoJSON (Delta du Fleuve Sénégal)
 *  - 2 agro_rules validées par l'ISRA
 *  - 1 campagne hivernage en cours
 *  - 3 visites
 *  - 2 intrants + mouvements
 */

import { AppDataSource } from '../src/database/data-source';
import { User } from '../src/users/entities/user.entity';
import { Equipe } from '../src/equipes/entities/equipe.entity';
import { Parcelle } from '../src/parcelles/entities/parcelle.entity';
import { Visite } from '../src/visites/entities/visite.entity';
import { Intrant } from '../src/intrants/entities/intrant.entity';
import { Mouvement } from '../src/intrants/entities/mouvement.entity';
import { Campagne } from '../src/campagnes/entities/campagne.entity';
import { AgroRule } from '../src/sync/entities/agro-rule.entity';
import * as bcrypt from 'bcrypt';

// ─── Helpers ──────────────────────────────────────────────────────────────

const hash = (pwd: string) => bcrypt.hash(pwd, 12);

function makePolygon(center: [number, number], sizeKm: number): object {
  const d = sizeKm / 111;
  const [lng, lat] = center;
  return {
    type: 'Polygon',
    coordinates: [[
      [lng - d, lat - d],
      [lng + d, lat - d],
      [lng + d, lat + d],
      [lng - d, lat + d],
      [lng - d, lat - d],
    ]],
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function seed() {
  await AppDataSource.initialize();
  console.log('🌱 Starting development seed...\n');

  const userRepo      = AppDataSource.getRepository(User);
  const equipeRepo    = AppDataSource.getRepository(Equipe);
  const parcelleRepo  = AppDataSource.getRepository(Parcelle);
  const visiteRepo    = AppDataSource.getRepository(Visite);
  const intrantRepo   = AppDataSource.getRepository(Intrant);
  const mouvRepo      = AppDataSource.getRepository(Mouvement);
  const campagneRepo  = AppDataSource.getRepository(Campagne);
  const agroRuleRepo  = AppDataSource.getRepository(AgroRule);

  const ORG_ID = 'org-petalia-dev-00000000';

  // ── Users ────────────────────────────────────────────────────────────────
  const users: Partial<User>[] = [
    {
      email: 'admin@petalia.sn',
      passwordHash: await hash('Admin@2025!'),
      nom: 'Diallo',
      prenom: 'Abdou',
      role: 'admin',
      organisationId: ORG_ID,
      actif: true,
    },
    {
      email: 'directeur@petalia.sn',
      passwordHash: await hash('Dir@2025!'),
      nom: 'Sow',
      prenom: 'Mariama',
      role: 'directeur',
      organisationId: ORG_ID,
      actif: true,
    },
    {
      email: 'tech1@petalia.sn',
      phone: '+221771234567',
      passwordHash: await hash('Tech@2025!'),
      nom: 'Ndiaye',
      prenom: 'Ibrahima',
      role: 'technicien',
      organisationId: ORG_ID,
      actif: true,
    },
    {
      email: 'tech2@petalia.sn',
      phone: '+221779876543',
      passwordHash: await hash('Tech@2025!'),
      nom: 'Ba',
      prenom: 'Fatoumata',
      role: 'technicien',
      organisationId: ORG_ID,
      actif: true,
    },
  ];

  const createdUsers: User[] = [];
  for (const u of users) {
    const exists = await userRepo.findOne({ where: { email: u.email } });
    if (!exists) {
      createdUsers.push(await userRepo.save(userRepo.create(u)));
      console.log(`  ✅ User: ${u.email}`);
    } else {
      createdUsers.push(exists);
      console.log(`  ⏭️  User exists: ${u.email}`);
    }
  }

  const [, , tech1, tech2] = createdUsers;

  // ── Équipes ───────────────────────────────────────────────────────────────
  let equipe1 = await equipeRepo.findOne({ where: { nom: 'Équipe Delta Nord' } });
  if (!equipe1) {
    equipe1 = await equipeRepo.save(equipeRepo.create({
      nom: 'Équipe Delta Nord',
      description: 'Techniciens zone nord du Delta',
      responsableId: tech1.id,
      organisationId: ORG_ID,
      actif: true,
    }));
    console.log('  ✅ Équipe: Delta Nord');
  }

  let equipe2 = await equipeRepo.findOne({ where: { nom: 'Équipe Delta Sud' } });
  if (!equipe2) {
    equipe2 = await equipeRepo.save(equipeRepo.create({
      nom: 'Équipe Delta Sud',
      description: 'Techniciens zone sud du Delta',
      responsableId: tech2.id,
      organisationId: ORG_ID,
      actif: true,
    }));
    console.log('  ✅ Équipe: Delta Sud');
  }

  // ── Parcelles ─────────────────────────────────────────────────────────────
  console.log('\n📍 Seeding parcelles...');

  const parcellesDefs = [
    {
      code: 'PAR-001-WALO',
      nom: 'Parcelle Walo Nord',
      producteurNom: 'Mamadou Konaté',
      localite: 'Ross Béthio',
      boundary: makePolygon([16.12, 16.32], 0.3),
      superficie: 2.5,
      culture: 'riz' as const,
      stade: 'tallage' as const,
      statut: 'sain' as const,
      typeCampagne: 'hivernage' as const,
      dateSemis: new Date('2025-07-15'),
      variete: 'Sahel 108',
      technicienId: tech1.id,
      equipeId: equipe1.id,
      organisationId: ORG_ID,
      typeSol: 'argilo-limoneux',
      zoneAgroecologique: 'delta',
      region: 'Saint-Louis',
      sourceEau: 'canal_irrigation',
      healthScore: 78,
    },
    {
      code: 'PAR-002-PODOR',
      nom: 'Parcelle Podor Centrale',
      producteurNom: 'Aïssatou Bâ',
      localite: 'Podor',
      boundary: makePolygon([14.95, 16.65], 0.25),
      superficie: 1.8,
      culture: 'mais' as const,
      stade: 'floraison' as const,
      statut: 'attention' as const,
      typeCampagne: 'contre_saison_froide' as const,
      dateSemis: new Date('2025-11-01'),
      technicienId: tech1.id,
      equipeId: equipe1.id,
      organisationId: ORG_ID,
      typeSol: 'sablo-argileux',
      zoneAgroecologique: 'fleuve',
      region: 'Saint-Louis',
      sourceEau: 'pompage',
      healthScore: 52,
    },
    {
      code: 'PAR-003-DAGANA',
      nom: 'Champ Dagana Ouest',
      producteurNom: 'Ousmane Sarr',
      localite: 'Dagana',
      boundary: makePolygon([15.51, 16.52], 0.4),
      superficie: 4.1,
      culture: 'riz' as const,
      stade: 'maturation' as const,
      statut: 'sain' as const,
      typeCampagne: 'hivernage' as const,
      dateSemis: new Date('2025-07-10'),
      variete: 'Sahel 201',
      technicienId: tech2.id,
      equipeId: equipe2.id,
      organisationId: ORG_ID,
      typeSol: 'argileux-lourd',
      zoneAgroecologique: 'delta',
      region: 'Saint-Louis',
      sourceEau: 'canal_irrigation',
      healthScore: 85,
    },
  ];

  const createdParcelles: Parcelle[] = [];
  for (const p of parcellesDefs) {
    const exists = await parcelleRepo.findOne({ where: { code: p.code } });
    if (!exists) {
      createdParcelles.push(await parcelleRepo.save(parcelleRepo.create(p)));
      console.log(`  ✅ Parcelle: ${p.code}`);
    } else {
      createdParcelles.push(exists);
      console.log(`  ⏭️  Parcelle exists: ${p.code}`);
    }
  }

  // ── Campagne ──────────────────────────────────────────────────────────────
  console.log('\n🌾 Seeding campagne...');
  let campagne = await campagneRepo.findOne({ where: { nom: 'Hivernage 2025' } });
  if (!campagne) {
    campagne = await campagneRepo.save(campagneRepo.create({
      nom: 'Hivernage 2025',
      type: 'hivernage',
      dateDebut: new Date('2025-07-01'),
      statut: 'en_cours',
      progressionPct: 60,
      objectifRendement: 5.5,
      parcelleIds: [createdParcelles[0].id, createdParcelles[2].id],
      organisationId: ORG_ID,
    }));
    console.log('  ✅ Campagne: Hivernage 2025');
  }

  // ── Visites ───────────────────────────────────────────────────────────────
  console.log('\n🔍 Seeding visites...');
  const visiteDefs = [
    {
      parcelleId: createdParcelles[0].id,
      technicienId: tech1.id,
      organisationId: ORG_ID,
      campagneId: campagne.id,
      date: new Date('2025-10-12T09:00:00Z'),
      statut: 'completee' as const,
      etatGeneral: 'normale' as const,
      objectif: 'Contrôle tallage et fertilisation',
      observations: 'Tallage homogène, bon développement végétatif. Légère jaunisse sur 10% des plants.',
      recommandations: 'Apport d\'urée 50 kg/ha dans 7 jours.',
      photos: [],
      gpsLocation: { type: 'Point', coordinates: [16.12, 16.32] },
    },
    {
      parcelleId: createdParcelles[1].id,
      technicienId: tech1.id,
      organisationId: ORG_ID,
      date: new Date('2025-10-18T08:30:00Z'),
      statut: 'completee' as const,
      etatGeneral: 'stress' as const,
      objectif: 'Évaluation stress hydrique',
      observations: 'Symptômes de stress hydrique visibles. Feuilles enroulées en matinée.',
      recommandations: 'Augmenter fréquence irrigation. Prochain contrôle J+5.',
      photos: [],
    },
    {
      parcelleId: createdParcelles[2].id,
      technicienId: tech2.id,
      organisationId: ORG_ID,
      campagneId: campagne.id,
      date: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      statut: 'planifiee' as const,
      objectif: 'Estimation rendement pré-récolte',
    },
  ];

  for (const v of visiteDefs) {
    const exists = await visiteRepo.findOne({
      where: { parcelleId: v.parcelleId, date: v.date },
    });
    if (!exists) {
      await visiteRepo.save(visiteRepo.create(v));
      console.log(`  ✅ Visite: ${v.parcelleId.substring(0, 8)}... le ${v.date.toLocaleDateString('fr-FR')}`);
    } else {
      console.log(`  ⏭️  Visite exists`);
    }
  }

  // ── Intrants + Mouvements ─────────────────────────────────────────────────
  console.log('\n🧪 Seeding intrants...');

  let urée = await intrantRepo.findOne({ where: { nom: 'Urée 46%' } });
  if (!urée) {
    urée = await intrantRepo.save(intrantRepo.create({
      nom: 'Urée 46%',
      type: 'Engrais',
      marque: 'OCP Maroc',
      unite: 'kg',
      quantiteStock: 2500,
      seuilAlerte: 200,
      prixUnitaire: 450,
      organisationId: ORG_ID,
    }));
    await mouvRepo.save(mouvRepo.create({
      intrantId: urée.id,
      type: 'entree',
      quantite: 2500,
      date: new Date('2025-07-01'),
      motif: 'Approvisionnement campagne hivernage 2025',
      operateurId: createdUsers[0].id,
    }));
    await mouvRepo.save(mouvRepo.create({
      intrantId: urée.id,
      type: 'sortie',
      quantite: 125,
      date: new Date('2025-10-15'),
      parcelleId: createdParcelles[0].id,
      motif: 'Application PAR-001 — 50 kg/ha × 2.5 ha',
      operateurId: tech1.id,
    }));
    console.log('  ✅ Intrant: Urée 46%');
  }

  let tricyclazole = await intrantRepo.findOne({ where: { nom: 'Tricyclazole 75 WP' } });
  if (!tricyclazole) {
    tricyclazole = await intrantRepo.save(intrantRepo.create({
      nom: 'Tricyclazole 75 WP',
      type: 'Pesticide',
      marque: 'Bayer CropScience',
      description: 'Fongicide contre la pyriculariose du riz',
      unite: 'g',
      quantiteStock: 5000,
      seuilAlerte: 500,
      prixUnitaire: 12,
      dateExpiration: new Date('2026-12-31'),
      organisationId: ORG_ID,
    }));
    await mouvRepo.save(mouvRepo.create({
      intrantId: tricyclazole.id,
      type: 'entree',
      quantite: 5000,
      date: new Date('2025-07-15'),
      motif: 'Stock préventif pyriculariose',
      operateurId: createdUsers[0].id,
    }));
    console.log('  ✅ Intrant: Tricyclazole 75 WP');
  }

  // ── Agro Rules ────────────────────────────────────────────────────────────
  console.log('\n📚 Seeding agro_rules...');

  const rules = [
    {
      id: 'RIZ-R1-BLAST-DECA',
      crop: 'riz' as const,
      stages: ['tallage', 'floraison'],
      symptom: 'leaf_blast',
      season: 'hivernage' as const,
      regions: ['*'],
      severityMin: 0.2,
      diagnosis: 'Pyriculariose (Magnaporthe oryzae) — maladie fongique majeure du riz',
      recommendation: {
        title: 'Traitement fongicide Tricyclazole',
        actions: [
          'Appliquer Tricyclazole 75 WP à 600g/ha',
          'Réduire apport azote de 30%',
          'Surveiller J+7 et J+14',
        ],
        costFcfaPerHa: 25000,
        delayBeforeHarvestDays: 21,
        ppeRequired: true,
        followupDays: 14,
      },
      validatedBy: 'ISRA Saint-Louis',
      actif: true,
    },
    {
      id: 'ARA-R1-YELLOW-SAHEL-RAINY',
      crop: 'arachide' as const,
      stages: ['vegetative', 'floraison'],
      symptom: 'yellow_leaves',
      season: 'hivernage' as const,
      regions: ['thies', 'kaolack', 'fatick'],
      severityMin: 0.3,
      diagnosis: 'Carence en fer (chlorose ferrique) liée à pH élevé du sol',
      recommendation: {
        title: 'Correction carence fer + soufre',
        actions: [
          'Pulvériser sulfate de fer à 2g/L d\'eau',
          'Répéter à J+7',
          'Analyser pH sol (objectif 5.5–6.5)',
        ],
        costFcfaPerHa: 15000,
        delayBeforeHarvestDays: 0,
        ppeRequired: false,
        followupDays: 7,
      },
      validatedBy: 'ISRA Bambey',
      actif: true,
    },
    {
      id: 'MIL-R1-STRIGA-SAHEL',
      crop: 'mil' as const,
      stages: ['levee', 'vegetative'],
      symptom: 'striga_infestation',
      season: 'hivernage' as const,
      regions: ['thies', 'louga', 'matam'],
      severityMin: 0.4,
      diagnosis: 'Infestation par Striga hermonthica (parasite racinaire)',
      recommendation: {
        title: 'Traitement herbicide + désherbage manuel',
        actions: [
          'Arracher les plants de striga avant floraison',
          'Appliquer Imazapyr 750mL/ha au semis',
          'Pratiquer rotation légumineuse l\'année suivante',
        ],
        costFcfaPerHa: 18000,
        delayBeforeHarvestDays: 30,
        ppeRequired: true,
        followupDays: 21,
      },
      validatedBy: 'ISRA Bambey',
      actif: true,
    },
  ];

  for (const rule of rules) {
    const exists = await agroRuleRepo.findOne({ where: { id: rule.id } });
    if (!exists) {
      await agroRuleRepo.save(agroRuleRepo.create(rule));
      console.log(`  ✅ AgroRule: ${rule.id}`);
    } else {
      console.log(`  ⏭️  AgroRule exists: ${rule.id}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ Seed terminé !');
  console.log('');
  console.log('   Comptes créés :');
  console.log('   admin@petalia.sn    /  Admin@2025!   (admin)');
  console.log('   directeur@petalia.sn / Dir@2025!     (directeur)');
  console.log('   tech1@petalia.sn    /  Tech@2025!   (technicien)');
  console.log('   tech2@petalia.sn    /  Tech@2025!   (technicien)');
  console.log('═══════════════════════════════════════════════════════════\n');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
