import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type AgroRuleDocument = AgroRule & Document;

@Schema({ timestamps: true })
export class AgroRule {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({
    required: true,
    enum: ["riz", "mais", "mil", "arachide", "oignon", "tomate", "*"],
  })
  crop: string;

  @Prop({ type: [String], required: true })
  stages: string[];

  @Prop({ required: true })
  symptom: string;

  @Prop({ required: true, enum: ["hivernage", "contre_saison", "*"] })
  season: string;

  @Prop({ type: [String], required: true })
  regions: string[];

  @Prop({ default: 0 })
  severityMin: number;

  @Prop({ required: true })
  diagnosis: string;

  @Prop({
    required: true,
    type: {
      title: String,
      actions: [String],
      costFcfaPerHa: Number,
      delayBeforeHarvestDays: Number,
      ppeRequired: Boolean,
      followupDays: Number,
    },
  })
  recommendation: {
    title: string;
    actions: string[];
    costFcfaPerHa: number;
    delayBeforeHarvestDays: number;
    ppeRequired: boolean;
    followupDays: number;
  };

  @Prop()
  validatedBy: string;

  @Prop({ default: true })
  actif: boolean;
}

export const AgroRuleSchema = SchemaFactory.createForClass(AgroRule);

AgroRuleSchema.index({ updatedAt: 1 });
AgroRuleSchema.index({ crop: 1, symptom: 1, actif: 1 });
