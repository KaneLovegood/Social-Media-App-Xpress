import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key dùng cho @Public() decorator.
 * JwtGuard sẽ Reflector.getAllAndOverride() key này để bỏ qua xác thực JWT.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Đánh dấu một route hoặc controller là public — KHÔNG yêu cầu JWT.
 *
 * Quy ước:
 * - CHỈ dùng cho các route auth (login/register/oauth/otp/refresh/logout) hoặc
 *   các webhook / health-check không có user context.
 * - KHÔNG dùng cho bất kỳ endpoint nào đọc/ghi dữ liệu người dùng.
 *
 * @example
 *   @Public()
 *   @Post('login')
 *   login(@Body() dto: LoginDto) { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
