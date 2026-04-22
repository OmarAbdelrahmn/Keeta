'use strict';

if (!window.__keetaInjected) {
  window.__keetaInjected = true;

  let latestMtgsig = null;

  (function injectInterceptor() {
    const script = document.createElement('script');
    script.textContent = `(function() {
      if (window.__keetaInterceptorActive) return;
      window.__keetaInterceptorActive = true;
      function capture(headers) {
        try {
          let sig = null;
          if (!headers) return;
          if (typeof headers.get === 'function') {
            sig = headers.get('mtgsig');
          } else if (typeof headers === 'object') {
            const key = Object.keys(headers).find(k => k.toLowerCase() === 'mtgsig');
            if (key) sig = headers[key];
          }
          if (sig) window.postMessage({ __keetaSig: sig }, '*');
        } catch(_) {}
      }
      const _fetch = window.fetch;
      window.fetch = function(url, opts) {
        if (opts && opts.headers) capture(opts.headers);
        return _fetch.apply(this, arguments);
      };
      const _setHeader = XMLHttpRequest.prototype.setRequestHeader;
      XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        if (typeof name === 'string' && name.toLowerCase() === 'mtgsig') {
          window.postMessage({ __keetaSig: value }, '*');
        }
        return _setHeader.call(this, name, value);
      };
    })();`;
    const target = document.head || document.documentElement;
    target.insertBefore(script, target.firstChild);
    script.remove();
  })();

  window.addEventListener('message', e => {
    if (e.source === window && e.data && e.data.__keetaSig) {
      latestMtgsig = e.data.__keetaSig;
    }
  });

  function generateTraceId() {
    return String(Math.floor(Math.random() * 9e18));
  }

  function buildHeaders(extraHeaders) {
    const headers = {
      'Accept':       'application/json, text/plain, */*',
      'Content-Type': 'application/json;charset=UTF-8',
      'locale':       'ar',
      'region':       'SA',
      'm-appkey':     'fe_com.sankuai.sailorfe.d.pc',
      'm-traceid':    generateTraceId(),
      ...(extraHeaders || {}),
    };
    if (latestMtgsig) headers['mtgsig'] = latestMtgsig;
    return headers;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'API_FETCH') return false;

    const fetchOptions = {
      method:      message.method || 'POST',
      credentials: 'include',
      headers:     buildHeaders(message.headers || {}),
    };

    if (message.body != null) {
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
          sendResponse({ data: await res.json() });
        } catch (e) {
          sendResponse({ error: `JSON parse: ${e.message}` });
        }
      })
      .catch(err => sendResponse({ error: err.message }));

    return true;
  });
}