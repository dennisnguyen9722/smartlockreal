import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import {
  CustomerContactSchema,
  CustomerContactUpdateSchema,
  CustomerCreateSchema,
  CustomerListQuerySchema,
  CustomerUpdateSchema,
  ErrorCode,
  Permission,
} from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../common/types/express';
import { CustomerService } from './customer.service';

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

@Controller('customers')
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  @Get()
  @RequirePermissions(Permission.CUSTOMER_VIEW)
  list(@Query() query: unknown, @CurrentUser() user: AuthUser) {
    return this.customers.list(parse(CustomerListQuerySchema, query), user.id);
  }

  /** Đặt TRƯỚC ':id' để không bị hiểu là một mã khách */
  @Get('groups')
  @RequirePermissions(Permission.CUSTOMER_VIEW)
  groups() {
    return this.customers.groups();
  }

  @Get(':id')
  @RequirePermissions(Permission.CUSTOMER_VIEW)
  getById(@Param('id') id: string) {
    return this.customers.getById(parse(IdSchema, id));
  }

  @Post()
  @RequirePermissions(Permission.CUSTOMER_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.customers.create(parse(CustomerCreateSchema, body), user.id, auditContext(req));
  }

  @Patch(':id')
  @RequirePermissions(Permission.CUSTOMER_MANAGE)
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.customers.update(parse(IdSchema, id), parse(CustomerUpdateSchema, body), user.id, auditContext(req));
  }

  @Post(':id/contacts')
  @RequirePermissions(Permission.CUSTOMER_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  addContact(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.customers.addContact(parse(IdSchema, id), parse(CustomerContactSchema, body), user.id, auditContext(req));
  }

  @Patch('contacts/:contactId')
  @RequirePermissions(Permission.CUSTOMER_MANAGE)
  updateContact(
    @Param('contactId') contactId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.customers.updateContact(
      parse(IdSchema, contactId),
      parse(CustomerContactUpdateSchema, body),
      user.id,
      auditContext(req),
    );
  }

  @Delete('contacts/:contactId')
  @RequirePermissions(Permission.CUSTOMER_MANAGE)
  removeContact(@Param('contactId') contactId: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.customers.removeContact(parse(IdSchema, contactId), user.id, auditContext(req));
  }
}