import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from "typeorm";

@Entity("market_prices")
@Index(["culture", "marche", "date"])
@Unique("uq_culture_marche_date", ["culture", "marche", "date"])
export class MarketPrice {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: [
      "riz",
      "mais",
      "mil",
      "arachide",
      "oignon",
      "tomate",
      "mangue",
      "niebe",
    ],
  })
  culture: string;

  @Column()
  marche: string;

  @Column({ nullable: true })
  region: string;

  @Column({ type: "date" })
  date: Date;

  @Column({ type: "float" })
  prixFcfaPerKg: number;

  @Column({ default: "manuel" })
  source: string;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}
