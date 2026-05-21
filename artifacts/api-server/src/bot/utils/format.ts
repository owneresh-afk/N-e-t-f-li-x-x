export function line(char = "━", length = 24): string {
  return char.repeat(length);
}

export function box(title: string, lines: string[]): string {
  const body = lines.map((l) => `│  ${l}`).join("\n");
  return `╭━━〔 ${title} 〕━━╮\n${body}\n│\n╰${"━".repeat(24)}╯`;
}

export function panel(title: string, lines: string[]): string {
  const body = lines.map((l) => `├  ${l}`).join("\n");
  return `╭━━〔 ${title} 〕━━╮\n│\n${body}\n│\n╰${"━".repeat(24)}╯`;
}

export function formatPoints(n: number): string {
  return `${n} pts`;
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatUptime(startTime: number): string {
  return formatDuration(Date.now() - startTime);
}

export function timeUntil(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "0s";
  return formatDuration(ms);
}
