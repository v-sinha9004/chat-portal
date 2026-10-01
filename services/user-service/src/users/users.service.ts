import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { USER_SAFE_SELECT } from './constants/user-select.constant';
import { SafeUser, PaginatedUsersResponse } from './interfaces/user-response.interface';

export { USER_SAFE_SELECT };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findAll(query: QueryUserDto): Promise<PaginatedUsersResponse> {
    const page = query.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query.limit && query.limit > 0 ? Number(query.limit) : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { username: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: USER_SAFE_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateLastSeen(id: string, lastSeenAt: Date = new Date()): Promise<SafeUser> {
    return this.prisma.user.update({
      where: { id },
      data: { lastSeenAt },
      select: USER_SAFE_SELECT,
    });
  }
}
