import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server } from 'socket.io';

type IoServerOptions = Parameters<IoAdapter['createIOServer']>[1];

/**
 * Adapter Socket.IO của dự án.
 * CORS của HTTP (app.enableCors) KHÔNG áp dụng cho Socket.IO, nên phải cấu hình riêng ở đây.
 */
export class AppIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly corsOrigins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: IoServerOptions): Server {
    // NestJS khai báo ServerOptions yêu cầu đủ mọi trường,
    // nhưng Socket.IO tự điền mặc định cho trường thiếu (vd: path = '/socket.io').
    const withCors = {
      ...options,
      cors: { origin: this.corsOrigins, credentials: true },
    } as NonNullable<IoServerOptions>;

    return super.createIOServer(port, withCors) as Server;
  }
}