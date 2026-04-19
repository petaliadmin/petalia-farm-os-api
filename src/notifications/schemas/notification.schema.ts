import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ["alerte", "avertissement", "succes", "info"] })
  type: string;

  @Prop({ required: true })
  titre: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: false })
  lue: boolean;

  @Prop()
  lienId?: string;

  @Prop()
  lienType?: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Virtual date = createdAt (required by Angular NotificationService)
NotificationSchema.virtual("date").get(function () {
  return this.createdAt;
});

NotificationSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

NotificationSchema.set("toJSON", { virtuals: true });
NotificationSchema.set("toObject", { virtuals: true });

// TTL 90 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
NotificationSchema.index({ userId: 1, lue: 1, createdAt: -1 });
