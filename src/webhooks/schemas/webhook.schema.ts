import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type WebhookDocument = Webhook & Document;

@Schema({ timestamps: true })
export class Webhook {
  @Prop({ required: true })
  nom: string;

  @Prop({ required: true })
  url: string;

  @Prop({
    required: true,
    enum: [
      "recolte.created",
      "recolte.validated",
      "visite.completed",
      "parcelle.created",
      "ndvi.alerte",
      "campagne.terminee",
    ],
  })
  evenement: string;

  @Prop({ default: true })
  actif: boolean;

  @Prop({ type: Types.ObjectId, ref: "Organisation" })
  organisationId: Types.ObjectId;
}

export const WebhookSchema = SchemaFactory.createForClass(Webhook);

WebhookSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

WebhookSchema.set("toJSON", { virtuals: true });
WebhookSchema.set("toObject", { virtuals: true });
