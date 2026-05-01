import {
  Process,
  Processor,
  OnQueueFailed,
  OnQueueCompleted,
} from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Job } from "bull";
import PDFDocument from "pdfkit";
import { QUEUE_NAMES } from "../common/queues";
import { Visite } from "../visites/entities/visite.entity";
import { Tache } from "../taches/entities/tache.entity";
import { Recolte } from "../recoltes/entities/recolte.entity";
import { MetricsService } from "../metrics/metrics.service";
import { SlackAlerterService } from "../common/alerting/slack-alerter.service";

export interface PdfGenerationJob {
  organisationId: string | null;
  type: "synthese" | "visites" | "recoltes" | "complet";
  periode: "semaine" | "mois" | "saison";
  startDate?: string;
  endDate?: string;
}

@Processor(QUEUE_NAMES.PDF)
export class RapportsProcessor {
  private readonly logger = new Logger(RapportsProcessor.name);

  constructor(
    @InjectRepository(Visite) private visitesRepo: Repository<Visite>,
    @InjectRepository(Tache) private tachesRepo: Repository<Tache>,
    @InjectRepository(Recolte) private recoltesRepo: Repository<Recolte>,
    private metrics: MetricsService,
    private slack: SlackAlerterService,
  ) {}

  @Process("generate")
  async generatePdf(
    job: Job<PdfGenerationJob>,
  ): Promise<{ pdf: string; size: number }> {
    const { organisationId, type, periode } = job.data;
    this.logger.log(`PDF generation job ${job.id} → ${type} rapport`);

    // Create PDF document in memory (as stream)
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];

    // Collect chunks instead of writing to file
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    // Wait for stream to finish
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("error", reject);
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    // Add content based on rapport type
    this.addHeader(doc, type);

    switch (type) {
      case "synthese":
        await this.addSyntheseContent(doc, organisationId, periode);
        break;
      case "visites":
        await this.addVisitesContent(doc, organisationId, periode);
        break;
      case "recoltes":
        await this.addRecoltesContent(doc, organisationId, periode);
        break;
      case "complet":
        await this.addSyntheseContent(doc, organisationId, periode);
        doc.addPage();
        await this.addVisitesContent(doc, organisationId, periode);
        doc.addPage();
        await this.addRecoltesContent(doc, organisationId, periode);
        break;
    }

    this.addFooter(doc);
    doc.end();

    const pdfBuffer = await pdfPromise;
    const base64 = pdfBuffer.toString("base64");

    this.logger.log(
      `Persisted PDF rapport ${type} (${pdfBuffer.length} bytes) for job ${job.id}`,
    );

    return {
      pdf: base64,
      size: pdfBuffer.length,
    };
  }

  private addHeader(doc: PDFDocument, type: string) {
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("🐝 Petalia Farm OS", { align: "center" });
    doc
      .fontSize(14)
      .text(`Rapport ${this.typeLabel(type)}`, { align: "center" });
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, {
        align: "center",
      });
    doc
      .moveTo(50, doc.y + 10)
      .lineTo(550, doc.y + 10)
      .stroke();
    doc.y += 20;
  }

  private addFooter(doc: PDFDocument) {
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 1; i <= pageCount; i++) {
      doc.switchToPage(i - 1);
      doc
        .fontSize(8)
        .text(`Page ${i} / ${pageCount}`, 50, doc.page.height - 30, {
          align: "center",
        });
    }
  }

  private async addSyntheseContent(
    doc: PDFDocument,
    organisationId: string | null,
    _periode: string,
  ) {
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Résumé Général", { underline: true });
    doc.fontSize(10).font("Helvetica");

    const visitesCount = await this.visitesRepo.count({
      where: organisationId ? { organisationId } : {},
    });
    const tachesCount = await this.tachesRepo.count({
      where: organisationId ? { organisationId } : {},
    });
    const recoltesCount = await this.recoltesRepo.count({
      where: organisationId ? { organisationId } : {},
    });

    doc.text(`• Visites effectuées : ${visitesCount}`, { lineGap: 8 });
    doc.text(`• Tâches complétées : ${tachesCount}`, { lineGap: 8 });
    doc.text(`• Récoltes enregistrées : ${recoltesCount}`, { lineGap: 8 });
    doc.text(`• Période : ${_periode}`, { lineGap: 8 });
  }

  private async addVisitesContent(
    doc: PDFDocument,
    organisationId: string | null,
    _periode: string,
  ) {
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Détail des Visites", { underline: true });
    doc.fontSize(9).font("Helvetica");

    const visites = await this.visitesRepo.find({
      where: organisationId ? { organisationId } : {},
      take: 10,
      order: { date: "DESC" },
    });

    if (visites.length === 0) {
      doc.text("Aucune visite enregistrée");
      return;
    }

    doc.text(`Total visites : ${visites.length} (affichage des 10 dernières)`, {
      lineGap: 5,
    });
    visites.forEach((v, i) => {
      doc.text(
        `${i + 1}. Visite du ${new Date(v.date).toLocaleDateString("fr-FR")} — ${v.statut}`,
        { lineGap: 3 },
      );
    });
  }

  private async addRecoltesContent(
    doc: PDFDocument,
    organisationId: string | null,
    _periode: string,
  ) {
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Détail des Récoltes", { underline: true });
    doc.fontSize(9).font("Helvetica");

    const recoltes = await this.recoltesRepo.find({
      where: organisationId ? { organisationId } : {},
      take: 10,
      order: { dateRecolte: "DESC" },
    });

    if (recoltes.length === 0) {
      doc.text("Aucune récolte enregistrée");
      return;
    }

    doc.text(
      `Total récoltes : ${recoltes.length} (affichage des 10 dernières)`,
      {
        lineGap: 5,
      },
    );
    recoltes.forEach((r, i) => {
      doc.text(
        `${i + 1}. Récolte du ${new Date(r.dateRecolte).toLocaleDateString("fr-FR")} — Rendement: ${r.rendement} t/ha`,
        { lineGap: 3 },
      );
    });
  }

  private typeLabel(type: string): string {
    const labels: Record<string, string> = {
      synthese: "Synthèse",
      visites: "des Visites",
      recoltes: "des Récoltes",
      complet: "Complet",
    };
    return labels[type] || type;
  }

  @OnQueueCompleted()
  onCompleted() {
    this.metrics.queueJobsCompleted.inc({ queue: QUEUE_NAMES.PDF });
    this.metrics.recordBusinessEvent("rapport.pdf", "success");
  }

  @OnQueueFailed()
  async onFailed(job: Job<PdfGenerationJob>, err: Error) {
    this.logger.error(
      `PDF generation job ${job.id} failed: ${err.message}`,
      err.stack,
    );
    this.metrics.queueJobsFailed.inc({
      queue: QUEUE_NAMES.PDF,
      reason: err.name || "Error",
    });
    this.metrics.recordBusinessEvent("rapport.pdf", "failure");

    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      this.slack.notify({
        key: `queue.pdf.failed.${job.data?.type}`,
        severity: "error",
        title: "PDF rapport job failed (final attempt)",
        message: `Rapport *${job.data?.type}* (${job.data?.periode}) failed.`,
        context: {
          jobId: String(job.id),
          organisationId: job.data?.organisationId || "n/a",
          attempts: job.attemptsMade,
          error: err.message,
        },
      });
    }
  }
}
