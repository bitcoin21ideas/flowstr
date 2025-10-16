import { useBoolean } from '@literal-ui/hooks'
import React, { Fragment } from 'react'
import { useMemo } from 'react'
import { VscCopy } from 'react-icons/vsc'
import { MdShare } from 'react-icons/md'

import { Annotation } from '@flow/reader/annotation'
import { useTranslation } from '@flow/reader/hooks'
import { reader, useReaderSnapshot } from '@flow/reader/models'
import { copy, group, keys } from '@flow/reader/utils'
import { useNostrHighlight } from '../../hooks/useNostrHighlight'

import { Row } from '../Row'
import { PaneViewProps, PaneView, Pane } from '../base'

export const AnnotationView: React.FC<PaneViewProps> = (props) => {
  return (
    <PaneView {...props}>
      <DefinitionPane />
      <AnnotationPane />
    </PaneView>
  )
}

const DefinitionPane: React.FC = () => {
  const { focusedBookTab } = useReaderSnapshot()
  const t = useTranslation('annotation')

  return (
    <Pane headline={t('definitions')} preferredSize={120}>
      {focusedBookTab?.book.definitions.map((d) => {
        return (
          <Row
            key={d}
            onDelete={() => {
              reader.focusedBookTab?.undefine(d)
            }}
          >
            {d}
          </Row>
        )
      })}
    </Pane>
  )
}

const AnnotationPane: React.FC = () => {
  const { focusedBookTab } = useReaderSnapshot()
  const t = useTranslation('annotation')

  const annotations = useMemo(
    () => (focusedBookTab?.book.annotations as Annotation[]) ?? [],
    [focusedBookTab?.book.annotations],
  )

  const groupedAnnotation = useMemo(() => {
    return group(annotations ?? [], (a) => a.spine.index)
  }, [annotations])

  const exportAnnotations = () => {
    // process annotations to be under each section
    // group annotations by title
    const grouped = group(annotations, (a) => a.spine.title)
    const exported: Record<string, any[]> = {}
    for (const chapter in grouped) {
      const annotations =
        grouped[chapter]?.map((a) => {
          const annotation: Record<string, any> = {}
          if (a.notes !== undefined) annotation.notes = a.notes
          if (a.text !== undefined) annotation.text = a.text
          return annotation
        }) ?? []
      exported[chapter] = annotations
    }

    // Copy to clipboard as markdown
    const exportedAnnotationsMd = Object.entries(exported)
      .map(([chapter, annotations]) => {
        return `## ${chapter}\n${annotations
          .map((a) => `- ${a.text} ${a.notes ? `(${a.notes})` : ''}`)
          .join('\n')}`
      })
      .join('\n\n')
    copy(exportedAnnotationsMd)
  }

  return (
    <Pane
      headline={t('annotations')}
      actions={
        annotations.length > 0
          ? [
              {
                id: 'copy-all',
                title: t('copy_as_markdown'),
                Icon: VscCopy,
                handle() {
                  exportAnnotations()
                },
              },
            ]
          : undefined
      }
    >
      {keys(groupedAnnotation).map((k) => (
        <AnnotationBlock key={k} annotations={groupedAnnotation[k]!} />
      ))}
    </Pane>
  )
}

interface AnnotationBlockProps {
  annotations: Annotation[]
}
const AnnotationBlock: React.FC<AnnotationBlockProps> = ({ annotations }) => {
  const [expanded, toggle] = useBoolean(true)

  return (
    <div>
      <Row
        depth={1}
        badge
        expanded={expanded}
        toggle={toggle}
        subitems={annotations}
      >
        {annotations[0]?.spine.title}
      </Row>

      {expanded && (
        <div>
          {annotations.map((a) => (
            <AnnotationRow key={a.id} annotation={a} />
          ))}
        </div>
      )}
    </div>
  )
}

interface AnnotationRowProps {
  annotation: Annotation
}
const AnnotationRow: React.FC<AnnotationRowProps> = ({ annotation }) => {
  const t = useTranslation('menu')
  const { focusedBookTab } = useReaderSnapshot()
  
  const { postHighlight, isPosting, isLoggedIn } = useNostrHighlight({
    onSuccess: (eventId) => {
      console.log('Highlight posted to Nostr:', eventId)
      // Update the annotation with the Nostr event ID
      if (focusedBookTab) {
        const annotationIndex = focusedBookTab.book.annotations.findIndex(a => a.id === annotation.id)
        if (annotationIndex !== -1) {
          const updatedAnnotation = {
            ...focusedBookTab.book.annotations[annotationIndex],
            nostrEventId: eventId
          }
          focusedBookTab.book.annotations[annotationIndex] = updatedAnnotation
        }
      }
    },
    onError: (error) => {
      console.error('Failed to post highlight:', error)
    }
  })

  const handlePostToNostr = () => {
    if (!focusedBookTab) return
    
    const bookMetadata = {
      title: focusedBookTab.book.metadata.title || 'Untitled',
      creator: focusedBookTab.book.metadata.creator || 'Unknown Author'
    }
    
    // Create a mock range for context extraction
    // In a real implementation, we'd need to store the original range or CFI
    const mockRange = {
      toString: () => annotation.text,
      startContainer: document.body,
      endContainer: document.body,
      startOffset: 0,
      endOffset: annotation.text.length,
      commonAncestorContainer: document.body
    } as Range
    
    postHighlight(annotation.text, mockRange, bookMetadata)
  }

  return (
    <Fragment>
      <div className="relative flex items-center">
        <Row
          depth={2}
          onClick={() => {
            reader.focusedBookTab?.display(annotation.cfi)
          }}
          onDelete={() => {
            reader.focusedBookTab?.removeAnnotation(annotation.cfi)
          }}
        >
          {annotation.text}
        </Row>
        <div className="ml-auto flex items-center gap-1">
          {annotation.nostrEventId ? (
            <span className="text-xs text-green-600" title={t('posted_to_nostr')}>
              ✓
            </span>
          ) : (
            <button
              className="action hidden p-1 text-xs hover:bg-surface-variant rounded"
              title={isLoggedIn ? t('post_to_nostr') : t('nostr_login_required')}
              disabled={isPosting || !isLoggedIn}
              onClick={(e) => {
                e.stopPropagation()
                handlePostToNostr()
              }}
            >
              <MdShare className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      {annotation.notes && (
        <Row
          depth={3}
          onClick={() => {
            reader.focusedBookTab?.display(annotation.cfi)
          }}
        >
          <span className="text-outline">{annotation.notes}</span>
        </Row>
      )}
    </Fragment>
  )
}
