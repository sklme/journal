import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const docs = join(root, 'docs')
const dist = join(docs, '.vitepress/dist')

function markdownFiles(directory: string, prefix = ''): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${prefix}${entry.name}`
    if (entry.isDirectory()) return markdownFiles(join(directory, entry.name), `${path}/`)
    return entry.name.endsWith('.md') ? [path] : []
  })
}

const content = ['knowledge', 'guide'].flatMap((section) =>
  markdownFiles(join(docs, section)).map((file) => `${section}/${file}`)
)
const articles = content.filter((file) => !file.endsWith('/index.md'))
const pages = [...content, 'log/index.md', 'about.md']
  .filter((file) => existsSync(join(docs, file)))
const errors: string[] = []

for (const page of pages) {
  const output = join(dist, page.replace(/\.md$/, '.html'))
  if (!existsSync(output)) {
    errors.push(`${page}: 缺少构建产物，请先构建站点`)
    continue
  }
  const html = readFileSync(output, 'utf8')
  const sidebar = html.match(/<nav\b[^>]*\bid="VPSidebarNav"[^>]*>([\s\S]*?)<\/nav>/)?.[1]
  if (!sidebar) {
    errors.push(`${page}: 缺少文章侧栏`)
    continue
  }
  const links = [...sidebar.matchAll(/\bhref="([^"]+)"/g)].map((match) => match[1])
  for (const article of articles) {
    const href = `/journal/${article.replace(/\.md$/, '')}`
    const count = links.filter((link) => link === href).length
    if (count !== 1) errors.push(`${page}: ${article} 的侧栏入口数量为 ${count}，应为 1`)
  }
  for (const link of links) {
    if (!link?.startsWith('/journal/')) continue
    const path = link.slice('/journal/'.length).split('#')[0] ?? ''
    const file = path.endsWith('/') || !path ? `${path}index.html` : `${path.replace(/\.html$/, '')}.html`
    if (!existsSync(join(dist, file))) errors.push(`${page}: 侧栏链接失效 ${link}`)
  }
}

if (articles.length === 0) errors.push('未找到文章，无法验证导航覆盖')
if (errors.length) {
  console.error(`侧栏检查失败：\n${errors.map((error) => `- ${error}`).join('\n')}`)
  process.exit(1)
}
console.log(`侧栏检查通过：${pages.length} 个页面均包含 ${articles.length} 篇文章的唯一入口，侧栏链接全部有效。`)
