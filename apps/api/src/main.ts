import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  // Tạm đọc thẳng biến môi trường; bước sau sẽ kiểm tra bằng Zod
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  Logger.log(`API đang chạy tại http://localhost:${port}/api/v1`, 'Bootstrap');
}

void bootstrap();