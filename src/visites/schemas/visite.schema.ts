import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type VisiteDocument = Visite & Document;

@Schema({ timestamps: true })
export class Visite {
  @Prop({ type: Types.ObjectId, ref: "Parcelle", required: true })
  parcelleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  technicienId: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({
    enum: ["planifiee", "en_cours", "completee", "annulee"],
    default: "planifiee",
  })
  statut: string;

  @Prop()
  dureeMinutes?: number;

  @Prop()
  objectif?: string;

  @Prop()
  observations?: string;

  @Prop({
    enum: ["normale", "stress", "maladie", "ravageur", "carence", "autre"],
  })
  etatGeneral?: string;

  @Prop({ type: [String], default: [] })
  observationsDetaillees?: string[];

  @Prop()
  recommandations?: string;

  @Prop()
  prochainAction?: string;

  @Prop({
    type: { type: String, enum: ["Point"] },
    coordinates: { type: [Number] },
  })
  gpsLocation?: { type: "Point"; coordinates: [number, number] };

  @Prop({ type: [String], default: [] })
  photos?: string[];

  @Prop()
  rapport?: string;

  @Prop({ type: Types.ObjectId, ref: "Campagne" })
  campagneId?: Types.ObjectId;
}

export const VisiteSchema = SchemaFactory.createForClass(Visite);

VisiteSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

VisiteSchema.set("toJSON", { virtuals: true });
VisiteSchema.set("toObject", { virtuals: true });

// Indexes
VisiteSchema.index({ parcelleId: 1, date: -1 });
VisiteSchema.index({ technicianId: 1, statut: 1 });
VisiteSchema.index({ organisationId: 1, date: -1 });
VisiteSchema.index({ gpsLocation: "2dsphere" }, { sparse: true });
