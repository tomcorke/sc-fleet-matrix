// Relays the viewer's hangar request to the background worker, which can make
// signed-in requests to RSI, and posts the result back to the page.
document.documentElement.dataset.scFleetHangar = '1';

window.addEventListener('message', async (event) => {
  if (event.source !== window || event.data?.type !== 'sc-fleet:hangar') {
    return;
  }

  const result = await chrome.runtime.sendMessage('hangar');

  window.postMessage(
    { type: 'sc-fleet:hangar-result', ...result },
    window.location.origin,
  );
});
