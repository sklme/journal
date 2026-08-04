import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, join, relative, resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const docsRoot = join(root, 'docs')
const logPath = join(docsRoot, 'log', 'index.md')
const contentRoots = [
  join(docsRoot, 'knowledge'),
  join(docsRoot, 'guide')
]

function walk(directory: string): string[] {
  const paths: string[] = []

  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry)
    const stats = statSync(absolutePath)

    if (stats.isDirectory()) {
      paths.push(...walk(absolutePath))
    } else if (
      stats.isFile() &&
      extname(entry) === '.md' &&
      basename(entry) !== 'index.md'
    ) {
      paths.push(absolutePath)
    }
  }

  return paths
}

function sitePath(file: string): string {
  const path = relative(docsRoot, file).split(sep).join('/')
  return `/${path.replace(/\.md$/, '')}`
}

const expectedPaths = contentRoots
  .flatMap((directory) => walk(directory))
  .map((file) => sitePath(file))
  .sort()
const expectedSet = new Set(expectedPaths)
const log = readFileSync(logPath, 'utf8')
const errors: string[] = []

for (const path of expectedPaths) {
  const occurrences = log.split(`](${path})`).length - 1

  if (occurrences === 0) {
    errors.push(`缺少条目：${path}`)
  } else if (occurrences > 1) {
    errors.push(`重复条目：${path}`)
  }
}

const loggedPaths = log.matchAll(/\]\((\/(?:knowledge|guide)\/[^)\s]+)\)/g)
for (const match of loggedPaths) {
  const path = match[1]
  if (path && !expectedSet.has(path)) errors.push(`失效条目：${path}`)
}

if (errors.length > 0) {
  console.error('内容日志检查失败：')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`内容日志检查通过，共覆盖 ${expectedPaths.length} 篇文档。`)
