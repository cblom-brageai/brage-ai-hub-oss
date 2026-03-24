/**
 * Manages the full audio capture + Soniox streaming pipeline.
 *
 * Flow:
 *  1. User clicks "Start Recording" (user gesture required for tabCapture)
 *  2. chrome.tabCapture.capture() → MediaStream
 *  3. MediaRecorder chunks audio → WebSocket to Soniox
 *  4. Soniox streams token events:
 *     - is_final: false → update live partial text (shown in UI before finalized)
 *     - all tokens is_final: true in one batch → endpoint detected → flush as utterance
 *  5. Each finalized utterance is POSTed to the Brage backend
 */

import { useState, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import type { LiveToken, UtterancePayload } from '../../types'

const SONIOX_WS = 'wss://stt-rt-eu.soniox.com/transcribe-websocket'

interface UseSonioxOptions {
  meetingId: string
  languageHints: string[]
  onUtterance: (u: UtterancePayload) => void
}

export function useSoniox({ meetingId, languageHints, onUtterance }: UseSonioxOptions) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [liveText, setLiveText] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sequenceRef = useRef(0)
  const meetingStartRef = useRef<number>(0)

  // Accumulator: final tokens that have not yet been flushed as an utterance
  const finalBufRef = useRef<LiveToken[]>([])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send('') // Soniox end-of-audio signal
    }
    wsRef.current?.close()
    wsRef.current = null
    setRecording(false)
    setLiveText('')
  }, [])

  const start = useCallback(async () => {
    setError(null)

    // 1. Fetch org Soniox API key from hub
    let sonioxApiKey: string
    try {
      const config = await api.meetings.sonioxConfig()
      sonioxApiKey = config.api_key
    } catch (e) {
      setError('Could not fetch Soniox API key from hub. Is the hub running?')
      return
    }

    // 2. Capture active tab audio (must be called during user gesture)
    let stream: MediaStream
    try {
      stream = await new Promise<MediaStream>((resolve, reject) => {
        chrome.tabCapture.capture({ audio: true, video: false }, (s) => {
          if (chrome.runtime.lastError || !s) {
            reject(new Error(chrome.runtime.lastError?.message ?? 'tabCapture failed'))
          } else {
            resolve(s)
          }
        })
      })
    } catch (e: any) {
      setError(`Tab capture failed: ${e.message}`)
      return
    }

    streamRef.current = stream
    meetingStartRef.current = Date.now()

    // 3. Open Soniox WebSocket
    const ws = new WebSocket(SONIOX_WS)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({
        api_key: sonioxApiKey,
        model: 'stt-rt-v4',
        audio_format: 'auto',
        enable_language_identification: true,
        enable_speaker_diarization: true,
        enable_endpoint_detection: true,
        language_hints: languageHints,
      }))

      // 4. Start MediaRecorder and pipe chunks to Soniox
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data)
        }
      }

      recorder.onstop = () => {
        if (ws.readyState === WebSocket.OPEN) ws.send('')
      }

      recorder.start(250) // 250ms chunks
      setRecording(true)
    }

    // 5. Handle incoming Soniox events
    ws.onmessage = (msg) => {
      let data: { tokens?: LiveToken[]; finished?: boolean; error_message?: string | null }
      try {
        data = JSON.parse(msg.data as string)
      } catch {
        return
      }

      if (data.error_message) {
        setError(`Soniox error: ${data.error_message}`)
        stop()
        return
      }

      const tokens = data.tokens ?? []
      if (tokens.length === 0) return

      const allFinal = tokens.every((t) => t.is_final)

      if (allFinal) {
        // Endpoint detected — flush accumulated finals + this batch as one utterance
        const utteranceTokens = [...finalBufRef.current, ...tokens]
        finalBufRef.current = []

        if (utteranceTokens.length === 0) return

        const text = utteranceTokens.map((t) => t.text).join('').trim()
        if (!text) return

        const speaker = utteranceTokens[0].speaker
        const language = utteranceTokens[0].language

        const payload: UtterancePayload = {
          speaker_id: speaker,
          speaker_label: null, // set by admin after the meeting
          text,
          language,
          timestamp_ms: Date.now() - meetingStartRef.current,
          sequence_number: ++sequenceRef.current,
        }

        onUtterance(payload)
        setLiveText('')

        // Fire-and-forget POST to hub
        api.meetings.utterance(meetingId, payload).catch(console.error)
      } else {
        // Mix of final and partial tokens — keep finals, update live text
        const newFinals = tokens.filter((t) => t.is_final)
        finalBufRef.current.push(...newFinals)

        const partials = tokens.filter((t) => !t.is_final)
        const liveChunk = [
          ...finalBufRef.current.map((t) => t.text),
          ...partials.map((t) => t.text),
        ].join('')
        setLiveText(liveChunk)
      }
    }

    ws.onerror = () => setError('Soniox WebSocket error. Check your API key and network.')
    ws.onclose = () => {
      setRecording(false)
      setLiveText('')
    }
  }, [meetingId, languageHints, onUtterance, stop])

  return { recording, error, liveText, start, stop }
}
