import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  id?: string;

  @Prop({ unique: true, sparse: true, lowercase: true })
  email?: string;

  @Prop({ unique: true, sparse: true })
  phone?: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true })
  nom: string;

  @Prop({ required: true })
  prenom: string;

  @Prop({
    enum: ["directeur", "superviseur", "technicien", "admin", "partenaire"],
  })
  role: string;

  @Prop({ type: Types.ObjectId, ref: "Organisation" })
  organisationId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Equipe", sparse: true })
  equipeId?: Types.ObjectId;

  @Prop()
  avatar?: string;

  @Prop({ default: true })
  actif: boolean;

  @Prop({ select: false })
  otpCode?: string;

  @Prop()
  otpExpiry?: Date;

  @Prop({ default: 0, select: false })
  loginAttempts: number;

  @Prop()
  lockedUntil?: Date;

  @Prop({ select: false })
  refreshTokenHash?: string;

  @Prop({ select: false, unique: true, sparse: true })
  apiKeyHash?: string;

  @Prop({ type: [String], default: [] })
  apiScopes: string[];

  @Prop()
  fcmToken?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

UserSchema.set("toJSON", { virtuals: true });
UserSchema.set("toObject", { virtuals: true });
