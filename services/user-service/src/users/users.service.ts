import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';

export const USER_SAFE_SELECT: Prisma.UserSelect = {
  id: true,
  email: true,
  username: true,
  name: true,
  role: true,
  avatarUrl: true,
  bio: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
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

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SAFE_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: USER_SAFE_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User with email '${email}' not found`);
    }

    return user;
  }

  async findAll(query: QueryUserDto) {
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

  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: username.trim() },
      select: USER_SAFE_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User with username '${username}' not found`);
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);

    const data: Prisma.UserUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.bio !== undefined && { bio: dto.bio }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.role !== undefined && { role: dto.role }),
    };

    if (dto.email) {
      const normalizedEmail = dto.email.toLowerCase().trim();
      const existing = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('A user with this email already exists');
      }
      data.email = normalizedEmail;
    }

    if (dto.username) {
      const normalizedUsername = dto.username.trim();
      const existing = await this.prisma.user.findUnique({
        where: { username: normalizedUsername },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('A user with this username already exists');
      }
      data.username = normalizedUsername;
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_SAFE_SELECT,
    });
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: USER_SAFE_SELECT,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.user.delete({
      where: { id },
      select: USER_SAFE_SELECT,
    });
  }
}
