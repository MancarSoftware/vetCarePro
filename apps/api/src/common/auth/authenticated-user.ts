export interface AuthenticatedUser {
  id: string;
  sessionId: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  type: 'access';
  iat?: number;
  exp?: number;
}

