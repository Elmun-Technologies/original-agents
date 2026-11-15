// Runs once before e2e: put the sample stock back (test purchases use it up). Local/staging DB only.
import { execFileSync } from 'node:child_process'

export default function globalSetup() {
  if (process.env.E2E_NO_RESET) return
  execFileSync('pnpm', ['exec', 'tsx', '--env-file=.env', 'scripts/e2e-reset.ts'], { stdio: 'inherit' })
}
