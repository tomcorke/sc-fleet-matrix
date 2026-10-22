// The content script stamps its manifest version on the page at
// document_start, so this is settled before the app renders.
export const hasExtension =
  document.documentElement.dataset.scFleetHangar === __EXTENSION_VERSION__;
