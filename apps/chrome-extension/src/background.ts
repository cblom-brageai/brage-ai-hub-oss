/**
 * Background service worker.
 * Opens the side panel when the extension action icon is clicked.
 * Meeting session state is stored in chrome.storage.local.
 */

chrome.action.onClicked.addListener((tab) => {
  if (tab.id == null) return
  chrome.sidePanel.open({ tabId: tab.id })
})

// Allow the side panel to be opened on all URLs (any meeting platform)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
