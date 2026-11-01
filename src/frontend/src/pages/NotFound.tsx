import { Link } from 'react-router';
import { useAuth, homeOf } from '../auth/auth';
import { Icon } from '../components/Icon';

/** Trang lỗi – mẫu chung/Shared_ErrorForbidden (dùng cho 404 và 403). */
export function NotFound({ code = 404 }: { code?: 403 | 404 }) {
  const { user } = useAuth();
  return (
    <div className="page" style={{ minHeight: 'var(--vh)', background: '#F5F5F5' }}>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
        <section className="card" style={{ width: 560, maxWidth: '100%', padding: 36, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
          <span style={{ width: 64, height: 64, borderRadius: 16, background: '#FCE8E6', color: '#B42318', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={code === 403 ? 'lock' : 'search'} size={30} />
          </span>
          <span className="badge b-gray mono">{code}</span>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{code === 403 ? 'Bạn không có quyền xem trang này' : 'Không tìm thấy trang'}</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#4A4E57' }}>
            {code === 403 ? 'Nếu bạn cho rằng đây là nhầm lẫn, hãy liên hệ quản trị viên.' : 'Đường dẫn không tồn tại hoặc đã bị xóa. Kiểm tra lại địa chỉ hoặc quay về trang chủ.'}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link className="btn btn-p" to={user ? homeOf(user.role) : '/login'}>
              Về trang chủ
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
