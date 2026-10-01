import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * RolesGuard enforces role-based access control based on route metadata.
 * Extracts the user role from the `x-user-role` header forwarded by the API Gateway,
 * falling back to a database lookup via `x-user-id` if the header is absent.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userIdHeader = request.headers['x-user-id'];
    const userRoleHeader = request.headers['x-user-role'];

    const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
    let roleStr = Array.isArray(userRoleHeader) ? userRoleHeader[0] : userRoleHeader;

    if (!roleStr && userId) {
      // Fallback: Query role from database
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!user) {
        throw new UnauthorizedException('Authentication required: user not found');
      }
      roleStr = user.role;
    }

    if (!roleStr) {
      throw new UnauthorizedException('Authentication required: missing user role header');
    }

    const normalizedRole = roleStr.toUpperCase();
    const hasRole = requiredRoles.some((r) => r.toUpperCase() === normalizedRole);

    if (!hasRole) {
      throw new ForbiddenException(
        `Forbidden: This action requires one of the following roles: [${requiredRoles.join(', ')}]`,
      );
    }

    return true;
  }
}
