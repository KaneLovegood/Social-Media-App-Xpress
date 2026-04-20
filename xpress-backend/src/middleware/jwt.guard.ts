import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Global JWT guard.
 *
 * - Mặc định: tất cả route đều yêu cầu JWT hợp lệ (secure by default).
 * - Bỏ qua xác thực CHỈ KHI route hoặc controller được đánh dấu @Public().
 *
 * Lưu ý: việc check ownership (IDOR) là trách nhiệm của service layer,
 * guard này chỉ xác thực TOKEN.
 */
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
