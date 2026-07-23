import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root: string = resolve(import.meta.dirname, '..')

if (!existsSync(resolve(root, '.git'))) {
  console.log('尚未初始化 Git，跳过 Git hooks 配置。')
  process.exit(0)
}

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
    cwd: root,
    stdio: 'inherit'
  })
  console.log('已启用 .githooks/pre-commit。')
} catch {
  console.warn('未能自动配置 Git hooks，请手动运行：git config core.hooksPath .githooks')
}
