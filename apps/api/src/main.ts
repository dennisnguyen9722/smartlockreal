import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap() {
  // Kiểm tra biến môi trường TRƯỚC khi tạo ứng dụng
  const env = loadEnv();

  const app = await NestFactory.create(AppModule.register(env));
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  await app.listen(env.API_PORT);
  Logger.log(`API đang chạy tại http://localhost:${env.API_PORT}/api/v1`, 'Bootstrap');
}

void bootstrap();