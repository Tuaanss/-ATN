/** Ngày giờ kiểu Việt Nam theo giờ Hà Nội: "dd/mm/yyyy" hoặc "dd/mm/yyyy HH:mm". */
export function vnDate(v: Date | string, withTime = false): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(v));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const date = `${p.day}/${p.month}/${p.year}`;
  return withTime ? `${date} ${p.hour}:${p.minute}` : date;
}
