let renderQueue: Promise<void> = Promise.resolve()
let nextId = 0

export function renderMermaid(code: string, dark: boolean): Promise<string> {
  // Mermaid configuration is global, so keep theme setup and rendering together.
  const result = renderQueue.then(async () => {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      htmlLabels: false,
      suppressErrorRendering: true,
      theme: dark ? 'dark' : 'default',
      fontFamily: 'sans-serif'
    })
    const { svg } = await mermaid.render(`journal-mermaid-${nextId++}`, code)
    return svg
  })

  // A malformed diagram must not prevent subsequent diagrams from rendering.
  renderQueue = result.then(() => {}, () => {})
  return result
}
