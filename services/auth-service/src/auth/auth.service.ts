import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  BadGatewayException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: {
    id: string;
    email: string;
    role: Role;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  private get accessSecret(): string {
    return this.configService.get<string>(
      'JWT_ACCESS_SECRET',
      'chat-portal-jwt-access-secret-key-32chars',
    );
  }

  private get accessExpiresIn(): string {
    return this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
  }

  private get refreshSecret(): string {
    return this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'chat-portal-jwt-refresh-secret-key-32chars',
    );
  }

  private get refreshExpiresIn(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
  }

  /**
   * Hashes a raw token string with SHA-256 for secure database storage.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generates both access token and refresh token for a user.
   */
  private async generateTokens(
    userId: string,
    email: string,
    role: Role,
  ): Promise<AuthTokens> {
    const accessPayload = { sub: userId, email, role, jti: crypto.randomUUID() };
    const refreshPayload = { sub: userId, email, jti: crypto.randomUUID() };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresIn,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Stores a hashed refresh token in the database.
   */
  private async storeRefreshToken(userId: string, rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    // Parse expiration (default 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });
  }

  /**
   * Register a new user in auth-service.
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Check if user already exists
    const existing = await this.prisma.authUser.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    // Create auth user
    const user = await this.prisma.authUser.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: dto.role ?? Role.MENTEE,
      },
    });

    // Provision user profile in user-service
    const userServiceUrl = this.configService.get<string>(
      'USER_SERVICE_URL',
      'http://localhost:3002',
    );

    try {
      const userRes = await fetch(`${userServiceUrl}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          username: dto.username,
          name: dto.name,
          role: user.role,
        }),
      });

      if (!userRes.ok) {
        const errorData = (await userRes.json().catch(() => null)) as {
          message?: string | string[];
          statusCode?: number;
        } | null;

        const errorMsg =
          (Array.isArray(errorData?.message)
            ? errorData?.message.join(', ')
            : errorData?.message) || 'Failed to initialize user profile in user-service';

        // Compensating rollback: Delete the auth user record to prevent orphaned credentials
        await this.prisma.authUser.delete({ where: { id: user.id } });

        this.logger.warn(
          `Compensating rollback: Deleted auth user [${user.id}] due to user-service failure: ${errorMsg}`,
        );

        if (userRes.status === 409) {
          throw new ConflictException(errorMsg);
        } else if (userRes.status === 400) {
          throw new BadRequestException(errorMsg);
        } else {
          throw new BadGatewayException(errorMsg);
        }
      }
    } catch (err) {
      if (
        err instanceof ConflictException ||
        err instanceof BadRequestException ||
        err instanceof BadGatewayException
      ) {
        throw err;
      }

      // If network failure / connection refused to user-service
      await this.prisma.authUser.delete({ where: { id: user.id } }).catch(() => null);
      this.logger.error(
        `Failed to reach user-service at ${userServiceUrl}: ${(err as Error).message}`,
      );
      throw new BadGatewayException(
        'User service is unreachable. Registration could not be completed.',
      );
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`User registered successfully: [${user.id}] ${user.email}`);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Authenticate user with email and password.
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await this.prisma.authUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`User logged in: [${user.id}] ${user.email}`);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Refresh token rotation with reuse detection.
   */
  async refreshTokens(rawRefreshToken: string): Promise<AuthResponse> {
    let payload: { sub: string; email: string };
    try {
      payload = await this.jwtService.verifyAsync(rawRefreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const existingToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existingToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse detection: If token was already revoked, someone is reusing an old token!
    if (existingToken.isRevoked) {
      // Concurrency Grace Period: check if a valid token was created for this user within the last 20s
      const recentActive = await this.prisma.refreshToken.findFirst({
        where: {
          userId: existingToken.userId,
          isRevoked: false,
          createdAt: { gte: new Date(Date.now() - 20000) },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (recentActive) {
        this.logger.log(
          `Concurrent refresh request tolerated within grace period for user [${existingToken.userId}]`,
        );
        const tokens = await this.generateTokens(
          existingToken.user.id,
          existingToken.user.email,
          existingToken.user.role,
        );
        return {
          accessToken: tokens.accessToken,
          refreshToken: rawRefreshToken,
          user: {
            id: existingToken.user.id,
            email: existingToken.user.email,
            role: existingToken.user.role,
          },
        };
      }

      this.logger.warn(
        `Revoked refresh token reuse detected for user ${existingToken.userId}! Revoking all sessions.`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { userId: existingToken.userId },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException(
        'Compromised token detected. All sessions have been invalidated. Please log in again.',
      );
    }

    if (existingToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (!existingToken.user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Rotate: Revoke current token
    await this.prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { isRevoked: true },
    });

    // Issue new token pair
    const tokens = await this.generateTokens(
      existingToken.user.id,
      existingToken.user.email,
      existingToken.user.role,
    );
    await this.storeRefreshToken(existingToken.user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: existingToken.user.id,
        email: existingToken.user.email,
        role: existingToken.user.role,
      },
    };
  }

  /**
   * Revoke a refresh token on logout.
   */
  async logout(rawRefreshToken?: string): Promise<{ message: string }> {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      await this.prisma.refreshToken
        .updateMany({
          where: { tokenHash },
          data: { isRevoked: true },
        })
        .catch(() => null);
    }

    return { message: 'Logged out successfully' };
  }

  /**
   * Get authenticated user profile details from auth DB.
   */
  async getMe(userId: string) {
    const user = await this.prisma.authUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
