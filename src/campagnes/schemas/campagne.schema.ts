import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type CampagneDocument = Campagne & Document;

@Schema({ timestamps: true })
export class Campagne {
  @Prop({ required: true })
  nom: string;

  @Prop({
    required: true,
    enum: ["hivernage", "contre_saison_froide", "contre_saison_chaude"],
  })
  type: string;

  @Prop({ required: true })
  dateDebut: Date;

  @Prop()
  dateFin?: Date;

  @Prop({
    enum: ["en_preparation", "en_cours", "terminee"],
    default: "en_preparation",
  })
  statut: string;

  @Prop()
  progressionPct: number;

  @Prop()
  objectifRendement: number;

  @Prop()
  observationsCloture?: string;

  @Prop()
  rendementFinal?: number;

  @Prop({ type: [Types.ObjectId], ref: "Parcelle", default: [] })
  parcelleIds: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: "Organisation" })
  organisationId: Types.ObjectId;
}

export const CampagneSchema = SchemaFactory.createForClass(Campagne);

CampagneSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

CampagneSchema.set("toJSON", { virtuals: true });
CampagneSchema.set("toObject", { virtuals: true });
