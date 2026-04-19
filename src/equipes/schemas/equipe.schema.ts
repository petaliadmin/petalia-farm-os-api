import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type EquipeDocument = Equipe & Document;

@Schema({ timestamps: true })
export class Equipe {
  @Prop({ required: true })
  nom: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: "User" })
  responsableId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organisation" })
  organisationId: Types.ObjectId;

  @Prop({ default: true })
  actif: boolean;
}

export const EquipeSchema = SchemaFactory.createForClass(Equipe);

EquipeSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

EquipeSchema.set("toJSON", { virtuals: true });
EquipeSchema.set("toObject", { virtuals: true });
