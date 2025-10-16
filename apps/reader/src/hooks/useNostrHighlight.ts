import { useState } from 'react'
import { nostrAuth } from '../nostr'
import { extractContext } from '../utils/context'

interface BookMetadata {
  title: string
  creator: string
}

interface UseNostrHighlightOptions {
  onSuccess?: (eventId: string) => void
  onError?: (error: Error) => void
}

export function useNostrHighlight(options: UseNostrHighlightOptions = {}) {
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const postHighlight = async (
    text: string,
    range: Range,
    bookMetadata: BookMetadata,
    comment?: string
  ): Promise<string | null> => {
    console.log('postHighlight called with:', { text: text.substring(0, 50), bookMetadata })
    
    if (!nostrAuth.isLoggedIn()) {
      console.log('User not logged in to Nostr')
      const error = new Error('Not logged in to Nostr')
      setError(error)
      options.onError?.(error)
      return null
    }

    console.log('User is logged in, starting post process')
    setIsPosting(true)
    setError(null)

    try {
      // Extract context from the range (2 sentences before and after)
      const context = extractContext(range)
      console.log('Extracted context:', context.substring(0, 200))
      
      // Publish the highlight
      console.log('Calling nostrAuth.publishHighlight')
      const eventId = await nostrAuth.publishHighlight(
        text,
        bookMetadata.title,
        bookMetadata.creator,
        context,
        comment
      )

      console.log('Publish result:', eventId)
      if (eventId) {
        options.onSuccess?.(eventId)
        return eventId
      } else {
        throw new Error('Failed to publish highlight')
      }
    } catch (err) {
      console.error('Error in postHighlight:', err)
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      options.onError?.(error)
      return null
    } finally {
      setIsPosting(false)
    }
  }

  return {
    postHighlight,
    isPosting,
    error,
    isLoggedIn: nostrAuth.isLoggedIn()
  }
}
