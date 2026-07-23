import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, join, relative, resolve } from 'node:path'
import process from 'node:process'

interface Rule {
  name: string
  pattern: RegExp
  excludeFiles?: ReadonlySet<string>
}

interface Finding {
  file: string
  line: number
  rule: string
}

const root = resolve(import.meta.dirname, '..')
const mode = process.argv.includes('--staged') ? 'staged' : 'all'

const scannedExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.mts',
  '.svg',
  '.ts',
  '.txt',
  '.yaml',
  '.yml'
])

const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'cache',
  'dist'
])

const ignoredFiles = new Set([
  '.sensitive-terms.local',
  'pnpm-lock.yaml'
])

const rules: Rule[] = [
  {
    name: '私钥',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g
  },
  {
    name: 'GitHub Token',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g
  },
  {
    name: 'AWS Access Key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g
  },
  {
    name: 'Bearer 凭据',
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi
  },
  {
    name: '疑似密码或密钥赋值',
    pattern: /\b(?:password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*["']?(?!<|\$\{|process\.env|example|placeholder|redacted)[^\s"',;}{]{8,}/gi
  },
  {
    name: 'Cookie 或会话值',
    pattern: /\b(?:cookie|session[_-]?id|session[_-]?key)\b\s*[:=]\s*["']?(?!<|example|placeholder|redacted)[^\s"',;}{]{8,}/gi
  },
  {
    name: '私有 IPv4 地址',
    pattern: /\b(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})\b/g
  },
  {
    name: '本机用户目录',
    pattern: /\/Users\/(?!example(?:\/|$)|<USER>(?:\/|$))[A-Za-z0-9._-]+(?:\/|$)/g
  },
  {
    name: '常见内网域名',
    pattern: /\b(?:localhost|[A-Za-z0-9.-]+\.(?:internal|intranet|corp|local|oa\.com|woa\.com))\b/gi,
    excludeFiles: new Set(['scripts/check-sensitive.ts'])
  },
  {
    name: '疑似中国大陆手机号',
    pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g
  },
  {
    name: '电子邮箱',
    pattern: /\b[A-Z0-9._%+-]+@(?!example\.(?:com|org|net)\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
  }
]

function walk(directory: string): string[] {
  const paths: string[] = []

  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry) || ignoredFiles.has(entry)) continue

    const absolutePath = join(directory, entry)
    const stats = statSync(absolutePath)

    if (stats.isDirectory()) {
      paths.push(...walk(absolutePath))
    } else if (stats.isFile()) {
      paths.push(absolutePath)
    }
  }

  return paths
}

function stagedFiles(): string[] {
  try {
    return execFileSync(
      'git',
      ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }
    )
      .split('\0')
      .filter(Boolean)
      .map((file) => resolve(root, file))
      .filter(existsSync)
  } catch {
    return []
  }
}

function allFiles(): string[] {
  try {
    const tracked = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }
    )
      .split('\0')
      .filter(Boolean)
      .map((file) => resolve(root, file))
      .filter(existsSync)

    if (tracked.length > 0) return tracked
  } catch {
    // 尚未初始化 Git 时，扫描工作目录。
  }

  return walk(root)
}

function customTerms(): string[] {
  const terms: string[] = []
  const localTermsPath = join(root, '.sensitive-terms.local')

  if (existsSync(localTermsPath)) {
    terms.push(...readFileSync(localTermsPath, 'utf8').split(/\r?\n/))
  }

  if (process.env.SENSITIVE_TERMS) {
    terms.push(...process.env.SENSITIVE_TERMS.split(/\r?\n|,/))
  }

  return terms.map((term) => term.trim()).filter(Boolean)
}

function lineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}

const files = (mode === 'staged' ? stagedFiles() : allFiles()).filter((file) => {
  const fileName = basename(file)
  return (
    !ignoredFiles.has(fileName) &&
    scannedExtensions.has(extname(file).toLowerCase())
  )
})

const findings: Finding[] = []
const terms = customTerms()

for (const file of files) {
  const content = readFileSync(file, 'utf8')
  const relativeFile = relative(root, file)

  for (const rule of rules) {
    if (rule.excludeFiles?.has(relativeFile)) continue

    rule.pattern.lastIndex = 0
    for (const match of content.matchAll(rule.pattern)) {
      findings.push({
        file: relativeFile,
        line: lineNumber(content, match.index ?? 0),
        rule: rule.name
      })
    }
  }

  const lowerContent = content.toLocaleLowerCase()
  for (const term of terms) {
    let start = 0
    const lowerTerm = term.toLocaleLowerCase()

    while ((start = lowerContent.indexOf(lowerTerm, start)) !== -1) {
      findings.push({
        file: relativeFile,
        line: lineNumber(content, start),
        rule: '自定义敏感词'
      })
      start += lowerTerm.length
    }
  }
}

if (findings.length > 0) {
  console.error(`敏感信息检查失败，共发现 ${findings.length} 处：`)
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}]`)
  }
  console.error('为避免二次泄露，检查结果不会打印命中的原文。')
  process.exit(1)
}

console.log(`敏感信息检查通过，共扫描 ${files.length} 个文本文件。`)
