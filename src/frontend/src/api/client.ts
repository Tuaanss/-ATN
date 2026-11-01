import axios, { AxiosError } from 'axios';

/** Gọi API cùng origin (/api/v1); cookie httpOnly được gửi kèm tự động. */
export const api = axios.create({ baseURL: '/api/v1', withCredentials: true });

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<ApiError>) => {
    if (err.response?.status === 401 && !location.pathname.startsWith('/login')) {
      location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
    }
    if (err.response?.data?.code === 'AUTH_MUST_CHANGE_PASSWORD' && location.pathname !== '/change-password') location.href = '/change-password';
    return Promise.reject(err);
  },
);

/** Lấy thông điệp tiếng Việt từ lỗi API (Specification §7). */
export function errorMessage(err: unknown): string {
  const e = err as AxiosError<ApiError>;
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.code === 'ERR_NETWORK') return 'Không kết nối được máy chủ';
  return 'Có lỗi xảy ra, vui lòng thử lại';
}

export const fileUrl = (id: string, download = false) => `/api/v1/files/${id}/content${download ? '?download=1' : ''}`;
