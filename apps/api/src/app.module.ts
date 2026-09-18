import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import type { Env } from './config/env';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RealtimeModule } from './realtime/realtime.module';
import { RedisModule } from './redis/redis.module';
import { DevController } from './dev/dev.controller';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';

@Module({})
export class AppModule {
  static register(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(env), DatabaseModule, RedisModule, QueueModule, RealtimeModule, AuthModule],
      controllers: [
        HealthController,
        // Endpoint phát triển chỉ tồn tại ngoài production
        ...(env.NODE_ENV === 'production' ? [] : [DevController]),
      ],
      providers: [
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        // Thứ tự quan trọng: xác thực token trước, kiểm tra quyền sau
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    };
  }
}