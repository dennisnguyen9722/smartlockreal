'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Permission } from '@ktm/shared';
import { ApiError, apiRequest, type LoginResponse, type StaffProfile } from '@/lib/api';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: Status;
  staff: StaffProfile | null;
  accessToken: string | null;
  can: (permission: Permission) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Gọi API kèm token, tự làm mới token khi hết hạn */
  authFetch: <T>(path: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Giữ bản mới nhất để dùng trong hàm không phụ thuộc state
  const tokenRef = useRef<string | null>(null);
  // Đảm bảo nhiều request hết hạn cùng lúc chỉ gọi refresh MỘT lần
  const refreshingRef = useRef<Promise<string | null> | null>(null);

  const applySession = useCallback((data: LoginResponse) => {
    tokenRef.current = data.accessToken;
    setAccessToken(data.accessToken);
    setStaff(data.staff);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    tokenRef.current = null;
    setAccessToken(null);
    setStaff(null);
    setStatus('unauthenticated');
  }, []);

  const refresh = useCallback(async (): Promise<string | null> => {
    if (refreshingRef.current) return refreshingRef.current;

    refreshingRef.current = (async () => {
      try {
        const data = await apiRequest<LoginResponse>('/auth/refresh', { method: 'POST' });
        applySession(data);
        return data.accessToken;
      } catch {
        clearSession();
        return null;
      } finally {
        refreshingRef.current = null;
      }
    })();

    return refreshingRef.current;
  }, [applySession, clearSession]);

  // Khôi phục phiên khi tải trang (cookie HttpOnly vẫn còn)
  useEffect(() => {
    void (async () => {
      const token = await refresh();
      if (!token) return;
      try {
        const profile = await apiRequest<StaffProfile>('/auth/me', { accessToken: token });
        setStaff(profile);
      } catch {
        clearSession();
      }
    })();
  }, [refresh, clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      applySession(data);
      const profile = await apiRequest<StaffProfile>('/auth/me', { accessToken: data.accessToken });
      setStaff(profile);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const authFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      try {
        return await apiRequest<T>(path, { ...options, accessToken: tokenRef.current ?? undefined });
      } catch (error) {
        const expired = error instanceof ApiError && error.code === 'TOKEN_EXPIRED';
        if (!expired) throw error;

        const token = await refresh();
        if (!token) throw error;
        return apiRequest<T>(path, { ...options, accessToken: token });
      }
    },
    [refresh],
  );

  const can = useCallback(
    (permission: Permission) => staff?.permissions?.includes(permission) ?? false,
    [staff],
  );

  return (
    <AuthContext.Provider value={{ status, staff, accessToken, can, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải dùng bên trong AuthProvider');
  return context;
}
