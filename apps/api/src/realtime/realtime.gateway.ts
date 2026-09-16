import { Inject, Logger } from '@nestjs/common';
import {
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { RealtimeEvent } from '@ktm/shared';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

/**
 * Quy ước room (dùng từ Bước 4, sau khi có xác thực):
 *   staff:<id> | role:<mã vai trò> | location:<mã điểm> | customer:<id>
 */
@WebSocketGateway({ namespace: '/realtime' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Namespace;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  handleConnection(client: Socket) {
    this.logger.log(`Kết nối: ${client.id}`);
    // TẠM THỜI để kiểm tra chiều server -> client; sẽ xóa ở Bước 4
    client.emit(RealtimeEvent.NOTIFICATION_NEW, { title: 'Kết nối realtime thành công' });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Ngắt kết nối: ${client.id}`);
  }

  /** Giá trị trả về được gửi lại cho client dưới dạng "ack" */
  @SubscribeMessage(RealtimeEvent.SYSTEM_PING)
  async ping(@MessageBody() body: unknown) {
    const sockets = await this.server.fetchSockets(); // hỏi tất cả instance qua Redis
    return {
      pong: true,
      serverTime: new Date().toISOString(),
      instancePort: this.env.API_PORT,
      totalClients: sockets.length,
      echo: body,
    };
  }

  /** TẠM THỜI: kiểm thử phát thông báo giữa nhiều instance. Bị chặn ở production. */
  @SubscribeMessage('system:broadcast-test')
  broadcastTest() {
    if (this.env.NODE_ENV === 'production') return;
    this.server.emit(RealtimeEvent.NOTIFICATION_NEW, {
      type: 'broadcast-test',
      fromPort: this.env.API_PORT,
    });
  }

  /** Các module nghiệp vụ gọi hàm này để phát thông báo */
  emitToRoom(room: string, event: RealtimeEvent, payload: unknown) {
    this.server.to(room).emit(event, payload);
  }
}