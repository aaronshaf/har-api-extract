# har-api-extract

A CLI tool to extract and format JSON/GraphQL API requests from HAR files for LLM analysis.

## Features

- Extract all JSON and GraphQL requests from HAR files
- Format output optimized for LLM analysis
- Read from file or stdin
- Built with TypeScript and Effect

## Installation

### Quick Usage (no install)

```bash
npx har-api-extract network.har
```

### Global Install

```bash
npm install -g har-api-extract

# Then use directly
har-api-extract network.har
```

### From Source

```bash
git clone https://github.com/aaronshaf/har-api-extract.git
cd har-api-extract
npm install
```

## Usage

```bash
# Process a HAR file
har-api-extract network.har

# Read from stdin
cat network.har | har-api-extract

# Pipe to clipboard (macOS)
har-api-extract network.har | pbcopy

# Include all requests (not just JSON/GraphQL)
har-api-extract network.har --all
```

## Options

- `-a, --all` - Include all requests, not just JSON/GraphQL
- `-h, --help` - Show help message

## How to Export HAR Files

1. Open Chrome DevTools (F12 or Cmd+Option+I)
2. Go to Network tab
3. Perform the actions you want to capture
4. Click the download arrow (⬇) in the Network panel toolbar
5. Save as HAR file

## Output Format

The tool outputs XML-formatted data optimized for LLM analysis, including:
- Request method and URL
- Status code and duration
- GraphQL operation names
- Full request/response bodies (JSON formatted)
- Variables for GraphQL requests

## Example

```bash
# Extract GraphQL requests from Apollo Studio
har-api-extract examples/studio.apollographql.com.har

# Output will be XML-formatted for LLM analysis
```
