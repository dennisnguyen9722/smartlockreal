import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@ktm/database';
import { ErrorCode } from '@ktm/shared';
import { AppException } from './app.exception';

/**
 * Lỗi ràng buộc từ PostgreSQL (SQLSTATE 23514 check_violation): gồm CHECK viết tay trong migration
 * và RAISE EXCEPTION ... USING ERRCODE = 'check_violation' trong trigger.
 * Qua driver adapter của Prisma 7, lỗi này tới dưới dạng PrismaClientKnownRequestError với mã P2004/P2010
 * (hoặc mã khác tùy phiên bản) và nội dung có "Code: `23514`" -> đọc cả mã lẫn nội dung cho chắc.
 */
function checkViolation(error: Prisma.PrismaClientKnownRequestError): { message: string; constraint?: string } | null {
  const raw = `${error.message} ${JSON.stringify(error.meta ?? {})}`;
  if (!raw.includes('23514') && error.code !== 'P2004') return null;

  // Tên ràng buộc CHECK (vd "product_reviews_phone_format") để lập trình viên tra
  const constraint = raw.match(/check constraint \\?"([a-z0-9_]+)\\?"/i)?.[1];
  if (constraint) {
    // Thông báo gốc của CHECK là tiếng Anh, không có ích cho người dùng
    return { message: 'Dữ liệu vi phạm quy tắc của hệ thống', constraint };
  }
  // Trigger của mình tự viết thông báo tiếng Việt: lấy phần "Message: `...`" nếu có
  const message = raw.match(/Message: `([^`]+)`/)?.[1] ?? raw.match(/"message":"([^"]+)"/)?.[1];
  return { message: message ?? 'Dữ liệu vi phạm quy tắc của hệ thống' };
}

/**
 * Đổi lỗi của Prisma thành lỗi chuẩn của hệ thống.
 * Dùng khi vẫn có thể xảy ra trùng dữ liệu dù đã kiểm tra trước
 * (hai người tạo cùng lúc), hoặc khi database chặn bằng CHECK/trigger.
 */
export function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      // Trùng giá trị ở cột duy nhất
      case 'P2002':
        throw new AppException(ErrorCode.ALREADY_EXISTS, HttpStatus.CONFLICT, {
          fields: error.meta?.target,
        });
      // Khóa ngoại không tồn tại (khi TẠO/SỬA; khi XÓA thì P2003 nghĩa là còn dữ liệu trỏ tới,
      // nơi xóa phải tự bắt, xem ShowroomService.remove)
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

    const violation = checkViolation(error);
    if (violation) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, [
        { field: violation.constraint ?? 'database', message: violation.message },
      ]);
    }
  }
  throw error;
}