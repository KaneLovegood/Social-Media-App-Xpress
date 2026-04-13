import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';

class SocketIoCorsAdapter extends IoAdapter {
  override createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        ...(options?.cors ?? {}),
      },
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configure CORS for HTTP
  app.enableCors({
    origin: '*',
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
