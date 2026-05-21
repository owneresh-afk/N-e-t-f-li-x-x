# Telegram Bot — Points Reward System

A Telegram bot with a points-based reward system featuring channel verification, daily rewards, referrals, account redemption, and a full admin panel.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server + bot (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `BOT_TOKEN` — Telegram bot token from @BotFather

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Bot: Telegraf 4.x (long polling)
- API: Express 5 (keep-alive web server)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/bot/` — all bot code
- `artifacts/api-server/src/bot/handlers/` — command and callback handlers
- `artifacts/api-server/src/bot/handlers/admin/` — admin panel handlers
- `artifacts/api-server/src/bot/utils/` — animations, formatting, safe-delete
- `artifacts/api-server/src/bot/middleware/` — user registration middleware
- `lib/db/src/schema/` — database schema (users, channels, accounts, codes, settings)

## Architecture decisions

- Bot runs alongside Express server in the same process (both start from `index.ts`)
- Long polling mode (no webhook needed) — works on Replit without HTTPS setup
- Single active menu per user enforced via `activeMessageId` in users table
- Verification version system: increment global version to force all users to re-verify
- In-memory conversation state (`Map`) for multi-step admin flows (broadcast, code gen, channel add)
- Account files stored as Telegram message references only (no file content stored)

## Product

- **Users**: verify channels → earn points via daily rewards & referrals → redeem accounts
- **Admins**: manage stock via DB channel TXT uploads → generate promo codes → broadcast → manage channels → restart verification
- **Redeem cost**: 50 points per account
- **Daily reward**: 10 points every 24 hours
- **Referral reward**: 10 points per verified referral

## User preferences

- Cyber minimal UI with line-art symbols and ASCII panels
- Monochrome aesthetic, professional tone
- Animations on key flows (startup, verification, redeem, claim)
- Owner ID: 8731647972 | Developer: @IAM_ESH

## Gotchas

- Always run `pnpm run typecheck:libs` after schema changes before typechecking artifacts
- Always run `pnpm --filter @workspace/db run push` after schema changes
- Bot must be admin of required channels to check membership via getChatMember
- Bot must be a member of the DB channel to receive channel_post updates
- Users redeem promo codes with `/code YOURCODE` command
- Delete account ranges with `/del LINK1 - LINK2` (admin only)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
