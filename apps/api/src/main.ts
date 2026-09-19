import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { AppIoAdapter } from './realtime/app-io.adapter';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import { REDIS, REDIS_SUBSCRIBER } from './redis/redis.module';
import path from 'node:path';

async function bootstrap() {
  const env = loadEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(env));
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  // Chạy sau Nginx/load balancer: tin 1 lớp proxy để lấy đúng IP khách
  app.set('trust proxy', 1);

  // Helmet mặc định cho toàn bộ API (gồm Cross-Origin-Resource-Policy: same-origin)
  app.use(helmet());
  app.use(cookieParser());

  // Ảnh là file tĩnh, phục vụ trực tiếp. Production nên để Nginx làm việc này
  // (nhớ thêm cùng header Cross-Origin-Resource-Policy ở cấu hình Nginx).
  app.useStaticAssets(path.resolve(env.MEDIA_ROOT), {
    prefix: '/media',
    // Tên file chứa mã băm nội dung nên đổi ảnh là đổi tên: cache thoải mái 1 năm
    maxAge: '1y',
    immutable: true,
    index: false,
    redirect: false,
    // Admin (:3001) và storefront khác nguồn với API: riêng ảnh được phép nhúng ở trang khác.
    // Chạy sau Helmet nên ghi đè giá trị same-origin mà Helmet đã đặt.
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });

  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });

  const redisAdapter = createAdapter(app.get<Redis>(REDIS), app.get<Redis>(REDIS_SUBSCRIBER));
  app.useWebSocketAdapter(new AppIoAdapter(app, env.CORS_ORIGINS, redisAdapter));

  await app.listen(env.API_PORT);
  Logger.log(`API đang chạy tại http://localhost:${env.API_PORT}/api/v1`, 'Bootstrap');
}

void bootstrap();