import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { AppIoAdapter } from './realtime/app-io.adapter';

async function bootstrap() {
  const env = loadEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(env));
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  // Chạy sau Nginx/load balancer: tin 1 lớp proxy để lấy đúng IP khách
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });

  app.useWebSocketAdapter(new AppIoAdapter(app, env.CORS_ORIGINS));

  await app.listen(env.API_PORT);
  Logger.log(`API đang chạy tại http://localhost:${env.API_PORT}/api/v1`, 'Bootstrap');
}

void bootstrap();