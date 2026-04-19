import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ParcelleDocument = Parcelle & Document;

@Schema({ timestamps: true })
export class Parcelle {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  nom: string;

  @Prop({ required: true })
  producteurNom: string;

  @Prop()
  exploitantNom?: string;

  @Prop()
  localite?: string;

  @Prop({
    type: { type: String, enum: ["Polygon"] },
    coordinates: { type: [[Number]] },
  })
  boundary: { type: "Polygon"; coordinates: number[][][] };

  @Prop({
    type: { type: String, enum: ["Point"] },
    coordinates: { type: [Number] },
  })
  centroid: { type: "Point"; coordinates: [number, number] };

  @Prop({ required: true })
  superficie: number;

  @Prop()
  zone: string;

  @Prop()
  typesSol: string;

  @Prop({
    enum: ["riz", "mais", "mil", "arachide", "oignon", "tomate", "autre"],
  })
  culture: string;

  @Prop({
    enum: [
      "semis",
      "levee",
      "vegetative",
      "tallage",
      "floraison",
      "fruiting",
      "maturation",
      "recolte",
    ],
  })
  stade: string;

  @Prop({ enum: ["sain", "attention", "urgent", "recolte"], default: "sain" })
  statut: string;

  @Prop({ enum: ["hivernage", "contre_saison_froide", "contre_saison_chaude"] })
  typeCampagne?: string;

  @Prop()
  dateSemis?: Date;

  @Prop()
  variete?: string;

  @Prop()
  densite?: string;

  @Prop({ enum: ["riz", "mais", "mil", "arachide", "oignon", "tomate"] })
  culturePrecedente?: string;

  @Prop({ enum: ["riz", "mais", "mil", "arachide", "oignon", "tomate"] })
  rotationPrevue?: string;

  @Prop({
    enum: [
      "dior",
      "deck",
      "argileux",
      "sableux",
      "argilo-sableux",
      "lateritique",
      "limoneux",
      "sablo-humifere",
      "sandy",
      "sandy_loam",
      "loam",
      "clay_loam",
      "clay",
      "silt",
    ],
  })
  typeSol?: string;

  @Prop({
    enum: [
      "Niayes",
      "Casamance",
      "Vallée du Fleuve Sénégal",
      "Bassin Arachidier",
      "Sénégal Oriental",
      "Zone Sylvopastorale",
    ],
  })
  zoneAgroecologique?: string;

  @Prop()
  region?: string;

  @Prop({
    enum: [
      "pluie",
      "forage",
      "canal",
      "fleuve",
      "bassin",
      "puits",
      "goutte_a_goutte",
      "aspersion",
      "submersion",
      "gravitaire",
      "rainfed",
    ],
  })
  sourceEau?: string;

  @Prop({ enum: ["propriete", "pret", "location", "communautaire"] })
  modeAccesTerre?: string;

  @Prop({ type: Types.ObjectId, ref: "User" })
  technicienId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organisation" })
  organisationId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Equipe", sparse: true })
  equipeId?: Types.ObjectId;

  @Prop({ default: 0 })
  healthScore: number;

  @Prop()
  rendementPrecedent?: number;

  @Prop()
  derniereVisite?: Date;

  @Prop()
  prochaineVisite?: Date;

  @Prop({ default: false })
  deleted: boolean;
}

export const ParcelleSchema = SchemaFactory.createForClass(Parcelle);

// Pre-save hook: calculate centroid from boundary
ParcelleSchema.pre("save", function (next) {
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
ParcelleSchema.virtual("coordonnees").get(function () {
  if (!this.centroid?.coordinates) return undefined;
  return {
    lat: this.centroid.coordinates[1],
    lng: this.centroid.coordinates[0],
  };
});

// Virtual Angular: geometry [{ lat, lng }] from boundary ring
ParcelleSchema.virtual("geometry").get(function () {
  if (!this.boundary?.coordinates?.[0]) return undefined;
  return this.boundary.coordinates[0]
    .slice(0, -1)
    .map(([lng, lat]) => ({ lat, lng }));
});

// Virtual id for Angular
ParcelleSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

ParcelleSchema.set("toJSON", { virtuals: true });
ParcelleSchema.set("toObject", { virtuals: true });

// Indexes
ParcelleSchema.index({ boundary: "2dsphere" });
ParcelleSchema.index({ centroid: "2dsphere" });
ParcelleSchema.index({ organisationId: 1, statut: 1, culture: 1 });
ParcelleSchema.index({ technicienId: 1, statut: 1 });
ParcelleSchema.index({ code: 1 }, { unique: true });
ParcelleSchema.index({ deleted: 1, organisationId: 1 });
