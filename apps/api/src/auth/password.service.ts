import { Injectable } from '@nestjs/common';
import { hash, verify, type Options } from '@node-rs/argon2';

/**
 * Argon2id với tham số theo khuyến nghị của OWASP:
 * 19 MiB bộ nhớ, 2 vòng lặp, 1 luồng.
 * Tham số nằm ngay trong chuỗi băm, nên đổi tham số sau này vẫn kiểm tra được mật khẩu cũ.
 */
const ARGON2_OPTIONS: Options = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return hash(plain, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, plain: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plain, ARGON2_OPTIONS);
    } catch {
      // Chuỗi băm hỏng hoặc sai định dạng: coi như sai mật khẩu
      return false;
    }
  }

  /**
   * Băm một chuỗi giả để thời gian phản hồi khi email KHÔNG tồn tại
   * gần bằng khi email tồn tại. Nếu không, kẻ tấn công đo thời gian
   * có thể dò ra email nào đang có trong hệ thống.
   */
  async burnTime(): Promise<void> {
    await hash('khong-ton-tai-' + Date.now(), ARGON2_OPTIONS);
  }
}
