import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type TacheDocument = Tache & Document;

@Schema({ timestamps: true })
export class Tache {
  @Prop({ required: true })
  titre: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: "Parcelle" })
  parcelleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User" })
  assigneAId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User" })
  creeParId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Campagne" })
  campagneId?: Types.ObjectId;

  @Prop({ enum: ["todo", "en_cours", "done", "reporte"], default: "todo" })
  statut: string;

  @Prop({ enum: ["basse", "normale", "haute", "urgente"], default: "normale" })
  priorite: string;

  @Prop()
  datePlanifiee?: Date;

  @Prop()
  dateFin?: Date;

  @Prop()
  dateTerminee?: Date;

  @Prop({ default: false })
  automatique: boolean;
}

export const TacheSchema = SchemaFactory.createForClass(Tache);

TacheSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

TacheSchema.set("toJSON", { virtuals: true });
TacheSchema.set("toObject", { virtuals: true });

TacheSchema.index({ parcelleId: 1, statut: 1 });
TacheSchema.index({ assigneeId: 1, statut: 1 });
TacheSchema.index({ organisationId: 1, priorite: 1, statut: 1 });
