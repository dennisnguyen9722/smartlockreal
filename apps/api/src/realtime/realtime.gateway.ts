import { Logger } from '@nestjs/common';
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

/**
 * Quy ước room (dùng từ Bước 4, sau khi có xác thực):
 *   staff:<id> | role:<mã vai trò> | location:<mã điểm> | customer:<id>
 */
@WebSocketGateway({ namespace: '/realtime' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Namespace;

  private readonly logger = new Logger(RealtimeGateway.name);

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
  ping(@MessageBody() body: unknown) {
    return { pong: true, serverTime: new Date().toISOString(), echo: body };
  }

  /** Các module nghiệp vụ gọi hàm này để phát thông báo */
  emitToRoom(room: string, event: RealtimeEvent, payload: unknown) {
    this.server.to(room).emit(event, payload);
  }
}