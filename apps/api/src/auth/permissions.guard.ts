import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ErrorCode, type Permission, roleHasPermission } from '@ktm/shared';
import { AppException } from '../common/errors/app.exception';
import { PERMISSIONS_KEY } from './auth.decorators';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const staff = context.switchToHttp().getRequest<Request>().staff;
    if (!staff) {
      throw new AppException(ErrorCode.UNAUTHENTICATED, HttpStatus.UNAUTHORIZED);
    }

    const missing = required.filter((permission) => !roleHasPermission(staff.role, permission));
    if (missing.length > 0) {
      throw new AppException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, { required: missing });
    }
    return true;
  }
}
