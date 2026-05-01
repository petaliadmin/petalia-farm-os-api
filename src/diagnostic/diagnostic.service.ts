import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";
import sharp from "sharp";
import { Diagnostic } from "./entities/diagnostic.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { ClaudeVisionClient } from "./claude-vision.client";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;
const TARGET_SIDE = 1568; // Anthropic recommends ≤1568px for vision; we downscale only if larger

@Injectable()
export class DiagnosticService {
  private readonly logger = new Logger(DiagnosticService.name);

  constructor(
    @InjectRepository(Diagnostic)
    private diagnosticRepo: Repository<Diagnostic>,
    @InjectRepository(Parcelle)
    private parcelleRepo: Repository<Parcelle>,
    private vision: ClaudeVisionClient,
  ) {}

  async diagnose(
    parcelleId: string,
    userId: string,
    organisationId: string | null,
    description: string | null,
    file: { mimetype: string; buffer: Buffer; size: number },
  ): Promise<Diagnostic> {
    if (!file?.buffer) {
      throw new BadRequestException("Fichier image requis (champ 'photo')");
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException("Image > 8 Mo non acceptée");
    }
    const mime = file.mimetype.toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException("Format accepté: JPEG, PNG, WebP");
    }

    const parcelle = await this.parcelleRepo.findOne({
      where: { id: parcelleId, deleted: false },
    });
    if (!parcelle) throw new NotFoundException("Parcelle introuvable");
    if (
      organisationId &&
      parcelle.organisationId &&
      parcelle.organisationId !== organisationId
    ) {
      throw new NotFoundException("Parcelle introuvable");
    }

    const optimized = await this.optimize(file.buffer);
    const imageBase64 = optimized.toString("base64");
    const imageHash = crypto
      .createHash("sha256")
      .update(optimized)
      .digest("hex")
      .slice(0, 32);

    const vision = await this.vision.diagnose(
      imageBase64,
      "image/jpeg",
      parcelle.culture,
      parcelle.stade,
      description,
    );

    this.logger.log(
      `Diagnostic ${parcelleId} → "${vision.result.identification}" conf=${vision.result.confidence} (${vision.usage.input_tokens}/${vision.usage.output_tokens} tokens)`,
    );

    const diagnostic = this.diagnosticRepo.create({
      parcelleId,
      organisationId: parcelle.organisationId,
      userId,
      culture: parcelle.culture,
      imageHash,
      imageBytes: optimized.byteLength,
      identification: vision.result.identification,
      confidence: vision.result.confidence,
      severite: vision.result.severite,
      symptomes: vision.result.symptomes,
      traitements: vision.result.traitements,
      preventionConseils: vision.result.preventionConseils,
      rawResponse: vision.raw,
      model: vision.model,
      inputTokens: vision.usage.input_tokens,
      outputTokens: vision.usage.output_tokens,
    });
    return this.diagnosticRepo.save(diagnostic);
  }

  async listForParcelle(
    parcelleId: string,
    organisationId: string | null,
  ): Promise<Diagnostic[]> {
    const qb = this.diagnosticRepo
      .createQueryBuilder("d")
      .where("d.parcelleId = :p", { p: parcelleId });
    if (organisationId) {
      qb.andWhere("d.organisationId = :org", { org: organisationId });
    }
    return qb.orderBy("d.createdAt", "DESC").take(50).getMany();
  }

  async getOne(id: string, organisationId: string | null): Promise<Diagnostic> {
    const d = await this.diagnosticRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException("Diagnostic introuvable");
    if (
      organisationId &&
      d.organisationId &&
      d.organisationId !== organisationId
    ) {
      throw new NotFoundException("Diagnostic introuvable");
    }
    return d;
  }

  /**
   * Resize > 1568 px on long side and re-encode JPEG q=82.
   * Reduces upload to Anthropic, avoids token-cost blowup.
   */
  private async optimize(buf: Buffer): Promise<Buffer> {
    try {
      const meta = await sharp(buf).metadata();
      const longSide = Math.max(meta.width ?? 0, meta.height ?? 0);
      const pipeline = sharp(buf).rotate();
      if (longSide > TARGET_SIDE) {
        pipeline.resize(TARGET_SIDE, TARGET_SIDE, { fit: "inside" });
      }
      return pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    } catch (err) {
      this.logger.warn(
        `Sharp pipeline failed, sending original: ${(err as Error).message}`,
      );
      return buf;
    }
  }
}
