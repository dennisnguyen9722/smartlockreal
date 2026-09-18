import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@ktm/database';
import { ErrorCode } from '@ktm/shared';
import { AppException } from './app.exception';

/**
 * Đổi lỗi của Prisma thành lỗi chuẩn của hệ thống.
 * Dùng khi vẫn có thể xảy ra trùng dữ liệu dù đã kiểm tra trước
 * (hai người tạo cùng lúc).
 */
export function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      // Trùng giá trị ở cột duy nhất
      case 'P2002':
        throw new AppException(ErrorCode.ALREADY_EXISTS, HttpStatus.CONFLICT, {
          fields: error.meta?.target,
        });
      // Khóa ngoại không tồn tại
      case 'P2003':
        throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
          message: 'Dữ liệu tham chiếu không tồn tại',
          field: error.meta?.field_name,
        });
      // Xóa bị chặn vì còn dữ liệu liên quan
      case 'P2014':
      case 'P2003_RESTRICT':
        throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT);
      // Không tìm thấy bản ghi cần sửa hoặc xóa
      case 'P2025':
        throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
  }
  throw error;
}
