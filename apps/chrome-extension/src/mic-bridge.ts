/**
 * Content script injected into the meeting tab.
 * Captures the local microphone and relays 250ms WebM chunks to the side panel
 * via chrome.runtime messaging. The side panel feeds these to a second Soniox
 * WebSocket so the local speaker's voice is also transcribed.
 */

let recorder: MediaRecorder | null = null
let micStream: MediaStream | null = null

async function startMic() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    recorder = new MediaRecorder(micStream, { mimeType: 'audio/webm' })
    recorder.ondataavailable = async (e) => {
      if (e.data.size > 0) {
        const buffer = await e.data.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        // base64-encode so the binary survives chrome.runtime message serialization
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        const b64 = btoa(binary)
        chrome.runtime.sendMessage({ type: 'BRAGE_MIC_CHUNK', b64 })
      }
    }
    recorder.start(250)
    chrome.runtime.sendMessage({ type: 'BRAGE_MIC_STARTED' })
  } catch (err: any) {
    chrome.runtime.sendMessage({ type: 'BRAGE_MIC_ERROR', message: err?.message ?? String(err) })
  }
}

function stopMic() {
  recorder?.stop()
  recorder = null
  micStream?.getTracks().forEach((t) => t.stop())
  micStream = null
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'BRAGE_START_MIC') startMic()
  if (msg.type === 'BRAGE_STOP_MIC') stopMic()
})
