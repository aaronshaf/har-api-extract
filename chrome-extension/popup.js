// Import formatter functions
const script = document.createElement('script');
script.src = 'formatter.js';
document.head.appendChild(script);

let capturedHAR = null;
let formattedOutput = '';
let isCapturing = false;
let retryCount = 0;
const MAX_RETRIES = 3;

// Check if capture is already in progress when popup opens
window.addEventListener('DOMContentLoaded', async () => {
  const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
  if (response.isCapturing) {
    isCapturing = true;
    const button = document.getElementById('extract');
    const status = document.getElementById('status');
    
    button.textContent = 'Stop & Process';
    button.style.background = '#f44336';
    status.className = 'info';
    status.textContent = 'Recording network activity... Click "Stop" when ready.';
  }
});

document.getElementById('extract').addEventListener('click', async () => {
  const button = document.getElementById('extract');
  const status = document.getElementById('status');
  const stats = document.getElementById('stats');
  const copyButton = document.getElementById('copy');
  
  if (!isCapturing) {
    // Start capture
    button.disabled = true;
    button.textContent = 'Capturing...';
    status.className = 'info';
    status.textContent = 'Recording network activity... Click "Stop" when ready.';
    copyButton.style.display = 'none';
    stats.textContent = '';
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Start capture
      const response = await chrome.runtime.sendMessage({ 
        action: 'startCapture', 
        tabId: tab.id 
      });
      
      if (response.success) {
        isCapturing = true;
        button.disabled = false;
        button.textContent = 'Stop & Process';
        button.style.background = '#f44336';
      } else {
        throw new Error(response.error || 'Failed to start capture');
      }
    } catch (error) {
      status.className = 'error';
      status.textContent = `Error: ${error.message}`;
      button.disabled = false;
      button.textContent = 'Record API Requests';
      isCapturing = false;
    }
  } else {
    // Stop capture and process
    button.disabled = true;
    button.textContent = 'Processing...';
    showProgress(true, 'Collecting response bodies...');
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'stopCapture' });
      
      if (response.success) {
        capturedHAR = response.har;
        showProgress(true, 'Processing HAR data...', 80);
        processHAR();
        showProgress(false);
        
        button.textContent = 'Record API Requests';
        button.style.background = '#4CAF50';
        button.disabled = false;
        isCapturing = false;
        retryCount = 0;
      } else {
        throw new Error(response.error || 'Failed to stop capture');
      }
    } catch (error) {
      showProgress(false);
      
      // Handle specific error types
      if (error.message.includes('Message length exceeded')) {
        status.className = 'error';
        status.textContent = 'Error: Captured data too large. Try recording fewer requests.';
        showRetryButton(true);
      } else if (error.message.includes('Debugger is already attached')) {
        status.className = 'error';
        status.textContent = 'Error: Close DevTools and try again.';
      } else {
        status.className = 'error';
        status.textContent = `Error: ${error.message}`;
        if (retryCount < MAX_RETRIES) {
          showRetryButton(true);
        }
      }
      
      button.disabled = false;
      button.textContent = 'Record API Requests';
      button.style.background = '#4CAF50';
      isCapturing = false;
    }
  }
});

function processHAR() {
  const status = document.getElementById('status');
  const stats = document.getElementById('stats');
  const copyButton = document.getElementById('copy');
  
  if (!capturedHAR || !capturedHAR.log || !capturedHAR.log.entries) {
    status.className = 'error';
    status.textContent = 'No data captured';
    return;
  }
  
  // Filter for JSON/GraphQL requests
  const filtered = filterJSONAndGraphQLEntries(capturedHAR.log.entries);
  
  if (filtered.length === 0) {
    status.className = 'info';
    status.textContent = 'No JSON or GraphQL requests found';
    stats.textContent = `Total requests captured: ${capturedHAR.log.entries.length}`;
    return;
  }
  
  // Format for LLM
  formattedOutput = formatForLLM(filtered);
  
  // Show stats
  const graphqlCount = filtered.filter(e => isGraphQLRequest(e)).length;
  const restCount = filtered.length - graphqlCount;
  
  stats.textContent = `Found ${filtered.length} API requests (${graphqlCount} GraphQL, ${restCount} REST)`;
  
  status.className = 'success';
  status.textContent = 'Complete! Click "Copy to Clipboard" to copy.';
  copyButton.style.display = 'block';
  document.getElementById('save').style.display = 'block';
}

document.getElementById('copy').addEventListener('click', async () => {
  const status = document.getElementById('status');
  
  try {
    await navigator.clipboard.writeText(formattedOutput);
    status.className = 'success';
    status.textContent = 'Copied to clipboard!';
    
    // Reset status after 2 seconds
    setTimeout(() => {
      status.textContent = 'Ready to extract';
      status.className = '';
    }, 2000);
  } catch (error) {
    status.className = 'error';
    status.textContent = 'Failed to copy to clipboard';
  }
});

// Save as HAR file
document.getElementById('save').addEventListener('click', () => {
  if (!capturedHAR) return;
  
  const blob = new Blob([JSON.stringify(capturedHAR, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  
  chrome.downloads.download({
    url: url,
    filename: `api-capture-${timestamp}.har`,
    saveAs: true
  }, () => {
    URL.revokeObjectURL(url);
    const status = document.getElementById('status');
    status.className = 'success';
    status.textContent = 'HAR file saved!';
    setTimeout(() => {
      status.textContent = 'Ready to extract';
      status.className = '';
    }, 2000);
  });
});

// Retry button
document.getElementById('retry').addEventListener('click', async () => {
  retryCount++;
  document.getElementById('retry').style.display = 'none';
  
  if (isCapturing) {
    // Retry stopping
    document.getElementById('extract').click();
  } else {
    // Clear error and allow new recording
    const status = document.getElementById('status');
    status.className = 'info';
    status.textContent = 'Ready to record. Click "Record API Requests" to start.';
  }
});

// Helper functions
function showProgress(show, message = '', percent = 0) {
  const progressDiv = document.getElementById('progress');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  
  if (show) {
    progressDiv.style.display = 'block';
    progressBar.style.width = `${percent}%`;
    progressText.textContent = message;
  } else {
    progressDiv.style.display = 'none';
  }
}

function showRetryButton(show) {
  const retryButton = document.getElementById('retry');
  retryButton.style.display = show ? 'block' : 'none';
}

// Check for saved HAR from keyboard shortcut
chrome.storage.local.get(['lastHAR', 'timestamp'], (result) => {
  if (result.lastHAR && result.timestamp) {
    // Check if HAR is recent (within last 5 minutes)
    if (Date.now() - result.timestamp < 5 * 60 * 1000) {
      capturedHAR = result.lastHAR;
      processHAR();
      chrome.storage.local.remove(['lastHAR', 'timestamp']);
    }
  }
});

