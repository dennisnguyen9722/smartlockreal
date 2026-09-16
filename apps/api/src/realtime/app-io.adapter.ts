import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { createAdapter } from '@socket.io/redis-adapter';
import type { Server } from 'socket.io';

type IoServerOptions = Parameters<IoAdapter['createIOServer']>[1];
type AdapterFactory = ReturnType<typeof createAdapter>;

/**
 * Adapter Socket.IO của dự án:
 * - CORS riêng cho Socket.IO (app.enableCors không áp dụng ở đây)
 * - Redis adapter để thông báo đi được giữa nhiều instance API
 */
export class AppIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly corsOrigins: string[],
    private readonly adapterFactory: AdapterFactory,
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

    const server = super.createIOServer(port, withCors) as Server;
    server.adapter(this.adapterFactory);
    return server;
  }
}