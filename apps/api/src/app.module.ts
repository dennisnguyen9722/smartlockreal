import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import type { Env } from './config/env';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RealtimeModule } from './realtime/realtime.module';
import { RedisModule } from './redis/redis.module';
import { DevController } from './dev/dev.controller';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard';
import { AuditModule } from './audit/audit.module';
import { CatalogModule } from './catalog/catalog.module';
import { MediaModule } from './media/media.module';
import { OrdersModule } from './orders/orders.module';
import { GeoModule } from './geo/geo.module';
import { CustomersModule } from './customers/customers.module';
import { QuotesModule } from './quotes/quotes.module';

@Module({})
export class AppModule {
  static register(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        DatabaseModule,
        RedisModule,
        QueueModule,
        RealtimeModule,
        AuditModule,
        AuthModule,
        CatalogModule,
        MediaModule,
        GeoModule,
        OrdersModule,
        CustomersModule,
        QuotesModule,
      ],
      controllers: [
        HealthController,
        // Endpoint phát triển chỉ tồn tại ngoài production
        ...(env.NODE_ENV === 'production' ? [] : [DevController]),
      ],
      providers: [
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        // Chặn spam trước khi làm việc nặng (băm mật khẩu, truy vấn database)
        { provide: APP_GUARD, useClass: RateLimitGuard },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_INTERCEPTOR, useClass: BigIntInterceptor },
      ],
    };
  }
}