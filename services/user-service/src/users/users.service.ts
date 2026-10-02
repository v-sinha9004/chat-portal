import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { USER_SAFE_SELECT } from './constants/user-select.constant';
import { SafeUser } from './interfaces/user-response.interface';

export { USER_SAFE_SELECT };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const normalizedUsername = dto.username.trim();

    // Check for duplicate email
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingEmail) {
      throw new ConflictException('A user with this email already exists');
    }

    // Check for duplicate username
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: normalizedUsername },
    });
    if (existingUsername) {
      throw new ConflictException('A user with this username already exists');
    }

    return this.prisma.user.create({
      data: {
        ...(dto.id ? { id: dto.id } : {}),
        email: normalizedEmail,
        username: normalizedUsername,
        name: dto.name.trim(),
        role: dto.role ?? Role.MENTEE,
        avatarUrl: dto.avatarUrl,
        bio: dto.bio,
      },
      select: USER_SAFE_SELECT,
    });
  }

  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SAFE_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    return user;
  }

  async findAll(requesterRole?: string, requesterId?: string): Promise<SafeUser[]> {
    const where: Prisma.UserWhereInput = {};

    if (requesterRole?.toUpperCase() === 'MENTEE') {
      where.role = { not: Role.MENTEE };
    }

    return this.prisma.user.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      select: USER_SAFE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateLastSeen(id: string, lastSeenAt: Date = new Date()): Promise<SafeUser> {
    return this.prisma.user.update({
      where: { id },
      data: { lastSeenAt },
      select: USER_SAFE_SELECT,
    });
  }
}
