# har-api-extract

A CLI tool to extract and format JSON/GraphQL API requests from HAR files for LLM analysis.

## Features

- Extract all JSON and GraphQL requests from HAR files
- Format output optimized for LLM analysis
- Compact mode for quick overview
- Read from file or stdin
- Built with Bun, TypeScript, and Effect

## Installation

### Using Bun

```bash
bun install
chmod +x har
```

### Build Standalone Binary

```bash
bun build har --compile --outfile har-binary
```

## Usage

```bash
# Process a HAR file
./har network.har

# Compact output
./har network.har --compact

# Read from stdin
cat network.har | ./har

# Pipe to clipboard (macOS)
./har network.har | pbcopy

# Include all requests (not just JSON/GraphQL)
./har network.har --all
```

## Options

- `-c, --compact` - Output in compact format
- `-a, --all` - Include all requests, not just JSON/GraphQL
- `-h, --help` - Show help message

## How to Export HAR Files

1. Open Chrome/Edge/Firefox DevTools (F12)
2. Go to Network tab
3. Perform the actions you want to capture
4. Right-click in the network panel
5. Select "Save all as HAR with content"

## Output Format

### Default (LLM-Optimized)
Provides detailed information about each request including:
- Request method and URL
- Status code and duration
- GraphQL operation names
- Full request/response bodies (JSON formatted)

### Compact Mode
Shows a quick overview with:
- Request type (GraphQL/REST)
- URL and status
- Response time
- Key response fields

## Example

```bash
# Extract GraphQL requests from Apollo Studio
./har examples/studio.apollographql.com.har --compact

# Output:
# API Requests Overview
# 7 total requests (6 GraphQL, 1 REST)
#
# [GraphQL: RoutedAppMeQuery] POST https://graphql.api.apollographql.com/api/graphql -> 200 (42ms)
#   Response keys: me
# ...
```
