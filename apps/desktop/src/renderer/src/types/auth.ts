export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: AuthUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface InitializeInput extends LoginInput {
  firstName: string;
  lastName: string;
}

