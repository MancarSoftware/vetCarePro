import {
  ApiError,
  apiBlobRequest,
  apiRequest,
  type ApiRequestOptions,
} from '@/lib/api';
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
  requestBlob: (path: string, options?: ApiRequestOptions) => Promise<Blob>;
}

interface SetupStatus {
  setupRequired: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const browserBridge: Window['vetcare'] = {
  platform: 'win32',
  versions: {
    electron: 'browser-preview',
    chrome: 'browser-preview',
  },
  auth: {
    getRefreshToken: async () =>
      window.sessionStorage.getItem('vetcare.refreshToken'),
    setRefreshToken: async (refreshToken) => {
      window.sessionStorage.setItem('vetcare.refreshToken', refreshToken);
      return true;
    },
    clearRefreshToken: async () => {
      window.sessionStorage.removeItem('vetcare.refreshToken');
      return true;
    },
  },
};

function getDesktopBridge(): Window['vetcare'] {
  return window.vetcare ?? browserBridge;
}

function getDeviceName(): string {
  const bridge = getDesktopBridge();
  const platform =
    bridge.platform === 'win32' ? 'Windows' : bridge.platform;
  return `VetCare Pro Desktop · ${platform}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string> | null>(null);

  const applyAuthResponse = useCallback(async (response: AuthResponse) => {
    await getDesktopBridge().auth.setRefreshToken(response.refreshToken);
    accessTokenRef.current = response.accessToken;
    setUser(response.user);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(async () => {
    accessTokenRef.current = null;
    setUser(null);
    await getDesktopBridge().auth.clearRefreshToken();
    setStatus('unauthenticated');
  }, []);

  const refreshSession = useCallback(async (): Promise<string> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
      const refreshToken = await getDesktopBridge().auth.getRefreshToken();
      if (!refreshToken) {
        throw new ApiError('No hay una sesión guardada', 401);
      }

      const response = await apiRequest<AuthResponse>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      });
      await getDesktopBridge().auth.setRefreshToken(response.refreshToken);
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

  const requestBlob = useCallback(
    async (
      path: string,
      options: ApiRequestOptions = {},
    ): Promise<Blob> => {
      try {
        return await apiBlobRequest(path, {
          ...options,
          accessToken: accessTokenRef.current,
        });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          throw error;
        }

        try {
          const accessToken = await refreshSession();
          return await apiBlobRequest(path, {
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
    const refreshToken = await getDesktopBridge().auth.getRefreshToken();
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
        await getDesktopBridge().auth.clearRefreshToken();
        setStatus('unauthenticated');
      }
    };

    void restore();
    return () => {
      active = false;
    };
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login,
      initialize,
      logout,
      request,
      requestBlob,
    }),
    [status, user, login, initialize, logout, request, requestBlob],
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
