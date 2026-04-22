'use strict';

/**
 * Content Script — runs inside courier.mykeeta.com
 * Fetches the API with same-origin cookies and required headers.
 * The mtgsig security header is extracted from the page's own signing
 * mechanism if available; otherwise the request relies on session cookies.
 */

function generateTraceId() {
  return String(Math.floor(Math.random() * 9e18));
}

/** Try to read the live mtgsig from the page context. */
function tryGetMtgsig() {
  try {
    // Some versions of the meituan JS SDK expose a global signer
    if (window.__mtgsig) return JSON.stringify(window.__mtgsig);
    if (window.MtSecurity && typeof window.MtSecurity.sign === 'function') {
      return JSON.stringify(window.MtSecurity.sign());
    }
  } catch (_) {}
  return null;
}

function buildHeaders(extraHeaders) {
  const traceId = generateTraceId();
  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json;charset=UTF-8',
    'locale': 'ar',
    'region': 'SA',
    'm-appkey': 'fe_com.sankuai.sailorfe.d.pc',
    'm-traceid': traceId,
    ...(extraHeaders || {}),
  };

  const sig = tryGetMtgsig();
  if (sig) headers['mtgsig'] = sig;

  return headers;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'API_FETCH') return false;

  const headers = buildHeaders(message.headers || {});

  const fetchOptions = {
    method: message.method || 'GET',
    credentials: 'include',
    headers,
  };

  if (message.body !== undefined && message.body !== null) {
    fetchOptions.body = typeof message.body === 'string'
      ? message.body
      : JSON.stringify(message.body);
  }

  fetch(message.url, fetchOptions)
    .then(async res => {
      const ct = res.headers.get('content-type') || '';

      if (ct.includes('text/html') && res.status !== 200) {
        sendResponse({ error: 'AUTH_REQUIRED', status: res.status });
        return;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        sendResponse({ error: `HTTP ${res.status}`, status: res.status, body });
        return;
      }

      try {
        const data = await res.json();
        sendResponse({ data });
      } catch (e) {
        sendResponse({ error: `JSON parse error: ${e.message}` });
      }
    })
    .catch(err => sendResponse({ error: err.message }));

  return true;
});