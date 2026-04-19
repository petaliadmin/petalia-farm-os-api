import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type FieldPoiDocument = FieldPoi & Document;

@Schema({ timestamps: true })
export class FieldPoi {
  @Prop({ type: Types.ObjectId, ref: "Parcelle", required: true })
  parcelleId: Types.ObjectId;

  @Prop({ required: true })
  nom: string;

  @Prop({
    required: true,
    enum: ["puits", "forage", "bassin", "canal", "depot", "bati", "autre"],
  })
  type: string;

  @Prop({
    type: { type: String, enum: ["Point"] },
    coordinates: { type: [Number] },
  })
  location: { type: "Point"; coordinates: [number, number] };

  @Prop()
  description?: string;
}

export const FieldPoiSchema = SchemaFactory.createForClass(FieldPoi);

FieldPoiSchema.index({ location: "2dsphere" });
FieldPoiSchema.virtual("id").get(function () {
  return this._id.toHexString();
});
FieldPoiSchema.set("toJSON", { virtuals: true });
FieldPoiSchema.set("toObject", { virtuals: true });
