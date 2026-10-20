import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { Repository } from "typeorm";
import { SlackAlerterService } from "../common/alerting/slack-alerter.service";
import {
  ContactRequestDto,
  DemoRequestDto,
  ListWebsiteRequestsQueryDto,
  OrderRequestDto,
  UpdateWebsiteRequestDto,
  WebsiteFormResponse,
} from "./dto/website.dto";
import {
  WebsiteOrderLine,
  WebsiteRequest,
  WebsiteRequestType,
} from "./entities/website-request.entity";

const CONFIRMATIONS: Record<WebsiteRequestType, string> = {
  contact: "Message bien reçu : notre équipe vous répond sous 24 h.",
  demo: "Demande de démo enregistrée : nous vous appelons sous 24 h pour fixer le rendez-vous.",
  order:
    "Demande de commande enregistrée : nous vous recontactons pour confirmer disponibilité, prix et livraison.",
};

const LABELS: Record<WebsiteRequestType, string> = {
  contact: "Nouveau message de contact",
  demo: "Nouvelle demande de démo",
  order: "Nouvelle demande de commande boutique",
};

/**
 * Demandes du site vitrine (contact, démo, commande boutique) :
 * enregistrement, alerte Slack de l'équipe, suivi par le back-office.
 */
@Injectable()
export class WebsiteService {
  private readonly logger = new Logger(WebsiteService.name);

  constructor(
    @InjectRepository(WebsiteRequest)
    private readonly requests: Repository<WebsiteRequest>,
    private readonly alerter: SlackAlerterService,
  ) {}

  submitContact(dto: ContactRequestDto): Promise<WebsiteFormResponse> {
    const details: Record<string, string> = {};
    if (dto.subject) details.subject = dto.subject;
    if (dto.farmSize) details.farmSize = dto.farmSize;
    return this.submit("contact", dto, { message: dto.message, details });
  }

  submitDemo(dto: DemoRequestDto): Promise<WebsiteFormResponse> {
    const details: Record<string, string> = { farmSize: dto.farmSize };
    if (dto.culture) details.culture = dto.culture;
    if (dto.availability) details.availability = dto.availability;
    return this.submit("demo", dto, { message: dto.message ?? null, details });
  }

  submitOrder(dto: OrderRequestDto): Promise<WebsiteFormResponse> {
    const lines: WebsiteOrderLine[] = dto.lines.map((l) => ({
      productId: l.productId,
      name: l.name,
      quantity: l.quantity,
      unitPriceFcfa: l.unitPriceFcfa,
    }));
    const details: Record<string, string> = {};
    if (dto.deliveryLocation) details.deliveryLocation = dto.deliveryLocation;
    return this.submit("order", dto, {
      message: dto.message ?? null,
      details,
      lines,
      totalFcfa: orderTotal(lines),
    });
  }

  async list(query: ListWebsiteRequestsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Partial<Pick<WebsiteRequest, "type" | "status">> = {};
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    const [data, total] = await this.requests.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<WebsiteRequest> {
    const request = await this.requests.findOne({ where: { id } });
    if (!request) throw new NotFoundException(`Demande ${id} introuvable`);
    return request;
  }

  async update(
    id: string,
    dto: UpdateWebsiteRequestDto,
  ): Promise<WebsiteRequest> {
    const request = await this.findOne(id);
    if (dto.status !== undefined) request.status = dto.status;
    if (dto.notes !== undefined) request.notes = dto.notes;
    return this.requests.save(request);
  }

  private async submit(
    type: WebsiteRequestType,
    dto: {
      name: string;
      phone: string;
      email?: string;
      sourcePage?: string;
      website?: string;
    },
    extra: Pick<WebsiteRequest, "message" | "details"> &
      Partial<Pick<WebsiteRequest, "lines" | "totalFcfa">>,
  ): Promise<WebsiteFormResponse> {
    // Champ piège rempli : on répond comme si tout allait bien, sans rien enregistrer
    if (dto.website) {
      this.logger.warn(`website.${type}: honeypot rempli, demande ignorée`);
      return this.response(type, randomUUID());
    }

    const saved = await this.requests.save(
      this.requests.create({
        type,
        name: dto.name,
        phone: normalizePhone(dto.phone),
        email: dto.email ?? null,
        sourcePage: dto.sourcePage ?? null,
        lines: null,
        totalFcfa: null,
        ...extra,
      }),
    );

    await this.alerter.notifyAndWait({
      key: `website.${type}.${saved.id}`,
      severity: "info",
      title: LABELS[type],
      message: summarize(saved),
      context: {
        id: saved.id,
        nom: saved.name,
        téléphone: saved.phone,
        email: saved.email ?? undefined,
        ...saved.details,
        totalFcfa: saved.totalFcfa ?? undefined,
      },
    });
    this.logger.log(`website.${type}: demande ${saved.id} enregistrée`);
    return this.response(type, saved.id);
  }

  private response(type: WebsiteRequestType, id: string): WebsiteFormResponse {
    return { success: true, message: CONFIRMATIONS[type], id, contactId: id };
  }
}

/** Retire espaces et tirets ; ajoute +221 aux numéros sénégalais à 9 chiffres. */
export function normalizePhone(raw: string): string {
  const compact = raw.replace(/[\s-]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (/^[37]\d{8}$/.test(compact)) return `+221${compact}`;
  return compact;
}

export function orderTotal(lines: WebsiteOrderLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.unitPriceFcfa, 0);
}

function summarize(r: WebsiteRequest): string {
  if (r.type === "order" && r.lines) {
    const items = r.lines.map((l) => `• ${l.quantity} × ${l.name}`).join("\n");
    return `${items}\nTotal indicatif : ${r.totalFcfa?.toLocaleString("fr-FR")} FCFA`;
  }
  return (r.message ?? "").slice(0, 500) || "(sans message)";
}
