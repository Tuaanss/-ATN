import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Card, Empty, Loading, Note, PageHead, Stat, Switch, useToast } from '../../components/ui';
import { fullDate, fullDT } from '../../utils/format';

interface Privacy {
  discoverable: boolean;
  views30d: number;
  activeGrants: { enterprise: string; grantedAt: string; daysLeft: number }[];
  accessLog: { enterprise: string; submission: string; at: string }[];
}

/** Doanh nghiệp & quyền riêng tư – mẫu sinh-vien/SV_Privacy (UC03.4, UC09.11). */
export function PrivacyPage() {
  useCrumbs([{ label: 'Doanh nghiệp & quyền riêng tư' }]);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['student', 'privacy'], queryFn: () => api.get<Privacy>('/student/privacy').then((r) => r.data) });
  const set = useMutation({
    mutationFn: (v: boolean) => api.patch<Privacy>('/student/privacy', { discoverable: v }).then((r) => r.data),
    onSuccess: (d) => {
      qc.setQueryData(['student', 'privacy'], d);
      qc.invalidateQueries({ queryKey: ['student', 'profile'] });
      toast.ok(d.discoverable ? 'Doanh nghiệp đã có thể tìm thấy bạn' : 'Đã ẩn hồ sơ khỏi kết quả tìm kiếm của doanh nghiệp');
    },
    onError: (e) => toast.err(errorMessage(e)),
  });
  if (q.isLoading || !q.data) return <Loading />;
  const d = q.data;
  return (
    <div className="page">
      <PageHead title="Doanh nghiệp & quyền riêng tư" sub="Theo dõi doanh nghiệp tìm thấy và xem bài của bạn" />
      <div className="cols-2-1">
        <div className="col">
          <div className="cols-1-1" style={{ gap: 16 }}>
            <Stat tone="blue" icon="building" label="Doanh nghiệp đã xem hồ sơ" value={d.views30d} sub="30 ngày gần nhất" />
            <Stat tone="green" icon="eye" label="Đang có quyền xem bài" value={d.activeGrants.length} sub="Quyền tự thu hồi khi hết hạn" />
          </div>
          <Card title="Doanh nghiệp đang có quyền xem" body={false}>
            {d.activeGrants.length ? (
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Doanh nghiệp</th>
                      <th>Cấp ngày</th>
                      <th>Còn lại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.activeGrants.map((g, i) => (
                      <tr key={i}>
                        <td>{g.enterprise}</td>
                        <td>{fullDate(g.grantedAt)}</td>
                        <td>{g.daysLeft} ngày</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="building">Chưa có doanh nghiệp nào được cấp quyền xem bài của bạn.</Empty>
            )}
          </Card>
          <Card title="Nhật ký truy cập bài của bạn" body={false}>
            {d.accessLog.length ? (
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ai xem</th>
                      <th>Bài</th>
                      <th>Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.accessLog.map((l, i) => (
                      <tr key={i}>
                        <td>{l.enterprise}</td>
                        <td>{l.submission}</td>
                        <td>{fullDT(l.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="eye">Chưa có lượt xem nào.</Empty>
            )}
          </Card>
        </div>
        <div className="col">
          <Card title="Cho phép doanh nghiệp tìm thấy tôi" extra={<Switch checked={d.discoverable} disabled={set.isPending} onChange={(v) => set.mutate(v)} label="Cho phép doanh nghiệp tìm thấy tôi" />}>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: '#4A4E57' }}>
              Doanh nghiệp chỉ thấy họ tên, khóa, ngành, điểm TB bài tập và đề tài đã nộp — không thấy SĐT, email, thông tin phụ huynh hay điểm từng bài.
            </p>
          </Card>
          <Note tone="gray" icon="shield">
            Doanh nghiệp xem bài khi được Quản trị viên duyệt yêu cầu (14–28 ngày), bạn không cần phê duyệt. Muốn không bị doanh nghiệp tìm thấy, hãy tắt công tắc ở trên. Quyền xem đã cấp vẫn còn đến hết hạn.
          </Note>
        </div>
      </div>
    </div>
  );
}
