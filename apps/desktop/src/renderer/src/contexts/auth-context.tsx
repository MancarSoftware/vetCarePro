import { ApiError, apiRequest, type ApiRequestOptions } from '@/lib/api';
import type {
  AuthResponse,
  AuthUser,
  InitializeInput,
  LoginInput,
} from '@/types/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type AuthStatus =
  | 'loading'
  | 'setup-required'
  | 'unauthenticated'
  | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (input: LoginInput) => Promise<void>;
  initialize: (input: InitializeInput) => Promise<void>;
  logout: () => Promise<void>;
  request: <T>(path: string, options?: ApiRequestOptions) => Promise<T>;
}

interface SetupStatus {
  setupRequired: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getDeviceName(): string {
  const platform =
    window.vetcare.platform === 'win32' ? 'Windows' : window.vetcare.platform;
  return `VetCare Pro Desktop · ${platform}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string> | null>(null);

  const applyAuthResponse = useCallback(async (response: AuthResponse) => {
    await window.vetcare.auth.setRefreshToken(response.refreshToken);
    accessTokenRef.current = response.accessToken;
    setUser(response.user);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(async () => {
    accessTokenRef.current = null;
    setUser(null);
    await window.vetcare.auth.clearRefreshToken();
    setStatus('unauthenticated');
  }, []);

  const refreshSession = useCallback(async (): Promise<string> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
      const refreshToken = await window.vetcare.auth.getRefreshToken();
      if (!refreshToken) {
        throw new ApiError('No hay una sesión guardada', 401);
      }

      const response = await apiRequest<AuthResponse>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      });
      await window.vetcare.auth.setRefreshToken(response.refreshToken);
      accessTokenRef.current = response.accessToken;
      setUser(response.user);
      setStatus('authenticated');
      return response.accessToken;
    })();

    try {
      return await refreshPromiseRef.current;
    } finally {
      refreshPromiseRef.current = null;
    }
  }, []);

  const request = useCallback(
    async <T,>(
      path: string,
      options: ApiRequestOptions = {},
    ): Promise<T> => {
      try {
        return await apiRequest<T>(path, {
          ...options,
          accessToken: accessTokenRef.current,
        });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          throw error;
        }

        try {
          const accessToken = await refreshSession();
          return await apiRequest<T>(path, {
            ...options,
            accessToken,
          });
        } catch (refreshError) {
          await clearSession();
          throw refreshError;
        }
      }
    },
    [clearSession, refreshSession],
  );

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: {
          ...input,
          deviceName: getDeviceName(),
        },
      });
      await applyAuthResponse(response);
    },
    [applyAuthResponse],
  );

  const initialize = useCallback(
    async (input: InitializeInput) => {
      const response = await apiRequest<AuthResponse>('/auth/initialize', {
        method: 'POST',
        body: {
          ...input,
          deviceName: getDeviceName(),
        },
      });
      await applyAuthResponse(response);
    },
    [applyAuthResponse],
  );

  const logout = useCallback(async () => {
    const refreshToken = await window.vetcare.auth.getRefreshToken();
    if (refreshToken) {
      try {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: { refreshToken },
        });
      } catch {
        // The local token is still cleared if the API is unavailable.
      }
    }
    await clearSession();
  }, [clearSession]);

  useEffect(() => {
    let active = true;

    const restore = async () => {
      try {
        const setup = await apiRequest<SetupStatus>('/auth/setup-status');
        if (!active) return;
        if (setup.setupRequired) {
          setStatus('setup-required');
          return;
        }

        await refreshSession();
      } catch {
        if (!active) return;
        await window.vetcare.auth.clearRefreshToken();
        setStatus('unauthenticated');
      }
    };

    void restore();
    return () => {
      active = false;
    };
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, initialize, logout, request }),
    [status, user, login, initialize, logout, request],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  }
  return context;
}

