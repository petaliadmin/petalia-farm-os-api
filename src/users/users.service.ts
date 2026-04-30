import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    return this.userRepo.save(this.userRepo.create(dto));
  }

  async findAll(organisationId?: string): Promise<User[]> {
    const where = organisationId ? { organisationId } : {};
    return this.userRepo.find({ where });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('u')
      .addSelect(['u.passwordHash', 'u.refreshTokenHash', 'u.otpCode', 'u.loginAttempts'])
      .where('u.email = :email', { email })
      .getOne();
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('u')
      .addSelect(['u.passwordHash', 'u.otpCode'])
      .where('u.phone = :phone', { phone })
      .getOne();
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async remove(id: string): Promise<void> {
    const result = await this.userRepo.delete(id);
    if (!result.affected) throw new NotFoundException(`User with ID ${id} not found`);
  }

  async findByEquipage(equipeId: string): Promise<User[]> {
    return this.userRepo.find({ where: { equipeId } });
  }

  async findTechniciens(organisationId?: string): Promise<User[]> {
    const where: any = { role: 'technicien', actif: true };
    if (organisationId) where.organisationId = organisationId;
    return this.userRepo.find({ where });
  }
}
