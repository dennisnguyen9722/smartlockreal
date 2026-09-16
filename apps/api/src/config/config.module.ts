import { DynamicModule, Global, Module } from '@nestjs/common';
import type { Env } from './env';

/** Token để tiêm cấu hình: @Inject(ENV) private readonly env: Env */
export const ENV = Symbol('ENV');

@Global()
@Module({})
export class ConfigModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: ENV, useValue: env }],
      exports: [ENV],
    };
  }
}