'use client'

import { useState, useEffect, useCallback } from 'react'
import { Box, Button, Card, Flex, Spinner, Stack, Text } from '@sanity/ui'
import { EnvelopeIcon } from '@sanity/icons'
import type { DocumentActionComponent, DocumentActionProps } from 'sanity'

interface SubscriberCounts {
  en: number
  es: number
}

interface SendResult {
  enSent: number
  esSent: number
  enFailed: number
  esFailed: number
  errors: Array<{ email: string; error: string }>
}

type DialogState = 'confirm' | 'sending' | 'success' | 'error'

function SendNewsletterDialog({
  postId,
  postLocale,
  hasRelatedPost,
  alreadySent,
  sentAt,
  onClose,
  onComplete,
}: {
  postId: string
  postLocale: 'en' | 'es'
  hasRelatedPost: boolean
  alreadySent: boolean
  sentAt?: string
  onClose: () => void
  onComplete: () => void
}) {
  const [dialogState, setDialogState] = useState<DialogState>('confirm')
  const [counts, setCounts] = useState<SubscriberCounts | null>(null)
  const [countsLoading, setCountsLoading] = useState(true)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    setCountsLoading(true)
    fetch('/api/newsletter/subscriber-counts')
      .then((r) => r.json())
      .then((data) => { if (data.success) setCounts(data.counts) })
      .catch(() => {})
      .finally(() => setCountsLoading(false))
  }, [])

  const handleSend = useCallback(async () => {
    setDialogState('sending')
    try {
      const res = await fetch('/api/newsletter/send-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, force: alreadySent }),
      })
      const data = await res.json()
      if (data.success) {
        setSendResult(data.result)
        setDialogState('success')
      } else {
        setErrorMessage(data.error || 'Failed to send newsletter')
        setDialogState('error')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error')
      setDialogState('error')
    }
  }, [postId, alreadySent])

  const handleClose = useCallback(() => {
    if (dialogState === 'success') onComplete()
    onClose()
  }, [dialogState, onClose, onComplete])

  if (dialogState === 'sending') {
    return (
      <Box padding={5}>
        <Flex align="center" direction="column" gap={4}>
          <Spinner />
          <Text muted size={1}>Sending newsletter emails… This may take a minute.</Text>
        </Flex>
      </Box>
    )
  }

  if (dialogState === 'success' && sendResult) {
    const showEn = postLocale === 'en' || hasRelatedPost
    const showEs = postLocale === 'es' || hasRelatedPost
    const totalFailed = sendResult.enFailed + sendResult.esFailed
    return (
      <Box padding={4}>
        <Stack space={4}>
          <Text size={2} weight="semibold">Newsletter sent successfully</Text>
          <Card padding={3} radius={2} shadow={1}>
            <Stack space={3}>
              {showEn && (
                <Flex justify="space-between">
                  <Text size={2}>English</Text>
                  <Text size={2}>
                    {sendResult.enSent} sent
                    {sendResult.enFailed > 0 && ` · ${sendResult.enFailed} failed`}
                  </Text>
                </Flex>
              )}
              {showEs && (
                <Flex justify="space-between">
                  <Text size={2}>Spanish</Text>
                  <Text size={2}>
                    {sendResult.esSent} sent
                    {sendResult.esFailed > 0 && ` · ${sendResult.esFailed} failed`}
                  </Text>
                </Flex>
              )}
            </Stack>
          </Card>
          {totalFailed > 0 && (
            <Text muted size={1}>
              {totalFailed} failed {totalFailed === 1 ? 'delivery' : 'deliveries'} — check server logs.
            </Text>
          )}
          <Flex justify="flex-end">
            <Button mode="ghost" onClick={handleClose} text="Close" />
          </Flex>
        </Stack>
      </Box>
    )
  }

  if (dialogState === 'error') {
    return (
      <Box padding={4}>
        <Stack space={4}>
          <Text>Send failed: {errorMessage}</Text>
          <Flex gap={2} justify="flex-end">
            <Button mode="ghost" onClick={handleClose} text="Close" />
            <Button onClick={() => setDialogState('confirm')} text="Try Again" tone="primary" />
          </Flex>
        </Stack>
      </Box>
    )
  }

  // Confirm state — only show locales that have a post to send
  const showEn = postLocale === 'en' || hasRelatedPost
  const showEs = postLocale === 'es' || hasRelatedPost
  const totalCount = (showEn ? (counts?.en ?? 0) : 0) + (showEs ? (counts?.es ?? 0) : 0)
  const sentAtFormatted = sentAt
    ? new Date(sentAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <Box padding={4}>
      <Stack space={4}>
        <Text size={2}>
          This will send the post as a newsletter to all confirmed subscribers:
        </Text>

        {countsLoading ? (
          <Flex align="center" gap={2}>
            <Spinner muted />
            <Text muted size={1}>Loading subscriber counts…</Text>
          </Flex>
        ) : counts ? (
          <Card padding={3} radius={2} shadow={1}>
            <Stack space={3}>
              {showEn && (
                <Flex justify="space-between">
                  <Text size={2}>English subscribers</Text>
                  <Text size={2} weight="semibold">{counts.en.toLocaleString()}</Text>
                </Flex>
              )}
              {showEs && (
                <Flex justify="space-between">
                  <Text size={2}>Spanish subscribers</Text>
                  <Text size={2} weight="semibold">{counts.es.toLocaleString()}</Text>
                </Flex>
              )}
            </Stack>
          </Card>
        ) : null}

        {alreadySent && sentAtFormatted && (
          <Card padding={3} radius={2} tone="caution">
            <Text size={1}>
              Warning: This post was already sent on {sentAtFormatted}. Sending again will reach the same subscribers.
            </Text>
          </Card>
        )}

        <Text muted size={1}>
          Only confirmed subscribers receive emails. Pending and unsubscribed addresses are excluded.
        </Text>

        <Flex gap={2} justify="flex-end">
          <Button mode="ghost" onClick={handleClose} text="Cancel" />
          <Button
            disabled={countsLoading}
            icon={EnvelopeIcon}
            onClick={handleSend}
            text={
              counts
                ? `Send to ${totalCount.toLocaleString()} ${totalCount === 1 ? 'person' : 'people'}`
                : 'Send Newsletter'
            }
            tone={alreadySent ? 'caution' : 'primary'}
          />
        </Flex>
      </Stack>
    </Box>
  )
}

export const sendNewsletterAction: DocumentActionComponent = function SendNewsletterAction(
  props: DocumentActionProps
) {
  const { id, published, onComplete } = props
  const [dialogOpen, setDialogOpen] = useState(false)

  const publishedDoc = published as (Record<string, unknown> & {
    newsletterSentAt?: string
    locale?: string
    relatedPost?: { _ref: string }
  }) | null
  const isPublished = !!publishedDoc
  const alreadySent = !!publishedDoc?.newsletterSentAt
  const sentAt = publishedDoc?.newsletterSentAt
  const postLocale = (publishedDoc?.locale ?? 'en') as 'en' | 'es'
  const hasRelatedPost = !!publishedDoc?.relatedPost?._ref

  const handleOpen = useCallback(() => setDialogOpen(true), [])
  const handleClose = useCallback(() => setDialogOpen(false), [])

  return {
    disabled: !isPublished,
    icon: EnvelopeIcon,
    label: alreadySent ? 'Resend Newsletter' : 'Send Newsletter',
    title: !isPublished ? 'Publish post before sending newsletter' : undefined,
    tone: alreadySent ? 'caution' : undefined,
    onHandle: handleOpen,
    dialog: dialogOpen
      ? {
          type: 'dialog' as const,
          header: alreadySent ? 'Resend Newsletter' : 'Send Newsletter',
          onClose: handleClose,
          content: (
            <SendNewsletterDialog
              postId={id}
              postLocale={postLocale}
              hasRelatedPost={hasRelatedPost}
              alreadySent={alreadySent}
              sentAt={sentAt}
              onClose={handleClose}
              onComplete={onComplete}
            />
          ),
        }
      : undefined,
  }
}
