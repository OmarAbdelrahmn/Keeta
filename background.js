'use strict';

const SITE_ORIGIN = 'https://courier.mykeeta.com/*';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'API_FETCH') return false;

  chrome.tabs.query({ url: SITE_ORIGIN }, tabs => {
    if (!tabs || tabs.length === 0) {
      sendResponse({
        error: 'NO_TAB',
        message: 'يرجى فتح https://courier.mykeeta.com في أحد التبويبات أولاً',
      });
      return;
    }

    const target = tabs.find(t => t.status === 'complete') || tabs[0];

    // Try sending first
    chrome.tabs.sendMessage(target.id, message, response => {
      if (!chrome.runtime.lastError) {
        sendResponse(response);
        return;
      }

      // Content script not loaded — inject it then retry ONCE
      chrome.scripting.executeScript(
        { target: { tabId: target.id }, files: ['content.js'] },
        () => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: `Inject failed: ${chrome.runtime.lastError.message}` });
            return;
          }
          // Small delay for script to register its listener
          setTimeout(() => {
            chrome.tabs.sendMessage(target.id, message, response2 => {
              if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
              } else {
                sendResponse(response2);
              }
            });
          }, 100);
        }
      );
    });
  });

  return true;
});