import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type NdviDataDocument = NdviData & Document;

@Schema({ timestamps: true })
export class NdviData {
  @Prop({ type: Types.ObjectId, ref: "Parcelle", required: true })
  parcelleId: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true, min: 0, max: 1 })
  ndviMoyen: number;

  @Prop()
  ndviMin: number;

  @Prop()
  ndviMax: number;

  @Prop({ default: 10 })
  resolution: number;

  @Prop({ default: "sentinel-2" })
  source: string;

  @Prop({ type: [{ lat: Number, lng: Number, valeur: Number }] })
  zones: { lat: number; lng: number; valeur: number }[];

  @Prop()
  tileUrl?: string;

  @Prop()
  imageUrl?: string;

  @Prop()
  cloudCoverage?: number;
}

export const NdviDataSchema = SchemaFactory.createForClass(NdviData);

NdviDataSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

NdviDataSchema.set("toJSON", { virtuals: true });
NdviDataSchema.set("toObject", { virtuals: true });
