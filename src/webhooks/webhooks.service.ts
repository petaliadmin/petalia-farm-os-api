import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from './entities/webhook.entity';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(Webhook)
    private webhookRepo: Repository<Webhook>,
  ) {}

  async findAll(organisationId?: string): Promise<Webhook[]> {
    const where = organisationId ? { organisationId } : {};
    return this.webhookRepo.find({ where });
  }

  async create(data: Partial<Webhook>): Promise<Webhook> {
    return this.webhookRepo.save(this.webhookRepo.create(data));
  }

  async update(id: string, data: Partial<Webhook>): Promise<Webhook> {
    const webhook = await this.webhookRepo.findOne({ where: { id } });
    if (!webhook) throw new NotFoundException(`Webhook ${id} non trouvé`);
    Object.assign(webhook, data);
    return this.webhookRepo.save(webhook);
  }

  async remove(id: string): Promise<{ data: boolean }> {
    await this.webhookRepo.delete(id);
    return { data: true };
  }

  async test(id: string): Promise<{ sent: boolean }> {
    const webhook = await this.webhookRepo.findOne({ where: { id } });
    if (!webhook) throw new NotFoundException(`Webhook ${id} non trouvé`);
    return { sent: true };
  }
}
