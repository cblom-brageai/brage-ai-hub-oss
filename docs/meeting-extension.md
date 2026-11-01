# Meeting assistant (Chrome extension)

The extension is a Manifest V3 side panel that lets the hub's agents listen to any browser-based meeting: Microsoft Teams, Google Meet, Zoom web and others.

## How it works

1. You open the meeting tab and click the extension icon. The background worker records the tab id and opens the side panel.
2. The panel asks the hub for the Soniox key (`GET /api/meetings/soniox-config`), captures the tab's audio with `chrome.tabCapture`, injects a small content script to capture your own microphone, and opens two WebSockets to Soniox (`stt-rt-v4`, diarisation and language identification enabled).
3. Soniox returns tokens; when an utterance is final the panel `POST`s it to `/api/meetings/[id]/utterance`, which forwards it to the meeting-agent.
4. The meeting-agent fans the utterance out to the agents assigned to the meeting (decision logger, Q&A, monitor) and to invited employees when they are addressed by name. Results are written to Supabase.
5. The panel subscribes to the meeting tables over Supabase Realtime and shows transcript, decisions, answers and agenda status live. Typed questions go to the Q&A agent through `/api/meetings/[id]/chat`.
6. Ending the meeting triggers minutes generation in the background.

## Build and install

```bash
cd apps/chrome-extension
pnpm install
pnpm build          # reads ../../.env: SUPABASE_URL, SUPABASE_KEY, FRONTEND_URL
```

Then open `chrome://extensions`, enable Developer mode, "Load unpacked", and pick `apps/chrome-extension/dist`. Rebuild and press the reload button on the extension card after changing `FRONTEND_URL` or the code. `pnpm dev` rebuilds on every change.

The hub URL is baked in at build time (`FRONTEND_URL`, default `http://localhost:3000`). The manifest grants access to `localhost` and the Soniox endpoint; for a remotely hosted hub, add its origin to `host_permissions` before building (an options page with a runtime permission prompt is on the roadmap).

## Prerequisites

- `SONIOX_API_KEY` in `.env` (the meeting-agent and the hub need it).
- A Supabase user to log in with (the extension stores the session in `chrome.storage.local`).
- Migration `007_meetings.sql` applied, with Realtime enabled on the meeting tables (the migration does this).

## Using it

1. Create a meeting in the hub (Admin → Meetings → New) or from the panel: title, agenda items, language hints, which agents and employees attend.
2. On the meeting tab, click the extension icon, log in, select the meeting and press start.
3. Speak. Decisions, answers and agenda updates appear as they are detected. Ask the agents something in the chat box.
4. Press end. The minutes are written to `meeting_mom` and shown on the meeting's admin page.

## Troubleshooting

- "Close the panel, go to your meeting tab, then click the toolbar icon": the tab id was lost (extension reloaded). Do exactly that; the icon click is what authorises tab capture.
- No transcript: check `SONIOX_API_KEY`, the browser console in the panel (right-click → Inspect), and that the meeting tab is actually producing audio.
- Agents silent after a server restart: the panel always calls `/start` when it opens a meeting, which recreates the session. Reopen the meeting in the panel.
- Microphone not transcribed: the content script needs permission on the meeting tab; Chrome prompts once per site.

## Privacy

Audio goes from your browser to Soniox; transcripts and agent output go to your Supabase project. See [privacy-mode.md](privacy-mode.md) and [SECURITY.md](../SECURITY.md).
