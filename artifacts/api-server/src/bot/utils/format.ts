// ─── Utility helpers ──────────────────────────────────────────────────────────

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

// ─── Panel builders ───────────────────────────────────────────────────────────

/**
 * MAIN MENU — Premium Control Panel (heavy double borders + inner divider)
 *
 * ╔══〔 CONTROL PANEL 〕══╗
 * ║  ◈  @username          ║
 * ╠══〔 OVERVIEW 〕════════╣
 * ║  ◆  Balance ···  50 pts║
 * ╚════════════════════════╝
 */
export function ctrlPanel(username: string, balance: number, stock: number): string {
  return [
    `╔══〔 CONTROL PANEL 〕══╗`,
    `║`,
    `║  ◈  ${username}`,
    `║`,
    `╠══〔 OVERVIEW 〕═══════╣`,
    `║  ◆  Balance ····  ${balance} pts`,
    `║  ⬢  Stock ······  ${stock}`,
    `║`,
    `╚═══════════════════════╝`,
  ].join("\n");
}

/**
 * VERIFICATION — Scanner UI (light rounded borders)
 *
 * ╭──〔 IDENTITY SCANNER 〕──╮
 * │  ⌁  SCAN REQUIRED        │
 * │  ─────────────────────   │
 * │  ›  Channel Name         │
 * ╰──────────────────────────╯
 */
export function scannerPanel(channelNames: string[], count: number): string {
  const channelLines = channelNames.length > 0
    ? channelNames.map((n) => `│  ›  ${n}`)
    : [`│  ◌  No channels set yet`];
  return [
    `╭──〔 IDENTITY SCANNER 〕──╮`,
    `│`,
    `│  ⌁  SCAN REQUIRED`,
    `│  ─────────────────────`,
    ...channelLines,
    `│`,
    `│  ◎  ${count} channel(s) to verify`,
    `│  ◌  Join all · then press VERIFY`,
    `│`,
    `╰──────────────────────────╯`,
  ].join("\n");
}

/**
 * PROFILE — User Card (table-style with mixed borders + section headers)
 *
 * ┌──〔 USER CARD 〕──────┐
 * │  ◎  @username          │
 * ├────────────────────────┤
 * │  ◆  METRICS            │
 * │  ├  Balance ···  50 pts │
 * └────────────────────────┘
 */
export function userCard(
  name: string,
  userId: number,
  balance: number,
  refs: number,
  redeems: number,
  joined: string,
  verified: boolean
): string {
  const status = verified ? `✦  VERIFIED` : `⎋  UNVERIFIED`;
  return [
    `┌──〔 USER CARD 〕───────────┐`,
    `│  ◎  ${name}`,
    `│  ◌  ID ····  ${userId}`,
    `├───────────────────────────┤`,
    `│  ◆  METRICS`,
    `│  ├  Balance ···  ${balance} pts`,
    `│  ├  Refs ······  ${refs}`,
    `│  └  Redeems ···  ${redeems}`,
    `├───────────────────────────┤`,
    `│  ◉  Joined ·  ${joined}`,
    `│  ${status}`,
    `└───────────────────────────┘`,
  ].join("\n");
}

/**
 * ADMIN — Heavy Cyber Console
 *
 * ╔══〔 SYS:ADMIN 〕════╗
 * ║  ⌘  ELEVATED ACCESS  ║
 * ╠═════════════════════╣
 * ║  › select operation  ║
 * ╚═════════════════════╝
 */
export function consolePanel(header: string[], body: string[]): string {
  const hLines = header.map((l) => `║  ${l}`);
  const bLines = body.map((l) => `║  ${l}`);
  return [
    `╔══〔 SYS:ADMIN CONSOLE 〕══╗`,
    ...hLines,
    `╠═══════════════════════════╣`,
    ...bLines,
    `╚═══════════════════════════╝`,
  ].join("\n");
}

/**
 * STATISTICS — Dashboard (rounded with ⟦ SECTION ⟧ headers)
 *
 * ╭─〔 SYSTEM DASHBOARD 〕──╮
 * │  ⟦ USERS ⟧
 * │  ├── Total ·····  1,234
 * │  └── Verified ·    890
 * ╰──────────────────────────╯
 */
export function dashboardPanel(
  sections: Array<{ label: string; rows: Array<{ key: string; val: string | number; last?: boolean }> }>
): string {
  const lines: string[] = [`╭─〔 SYSTEM DASHBOARD 〕──────╮`, `│`];
  for (const sec of sections) {
    lines.push(`│  ⟦ ${sec.label} ⟧`);
    for (const row of sec.rows) {
      const prefix = row.last ? `└──` : `├──`;
      const dots = "·".repeat(Math.max(1, 12 - row.key.length));
      lines.push(`│  ${prefix} ${row.key} ${dots}  ${row.val}`);
    }
    lines.push(`│`);
  }
  lines.push(`╰────────────────────────────╯`);
  return lines.join("\n");
}

/**
 * MINIMAL — Top/bottom bar style (daily, balance, referral)
 *
 * ▔▔▔〔 TITLE 〕▔▔▔▔▔▔▔
 *
 *   ◈  key ·······  value
 *   ──────────────────────
 *   ◉  key ·······  value
 *
 * ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
 */
export function minimalPanel(title: string, lines: string[]): string {
  const titleBar = `▔▔▔〔 ${title} 〕▔▔▔▔▔▔▔`;
  const botBar = `▁`.repeat(titleBar.length);
  return [
    titleBar,
    ``,
    ...lines.map((l) => `  ${l}`),
    ``,
    botBar,
  ].join("\n");
}

/**
 * STOCK — Inventory Panel
 *
 * ╭─〔 STOCK OVERVIEW 〕──────╮
 * │  ◈  Available ·····  120  │
 * │  ████████▁▁  73%          │
 * ╰─────────────────────────╯
 */
export function stockPanel(available: number, used: number, total: number): string {
  const bar = buildStockBar(available, total);
  const pct = total === 0 ? 0 : Math.round((available / total) * 100);
  return [
    `╭─〔 STOCK OVERVIEW 〕──────╮`,
    `│`,
    `│  ◈  Available ·····  ${available}`,
    `│  ◎  Used ···········  ${used}`,
    `│  ◆  Total ··········  ${total}`,
    `│`,
    `│  ${bar}  ${pct}%`,
    `│`,
    `╰───────────────────────────╯`,
  ].join("\n");
}

function buildStockBar(available: number, total: number): string {
  if (total === 0) return `▁▁▁▁▁▁▁▁▁▁`;
  const filled = Math.round((available / total) * 10);
  return `█`.repeat(filled) + `▁`.repeat(10 - filled);
}

/**
 * REDEEM — Processing Panel
 *
 * ╭──〔 ACCOUNT REDEEM 〕──╮
 * │  ◆  Cost ·····  1 pt    │
 * │  ◎  Balance ··  50 pts  │
 * ╰────────────────────────╯
 */
export function redeemPanel(cost: number, balance: number, stock: number): string {
  const ok = balance >= cost;
  return [
    `╭──〔 ACCOUNT REDEEM 〕──╮`,
    `│`,
    `│  ◆  Cost ·····  ${cost} pt`,
    `│  ◎  Balance ···  ${balance} pts`,
    `│  ◌  Stock ·····  ${stock}`,
    `│  ───────────────────────`,
    `│  ${ok ? `◉  Balance sufficient` : `⎋  Insufficient balance`}`,
    `│`,
    `╰──────────────────────────╯`,
  ].join("\n");
}

/**
 * BROADCAST — Live Progress Panel
 *
 * ╔══〔 BROADCAST LIVE 〕══╗
 * ║  ◈  Progress · 450/500  ║
 * ║  ████████████▁▁  90%    ║
 * ╚═════════════════════════╝
 */
export function broadcastPanel(done: number, total: number, success: number, failed: number): string {
  const bar = buildBroadcastBar(done, total);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return [
    `╔══〔 BROADCAST LIVE 〕══╗`,
    `║`,
    `║  ◈  Progress ·  ${done} / ${total}`,
    `║  ${bar}  ${pct}%`,
    `║`,
    `║  ◎  Sent ·····  ${success}`,
    `║  ◌  Failed ···  ${failed}`,
    `║`,
    `╚════════════════════════╝`,
  ].join("\n");
}

export function broadcastCompletePanel(success: number, failed: number, total: number): string {
  return [
    `╔══〔 BROADCAST DONE 〕══╗`,
    `║`,
    `║  ◉  Complete ✦`,
    `║  ───────────────────────`,
    `║  ◎  Sent ·····  ${success}`,
    `║  ◌  Failed ···  ${failed}`,
    `║  ◆  Total ·····  ${total}`,
    `║`,
    `╚════════════════════════╝`,
  ].join("\n");
}

function buildBroadcastBar(done: number, total: number): string {
  if (total === 0) return `▁▁▁▁▁▁▁▁▁▁▁▁`;
  const filled = Math.round((done / total) * 12);
  return `█`.repeat(filled) + `▁`.repeat(12 - filled);
}

/**
 * ALERT — Compact error/warning panel
 *
 * ⎋ ─〔 ALERT 〕──────────────
 * │  ◌  message line
 * ──────────────────────────────
 */
export function alertPanel(title: string, lines: string[]): string {
  return [
    `⎋ ─〔 ${title} 〕─────────────`,
    `│`,
    ...lines.map((l) => `│  ◌  ${l}`),
    `│`,
    `──────────────────────────────`,
  ].join("\n");
}

/**
 * STEP CONSOLE — Admin multi-step flows
 *
 * ╔══〔 TITLE 〕══════╗
 * ║  ⌁  STEP 1 / 3     ║
 * ╠═══════════════════╣
 * ║  ◎  prompt line    ║
 * ╚═══════════════════╝
 */
export function stepConsole(title: string, step: number, total: number, lines: string[]): string {
  const bLines = lines.map((l) => `║  ${l}`);
  return [
    `╔══〔 ${title} 〕══════╗`,
    `║  ⌁  STEP ${step} / ${total}`,
    `╠═══════════════════════════╣`,
    ...bLines,
    `╚═══════════════════════════╝`,
  ].join("\n");
}

/**
 * SUCCESS — Minimal success confirmation
 *
 * ◉ ─〔 TITLE ✦ 〕────────────
 * │  line 1
 * ────────────────────────────
 */
export function successPanel(title: string, lines: string[]): string {
  return [
    `◉ ─〔 ${title} ✦ 〕──────────`,
    `│`,
    ...lines.map((l) => `│  ${l}`),
    `│`,
    `──────────────────────────────`,
  ].join("\n");
}

/**
 * GENERIC — Fallback panel (backward compat, used in stock-manager etc.)
 */
export function panel(title: string, lines: string[]): string {
  const body = lines.map((l) => `│  ${l}`).join("\n");
  return `╭━━〔 ${title} 〕━━╮\n${body}\n│\n╰${"━".repeat(24)}╯`;
}
