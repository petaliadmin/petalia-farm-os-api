import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Parcelle } from "../parcelles/entities/parcelle.entity";

type ExportFormat = "geojson" | "kml" | "shp";

interface FeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

interface GeoFeature {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] } | null;
  properties: Record<string, unknown>;
}

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);

  constructor(
    @InjectRepository(Parcelle) private parcellesRepo: Repository<Parcelle>,
  ) {}

  async exportParcelles(
    format: ExportFormat,
    organisationId: string | null,
  ): Promise<{
    contentType: string;
    extension: string;
    body: Buffer | string;
  }> {
    if (!["geojson", "kml", "shp"].includes(format)) {
      throw new BadRequestException("format ∈ {geojson, kml, shp}");
    }

    const qb = this.parcellesRepo
      .createQueryBuilder("p")
      .where("p.deleted = false")
      .andWhere("p.boundary IS NOT NULL");

    if (organisationId) {
      qb.andWhere("p.organisationId = :org", { org: organisationId });
    }
    const parcelles = await qb.getMany();

    const fc = this.toFeatureCollection(parcelles);

    if (format === "geojson") {
      return {
        contentType: "application/geo+json",
        extension: "geojson",
        body: JSON.stringify(fc, null, 2),
      };
    }
    if (format === "kml") {
      return {
        contentType: "application/vnd.google-earth.kml+xml",
        extension: "kml",
        body: this.toKml(fc),
      };
    }
    return {
      contentType: "application/zip",
      extension: "zip",
      body: await this.toShapefileZip(fc),
    };
  }

  private toFeatureCollection(parcelles: Parcelle[]): FeatureCollection {
    return {
      type: "FeatureCollection",
      features: parcelles
        .filter((p) => p.boundary)
        .map((p) => ({
          type: "Feature",
          geometry: p.boundary as
            | { type: "Polygon"; coordinates: number[][][] }
            | null,
          properties: {
            id: p.id,
            code: p.code,
            nom: p.nom,
            culture: p.culture,
            stade: p.stade,
            statut: p.statut,
            superficie: p.superficie,
            zone: p.zone,
            zoneAgroecologique: p.zoneAgroecologique,
            region: p.region,
            producteur: p.producteurNom,
            healthScore: p.healthScore,
          },
        })),
    };
  }

  private toKml(fc: FeatureCollection): string {
    const features = fc.features
      .map((f) => this.featureToKmlPlacemark(f))
      .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>Parcelles Petalia Farm OS</name>
<Style id="parcelle">
  <LineStyle><color>ff00aa00</color><width>2</width></LineStyle>
  <PolyStyle><color>4d00aa00</color></PolyStyle>
</Style>
${features}
</Document>
</kml>`;
  }

  private featureToKmlPlacemark(f: GeoFeature): string {
    if (!f.geometry || f.geometry.type !== "Polygon") return "";
    const ring = f.geometry.coordinates[0];
    const coords = ring.map((c) => `${c[0]},${c[1]},0`).join(" ");
    const props = Object.entries(f.properties)
      .filter(([, v]) => v != null)
      .map(
        ([k, v]) =>
          `<Data name="${this.xmlEscape(k)}"><value>${this.xmlEscape(String(v))}</value></Data>`,
      )
      .join("");
    const name = this.xmlEscape(String(f.properties.code ?? f.properties.id));
    return `<Placemark>
  <name>${name}</name>
  <styleUrl>#parcelle</styleUrl>
  <ExtendedData>${props}</ExtendedData>
  <Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>
</Placemark>`;
  }

  private async toShapefileZip(fc: FeatureCollection): Promise<Buffer> {
    const shpwrite: any = await import("shp-write");
    const writer = shpwrite.default ?? shpwrite;
    const zipped: ArrayBuffer | Buffer = writer.zip(fc, {
      folder: "parcelles",
      types: { polygon: "parcelles" },
    });
    return Buffer.isBuffer(zipped) ? zipped : Buffer.from(zipped);
  }

  private xmlEscape(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}
