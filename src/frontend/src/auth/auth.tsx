import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router';
import { api } from '../api/client';
import type { AuthUser, Role } from '../api/types';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<unknown>;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () =>
      api
        .get<{ user: AuthUser | null }>('/auth/me')
        .then((r) => r.data.user)
        .catch(() => null),
    staleTime: Infinity,
  });
  const logout = async () => {
    await api.post('/auth/logout').catch(() => undefined);
    qc.clear();
    location.href = '/login';
  };
  return <AuthContext.Provider value={{ user: me.data ?? null, loading: me.isLoading, logout, refresh: me.refetch }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const homeOf = (role?: Role) => (role === 'LECTURER' ? '/lecturer' : role === 'STUDENT' ? '/student' : role === 'ADMIN' ? '/admin' : role === 'PARENT' ? '/parent' : role === 'ENTERPRISE' ? '/enterprise' : '/login');

export function FullscreenLoading() {
  return (
    <div style={{ minHeight: 'var(--vh)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DB0000' }}>
      <span className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  );
}

/** Chặn route theo vai trò (RequireAuth + RequireRole – ModulesStructure §5.1). */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullscreenLoading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  // FR-01.03: tài khoản do hệ thống cấp phải đổi mật khẩu lần đầu
  if (user.mcp) return <Navigate to="/change-password" replace />;
  if (user.role !== role) return <Navigate to={homeOf(user.role)} replace />;
  // SV chưa khai báo hồ sơ chỉ dùng được trang hồ sơ (FR-03.01)
  if (user.role === 'STUDENT' && user.profileCompleted === false && loc.pathname !== '/student/profile') return <Navigate to="/student/profile" replace />;
  return <>{children}</>;
}
