'use strict';

/**
 * Background Service Worker — Message Router
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes API_FETCH requests from the dashboard to the content script running
 * inside a courier.mykeeta.com tab. The content script fetch runs in the
 * same-origin context so all session cookies are sent automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SITE_ORIGIN = 'https://courier.mykeeta.com/*';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'API_FETCH') return false;

  chrome.tabs.query({ url: SITE_ORIGIN }, tabs => {
    if (!tabs || tabs.length === 0) {
      sendResponse({
        error: 'NO_TAB',
        message: 'يرجى فتح الموقع https://courier.mykeeta.com في أحد التبويبات أولاً',
      });
      return;
    }

    const target = tabs.find(t => t.status === 'complete') || tabs[0];

    chrome.tabs.sendMessage(target.id, message, response => {
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript(
          { target: { tabId: target.id }, files: ['content.js'] },
          () => {
            if (chrome.runtime.lastError) {
              sendResponse({ error: `Script inject failed: ${chrome.runtime.lastError.message}` });
              return;
            }
            setTimeout(() => {
              chrome.tabs.sendMessage(target.id, message, response2 => {
                if (chrome.runtime.lastError) {
                  sendResponse({ error: chrome.runtime.lastError.message });
                } else {
                  sendResponse(response2);
                }
              });
            }, 300);
          }
        );
      } else {
        sendResponse(response);
      }
    });
  });

  return true;
});