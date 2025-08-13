import { describe, test } from "node:test"
import assert from "node:assert"
import { Effect } from "effect"
import { parseHARFile } from "./parser.js"

describe("HAR version compatibility and malformed structures", () => {
  test("handles HAR 1.1 format", async () => {
    const har11 = JSON.stringify({
      log: {
        version: "1.1",
        creator: {
          name: "Old Browser",
          version: "1.0"
        },
        browser: {
          name: "Chrome",
          version: "50.0"
        },
        entries: []
      }
    })
    
    const result = await Effect.runPromise(parseHARFile(har11))
    assert.strictEqual(result.log.version, "1.1")
  })

  test("handles HAR with additional custom fields", async () => {
    const harWithCustom = JSON.stringify({
      log: {
        version: "1.2",
        creator: {
          name: "Custom Tool",
          version: "2.0",
          customField: "custom value"
        },
        entries: [],
        _custom: {
          additionalData: "test"
        },
        comment: "This is a comment"
      }
    })
    
    const result = await Effect.runPromise(parseHARFile(harWithCustom))
    assert.strictEqual(result.log.version, "1.2")
  })

  test("handles HAR with pages field", async () => {
    const harWithPages = JSON.stringify({
      log: {
        version: "1.2",
        creator: {
          name: "Browser",
          version: "1.0"
        },
        pages: [
          {
            startedDateTime: "2024-01-01T00:00:00Z",
            id: "page_1",
            title: "Test Page",
            pageTimings: {
              onContentLoad: 500,
              onLoad: 1000
            }
          }
        ],
        entries: [
          {
            pageref: "page_1",
            request: {
              method: "GET",
              url: "https://example.com",
              headers: []
            },
            response: {
              status: 200,
              statusText: "OK",
              headers: [],
              content: {
                size: 100,
                mimeType: "text/html",
                text: "<html></html>"
              }
            },
            startedDateTime: "2024-01-01T00:00:00Z",
            time: 100
          }
        ]
      }
    })
    
    const result = await Effect.runPromise(parseHARFile(harWithPages))
    assert(result.log.entries.length === 1)
  })

  test("handles HAR with cache information", async () => {
    const harWithCache = JSON.stringify({
      log: {
        version: "1.2",
        creator: {
          name: "Browser",
          version: "1.0"
        },
        entries: [
          {
            request: {
              method: "GET",
              url: "https://api.example.com/data",
              headers: []
            },
            response: {
              status: 200,
              statusText: "OK",
              headers: [],
              content: {
                size: 100,
                mimeType: "application/json",
                text: '{"cached": true}'
              }
            },
            cache: {
              beforeRequest: {
                lastAccess: "2024-01-01T00:00:00Z",
                eTag: "abc123",
                hitCount: 5
              },
              afterRequest: {
                lastAccess: "2024-01-01T00:01:00Z",
                eTag: "abc123",
                hitCount: 6
              }
            },
            startedDateTime: "2024-01-01T00:00:00Z",
            time: 10
          }
        ]
      }
    })
    
    const result = await Effect.runPromise(parseHARFile(harWithCache))
    assert(result.log.entries.length === 1)
  })

  test("handles HAR with timing details", async () => {
    const harWithTimings = JSON.stringify({
      log: {
        version: "1.2",
        creator: {
          name: "Browser",
          version: "1.0"
        },
        entries: [
          {
            request: {
              method: "GET",
              url: "https://api.example.com/slow",
              headers: []
            },
            response: {
              status: 200,
              statusText: "OK",
              headers: [],
              content: {
                size: 100,
                mimeType: "application/json",
                text: '{"ok": true}'
              }
            },
            startedDateTime: "2024-01-01T00:00:00Z",
            time: 543,
            timings: {
              blocked: 1,
              dns: 5,
              connect: 10,
              send: 2,
              wait: 500,
              receive: 25,
              ssl: 5
            }
          }
        ]
      }
    })
    
    const result = await Effect.runPromise(parseHARFile(harWithTimings))
    assert.strictEqual(result.log.entries[0].time, 543)
  })

  test("handles HAR with cookies", async () => {
    const harWithCookies = JSON.stringify({
      log: {
        version: "1.2",
        creator: {
          name: "Browser",
          version: "1.0"
        },
        entries: [
          {
            request: {
              method: "GET",
              url: "https://api.example.com/auth",
              headers: [],
              cookies: [
                {
                  name: "session",
                  value: "abc123",
                  path: "/",
                  domain: ".example.com",
                  expires: "2024-12-31T23:59:59Z",
                  httpOnly: true,
                  secure: true
                }
              ]
            },
            response: {
              status: 200,
              statusText: "OK",
              headers: [],
              cookies: [
                {
                  name: "refresh",
                  value: "xyz789",
                  path: "/",
                  domain: ".example.com"
                }
              ],
              content: {
                size: 100,
                mimeType: "application/json",
                text: '{"authenticated": true}'
              }
            },
            startedDateTime: "2024-01-01T00:00:00Z",
            time: 50
          }
        ]
      }
    })
    
    const result = await Effect.runPromise(parseHARFile(harWithCookies))
    assert(result.log.entries.length === 1)
  })

  test("handles HAR with query string parameters", async () => {
    const harWithQueryString = JSON.stringify({
      log: {
        version: "1.2",
        creator: {
          name: "Browser",
          version: "1.0"
        },
        entries: [
          {
            request: {
              method: "GET",
              url: "https://api.example.com/search?q=test&limit=10",
              headers: [],
              queryString: [
                { name: "q", value: "test" },
                { name: "limit", value: "10" }
              ]
            },
            response: {
              status: 200,
              statusText: "OK",
              headers: [],
              content: {
                size: 100,
                mimeType: "application/json",
                text: '{"results": []}'
              }
            },
            startedDateTime: "2024-01-01T00:00:00Z",
            time: 75
          }
        ]
      }
    })
    
    const result = await Effect.runPromise(parseHARFile(harWithQueryString))
    assert(result.log.entries[0].request.url.includes("q=test"))
  })

  test("handles HAR with redirects", async () => {
    const harWithRedirects = JSON.stringify({
      log: {
        version: "1.2",
        creator: {
          name: "Browser",
          version: "1.0"
        },
        entries: [
          {
            request: {
              method: "GET",
              url: "https://api.example.com/old",
              headers: []
            },
            response: {
              status: 301,
              statusText: "Moved Permanently",
              headers: [
                { name: "Location", value: "https://api.example.com/new" }
              ],
              redirectURL: "https://api.example.com/new",
              content: {
                size: 0,
                mimeType: "text/html"
              }
            },
            startedDateTime: "2024-01-01T00:00:00Z",
            time: 20
          },
          {
            request: {
              method: "GET",
              url: "https://api.example.com/new",
              headers: []
            },
            response: {
              status: 200,
              statusText: "OK",
              headers: [],
              content: {
                size: 100,
                mimeType: "application/json",
                text: '{"redirected": true}'
              }
            },
            startedDateTime: "2024-01-01T00:00:01Z",
            time: 50
          }
        ]
      }
    })
    
    const result = await Effect.runPromise(parseHARFile(harWithRedirects))
    assert.strictEqual(result.log.entries.length, 2)
    assert.strictEqual(result.log.entries[0].response.status, 301)
    assert.strictEqual(result.log.entries[1].response.status, 200)
  })

  test("handles HAR with serverIPAddress", async () => {
    const harWithServerIP = JSON.stringify({
      log: {
        version: "1.2",
        creator: {
          name: "Browser",
          version: "1.0"
        },
        entries: [
          {
            request: {
              method: "GET",
              url: "https://api.example.com/info",
              headers: []
            },
            response: {
              status: 200,
              statusText: "OK",
              headers: [],
              content: {
                size: 100,
                mimeType: "application/json",
                text: '{"server": "info"}'
              }
            },
            serverIPAddress: "192.168.1.100",
            connection: "12345",
            startedDateTime: "2024-01-01T00:00:00Z",
            time: 30
          }
        ]
      }
    })
    
    const result = await Effect.runPromise(parseHARFile(harWithServerIP))
    assert(result.log.entries.length === 1)
  })

  test("handles HAR with websocket entries", async () => {
    const harWithWebSocket = JSON.stringify({
      log: {
        version: "1.2",
        creator: {
          name: "Browser",
          version: "1.0"
        },
        entries: [
          {
            request: {
              method: "GET",
              url: "wss://api.example.com/ws",
              headers: [
                { name: "Upgrade", value: "websocket" },
                { name: "Connection", value: "Upgrade" }
              ]
            },
            response: {
              status: 101,
              statusText: "Switching Protocols",
              headers: [
                { name: "Upgrade", value: "websocket" },
                { name: "Connection", value: "Upgrade" }
              ],
              content: {
                size: 0,
                mimeType: ""
              }
            },
            _webSocketMessages: [
              {
                type: "send",
                time: 100,
                opcode: 1,
                data: '{"type": "subscribe"}'
              },
              {
                type: "receive",
                time: 150,
                opcode: 1,
                data: '{"type": "message", "data": "hello"}'
              }
            ],
            startedDateTime: "2024-01-01T00:00:00Z",
            time: 200
          }
        ]
      }
    })
    
    const result = await Effect.runPromise(parseHARFile(harWithWebSocket))
    assert(result.log.entries.length === 1)
    assert.strictEqual(result.log.entries[0].response.status, 101)
  })

  test("handles malformed HAR with missing response", async () => {
    const malformed = JSON.stringify({
      log: {
        version: "1.2",
        creator: {
          name: "Broken",
          version: "1.0"
        },
        entries: [
          {
            request: {
              method: "GET",
              url: "https://api.example.com/test",
              headers: []
            },
            // Missing response
            startedDateTime: "2024-01-01T00:00:00Z",
            time: 0
          }
        ]
      }
    })
    
    const result = await Effect.runPromise(Effect.either(parseHARFile(malformed)))
    assert.strictEqual(result._tag, "Left")
  })

  test("handles HAR with compressed content", async () => {
    const harWithCompression = JSON.stringify({
      log: {
        version: "1.2",
        creator: {
          name: "Browser",
          version: "1.0"
        },
        entries: [
          {
            request: {
              method: "GET",
              url: "https://api.example.com/compressed",
              headers: [
                { name: "Accept-Encoding", value: "gzip, deflate, br" }
              ]
            },
            response: {
              status: 200,
              statusText: "OK",
              headers: [
                { name: "Content-Encoding", value: "gzip" }
              ],
              content: {
                size: 1000,
                compression: 700,
                mimeType: "application/json",
                text: '{"compressed": true}'
              }
            },
            startedDateTime: "2024-01-01T00:00:00Z",
            time: 40
          }
        ]
      }
    })
    
    const result = await Effect.runPromise(parseHARFile(harWithCompression))
    assert(result.log.entries.length === 1)
  })
})