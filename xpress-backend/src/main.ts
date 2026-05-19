import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';

/** Extra browser origins (comma-separated), e.g. CORS_ORIGINS=https://my-fe.vercel.app */
function extraCorsOrigins(): string[] {
  const raw = (process.env.CORS_ORIGINS ?? '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const corsOriginList: (string | RegExp)[] = [
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://deploy-frontend-01.s3-website-us-east-1.amazonaws.com',
  'https://new-technology-xpress-fe.onrender.com',
  'https://xpress-ten-ashen.vercel.app',
  'https://xpress-sandy.vercel.app',
  'https://xpress-s5va.vercel.app',
  /\.devtunnels\.ms$/,
  /^http:\/\/10\.0\.2\.2(:\d+)?$/,
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
  /^http:\/\/172\.\d+\.\d+\.\d+(:\d+)?$/,
  ...extraCorsOrigins(),
];

class SocketIoCorsAdapter extends IoAdapter {
  override createIOServer(port: number, options?: ServerOptions) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: corsOriginList,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
        ...(options?.cors ?? {}),
      },
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: corsOriginList,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Authorization, Idempotency-Key',
  });

  // Configure Socket.IO adapter with CORS
  app.useWebSocketAdapter(new SocketIoCorsAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
