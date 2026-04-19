import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type RecolteDocument = Recolte & Document;

@Schema({ timestamps: true })
export class Recolte {
  @Prop({ type: Types.ObjectId, ref: "Parcelle", required: true })
  parcelleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  technicienId: Types.ObjectId;

  @Prop({ required: true })
  dateRecolte: Date;

  @Prop({ required: true })
  quantiteRecoltee: number;

  @Prop({ required: true })
  superficie: number;

  @Prop({ default: 0 })
  pertesPostRecolte: number;

  @Prop()
  prixVente?: number;

  @Prop()
  rendement?: number;

  @Prop()
  tauxPerte?: number;

  @Prop()
  revenuTotal?: number;

  @Prop()
  qualite?: string;

  @Prop({ enum: ["en_attente", "validee", "rejetee"], default: "en_attente" })
  statut: string;

  @Prop()
  observations?: string;

  @Prop()
  attestationUrl?: string;
}

export const RecolteSchema = SchemaFactory.createForClass(Recolte);

// Server-side calculations as per backend.md spec
RecolteSchema.pre("save", function (next) {
  this.rendement =
    this.superficie > 0
      ? Math.round((this.quantiteRecoltee / 1000 / this.superficie) * 100) / 100
      : 0;

  this.tauxPerte =
    this.quantiteRecoltee > 0
      ? Math.round((this.pertesPostRecolte / this.quantiteRecoltee) * 1000) / 10
      : 0;

  if (this.prixVente) {
    this.revenuTotal =
      (this.quantiteRecoltee - this.pertesPostRecolte) * this.prixVente;
  }

  next();
});

RecolteSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

RecolteSchema.set("toJSON", { virtuals: true });
RecolteSchema.set("toObject", { virtuals: true });

RecolteSchema.index({ parcelleId: 1, dateRecolte: -1 });
RecolteSchema.index({ organisationId: 1, dateRecolte: -1 });
