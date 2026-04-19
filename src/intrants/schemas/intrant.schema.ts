import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type IntrantDocument = Intrant & Document;

@Schema({ timestamps: true })
export class Intrant {
  @Prop({ required: true })
  nom: string;

  @Prop({ required: true, enum: ["Engrais", "Pesticide", "Semence", "Autre"] })
  type: string;

  @Prop()
  marque?: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  unite: string;

  @Prop({ required: true, default: 0 })
  quantiteStock: number;

  @Prop()
  seuilAlerte?: number;

  @Prop()
  prixUnitaire: number;

  @Prop()
  dateExpiration?: Date;

  @Prop({ type: Types.ObjectId, ref: "Organisation" })
  organisationId: Types.ObjectId;

  @Prop({ default: false })
  deleted: boolean;
}

export const IntrantSchema = SchemaFactory.createForClass(Intrant);

IntrantSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

IntrantSchema.set("toJSON", { virtuals: true });
IntrantSchema.set("toObject", { virtuals: true });

IntrantSchema.index({ organisationId: 1, type: 1 });
IntrantSchema.index({ organisationId: 1, quantiteStock: 1 });
