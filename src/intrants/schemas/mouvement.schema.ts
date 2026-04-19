import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type MouvementDocument = Mouvement & Document;

@Schema({ timestamps: true })
export class Mouvement {
  @Prop({ type: Types.ObjectId, ref: "Intrant", required: true })
  intrantId: Types.ObjectId;

  @Prop({ required: true, enum: ["entree", "sortie"] })
  type: string;

  @Prop({ required: true })
  quantite: number;

  @Prop()
  date: Date;

  @Prop({ type: Types.ObjectId, ref: "Parcelle" })
  parcelleId?: Types.ObjectId;

  @Prop()
  motif?: string;

  @Prop({ type: Types.ObjectId, ref: "User" })
  operateurId: Types.ObjectId;
}

export const MouvementSchema = SchemaFactory.createForClass(Mouvement);

MouvementSchema.index({ intrantId: 1, date: -1 });
MouvementSchema.index({ parcelleId: 1, date: -1 });
