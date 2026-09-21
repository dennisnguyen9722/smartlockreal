import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import {
  CustomerLookupQuerySchema,
  ErrorCode,
  OrderCreateSchema,
  OrderLineSerialsSchema,
  OrderLinesReplaceSchema,
  OrderListQuerySchema,
  OrderStatusChangeSchema,
  OrderUpdateSchema,
  PaymentCancelSchema,
  PaymentRecordSchema,
  Permission,
  roleHasPermission,
} from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../common/types/express';
import { OrderWorkflowService } from './order-workflow.service';
import { OrderService } from './order.service';

const IdSchema = z.uuid('ID không hợp lệ');

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppException(
      ErrorCode.VALIDATION_FAILED,
      HttpStatus.BAD_REQUEST,
      result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}

function auditContext(req: Request) {
  return {
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
    traceId: req.get('x-request-id') ?? undefined,
  };
}

@Controller('orders')
export class OrderController {
  constructor(
    private readonly orders: OrderService,
    private readonly workflow: OrderWorkflowService,
  ) {}

  @Get()
  @RequirePermissions(Permission.ORDER_VIEW)
  list(@Query() query: unknown, @CurrentUser() user: AuthUser) {
    return this.orders.list(parse(OrderListQuerySchema, query), user.id);
  }

  /** Nhân viên tạo đơn (khách nhắn Zalo, mua tại showroom) */
  @Post()
  @RequirePermissions(Permission.ORDER_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.orders.create(parse(OrderCreateSchema, body), user.id, auditContext(req));
  }

  /** Danh sách nhân viên có thể phụ trách đơn (đặt TRƯỚC ':id' để không bị hiểu là một mã đơn) */
  @Get('assignees')
  @RequirePermissions(Permission.ORDER_VIEW)
  assignees() {
    return this.workflow.assignees();
  }

  /** Form tạo đơn: gõ số điện thoại để nhận ra khách cũ (null = khách mới) */
  @Get('customer-lookup')
  @RequirePermissions(Permission.ORDER_MANAGE)
  customerLookup(@Query() query: unknown) {
    return this.orders.customerLookup(parse(CustomerLookupQuerySchema, query).phone);
  }

  /** Showroom khách có thể đến nhận hàng */
  @Get('pickup-locations')
  @RequirePermissions(Permission.ORDER_VIEW)
  pickupLocations() {
    return this.orders.pickupLocations();
  }

  @Get(':id')
  @RequirePermissions(Permission.ORDER_VIEW)
  getById(@Param('id') id: string) {
    return this.workflow.getById(parse(IdSchema, id));
  }

  @Patch(':id')
  @RequirePermissions(Permission.ORDER_MANAGE)
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.workflow.update(parse(IdSchema, id), parse(OrderUpdateSchema, body), user.id, auditContext(req));
  }

  /** Thay toàn bộ sản phẩm trong đơn (chỉ trước bước Đã đặt hãng) */
  @Put(':id/lines')
  @RequirePermissions(Permission.ORDER_MANAGE)
  replaceLines(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.workflow.replaceLines(parse(IdSchema, id), parse(OrderLinesReplaceSchema, body), user.id, auditContext(req));
  }

  @Post(':id/status')
  @RequirePermissions(Permission.ORDER_MANAGE)
  @HttpCode(HttpStatus.OK)
  changeStatus(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const input = parse(OrderStatusChangeSchema, body);
    // Hủy đơn cần quyền riêng (order.cancel)
    if (input.to === 'CANCELLED' && !roleHasPermission(user.role, Permission.ORDER_CANCEL)) {
      throw new AppException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, { hint: 'Bạn không có quyền hủy đơn' });
    }
    return this.workflow.changeStatus(parse(IdSchema, id), input, user.id, auditContext(req));
  }

  @Post(':id/payments')
  @RequirePermissions(Permission.PAYMENT_RECORD)
  @HttpCode(HttpStatus.CREATED)
  recordPayment(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.workflow.recordPayment(parse(IdSchema, id), parse(PaymentRecordSchema, body), user.id, auditContext(req));
  }

  @Post('payments/:paymentId/cancel')
  @RequirePermissions(Permission.PAYMENT_RECORD)
  @HttpCode(HttpStatus.OK)
  cancelPayment(
    @Param('paymentId') paymentId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.workflow.cancelPayment(parse(IdSchema, paymentId), parse(PaymentCancelSchema, body), user.id, auditContext(req));
  }

  @Patch('lines/:lineId/serials')
  @RequirePermissions(Permission.ORDER_MANAGE)
  updateSerials(
    @Param('lineId') lineId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.workflow.updateSerials(parse(IdSchema, lineId), parse(OrderLineSerialsSchema, body), user.id, auditContext(req));
  }
}