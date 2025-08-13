// Background service worker to handle debugger API
let debuggeeId = null;
let capturedRequests = [];
let isCapturing = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatus') {
    sendResponse({ isCapturing, tabId: debuggeeId?.tabId });
    return false;
  }
  
  if (request.action === 'startCapture') {
    startCapture(request.tabId)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'stopCapture') {
    stopCapture()
      .then(har => sendResponse({ success: true, har }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function startCapture(tabId) {
  debuggeeId = { tabId };
  capturedRequests = [];
  isCapturing = true;
  
  // Attach debugger
  await chrome.debugger.attach(debuggeeId, "1.3");
  
  // Enable network domain
  await chrome.debugger.sendCommand(debuggeeId, "Network.enable", {
    maxPostDataSize: 65536
  });
  
  // Listen for network events
  chrome.debugger.onEvent.addListener(onDebuggerEvent);
}

async function stopCapture() {
  if (!debuggeeId) {
    throw new Error('No capture in progress');
  }
  
  // Detach debugger
  chrome.debugger.onEvent.removeListener(onDebuggerEvent);
  await chrome.debugger.detach(debuggeeId);
  
  const har = convertToHAR(capturedRequests);
  debuggeeId = null;
  capturedRequests = [];
  isCapturing = false;
  
  return har;
}

function onDebuggerEvent(source, method, params) {
  if (source.tabId !== debuggeeId.tabId) return;
  
  switch (method) {
    case "Network.requestWillBeSent":
      capturedRequests.push({
        requestId: params.requestId,
        request: {
          url: params.request.url,
          method: params.request.method,
          headers: params.request.headers,
          postData: params.request.postData,
          timestamp: params.timestamp
        }
      });
      break;
      
    case "Network.responseReceived":
      const request = capturedRequests.find(r => r.requestId === params.requestId);
      if (request) {
        request.response = {
          status: params.response.status,
          statusText: params.response.statusText,
          headers: params.response.headers,
          mimeType: params.response.mimeType,
          timestamp: params.timestamp
        };
      }
      break;
      
    case "Network.loadingFinished":
      const finishedRequest = capturedRequests.find(r => r.requestId === params.requestId);
      if (finishedRequest && finishedRequest.response) {
        // Get response body
        chrome.debugger.sendCommand(debuggeeId, "Network.getResponseBody", 
          { requestId: params.requestId },
          (result) => {
            if (result) {
              finishedRequest.response.body = result.body;
            }
          }
        );
      }
      break;
  }
}

function convertToHAR(requests) {
  const entries = requests
    .filter(r => r.response && r.response.body)
    .map(r => ({
      startedDateTime: new Date(r.request.timestamp * 1000).toISOString(),
      time: r.response.timestamp ? (r.response.timestamp - r.request.timestamp) * 1000 : 0,
      request: {
        method: r.request.method,
        url: r.request.url,
        headers: Object.entries(r.request.headers || {}).map(([name, value]) => ({ name, value })),
        postData: r.request.postData ? {
          mimeType: r.request.headers?.['content-type'] || 'application/json',
          text: r.request.postData
        } : undefined
      },
      response: {
        status: r.response.status,
        statusText: r.response.statusText,
        headers: Object.entries(r.response.headers || {}).map(([name, value]) => ({ name, value })),
        content: {
          size: r.response.body ? r.response.body.length : 0,
          mimeType: r.response.mimeType,
          text: r.response.body
        }
      }
    }));
    
  return {
    log: {
      version: "1.2",
      creator: {
        name: "HAR API Extractor",
        version: "1.0"
      },
      entries
    }
  };
}

// Handle debugger detachment (user closes DevTools or navigates away)
chrome.debugger.onDetach.addListener((source, reason) => {
  if (debuggeeId && source.tabId === debuggeeId.tabId) {
    debuggeeId = null;
    capturedRequests = [];
    isCapturing = false;
  }
});