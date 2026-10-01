import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Extracts and validates the authenticated user ID from the `x-user-id` header.
 * Throws UnauthorizedException if the header is missing or empty.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'];

    if (!userId || (typeof userId === 'string' && !userId.trim())) {
      throw new UnauthorizedException('Missing x-user-id header');
    }

    return Array.isArray(userId) ? userId[0].trim() : userId.trim();
  },
);

/**
 * Extracts the user role from the `x-user-role` header (e.g. 'MENTOR', 'ADMIN', 'MENTEE').
 * Returns an empty string if not provided.
 */
export const CurrentUserRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const role = request.headers['x-user-role'];

    if (!role) {
      return '';
    }

    return (Array.isArray(role) ? role[0] : role).trim();
  },
);

/**
 * Extracts the user display name from the `x-user-name` header.
 * Returns an empty string if not provided.
 */
export const CurrentUserName = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const name = request.headers['x-user-name'];

    if (!name) {
      return '';
    }

    return (Array.isArray(name) ? name[0] : name).trim();
  },
);
