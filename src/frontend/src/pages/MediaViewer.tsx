import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage, fileUrl } from '../api/client';
import type { SubmissionFile, SubmissionView } from '../api/types';
import { Icon, type IconName } from '../components/Icon';
import { useAuth } from '../auth/auth';
import { ddmmHHmm, fmtSize, fullDT } from '../utils/format';

type Tab = 'IMAGE' | 'FIGMA' | 'VIDEO' | 'SOURCE' | 'DOCUMENT';
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'IMAGE', label: 'Ảnh', icon: 'image' },
  { key: 'FIGMA', label: 'Figma', icon: 'link' },
  { key: 'VIDEO', label: 'Video', icon: 'play' },
  { key: 'SOURCE', label: 'Mã nguồn', icon: 'code' },
  { key: 'DOCUMENT', label: 'Báo cáo', icon: 'file' },
];
const SYNC: Record<string, [string, string]> = {
  SYNCED: ['#86EFAC', 'Đã đồng bộ Google Drive'],
  PENDING: ['#FCD34D', 'Đang đồng bộ Google Drive'],
  UPLOADING: ['#FCD34D', 'Đang đồng bộ Google Drive'],
};
const darkBtn = { background: '#1B1D23', borderColor: '#2E323C', color: '#fff' };

/** Trình xem bài nộp – mẫu chung/Media_Viewer (nền tối, xem ảnh/Figma/video/mã nguồn). */
export function MediaViewer() {
  const { submissionId } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['submission-view', submissionId], queryFn: () => api.get<SubmissionView>(`/files/submission/${submissionId}`).then((r) => r.data) });
  const s = q.data;
  const { user } = useAuth();
  const of = (t: Tab) => (s?.files ?? []).filter((f) => f.fileType === t);
  const has = (t: Tab) => (t === 'FIGMA' ? !!s?.figmaUrl : t === 'SOURCE' ? of('SOURCE').length > 0 || !!s?.gitUrl : of(t).length > 0);
  const [tab, setTab] = useState<Tab>('IMAGE');
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);

  // chọn tab + ảnh theo ?i= (chỉ số trong danh sách tệp)
  useEffect(() => {
    if (!s) return;
    const start = s.files[Number(params.get('i') ?? 0)];
    const t: Tab = start ? (start.fileType as Tab) : (TABS.find((x) => has(x.key))?.key ?? 'IMAGE');
    setTab(t);
    setIdx(start && start.fileType === 'IMAGE' ? of('IMAGE').findIndex((f) => f.id === start.id) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);

  const images = of('IMAGE');
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (tab !== 'IMAGE' || !images.length) return;
      if (e.key === 'ArrowLeft') setIdx((i) => (i - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % images.length);
      if (e.key === 'Escape') nav(-1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [tab, images.length, nav]);

  const shell = (children: ReactNode) => <div style={{ minHeight: 'var(--vh)', background: '#0E0F12', color: '#fff', display: 'flex', flexDirection: 'column' }}>{children}</div>;
  if (q.isLoading)
    return shell(
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>,
    );
  if (!s)
    return shell(
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <Icon name="lock" size={30} />
        <b>{errorMessage(q.error)}</b>
        <button className="btn" type="button" style={darkBtn} onClick={() => nav(-1)}>
          Quay lại
        </button>
      </div>,
    );

  const cur: SubmissionFile | undefined = tab === 'IMAGE' ? images[idx] : tab === 'VIDEO' || tab === 'DOCUMENT' || tab === 'SOURCE' ? of(tab)[0] : undefined;
  const sync = SYNC[s.syncStatus] ?? ['#FCA5A5', 'Lỗi đồng bộ Google Drive'];
  const figmaEmbed = s.figmaUrl ? `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(s.figmaUrl)}` : null;

  return shell(
    <>
      <header style={{ minHeight: 64, display: 'flex', alignItems: 'center', gap: 16, padding: '8px 24px', borderBottom: '1px solid #23262E', flexWrap: 'wrap' }}>
        <button className="btn btn-g" type="button" aria-label="Quay lại" style={{ color: '#fff', width: 40, padding: 0 }} onClick={() => nav(-1)}>
          <Icon name="chevronLeftLg" size={20} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{s.topic?.title ?? s.assignment.title}</span>
          <span style={{ fontSize: 12, color: '#9DA2B0' }}>
            {s.owner} · {s.assignment.title}
            {s.kind === 'PERSONAL' && s.owner && s.contributionPercent != null ? ` · đóng góp ${s.contributionPercent}%` : ''}
          </span>
        </div>
        <div style={{ marginLeft: 24, display: 'flex', gap: 4, padding: 3, background: '#1B1D23', borderRadius: 9, flexWrap: 'wrap' }}>
          {TABS.filter((t) => has(t.key)).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{ height: 34, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 7, background: tab === t.key ? '#2A2F3D' : 'transparent', border: 0, font: "600 13px 'Be Vietnam Pro',sans-serif", color: tab === t.key ? '#fff' : '#B9BDC8', cursor: 'pointer' }}
            >
              <Icon name={t.icon} size={16} />
              {t.label}
              {t.key === 'IMAGE' ? ` (${images.length})` : ''}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {tab === 'IMAGE' && (
            <button className="btn btn-g" type="button" aria-label="Phóng to" style={{ color: '#fff' }} onClick={() => setZoom((z) => !z)}>
              <Icon name="zoomIn" size={18} />
            </button>
          )}
          <button className="btn btn-g" type="button" aria-label="Toàn màn hình" style={{ color: '#fff' }} onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}>
            <Icon name="fullscreen" size={18} />
          </button>
          {s.canDownload && cur && (
            <a className="btn" href={fileUrl(cur.id, true)} style={darkBtn}>
              <Icon name="download" size={16} />
              Tải xuống
            </a>
          )}
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 300 }}>
          {tab === 'IMAGE' && images.length > 0 && (
            <>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24, minHeight: 360 }}>
                <button type="button" aria-label="Ảnh trước" onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)} style={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid #2E323C', background: '#1B1D23', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <Icon name="chevronLeftLg" size={22} />
                </button>
                <div style={{ flex: 1, maxWidth: 960, height: 'calc(var(--vh) - 260px)', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: zoom ? 'auto' : 'hidden', borderRadius: 10 }}>
                  <img src={fileUrl(images[idx].id)} alt={images[idx].name} onClick={() => setZoom((z) => !z)} style={zoom ? { maxWidth: 'none', cursor: 'zoom-out' } : { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 10, cursor: 'zoom-in' }} />
                </div>
                <button type="button" aria-label="Ảnh tiếp theo" onClick={() => setIdx((i) => (i + 1) % images.length)} style={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid #2E323C', background: '#1B1D23', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <Icon name="chevronRight" size={22} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: '#B9BDC8' }}>
                <b style={{ color: '#fff' }}>
                  {idx + 1} / {images.length}
                </b>
                <span>· Phím ← → để chuyển ảnh, vuốt trên di động</span>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '16px 24px 20px', flexWrap: 'wrap' }}>
                {images.map((f, i) => (
                  <button key={f.id} type="button" aria-label={f.name} onClick={() => setIdx(i)} style={{ width: 64, height: 44, borderRadius: 6, border: `2px solid ${i === idx ? '#fff' : 'transparent'}`, background: `#1B1D23 url("${fileUrl(f.id)}") center/cover`, opacity: i === idx ? 1 : 0.5, cursor: 'pointer', padding: 0 }} />
                ))}
              </div>
            </>
          )}
          {tab === 'FIGMA' && figmaEmbed && (
            <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <iframe title="Figma" src={figmaEmbed} style={{ flex: 1, minHeight: 480, border: '1px solid #2E323C', borderRadius: 10, background: '#1B1D23' }} allowFullScreen />
            </div>
          )}
          {tab === 'VIDEO' && (
            <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center' }}>
              {of('VIDEO').map((f) => (
                <div key={f.id} style={{ width: '100%', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <video src={fileUrl(f.id)} controls preload="metadata" style={{ width: '100%', maxHeight: 'calc(var(--vh) - 220px)', borderRadius: 10, background: '#000' }} />
                  <span className="mono" style={{ fontSize: 12, color: '#9DA2B0' }}>
                    {f.name} · {fmtSize(f.size)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {(tab === 'SOURCE' || tab === 'DOCUMENT') && (
            <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tab === 'SOURCE' && s.gitUrl && (
                <a href={s.gitUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 16, border: '1px solid #2E323C', borderRadius: 10, background: '#1B1D23', color: '#fff' }}>
                  <Icon name="code" size={20} />
                  <span style={{ flex: 1 }}>{s.gitUrl}</span>
                  <Icon name="link" size={16} />
                </a>
              )}
              {of(tab).map((f) => (
                <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 16, border: '1px solid #2E323C', borderRadius: 10, background: '#1B1D23' }}>
                    <Icon name={tab === 'SOURCE' ? 'code' : 'file'} size={20} />
                    <span className="mono" style={{ flex: 1, fontSize: 13 }}>
                      {f.name}
                    </span>
                    <span style={{ fontSize: 12, color: '#9DA2B0' }}>{fmtSize(f.size)}</span>
                    {s.canDownload && (
                      <a className="btn btn-sm" href={fileUrl(f.id, true)} style={darkBtn}>
                        <Icon name="download" size={14} />
                        Tải
                      </a>
                    )}
                  </div>
                  {f.mimeType === 'application/pdf' && <iframe title={f.name} src={fileUrl(f.id)} style={{ height: 'calc(var(--vh) - 240px)', minHeight: 420, border: '1px solid #2E323C', borderRadius: 10, background: '#fff' }} />}
                </div>
              ))}
            </div>
          )}
        </div>
        <aside style={{ width: 320, maxWidth: '100%', borderLeft: '1px solid #23262E', padding: 24, display: 'flex', flexDirection: 'column', gap: 18, fontSize: 13 }}>
          {s.topic && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ color: '#9DA2B0' }}>Đề tài</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{s.topic.title}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {s.topic.keywords.map((k) => (
                  <span key={k} className="chip" style={{ background: '#1B1D23', borderColor: '#2E323C', color: '#DADDE5' }}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: '#9DA2B0' }}>Người nộp</span>
            <span>
              {s.submittedBy} · {fullDT(s.submittedAt)}
              {s.isLate ? ' · nộp muộn' : ''}
            </span>
          </div>
          {s.figmaUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ color: '#9DA2B0' }}>Link Figma</span>
              <a href={s.figmaUrl} target="_blank" rel="noreferrer" style={{ color: '#FF8A8A', wordBreak: 'break-all' }}>
                {s.figmaUrl.replace(/^https:\/\/(www\.)?/, '').slice(0, 40)}
                {s.figmaUrl.length > 48 ? '…' : ''}
              </a>
            </div>
          )}
          {s.note && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ color: '#9DA2B0' }}>Ghi chú của sinh viên</span>
              <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{s.note}</span>
            </div>
          )}
          {user?.role === 'LECTURER' ? (
            <>
              <LecturerFeedback submissionId={s.id} group={s.kind === 'GROUP_SHARED'} />
              <LecturerNote submissionId={s.id} />
            </>
          ) : (
            s.feedback?.map((f, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14, borderRadius: 10, background: 'rgba(219,0,0,.08)', border: '1px solid rgba(255,138,138,.35)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  <Icon name="edit" size={15} /> Nhận xét của giảng viên
                </span>
                <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{f.content}</span>
                <span style={{ fontSize: 12, color: '#9DA2B0' }}>
                  {f.lecturer} · {ddmmHHmm(f.updatedAt)}
                </span>
              </div>
            ))
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: '#9DA2B0' }}>Lưu trữ</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: sync[0] }}>
              <Icon name={s.syncStatus === 'SYNCED' ? 'check' : 'drive'} size={16} />
              {sync[1]}
            </span>
          </div>
        </aside>
      </div>
    </>,
  );
}

/** Nhận xét gửi sinh viên – khác ghi chú riêng: SV của bài (cả nhóm với bài chung) và phụ huynh xem được, SV nhận thông báo. */
function LecturerFeedback({ submissionId, group }: { submissionId: string; group: boolean }) {
  const q = useQuery({ queryKey: ['lecturer', 'feedback', submissionId], queryFn: () => api.get<{ content: string; updatedAt: string | null }>(`/lecturer/submissions/${submissionId}/feedback`).then((r) => r.data) });
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState<{ content: string; updatedAt: string | null }>({ content: '', updatedAt: null });
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  const loaded = useRef(false);
  useEffect(() => {
    if (!q.data || loaded.current) return;
    loaded.current = true;
    setContent(q.data.content);
    setSaved(q.data);
  }, [q.data]);
  const dirty = content.trim() !== saved.content;
  const send = async () => {
    setState('saving');
    try {
      const r = await api.put<{ content: string; updatedAt: string | null }>(`/lecturer/submissions/${submissionId}/feedback`, { content: content.trim() });
      setSaved(r.data);
      setContent(r.data.content);
      setState('idle');
    } catch {
      setState('error');
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 10, background: 'rgba(219,0,0,.08)', border: '1px solid rgba(255,138,138,.35)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="edit" size={16} />
        <span style={{ fontWeight: 600, flex: 1 }}>Nhận xét gửi sinh viên</span>
      </div>
      <textarea
        value={content}
        maxLength={2000}
        rows={4}
        disabled={q.isLoading}
        placeholder="VD: Bố cục rõ ràng, nên tăng độ tương phản màu chữ ở trang chủ…"
        onChange={(e) => setContent(e.target.value)}
        style={{ width: '100%', resize: 'vertical', borderRadius: 8, border: '1px solid #3A3F4B', background: '#121418', color: '#F1F2F5', padding: '10px 12px', font: "400 13px/1.55 'Be Vietnam Pro',sans-serif", outline: 'none' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: state === 'error' ? '#FF8A8A' : '#9DA2B0', flex: 1 }}>
          {state === 'error' ? 'Không gửi được, thử lại' : saved.updatedAt ? `Đã gửi ${ddmmHHmm(saved.updatedAt)}` : group ? 'Cả nhóm và phụ huynh sẽ thấy, nhóm nhận thông báo' : 'Sinh viên và phụ huynh sẽ thấy, sinh viên nhận thông báo'}
        </span>
        <button
          type="button"
          disabled={!dirty || state === 'saving'}
          onClick={send}
          style={{ height: 32, padding: '0 14px', borderRadius: 8, border: 0, cursor: dirty ? 'pointer' : 'not-allowed', font: "600 13px 'Be Vietnam Pro',sans-serif", background: dirty ? '#DB0000' : '#3A3F4B', color: '#fff' }}
        >
          {state === 'saving' ? 'Đang gửi…' : !content.trim() && saved.content ? 'Xóa nhận xét' : saved.content ? 'Cập nhật' : 'Gửi nhận xét'}
        </button>
      </div>
    </div>
  );
}

/** Ghi chú riêng của giảng viên trên bài nộp – chỉ GV viết thấy, tự lưu khi ngừng gõ. */
function LecturerNote({ submissionId }: { submissionId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['lecturer', 'note', submissionId], queryFn: () => api.get<{ content: string; isSample: boolean; updatedAt: string | null }>(`/lecturer/submissions/${submissionId}/note`).then((r) => r.data) });
  const [content, setContent] = useState('');
  const [isSample, setIsSample] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!q.data || loaded.current) return;
    loaded.current = true;
    setContent(q.data.content);
    setIsSample(q.data.isSample);
    setSavedAt(q.data.updatedAt);
  }, [q.data]);

  const save = async (c: string, sample: boolean) => {
    setState('saving');
    try {
      const r = await api.put<{ updatedAt: string | null }>(`/lecturer/submissions/${submissionId}/note`, { content: c, isSample: sample });
      setSavedAt(r.data.updatedAt);
      setState('saved');
      qc.invalidateQueries({ queryKey: ['lecturer', 'assignment'] });
      qc.invalidateQueries({ queryKey: ['lecturer', 'search'] });
    } catch {
      setState('error');
    }
  };
  const schedule = (c: string, sample: boolean, delay = 800) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(c, sample), delay);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 10, background: '#1B1D23', border: '1px solid #2E323C' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="note" size={16} />
        <span style={{ fontWeight: 600, flex: 1 }}>Ghi chú của tôi</span>
        <button
          type="button"
          aria-pressed={isSample}
          title="Đánh dấu bài mẫu để tìm lại cho khóa sau"
          onClick={() => {
            setIsSample(!isSample);
            schedule(content, !isSample, 0);
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 999, cursor: 'pointer', font: "600 12px 'Be Vietnam Pro',sans-serif", border: `1px solid ${isSample ? '#F59E0B' : '#3A3F4B'}`, background: isSample ? 'rgba(245,158,11,.15)' : 'transparent', color: isSample ? '#FCD34D' : '#9DA2B0' }}
        >
          <Icon name="star" size={14} />
          Bài mẫu
        </button>
      </div>
      <textarea
        value={content}
        maxLength={2000}
        rows={5}
        disabled={q.isLoading}
        placeholder="VD: Thiết kế đẹp nhưng chưa đáp ứng yêu cầu responsive…"
        onChange={(e) => {
          setContent(e.target.value);
          schedule(e.target.value, isSample);
        }}
        style={{ width: '100%', resize: 'vertical', borderRadius: 8, border: '1px solid #3A3F4B', background: '#121418', color: '#F1F2F5', padding: '10px 12px', font: "400 13px/1.55 'Be Vietnam Pro',sans-serif", outline: 'none' }}
      />
      <span style={{ fontSize: 12, color: state === 'error' ? '#FF8A8A' : '#9DA2B0' }}>
        {state === 'saving' ? 'Đang lưu…' : state === 'error' ? 'Không lưu được, thử lại' : savedAt ? `Đã lưu ${ddmmHHmm(savedAt)} · chỉ bạn thấy` : 'Chỉ bạn thấy ghi chú này'}
      </span>
    </div>
  );
}
