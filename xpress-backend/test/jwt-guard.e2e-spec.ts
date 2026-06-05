/**
 * E2E test for JwtGuard - chứng minh user A KHÔNG thể dùng token của user B
 * (và ngược lại) để gọi API "trục lợi", và whitelist public hoạt động đúng
 * theo cơ chế @Public() decorator + Reflector.
 *
 * Test này CỐ TÌNH KHÔNG load AppModule thật vì AppModule phụ thuộc DynamoDB +
 * nodemailer + Google client. Thay vào đó dựng 1 module test nhỏ với:
 *   - JwtGuard, JwtStrategy THẬT (đúng code đang chạy production)
 *   - SessionRepository được mock bằng in-memory store
 *   - JwtService THẬT để mint token cho từng kịch bản
 *   - @Public() decorator THẬT để xác minh whitelist
 */

process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'test-secret-key-only-for-jwt-guard-e2e';

import {
  Controller,
  Get,
  INestApplication,
  Module,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { JwtGuard } from '../src/middleware/jwt.guard';
import { Public } from '../src/middleware/public.decorator';
import { SessionRepository } from '../src/modules/auth/repositories/session.repository';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { DeviceSessionService } from '../src/modules/device-session/device-session.service';

interface AuthedReq extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    sessionId: string;
  };
}

class FakeSessionRepository {
  private sessions = new Map<
    string,
    { sessionId: string; status: 'ACTIVE' | 'INACTIVE' }
  >();

  setActive(userId: string, sessionId: string) {
    this.sessions.set(`${userId}#${sessionId}`, {
      sessionId,
      status: 'ACTIVE',
    });
  }

  setInactive(userId: string, sessionId: string) {
    this.sessions.set(`${userId}#${sessionId}`, {
      sessionId,
      status: 'INACTIVE',
    });
  }

  findSessionById(userId: string, sessionId: string) {
    return Promise.resolve(this.sessions.get(`${userId}#${sessionId}`) ?? null);
  }
}

class FakeDeviceSessionService {
  isSessionValid() {
    return Promise.resolve(true);
  }
}

@Controller()
class TestController {
  @Get('me')
  me(@Req() req: AuthedReq) {
    if (!req.user) throw new UnauthorizedException();
    return req.user;
  }

  @Get('me/secret')
  safeGetSecret(@Req() req: AuthedReq) {
    return { tokenOwner: req.user?.userId };
  }

  @Get('users/:userId/secret')
  unsafeGetSecret(@Req() req: AuthedReq, @Param('userId') userId: string) {
    return { tokenOwner: req.user?.userId, askedFor: userId };
  }

  // Mô phỏng các route auth public (login/register/refresh/...)
  @Public()
  @Post('auth/login')
  fakeLogin() {
    return { ok: true };
  }

  @Public()
  @Post('auth/refresh')
  fakeRefresh() {
    return { ok: true };
  }

  // Cùng path nhưng method khác — KHÔNG có @Public() → vẫn cần auth.
  // Dùng để xác minh metadata gắn vào HANDLER, không phải vào path/string.
  @Get('auth/login')
  fakeLoginGetGuarded() {
    return { ok: true };
  }
}

// Controller được mark @Public() ở CLASS level → mọi route con đều public.
@Public()
@Controller('public')
class PublicController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('version')
  version() {
    return { version: '1.0.0' };
  }
}

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '10m' },
    }),
  ],
  controllers: [TestController, PublicController],
  providers: [
    JwtStrategy,
    { provide: SessionRepository, useClass: FakeSessionRepository },
    { provide: DeviceSessionService, useClass: FakeDeviceSessionService },
    { provide: APP_GUARD, useClass: JwtGuard },
  ],
})
class TestAppModule {}

describe('JwtGuard (e2e — token isolation, forgery & @Public())', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let sessions: FakeSessionRepository;

  let tokenA: string;
  let tokenB: string;

  const userA = {
    sub: 'user-a-id',
    email: 'a@test.com',
    role: 'CUSTOMER',
    sid: 'sess-a',
  };
  const userB = {
    sub: 'user-b-id',
    email: 'b@test.com',
    role: 'CUSTOMER',
    sid: 'sess-b',
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = mod.createNestApplication();
    await app.init();

    jwt = app.get(JwtService);
    sessions = app.get(SessionRepository);

    sessions.setActive(userA.sub, userA.sid);
    sessions.setActive(userB.sub, userB.sid);

    tokenA = await jwt.signAsync(userA);
    tokenB = await jwt.signAsync(userB);
  });

  afterAll(async () => {
    await app.close();
  });

  // ======================================================================
  // Nhóm 1: Forge / chế tác token (kẻ tấn công không có token hợp lệ)
  // ======================================================================
  describe('Token forgery', () => {
    it('không có Authorization header → 401', () => {
      return request(app.getHttpServer()).get('/me').expect(401);
    });

    it('Bearer token rác → 401', () => {
      return request(app.getHttpServer())
        .get('/me')
        .set('Authorization', 'Bearer not.a.real.jwt')
        .expect(401);
    });

    it('token ký bằng secret khác (kẻ tấn công không biết JWT_SECRET) → 401', async () => {
      const attackerSigner = new JwtService({
        secret: 'attacker-secret',
        signOptions: { expiresIn: '10m' },
      });
      const fake = await attackerSigner.signAsync(userA);

      return request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${fake}`)
        .expect(401);
    });

    it('token đã hết hạn → 401', async () => {
      const expired = await jwt.signAsync(userA, { expiresIn: -10 });
      return request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
    });

    it('token thiếu sid → 401', async () => {
      const noSid = await jwt.signAsync({
        sub: userA.sub,
        email: userA.email,
        role: userA.role,
      });
      return request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${noSid}`)
        .expect(401);
    });

    it('token có sid không tồn tại trong DB → 401', async () => {
      const ghostSid = await jwt.signAsync({
        ...userA,
        sid: 'sid-khong-co-that',
      });
      return request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${ghostSid}`)
        .expect(401);
    });

    it('token của session đã bị revoke (logout) → 401', async () => {
      sessions.setInactive(userA.sub, userA.sid);
      const t = await jwt.signAsync(userA);
      try {
        await request(app.getHttpServer())
          .get('/me')
          .set('Authorization', `Bearer ${t}`)
          .expect(401);
      } finally {
        sessions.setActive(userA.sub, userA.sid);
      }
    });
  });

  // ======================================================================
  // Nhóm 2: Token isolation - mỗi token chỉ đại diện đúng chủ của nó
  // ======================================================================
  describe('Token isolation (token của ai chỉ đại diện cho người đó)', () => {
    it('tokenA → request.user.userId = userA', async () => {
      const res = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body.userId).toBe(userA.sub);
      expect(res.body.userId).not.toBe(userB.sub);
    });

    it('tokenB → request.user.userId = userB', async () => {
      const res = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      expect(res.body.userId).toBe(userB.sub);
      expect(res.body.userId).not.toBe(userA.sub);
    });

    it('user A KHÔNG thể "đổi sub" trên token của mình để giả làm B', async () => {
      // Tampering: lấy tokenA, sửa payload sub → userB.sub, giữ nguyên signature.
      // JWT verify sẽ fail vì signature không khớp với payload mới.
      const [header, payload, sig] = tokenA.split('.');
      const decoded = JSON.parse(
        Buffer.from(payload, 'base64url').toString(),
      ) as Record<string, unknown>;
      decoded.sub = userB.sub;
      decoded.email = userB.email;
      const tampered = `${header}.${Buffer.from(
        JSON.stringify(decoded),
      ).toString('base64url')}.${sig}`;

      return request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${tampered}`)
        .expect(401);
    });
  });

  // ======================================================================
  // Nhóm 3: IDOR - JwtGuard CHỈ xác thực token, KHÔNG check ownership.
  //         Service layer phải tự kiểm tra. Test này để chứng minh & nhắc nhở.
  // ======================================================================
  describe('IDOR — guard không tự bảo vệ ownership, service phải làm', () => {
    it('controller AN TOÀN: chỉ đọc userId từ request.user → trục lợi bất khả thi', async () => {
      const res = await request(app.getHttpServer())
        .get('/me/secret')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body.tokenOwner).toBe(userA.sub);
    });

    it('controller XẤU: tin userId từ URL → A vẫn lấy được dữ liệu của B (đây là bug cần tránh!)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${userB.sub}/secret`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      // Token là của A nhưng URL hỏi về B → controller xấu sẽ trả dữ liệu B.
      // Test này PASS để cho thấy guard không cứu được bạn ở tầng service.
      expect(res.body.tokenOwner).toBe(userA.sub);
      expect(res.body.askedFor).toBe(userB.sub);
    });
  });

  // ======================================================================
  // Nhóm 4: @Public() decorator - whitelist theo metadata
  // ======================================================================
  describe('@Public() decorator', () => {
    it('route có @Public() → cho qua không cần token', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(201);
    });

    it('route /auth/refresh có @Public() → cho qua không cần token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(201);
    });

    it('cùng path /auth/login nhưng method GET KHÔNG có @Public() → 401', () => {
      // Quan trọng: chứng minh metadata gắn vào HANDLER, không phải path string.
      // Phương pháp hard-code cũ dễ "lệch" giữa POST và GET, cách @Public() thì không.
      return request(app.getHttpServer()).get('/auth/login').expect(401);
    });

    it('@Public() ở CLASS level → tất cả route con đều public', async () => {
      await request(app.getHttpServer()).get('/public/health').expect(200);
      await request(app.getHttpServer()).get('/public/version').expect(200);
    });

    it('route bình thường (không có @Public()) → mặc định cần token (secure by default)', () => {
      return request(app.getHttpServer()).get('/me').expect(401);
    });

    it('route public vẫn nhận được khi user CÓ token (không bị guard chặn)', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({})
        .expect(201);
    });
  });
});
