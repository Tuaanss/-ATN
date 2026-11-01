import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { api } from '../../api/client';

export interface Child {
  id: string;
  studentCode: string;
  fullName: string;
  relation: 'FATHER' | 'MOTHER' | 'GUARDIAN';
  relationLabel: string;
  hasAvatar: boolean;
  adminClass: string | null;
  major: string | null;
  cohort: string | null;
  cpa: number | null;
  credits: number;
  rank: string | null;
  unread: number;
  warnings: number;
}
export interface ParentInfo {
  phone: string;
  fullName: string | null;
  children: Child[];
}

const KEY = 'ph-child';
export const savedChild = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const saveChild = (id: string) => {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* trình duyệt chặn lưu trữ */
  }
};

export function useParent() {
  return useQuery({ queryKey: ['parent', 'children'], queryFn: () => api.get<ParentInfo>('/parent/children').then((r) => r.data), staleTime: 30_000 });
}

/** Con đang xem: ?child= trên URL → con đã chọn lần trước → con đầu tiên. */
export function useChild() {
  const q = useParent();
  const [params, setParams] = useSearchParams();
  const kids = q.data?.children ?? [];
  const want = params.get('child') ?? savedChild();
  const child = kids.find((k) => k.id === want) ?? kids[0] ?? null;
  const select = (id: string) => {
    saveChild(id);
    const p = new URLSearchParams(params);
    p.set('child', id);
    setParams(p, { replace: true });
  };
  return { info: q.data, kids, child, select, loading: q.isLoading };
}

export const shortName = (n: string) => n.split(/\s+/).slice(-2).join(' ');
