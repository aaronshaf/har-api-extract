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
      .catch(error => {
        console.error('Start capture error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'stopCapture') {
    stopCapture()
      .then(har => sendResponse({ success: true, har }))
      .catch(error => {
        console.error('Stop capture error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

async function startCapture(tabId) {
  try {
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
    
    console.log('Capture started for tab', tabId);
  } catch (error) {
    debuggeeId = null;
    capturedRequests = [];
    isCapturing = false;
    throw error;
  }
}

async function stopCapture() {
  if (!debuggeeId) {
    throw new Error('No capture in progress');
  }
  
  console.log('Stopping capture, processing', capturedRequests.length, 'requests');
  
  // Wait a bit for any pending network events to complete
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Collect response bodies for requests that have finished loading
  const bodyPromises = [];
  for (const request of capturedRequests) {
    if (request.response && !request.response.body && request.loadingFinished) {
      bodyPromises.push(
        fetchResponseBody(request.requestId).then(body => {
          if (body) {
            request.response.body = body;
          }
        })
      );
    }
  }
  
  // Wait for all body fetches to complete
  await Promise.all(bodyPromises);
  
  console.log('Collected bodies, detaching debugger');
  
  // Detach debugger
  chrome.debugger.onEvent.removeListener(onDebuggerEvent);
  
  try {
    await chrome.debugger.detach(debuggeeId);
  } catch (error) {
    console.warn('Error detaching debugger:', error);
  }
  
  const har = convertToHAR(capturedRequests);
  
  // Check HAR size and truncate if needed
  const harString = JSON.stringify(har);
  const MAX_MESSAGE_SIZE = 50 * 1024 * 1024; // 50MB limit to be safe
  
  if (harString.length > MAX_MESSAGE_SIZE) {
    console.warn(`HAR too large (${harString.length} bytes), truncating entries...`);
    
    // Remove entries until we're under the limit
    while (har.log.entries.length > 1 && JSON.stringify(har).length > MAX_MESSAGE_SIZE) {
      har.log.entries.pop();
    }
    
    console.log(`Truncated to ${har.log.entries.length} entries`);
  }
  
  // Clean up
  debuggeeId = null;
  capturedRequests = [];
  isCapturing = false;
  
  console.log('HAR generated with', har.log.entries.length, 'entries');
  
  return har;
}

// Helper function to fetch response body with proper error handling
async function fetchResponseBody(requestId, maxSize = 100000) {
  if (!debuggeeId) return null;
  
  return new Promise((resolve) => {
    chrome.debugger.sendCommand(
      debuggeeId,
      "Network.getResponseBody",
      { requestId },
      (response) => {
        // Always check for runtime errors
        if (chrome.runtime.lastError) {
          // This is expected for some resources (images, failed requests, etc)
          // Just log it at debug level
          console.debug(`No body available for ${requestId}:`, chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        
        if (response && response.body) {
          // Truncate large response bodies to prevent message size issues
          if (response.body.length > maxSize) {
            console.log(`Truncating large response body for ${requestId}: ${response.body.length} -> ${maxSize}`);
            resolve(response.body.substring(0, maxSize) + '\n[TRUNCATED]');
          } else {
            resolve(response.body);
          }
        } else {
          resolve(null);
        }
      }
    );
  });
}

function onDebuggerEvent(source, method, params) {
  if (!debuggeeId || source.tabId !== debuggeeId.tabId) return;
  
  switch (method) {
    case "Network.requestWillBeSent":
      // Truncate large request bodies
      let postData = params.request.postData;
      if (postData && postData.length > 100000) {
        console.log(`Truncating large request body: ${postData.length} -> 100000`);
        postData = postData.substring(0, 100000) + '\n[TRUNCATED]';
      }
      
      capturedRequests.push({
        requestId: params.requestId,
        request: {
          url: params.request.url,
          method: params.request.method,
          headers: params.request.headers,
          postData: postData,
          timestamp: params.timestamp
        },
        loadingFinished: false
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
      if (finishedRequest) {
        finishedRequest.loadingFinished = true;
        
        // Try to get response body immediately if we have a response
        if (finishedRequest.response) {
          fetchResponseBody(params.requestId).then(body => {
            if (body && finishedRequest.response) {
              finishedRequest.response.body = body;
            }
          });
        }
      }
      break;
      
    case "Network.loadingFailed":
      const failedRequest = capturedRequests.find(r => r.requestId === params.requestId);
      if (failedRequest) {
        failedRequest.failed = true;
        failedRequest.errorText = params.errorText;
      }
      break;
  }
}

function convertToHAR(requests) {
  const entries = requests
    .filter(r => r.response && !r.failed) // Exclude failed requests
    .map(r => {
      const entry = {
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
            text: r.response.body || ""
          }
        }
      };
      
      // Remove undefined postData if not present
      if (!entry.request.postData) {
        delete entry.request.postData;
      }
      
      return entry;
    });
    
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
    console.log('Debugger detached:', reason);
    debuggeeId = null;
    capturedRequests = [];
    isCapturing = false;
  }
});