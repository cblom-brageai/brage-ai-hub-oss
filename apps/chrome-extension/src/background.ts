/**
 * Background service worker.
 * Opens the side panel when the extension action icon is clicked.
 *
 * IMPORTANT: openPanelOnActionClick must be FALSE (or unset) so that
 * chrome.action.onClicked fires. Chrome requires onClicked to fire in order
 * to record the "invocation" needed by chrome.tabCapture.getMediaStreamId.
 */

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })

chrome.action.onClicked.addListener((tab) => {
  if (tab.id == null) return
  // Store in session storage so the side panel can pass it to getMediaStreamId.
  // session storage is cleared on extension reload — prevents stale tab IDs.
  chrome.storage.session.set({ captureTabId: tab.id })
  chrome.sidePanel.open({ tabId: tab.id })
})
