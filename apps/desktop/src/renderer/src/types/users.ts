export interface UserRole {
  code: string;
  name: string;
}

export interface SystemUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  lastLoginAt: string | null;
  createdAt: string;
  roles: Array<{ role: UserRole }>;
}

export interface SystemRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: Array<{
    permission: {
      code: string;
      description: string | null;
    };
  }>;
}

