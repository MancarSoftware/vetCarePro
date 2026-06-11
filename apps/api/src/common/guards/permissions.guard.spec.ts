import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  it('allows a user who has every required permission', () => {
    const guard = new PermissionsGuard(
      createReflector(['users.read', 'users.manage']),
    );
    const context = createContext(['users.read', 'users.manage']);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a user who lacks a required permission', () => {
    const guard = new PermissionsGuard(createReflector(['users.manage']));
    const context = createContext(['users.read']);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

function createReflector(required: string[]): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  } as unknown as Reflector;
}

function createContext(permissions: string[]): ExecutionContext {
  const request = {
    user: {
      id: 'user-id',
      sessionId: 'session-id',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@vetcare.local',
      roles: ['ADMIN'],
      permissions,
    },
  } as AuthenticatedRequest;

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => createContext,
    getClass: () => PermissionsGuard,
  } as unknown as ExecutionContext;
}

