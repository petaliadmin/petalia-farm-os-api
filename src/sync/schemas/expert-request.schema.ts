import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ExpertRequestDocument = ExpertRequest & Document;

@Schema({ timestamps: true })
export class ExpertRequest {
  @Prop({ required: true })
  id: string;

  @Prop({ type: Types.ObjectId, ref: "Parcelle", required: true })
  parcelId: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  photoPaths: string[];

  @Prop({ required: true })
  context: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop()
  remoteId?: string;

  @Prop({ default: "queued", enum: ["queued", "sent", "received", "answered"] })
  status: string;

  @Prop()
  answer?: string;

  @Prop()
  answeredAt?: Date;
}

export const ExpertRequestSchema = SchemaFactory.createForClass(ExpertRequest);

ExpertRequestSchema.index({ createdAt: 1 });
