import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes, randomInt } from "crypto";
import { Repository } from "typeorm";
import { Parcelle } from "../../parcelles/entities/parcelle.entity";
import { PublicClient } from "../common/context";
import { polygonAreaHa, PolygonGeometry, Position } from "../common/geo";
import { encodeId } from "../common/ids";
import { CropCode, cropToLegacy, SEASONS } from "../common/vocabulary";
import { CropCycle } from "../entities/crop-cycle.entity";
import { Device } from "../entities/device.entity";
import { Farm } from "../entities/farm.entity";
import { Farmer } from "../entities/farmer.entity";
import { Observation } from "../entities/observation.entity";

interface Zone {
  zone: string;
  region: string;
  locality: string;
  center: Position;
  crop: CropCode;
  variety: string;
  season: "rainy" | "cold_dry" | "hot_dry";
  soil: string;
  water: string;
  farmer: {
    first: string;
    last: string;
    gender: "female" | "male";
    lang: string;
  };
  sensor: { manufacturer: string; model: string };
  /** Baseline soil moisture (%) for the simulated series. */
  moisture: number;
}

/** Three agro-ecological zones that integrators meet first in Senegal. */
const ZONES: Zone[] = [
  {
    zone: "Niayes",
    region: "Thiès",
    locality: "Mboro",
    center: [-16.965, 15.137],
    crop: "onion",
    variety: "Violet de Galmi",
    season: "cold_dry",
    soil: "dior (sableux)",
    water: "puits + goutte-à-goutte",
    farmer: { first: "Awa", last: "Ndiaye", gender: "female", lang: "wo" },
    sensor: { manufacturer: "dragino", model: "LSE01" },
    moisture: 24,
  },
  {
    zone: "Bassin arachidier",
    region: "Kaolack",
    locality: "Nioro du Rip",
    center: [-15.785, 13.744],
    crop: "groundnut",
    variety: "Fleur 11",
    season: "rainy",
    soil: "deck-dior",
    water: "pluvial",
    farmer: { first: "Moussa", last: "Sarr", gender: "male", lang: "wo" },
    sensor: { manufacturer: "ecowitt", model: "WH51" },
    moisture: 18,
  },
  {
    zone: "Vallée du fleuve Sénégal",
    region: "Saint-Louis",
    locality: "Ross Béthio",
    center: [-16.272, 16.272],
    crop: "rice",
    variety: "Sahel 108",
    season: "hot_dry",
    soil: "hollaldé (argileux)",
    water: "irrigation (canal SAED)",
    farmer: { first: "Aïssatou", last: "Sow", gender: "female", lang: "ff" },
    sensor: { manufacturer: "dragino", model: "LLDS12" },
    moisture: 41,
  },
];

/** Square of `sideM` metres around a [lng, lat] centre. */
function square(center: Position, sideM: number): PolygonGeometry {
  const dLat = sideM / 2 / 111_320;
  const dLng = sideM / 2 / (111_320 * Math.cos((center[1] * Math.PI) / 180));
  const [lng, lat] = center;
  const ring: Position[] = [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ].map(([x, y]) => [Number(x.toFixed(6)), Number(y.toFixed(6))] as Position);
  return { type: "Polygon", coordinates: [ring] };
}

@Injectable()
export class SandboxService {
  constructor(
    @InjectRepository(Farmer) private readonly farmers: Repository<Farmer>,
    @InjectRepository(Farm) private readonly farms: Repository<Farm>,
    @InjectRepository(Parcelle) private readonly parcels: Repository<Parcelle>,
    @InjectRepository(CropCycle) private readonly cycles: Repository<CropCycle>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(Observation)
    private readonly observations: Repository<Observation>,
  ) {}

  /** Seeds farmers, farms, parcels, crop cycles, sensors and 7 days of readings. */
  async seed(client: PublicClient) {
    if (client.livemode) throw new Error("sandbox seeding requires test mode");
    const year = new Date().getUTCFullYear();
    const created: Record<string, string[]> = {
      farmers: [],
      farms: [],
      parcels: [],
      devices: [],
    };
    let readings = 0;

    for (const z of ZONES) {
      const base = {
        livemode: false,
        organisationId: client.organizationId,
        metadata: { sandbox: "true", zone: z.zone },
      };
      const farmer = await this.farmers.save(
        this.farmers.create({
          ...base,
          // +221 70 range, random so several sandboxes never collide.
          phone: `+22170${String(randomInt(0, 10_000_000)).padStart(7, "0")}`,
          firstName: z.farmer.first,
          lastName: z.farmer.last,
          gender: z.farmer.gender,
          preferredLanguage: z.farmer.lang,
          preferredChannel: "sms",
          locality: z.locality,
          region: z.region,
        }),
      );
      const farm = await this.farms.save(
        this.farms.create({
          ...base,
          farmerId: farmer.id,
          name: `Exploitation ${z.farmer.last} – ${z.locality}`,
          locality: z.locality,
          region: z.region,
          location: { type: "Point", coordinates: z.center },
        }),
      );
      const geometry = square(z.center, 120 + randomInt(0, 80));
      const parcel = await this.parcels.save(
        this.parcels.create({
          ...base,
          code: `SBX-${randomInt(0, 0xffffffff).toString(16).toUpperCase().padStart(8, "0")}`,
          nom: `${z.zone} – parcelle ${z.crop}`,
          producteurNom: `${z.farmer.first} ${z.farmer.last}`,
          boundary: geometry,
          superficie: polygonAreaHa(geometry),
          region: z.region,
          localite: z.locality,
          zoneAgroecologique: z.zone,
          typeSol: z.soil,
          sourceEau: z.water,
          culture: cropToLegacy(z.crop),
          variete: z.variety,
          typeCampagne: SEASONS[z.season],
          farmerId: farmer.id,
          farmId: farm.id,
        }),
      );
      await this.cycles.save(
        this.cycles.create({
          ...base,
          parcelleId: parcel.id,
          crop: z.crop,
          variety: z.variety,
          season: z.season,
          campaignYear: year,
          status: "active",
          sownOn: new Date(Date.now() - 45 * 86_400_000)
            .toISOString()
            .slice(0, 10),
        }),
      );
      const device = await this.devices.save(
        this.devices.create({
          ...base,
          parcelleId: parcel.id,
          type: "sensor",
          manufacturer: z.sensor.manufacturer,
          model: z.sensor.model,
          devEui: randomBytes(8).toString("hex").toUpperCase(),
          name: `Sonde ${z.sensor.model} – ${z.locality}`,
          location: { type: "Point", coordinates: z.center },
          lastSeenAt: new Date(),
        }),
      );

      // 7 days, one reading every 6 h: soil moisture drying out between
      // irrigations, soil temperature with a daily cycle.
      const rows: Observation[] = [];
      for (let h = 7 * 24; h >= 0; h -= 6) {
        const at = new Date(Date.now() - h * 3_600_000);
        at.setUTCMinutes(0, 0, 0);
        const hour = at.getUTCHours();
        const moisture =
          z.moisture +
          6 * Math.cos((h / 48) * Math.PI) +
          (randomInt(0, 100) - 50) / 50;
        const temp =
          27 +
          6 * Math.sin(((hour - 8) / 24) * 2 * Math.PI) +
          (randomInt(0, 100) - 50) / 100;
        for (const [property, value, unit] of [
          ["soil_moisture", moisture, "%"],
          ["soil_temperature", temp, "°C"],
        ] as const) {
          rows.push(
            this.observations.create({
              ...base,
              parcelleId: parcel.id,
              deviceId: device.id,
              sourceType: "sensor",
              property,
              value: Math.round(value * 10) / 10,
              unit,
              observedAt: at,
              quality: "validated",
              location: { type: "Point", coordinates: z.center },
            }),
          );
        }
      }
      await this.observations
        .createQueryBuilder()
        .insert()
        .values(rows)
        .orIgnore()
        .execute();
      readings += rows.length;

      created.farmers.push(encodeId("farmer", farmer.id));
      created.farms.push(encodeId("farm", farm.id));
      created.parcels.push(encodeId("parcel", parcel.id));
      created.devices.push(encodeId("device", device.id));
    }

    return {
      object: "sandbox_seed" as const,
      livemode: false,
      zones: ZONES.map((z) => z.zone),
      ...created,
      observations_created: readings,
    };
  }
}
