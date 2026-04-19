import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Webhook, WebhookDocument } from "./schemas/webhook.schema";

@Injectable()
export class WebhooksService {
  constructor(
    @InjectModel(Webhook.name) private webhookModel: Model<WebhookDocument>,
  ) {}

  async findAll(organisationId?: string): Promise<Webhook[]> {
    const filter = organisationId
      ? { organisationId: new Types.ObjectId(organisationId) }
      : {};
    return this.webhookModel.find(filter).exec();
  }

  async create(data: Partial<Webhook>): Promise<Webhook> {
    return new this.webhookModel(data).save();
  }

  async update(id: string, data: Partial<Webhook>): Promise<Webhook> {
    const updated = await this.webhookModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Webhook ${id} non trouvé`);
    return updated;
  }

  async remove(id: string): Promise<{ data: boolean }> {
    await this.webhookModel.findByIdAndDelete(id).exec();
    return { data: true };
  }

  async test(id: string): Promise<{ sent: boolean }> {
    const webhook = await this.webhookModel.findById(id).exec();
    if (!webhook) throw new NotFoundException(`Webhook ${id} non trouvé`);
    // Would trigger actual HTTP POST in production
    return { sent: true };
  }
}
