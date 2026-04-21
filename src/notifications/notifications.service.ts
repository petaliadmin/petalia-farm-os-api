import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Notification,
  NotificationDocument,
} from "./schemas/notification.schema";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async findAll(
    userId: string,
    query?: { page?: number; limit?: number },
  ): Promise<{
    data: Notification[];
    meta: { total: number; page: number; limit: number };
  }> {
    const filter = { userId: new Types.ObjectId(userId) };
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(filter),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findNonLues(userId: string): Promise<Notification[]> {
    return this.notificationModel
      .find({ userId: new Types.ObjectId(userId), lue: false })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getCount(userId: string): Promise<{ data: { count: number } }> {
    const count = await this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      lue: false,
    });
    return { data: { count } };
  }

  async marquerLue(id: string): Promise<Notification> {
    const updated = await this.notificationModel
      .findByIdAndUpdate(id, { lue: true }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Notification ${id} non trouvée`);
    return updated;
  }

  async marquerToutesLues(
    userId: string,
  ): Promise<{ data: { updated: number } }> {
    const result = await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), lue: false },
      { lue: true },
    );
    return { data: { updated: result.modifiedCount } };
  }

  async remove(id: string): Promise<{ data: boolean }> {
    const result = await this.notificationModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(`Notification ${id} non trouvée`);
    return { data: true };
  }

  async create(data: Partial<Notification>): Promise<Notification> {
    return new this.notificationModel(data).save();
  }
}
