/**
 * Manages the full audio capture + Soniox streaming pipeline.
 *
 * Two parallel audio sources → two Soniox WebSockets:
 *  WS1 (tab)  — other participants' audio via chrome.tabCapture
 *  WS2 (mic)  — local speaker's microphone via injected content script (mic-bridge.js)
 *               The content script runs in the meeting tab context where mic permission
 *               prompts ARE shown (side panels can't show them).
 *
 * Both WS streams produce utterances that are merged into a single transcript.
 */

import { useState, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import type { LiveToken, UtterancePayload } from '../../types'

const SONIOX_WS = 'wss://stt-rt.eu.soniox.com/transcribe-websocket'

interface UseSonioxOptions {
  meetingId: string
  languageHints: string[]
  onUtterance: (u: UtterancePayload) => void
}

export function useSoniox({ meetingId, languageHints, onUtterance }: UseSonioxOptions) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [liveText, setLiveText] = useState('')

  // Tab audio WS
  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const finalBufRef = useRef<LiveToken[]>([])

  // Mic WS (content-script relay)
  const micWsRef = useRef<WebSocket | null>(null)
  const micFinalBufRef = useRef<LiveToken[]>([])
  const captureTabIdRef = useRef<number | null>(null)
  const micListenerRef = useRef<((msg: any, sender: chrome.runtime.MessageSender) => void) | null>(null)

  const sequenceRef = useRef(0)
  const meetingStartRef = useRef<number>(0)

  // ── Token handling (shared between tab and mic WS) ──────────────────────────

  function handleTokens(
    rawTokens: LiveToken[],
    finalBuf: React.MutableRefObject<LiveToken[]>,
    source: 'tab' | 'mic',
  ) {
    // Strip non-speech metadata tokens Soniox emits (e.g. <dev>, <noise>)
    const tokens = rawTokens.filter((t) => !/^<[^>]+>$/.test(t.text))
    if (tokens.length === 0) return

    const allFinal = tokens.every((t) => t.is_final)

    if (allFinal) {
      const utteranceTokens = [...finalBuf.current, ...tokens]
      finalBuf.current = []

      if (utteranceTokens.length === 0) return
      const text = utteranceTokens.map((t) => t.text).join('').trim()
      if (!text) return

      const payload: UtterancePayload = {
        speaker_id: utteranceTokens[0].speaker,
        speaker_label: null,
        text,
        language: utteranceTokens[0].language,
        timestamp_ms: Date.now() - meetingStartRef.current,
        sequence_number: ++sequenceRef.current,
      }

      onUtterance(payload)
      if (source === 'tab') setLiveText('')

      api.meetings.utterance(meetingId, payload).catch(console.error)
    } else {
      const newFinals = tokens.filter((t) => t.is_final)
      finalBuf.current.push(...newFinals)

      if (source === 'tab') {
        const partials = tokens.filter((t) => !t.is_final)
        setLiveText([
          ...finalBuf.current.map((t) => t.text),
          ...partials.map((t) => t.text),
        ].join(''))
      }
    }
  }

  function makeMsgHandler(
    _ws: WebSocket,
    finalBuf: React.MutableRefObject<LiveToken[]>,
    source: 'tab' | 'mic',
  ) {
    return (msg: MessageEvent) => {
      let data: { tokens?: LiveToken[]; error_message?: string | null }
      try { data = JSON.parse(msg.data as string) } catch { return }

      if (data.error_message) {
        setError(`Soniox error (${source}): ${data.error_message}`)
        stop()
        return
      }
      handleTokens(data.tokens ?? [], finalBuf, source)
    }
  }

  // ── Stop ────────────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    // Tab audio cleanup
    recorderRef.current?.stop()
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send('')
    wsRef.current?.close()
    wsRef.current = null

    // Mic cleanup
    if (captureTabIdRef.current) {
      chrome.tabs.sendMessage(captureTabIdRef.current, { type: 'BRAGE_STOP_MIC' }).catch(() => {})
      captureTabIdRef.current = null
    }
    if (micListenerRef.current) {
      chrome.runtime.onMessage.removeListener(micListenerRef.current)
      micListenerRef.current = null
    }
    if (micWsRef.current?.readyState === WebSocket.OPEN) micWsRef.current.send('')
    micWsRef.current?.close()
    micWsRef.current = null

    setRecording(false)
    setLiveText('')
  }, [])

  // ── Start ───────────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    setError(null)

    // 1. Fetch Soniox API key
    let sonioxApiKey: string
    try {
      const config = await api.meetings.sonioxConfig()
      sonioxApiKey = config.api_key
    } catch {
      setError('Could not fetch Soniox API key from hub. Is the hub running?')
      return
    }

    // 2. Get tab stream ID from session storage
    let captureTabId: number
    let tabStream: MediaStream
    try {
      const stored = await chrome.storage.session.get('captureTabId')
      if (!stored.captureTabId) {
        throw new Error('Close the panel, go to your meeting tab, then click the Brage toolbar icon to reopen it.')
      }
      captureTabId = Number(stored.captureTabId)

      const streamId = await new Promise<string>((resolve, reject) => {
        chrome.tabCapture.getMediaStreamId({ targetTabId: captureTabId }, (id) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
          else resolve(id)
        })
      })

      tabStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // @ts-ignore — Chrome-specific constraint
          mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId },
        },
        video: false,
      })
    } catch (e: any) {
      setError(`Tab capture failed: ${e.message}`)
      return
    }

    streamRef.current = tabStream
    captureTabIdRef.current = captureTabId
    meetingStartRef.current = Date.now()

    // 3. Open tab Soniox WS
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

      const recorder = new MediaRecorder(tabStream, { mimeType: 'audio/webm' })
      recorderRef.current = recorder
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data)
      }
      recorder.onstop = () => { if (ws.readyState === WebSocket.OPEN) ws.send('') }
      recorder.start(250)
      setRecording(true)
    }

    ws.onmessage = makeMsgHandler(ws, finalBufRef, 'tab')
    ws.onerror = () => setError('Soniox WebSocket error — check browser console.')
    ws.onclose = (e) => {
      if (e.code !== 1000 && e.code !== 1005) {
        setError(`Soniox disconnected (code ${e.code}${e.reason ? `: ${e.reason}` : ''})`)
      }
      setRecording(false)
      setLiveText('')
    }

    // 4. Set up mic via content script (runs in tab context, CAN prompt for mic)
    try {
      // Inject mic-bridge.js into the meeting tab
      await chrome.scripting.executeScript({
        target: { tabId: captureTabId },
        files: ['mic-bridge.js'],
      })

      // Open mic Soniox WS
      const micWs = new WebSocket(SONIOX_WS)
      micWsRef.current = micWs

      micWs.onopen = () => {
        micWs.send(JSON.stringify({
          api_key: sonioxApiKey,
          model: 'stt-rt-v4',
          audio_format: 'auto',
          enable_endpoint_detection: true,
          language_hints: languageHints,
        }))
        // Ask content script to start capturing microphone
        chrome.tabs.sendMessage(captureTabId, { type: 'BRAGE_START_MIC' }).catch(console.warn)
      }

      micWs.onmessage = makeMsgHandler(micWs, micFinalBufRef, 'mic')
      micWs.onerror = () => console.warn('[Soniox] Mic WS error')
      micWs.onclose = (e) => console.warn(`[Soniox] Mic WS closed (${e.code})`)

      // Listen for mic audio chunks from content script
      const listener = (msg: any, sender: chrome.runtime.MessageSender) => {
        if (sender.tab?.id !== captureTabId) return
        if (msg.type === 'BRAGE_MIC_CHUNK' && micWs.readyState === WebSocket.OPEN) {
          const binary = atob(msg.b64)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          micWs.send(bytes)
        }
        if (msg.type === 'BRAGE_MIC_ERROR') {
          console.warn('[Soniox] Mic capture error in tab:', msg.message)
        }
      }
      chrome.runtime.onMessage.addListener(listener)
      micListenerRef.current = listener
    } catch (e) {
      console.warn('[Soniox] Could not set up mic capture:', e)
      // Non-fatal — tab audio still works
    }
  }, [meetingId, languageHints, onUtterance, stop])

  return { recording, error, liveText, start, stop }
}
