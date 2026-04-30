import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThan, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
  ) {}

  async create(data: Partial<Notification>): Promise<Notification> {
    return this.notifRepo.save(this.notifRepo.create(data));
  }

  async findAll(
    userId: string,
    query?: { page?: number; limit?: number },
  ): Promise<{ data: Notification[]; meta: { total: number; page: number; limit: number } }> {
    const page = query?.page || 1;
    const limit = query?.limit || 20;

    const [data, total] = await this.notifRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { total, page, limit } };
  }

  async findNonLues(userId: string): Promise<Notification[]> {
    return this.notifRepo.find({
      where: { userId, lue: false },
      order: { createdAt: 'DESC' },
    });
  }

  async getCount(userId: string): Promise<{ data: { count: number } }> {
    const count = await this.notifRepo.count({ where: { userId, lue: false } });
    return { data: { count } };
  }

  async marquerLue(id: string): Promise<Notification> {
    const notif = await this.notifRepo.findOne({ where: { id } });
    if (!notif) throw new NotFoundException(`Notification ${id} non trouvée`);
    notif.lue = true;
    return this.notifRepo.save(notif);
  }

  async marquerToutesLues(userId: string): Promise<{ data: { updated: number } }> {
    const result = await this.notifRepo.update({ userId, lue: false }, { lue: true });
    return { data: { updated: result.affected || 0 } };
  }

  async remove(id: string): Promise<{ data: boolean }> {
    const result = await this.notifRepo.delete(id);
    if (!result.affected) throw new NotFoundException(`Notification ${id} non trouvée`);
    return { data: true };
  }

  // Replaces MongoDB TTL index: purge notifications older than 90 days
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeOldNotifications(): Promise<void> {
    const limit = new Date();
    limit.setDate(limit.getDate() - 90);
    await this.notifRepo.delete({ createdAt: LessThan(limit) });
  }
}
