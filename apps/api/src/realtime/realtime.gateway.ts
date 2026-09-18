import { Inject, Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Redis } from 'ioredis';
import type { Namespace, Socket } from 'socket.io';
import { REALTIME_NAMESPACE, type RealtimeEvent, type StaffRoleCode } from '@ktm/shared';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { REDIS } from '../redis/redis.module';

interface SocketStaff {
  id: string;
  role: StaffRoleCode;
  sessionId: string;
}

/** Dữ liệu gắn kèm mỗi kết nối sau khi xác thực */
interface AuthedSocket extends Socket {
  data: { staff?: SocketStaff };
}

/**
 * Quy ước phòng:
 *   staff:<id>       - một nhân viên
 *   role:<vai trò>   - mọi nhân viên cùng vai trò
 */
@WebSocketGateway({ namespace: REALTIME_NAMESPACE })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Namespace;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly tokens: TokenService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async handleConnection(client: AuthedSocket) {
    const token: unknown = client.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) {
      this.reject(client, 'Thiếu token');
      return;
    }

    const result = await this.tokens.verifyAccessToken(token);
    if (!result.ok) {
      this.reject(client, result.reason === 'EXPIRED' ? 'Token hết hạn' : 'Token không hợp lệ');
      return;
    }

    const revoked = await this.redis.exists(AuthService.revokedKey(result.payload.sid));
    if (revoked === 1) {
      this.reject(client, 'Phiên đã bị thu hồi');
      return;
    }

    const staff: SocketStaff = {
      id: result.payload.sub,
      role: result.payload.role,
      sessionId: result.payload.sid,
    };
    client.data.staff = staff;
    await client.join([`staff:${staff.id}`, `role:${staff.role}`]);

    this.logger.log(`Kết nối: ${staff.id} (${staff.role})`);
  }

  handleDisconnect(client: AuthedSocket) {
    const staff = client.data.staff;
    if (staff) this.logger.log(`Ngắt kết nối: ${staff.id}`);
  }

  /** Các module nghiệp vụ gọi hàm này để phát thông báo */
  emitToRoom(room: string, event: RealtimeEvent, payload: unknown) {
    this.server.to(room).emit(event, payload);
  }

  emitToStaff(staffId: string, event: RealtimeEvent, payload: unknown) {
    this.emitToRoom(`staff:${staffId}`, event, payload);
  }

  emitToRole(role: StaffRoleCode, event: RealtimeEvent, payload: unknown) {
    this.emitToRoom(`role:${role}`, event, payload);
  }

  private reject(client: Socket, reason: string) {
    this.logger.debug(`Từ chối kết nối ${client.id}: ${reason}`);
    // Báo lý do rồi mới ngắt, để client biết cần làm mới token hay đăng nhập lại
    client.emit('auth:error', { reason });
    client.disconnect(true);
  }
}
