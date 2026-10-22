// Relays named requests to the background worker and posts results to the page.
document.documentElement.dataset.scFleetHangar =
  chrome.runtime.getManifest().version;

window.addEventListener('message', async (event) => {
  if (event.source !== window || event.data?.type !== 'sc-fleet:request') {
    return;
  }

  const kind = event.data.kind;
  const result =
    typeof kind === 'string'
      ? await chrome.runtime.sendMessage(kind)
      : { error: 'Unknown request kind.' };

  window.postMessage(
    { type: 'sc-fleet:response', kind, ...result },
    window.location.origin,
  );
});
