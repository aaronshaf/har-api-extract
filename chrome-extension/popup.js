// Import formatter functions
const script = document.createElement('script');
script.src = 'formatter.js';
document.head.appendChild(script);

let capturedHAR = null;
let formattedOutput = '';
let isCapturing = false;

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
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'stopCapture' });
      
      if (response.success) {
        capturedHAR = response.har;
        processHAR();
        
        button.textContent = 'Record API Requests';
        button.style.background = '#4CAF50';
        button.disabled = false;
        isCapturing = false;
      } else {
        throw new Error(response.error || 'Failed to stop capture');
      }
    } catch (error) {
      status.className = 'error';
      status.textContent = `Error: ${error.message}`;
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

