import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { AccountStatus, PresenceStatus, User } from './types/user.type';
import { UsersRepository } from './users.repository';

@Injectable()
export class AuthService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async register(dto: RegisterDto) {
    const phone = dto.phone.trim();
    const existedUser = await this.usersRepository.findByPhone(phone);

    if (existedUser) {
      throw new ConflictException('Số điện thoại đã tồn tại');
    }

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user: User = {
      userId: randomUUID(),
      name: dto.name.trim(),
      phone,
      role: dto.role,
      status: PresenceStatus.OFFLINE,
      accountStatus: AccountStatus.ACTIVE,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    await this.usersRepository.create(user);

    return this.toSafeUser(user);
  }

  private toSafeUser(user: User) {
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }
}
