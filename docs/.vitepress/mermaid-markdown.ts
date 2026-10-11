import type { MarkdownRenderer } from 'vitepress'

export function configureMermaid(md: MarkdownRenderer): void {
  const defaultFence = md.renderer.rules.fence

  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const token = tokens[index]!
    if (token.info.trim().split(/\s+/)[0] === 'mermaid') {
      const code = md.utils.escapeHtml(JSON.stringify(token.content))
      return `<MermaidDiagram :code="${code}" />\n`
    }

    return defaultFence
      ? defaultFence(tokens, index, options, env, self)
      : self.renderToken(tokens, index, options)
  }
}
