import { execSync } from 'node:child_process'
import path from 'node:path'

export default async function globalSetup() {
  const root = path.resolve(__dirname, '..')
  execSync('npx tsx scripts/seed-e2e-shop-product.ts', {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
}
