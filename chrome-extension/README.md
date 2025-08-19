# Record API Requests - Chrome Extension

A Chrome extension that records JSON/GraphQL API requests from any webpage and formats them for LLM analysis.

## Features

- 🔴 **One-click recording** - Start/stop recording with a single button
- 🎯 **Smart filtering** - Automatically captures only JSON and GraphQL requests
- 📋 **Quick export** - Copy formatted output directly to clipboard
- 🔍 **Real-time capture** - See request counts as they happen
- 🚀 **Lightweight** - No external dependencies, pure JavaScript

## Installation

### From Source (Development)

1. Clone this repository:
```bash
git clone https://github.com/aaronshaf/har-api-extract.git
cd har-api-extract/chrome-extension
```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the `chrome-extension` folder

5. The extension icon will appear in your toolbar

### From Chrome Web Store

*Coming soon - currently available as developer install only*

## Usage

### Recording API Requests

1. **Navigate to the target page** - Open the website you want to capture API requests from

2. **Click the extension icon** - A popup will appear with the recording interface

3. **Start recording** - Click "Record API Requests" button
   - The button will turn red and change to "Stop"
   - A yellow banner appears at the top of the page indicating recording is active

4. **Perform actions** - Interact with the website to trigger API calls
   - Reload the page
   - Click buttons
   - Navigate through the app
   - Submit forms

5. **Stop recording** - Click the "Stop" button when done
   - The extension will process captured requests
   - Statistics will show the number of API requests found

6. **Copy to clipboard** - Click "Copy to Clipboard" to get the formatted output

### Understanding the Output

The extension generates XML-formatted output optimized for LLM analysis:

```xml
<api_requests total="5" graphql="2" rest="3">
  <request index="1" type="rest">
    <url method="POST">https://api.example.com/users</url>
    <status code="200" duration="145ms"/>
    <request_body>
      {"name": "John Doe", "email": "john@example.com"}
    </request_body>
    <response>
      {"id": 123, "name": "John Doe", "status": "created"}
    </response>
  </request>
  
  <request index="2" type="graphql">
    <url method="POST">https://api.example.com/graphql</url>
    <operation>GetUserProfile</operation>
    <graphql_query>
      query GetUserProfile($id: ID!) {
        user(id: $id) { name email avatar }
      }
    </graphql_query>
    <variables>
      {"id": "123"}
    </variables>
    <response>
      {"data": {"user": {"name": "John Doe", "email": "john@example.com"}}}
    </response>
  </request>
</api_requests>
```

## Screenshots

### Extension Popup
![Extension Popup](screenshots/popup.png)
*The main interface for recording API requests*

### Recording in Progress
![Recording State](screenshots/recording.png)
*Visual feedback when actively recording*

### Results View
![Results](screenshots/results.png)
*Summary of captured API requests*

## Limitations

- **Size limits** - Large request/response bodies are truncated to 100KB to prevent memory issues
- **HTTPS only** - Some sites may require HTTPS to allow debugging
- **DevTools conflict** - Cannot record while Chrome DevTools is open on the same tab
- **Cross-origin** - Cannot capture requests from iframes with different origins

## Troubleshooting

### "Debugger is already attached"
- Close Chrome DevTools for the tab you're trying to record
- Only one debugger can be attached at a time

### "No API requests found"
- Ensure the page is making JSON or GraphQL requests
- Check Network tab in DevTools to verify requests are being made
- Try reloading the page after starting recording

### Extension doesn't appear
- Make sure Developer Mode is enabled in chrome://extensions/
- Try reloading the extension
- Check for errors in the extension's background page console

### Recording gets stuck on "Processing"
- This usually means the captured data is too large
- Try recording fewer requests or shorter sessions
- Check the extension's background page console for errors

## Privacy & Security

- **Local processing only** - All data processing happens locally in your browser
- **No data transmission** - The extension never sends your data anywhere
- **Temporary storage** - Captured data is cleared when you close the popup
- **No permissions abuse** - Only requests minimal required permissions

## Development

### Building from Source

The extension is written in vanilla JavaScript and doesn't require a build step. To modify:

1. Edit the source files directly
2. Reload the extension in chrome://extensions/
3. Test your changes

### Project Structure

```
chrome-extension/
├── manifest.json       # Extension configuration
├── popup.html         # Popup UI
├── popup.js          # Popup logic
├── background.js     # Service worker for debugging API
├── formatter.js      # HAR to LLM format conversion
├── icon*.png        # Extension icons
└── README.md        # This file
```

### Contributing

Pull requests are welcome! Please:
- Test your changes thoroughly
- Update documentation if needed
- Follow the existing code style

## License

MIT - See LICENSE file in the root repository