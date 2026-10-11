import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { knowledgeTopics, topicArticles, type KnowledgeTopic } from '../docs/.vitepress/navigation.mts'

const root = resolve(import.meta.dirname, '..')
const docs = join(root, 'docs')
const dist = join(docs, '.vitepress/dist')
const base = '/journal/'

function markdownFiles(directory: string, prefix = ''): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = prefix + entry.name
    if (entry.isDirectory()) return markdownFiles(join(directory, entry.name), path + '/')
    return entry.name.endsWith('.md') ? [path] : []
  })
}

function articlePath(file: string): string {
  return '/' + file.replace(/\.md$/, '')
}

function linksIn(html: string): string[] {
  return [...html.matchAll(/\bhref="([^"]+)"/g)]
    .map((match) => (match[1] ?? '').replace(/&amp;/g, '&'))
}

const content = ['knowledge', 'guide'].flatMap((section) =>
  markdownFiles(join(docs, section)).map((file) => section + '/' + file)
)
const articles = content.filter((file) => !file.endsWith('/index.md'))
const articlePaths = new Set(articles.map(articlePath))
const pages = [...content, 'log/index.md', 'about.md', 'index.md']
  .filter((file) => existsSync(join(docs, file)))
const errors: string[] = []
const owners = new Map<string, KnowledgeTopic>()
const outputs = new Map<string, string>()

for (const topic of knowledgeTopics) {
  if (!topicArticles(topic).length) errors.push(topic.title + ': 主题不能为空')
  for (const article of topicArticles(topic)) {
    if (!articlePaths.has(article.link)) errors.push('主题中的文章不存在: ' + article.link)
    if (owners.has(article.link)) errors.push('文章重复归属: ' + article.link)
    owners.set(article.link, topic)
  }
}
for (const article of articlePaths) {
  if (!owners.has(article)) errors.push('文章缺少主题归属: ' + article)
}

function validateLinks(page: string, links: string[]): void {
  for (const link of new Set(links)) {
    if (!link.startsWith(base)) continue
    const [urlPath = '', fragment] = link.slice(base.length).split('#')
    const path = decodeURI(urlPath.split('?')[0] ?? '')
    const file = path.endsWith('/') || !path
      ? path + 'index.html'
      : /\.[^/]+$/.test(path) ? path : path + '.html'
    const output = join(dist, file)
    if (!existsSync(output)) {
      errors.push(page + ': 站内链接失效 ' + link)
      continue
    }
    if (fragment) {
      const target = readFileSync(output, 'utf8')
      if (!target.includes('id="' + decodeURIComponent(fragment) + '"')) {
        errors.push(page + ': 站内锚点失效 ' + link)
      }
    }
  }
}

for (const page of pages) {
  const output = join(dist, page.replace(/\.md$/, '.html'))
  if (!existsSync(output)) {
    errors.push(page + ': 缺少构建产物，请先构建站点')
    continue
  }
  const html = readFileSync(output, 'utf8')
  outputs.set(page, html)
  if (page === 'index.md') {
    validateLinks(page, linksIn(html))
    continue
  }
  const sidebar = html.match(/<nav\b[^>]*\bid="VPSidebarNav"[^>]*>([\s\S]*?)<\/nav>/)?.[1]
  if (!sidebar) {
    errors.push(page + ': 缺少侧栏')
    continue
  }
  const links = linksIn(sidebar)
  const topic = owners.get(articlePath(page)) ?? knowledgeTopics.find(
    (topic) => page === topic.link.slice(1) + 'index.md'
  )
  const expected = new Set(topic ? topicArticles(topic).map((article) => article.link) : [])
  for (const article of articlePaths) {
    const href = base + article.slice(1)
    const count = links.filter((link) => link === href).length
    const expectedCount = expected.has(article) ? 1 : 0
    if (count !== expectedCount) {
      errors.push(page + ': ' + article + ' 的侧栏入口数量为 ' + count + '，应为 ' + expectedCount)
    }
  }
  if (topic && !links.includes(base + topic.link.slice(1))) {
    errors.push(page + ': 缺少当前主题首页入口')
  }
  validateLinks(page, links)
  validateLinks(page, linksIn(html))
}

const logHtml = outputs.get('log/index.md')
if (logHtml) {
  const logLinks = linksIn(logHtml)
  for (const article of articlePaths) {
    const href = base + article.slice(1)
    const count = logLinks.filter((link) => link === href).length
    if (count !== 1) errors.push('内容日志: ' + article + ' 的构建后入口数量为 ' + count + '，应为 1')
  }
}
if (articles.length === 0) errors.push('未找到文章，无法验证导航覆盖')
if (errors.length) {
  console.error('导航检查失败:\n' + errors.map((error) => '- ' + error).join('\n'))
  process.exit(1)
}
console.log('导航检查通过: ' + pages.length + ' 个页面、' + knowledgeTopics.length +
  ' 个独立主题、' + articles.length + ' 篇文章；主题侧栏隔离、站内链接和日志 URL 全部有效。')
