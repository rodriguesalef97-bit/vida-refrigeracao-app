export function calculateDuration(startTime?: string | null, endTime?: string | null): number | null {
  if (!startTime || !endTime) return null;
  const re = /^(\d{2}):(\d{2})$/;
  const s = re.exec(startTime);
  const e = re.exec(endTime);
  if (!s || !e) return null;
  const startMin = parseInt(s[1], 10) * 60 + parseInt(s[2], 10);
  const endMin = parseInt(e[1], 10) * 60 + parseInt(e[2], 10);
  const diff = endMin - startMin;
  return diff > 0 ? diff : null;
}

export function formatDuration(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 hora" : `${h} horas`;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export function getDurationLabel(startTime?: string | null, endTime?: string | null): string | null {
  return formatDuration(calculateDuration(startTime, endTime));
}
