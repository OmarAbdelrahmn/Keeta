// popup.js - External script to handle dashboard opening
(function() {
  const btn = document.getElementById('btnOpen');
  if (btn) {
    btn.addEventListener('click', () => {
      const url = chrome.runtime.getURL('dashboard.html');
      chrome.tabs.create({ url: url });
    });
  }
})();
