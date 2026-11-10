import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/auth';
import { Icon } from '../../components/Icon';
import { Note, initials } from '../../components/ui';
import { FullscreenLoading } from '../../auth/auth';
import { saveChild, useParent } from './child';

/** Danh sách sinh viên có liên kết với điện thoại*/
export function ChooseChild() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const q = useParent();
  if (!q.data) return <FullscreenLoading />;
  const { phone, children } = q.data;
  const open = (id: string) => {
    saveChild(id);
    nav(`/parent?child=${id}`);
  };
  return (
    <div style={{ minHeight: 'var(--vh)', background: '#F5F5F5' }}>
      <header style={{ height: 64, display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px', background: '#fff', borderBottom: '1px solid #E3E1D9' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: '#DB0000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Icon name="logo" size={18} strokeWidth={2} />
          </span>
          <b style={{ fontSize: 17 }}>FrameUp</b>
        </span>
        <span className="muted" style={{ fontSize: 13 }}>
          Đăng nhập: <b className="mono">{phone}</b>
        </span>
        <button className="btn btn-g btn-sm" onClick={logout}>
          <Icon name="logout" size={16} /> Đăng xuất
        </button>
      </header>
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '40px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'center', alignItems: 'center' }}>
          <h1 className="h1">Danh sách sinh viên có liên kết với số điện thoại</h1>
          <p className="muted" style={{ maxWidth: 520, lineHeight: 1.6 }}> 

            Số điện thoại của bạn đang liên kết với {children.length > 1 ? `${children.length} sinh viên` : 'một sinh viên'}
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20 }}>
          {children.map((k) => (
            <button
              key={k.id}
              type="button"
              className="card"
              onClick={() => open(k.id)}
              style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {k.hasAvatar ? (
                    <img src={`/api/v1/account/avatar/${k.id}`} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <span className="av" style={{ width: 52, height: 52, fontSize: 18 }}>
                      {initials(k.fullName)}
                    </span>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <b style={{ fontSize: 17 }}>{k.fullName}</b>
                    <span className="mono muted" style={{ fontSize: 13 }}>
                      {k.studentCode}
                    </span>
                  </div>
                </div>
              </div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
                {k.major ?? '—'} · Lớp <span className="mono">{k.adminClass ?? '—'}</span> · Khóa {k.cohort ?? '—'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, padding: '12px 0', borderTop: '1px solid #EFEDE6', borderBottom: '1px solid #EFEDE6' }}>
                {[
                  ['Điểm TB bài tập', k.avgScore != null ? k.avgScore.toFixed(1).replace('.', ',') : '—'],
                  ['Bài có điểm', k.gradedAssignments],
                  ['Thông báo mới', k.unread],
                ].map(([l, v]) => (
                  <div key={String(l)} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {l}
                    </span>
                    <b style={{ fontSize: 20 }}>{v}</b>
                  </div>
                ))}
              </div>
              {k.warnings ? (
                <Note tone="red" icon="warn">
                  <b>{k.warnings} cảnh báo học tập</b> chưa xem
                </Note>
              ) : (
                <Note tone="green" icon="check">
                  Không có cảnh báo học tập
                </Note>
              )}
              <span className="btn btn-p" style={{ alignSelf: 'stretch' }}>
                Xem kết quả của {k.fullName} <Icon name="chevronRight" size={16} />
              </span>
            </button>
          ))}
        </div>
        {!children.length && <Note tone="amber" icon="warn">Tài khoản chưa liên kết với sinh viên nào.</Note>}
        <p className="muted" style={{ fontSize: 13, textAlign: 'center' }}>
          
        </p>
      </main>
    </div>
  );
}
