import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Extracts and validates the authenticated user ID from the `x-user-id` header
 * forwarded by the API Gateway or edge authentication middleware.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'];

    if (!userId || (typeof userId === 'string' && !userId.trim())) {
      throw new UnauthorizedException('Authentication required: missing user identity header');
    }

    return Array.isArray(userId) ? userId[0] : userId;
  },
);
