/**
 * Extract surrounding text context from a DOM Range for NIP-84 highlights
 */

export function extractContext(range: Range): string {
  const text = range.toString().trim()
  if (!text) return ''

  // Get the container element that contains the range
  const container = range.commonAncestorContainer
  const element = container.nodeType === Node.TEXT_NODE 
    ? container.parentElement 
    : container as Element

  if (!element) return text

  // Get all text content from the container
  const fullText = element.textContent || ''
  const rangeStart = range.startOffset
  const rangeEnd = range.endOffset

  // Find the start and end of the selection in the full text
  let textStart = 0
  let textEnd = fullText.length

  // Walk through text nodes to find the actual position
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  )

  let currentPos = 0
  let node = walker.nextNode()
  
  while (node) {
    const nodeLength = node.textContent?.length || 0
    
    if (node === range.startContainer) {
      textStart = currentPos + rangeStart
    }
    if (node === range.endContainer) {
      textEnd = currentPos + rangeEnd
      break
    }
    
    currentPos += nodeLength
    node = walker.nextNode()
  }

  // Extract context around the selection
  const beforeText = fullText.substring(0, textStart).trim()
  const afterText = fullText.substring(textEnd).trim()

  // Split into sentences and get exactly 2 sentences before and after
  const beforeSentences = splitIntoSentences(beforeText)
  const afterSentences = splitIntoSentences(afterText)

  // Get exactly 2 sentences before and 2 sentences after
  const contextBefore = beforeSentences.slice(-2).join(' ')
  const contextAfter = afterSentences.slice(0, 2).join(' ')

  // Format as: [2 sentences before] [highlighted content] [2 sentences after]
  const contextParts = []
  if (contextBefore) contextParts.push(contextBefore)
  contextParts.push(`[${text}]`) // Mark the highlighted content
  if (contextAfter) contextParts.push(contextAfter)

  return contextParts.join(' ')
}

function splitIntoSentences(text: string): string[] {
  if (!text) return []
  
  // Split on sentence endings, but be careful with abbreviations
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0)
    .map(s => s.trim())
  
  return sentences
}
