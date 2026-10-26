// Chrome and Edge call this when the user clicks the toolbar icon.
// Opening our own packaged page does not require the "tabs" permission.
async function openChecker() {
  return chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
}

chrome.action.onClicked.addListener(openChecker);
