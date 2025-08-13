import { describe, test } from "node:test"
import assert from "node:assert"
import { Effect } from "effect"
import { parseHARFile, isJSONRequest, isJSONResponse, isGraphQLRequest, filterJSONAndGraphQLEntries } from "./parser.js"
import type { HAREntry } from "./types.js"

describe("parseHARFile", () => {
  test("parses valid HAR JSON", async () => {
    const harContent = JSON.stringify({
      log: {
        version: "1.2",
        creator: { name: "test", version: "1.0" },
        entries: []
      }
    })
    
    const result = await Effect.runPromise(parseHARFile(harContent))
    assert.strictEqual(result.log.version, "1.2")
    assert.deepStrictEqual(result.log.entries, [])
  })

  test("handles invalid JSON", async () => {
    const result = await Effect.runPromise(
      Effect.either(parseHARFile("not valid json"))
    )
    assert.strictEqual(result._tag, "Left")
  })

  test("handles valid JSON but invalid HAR structure", async () => {
    const invalidHar = JSON.stringify({
      notLog: "this is not a HAR file"
    })
    
    const result = await Effect.runPromise(
      Effect.either(parseHARFile(invalidHar))
    )
    assert.strictEqual(result._tag, "Left")
  })

  test("handles empty string", async () => {
    const result = await Effect.runPromise(
      Effect.either(parseHARFile(""))
    )
    assert.strictEqual(result._tag, "Left")
  })

  test("handles HAR file with missing required fields", async () => {
    const incompleteHar = JSON.stringify({
      log: {
        version: "1.2"
        // missing creator and entries
      }
    })
    
    const result = await Effect.runPromise(
      Effect.either(parseHARFile(incompleteHar))
    )
    assert.strictEqual(result._tag, "Left")
  })

  test("parses minimal valid HAR file", async () => {
    const minimalHar = JSON.stringify({
      log: {
        version: "1.2",
        creator: {
          name: "test",
          version: "1.0"
        },
        entries: []
      }
    })
    
    const result = await Effect.runPromise(parseHARFile(minimalHar))
    assert.strictEqual(result.log.version, "1.2")
    assert.strictEqual(result.log.creator.name, "test")
    assert.deepStrictEqual(result.log.entries, [])
  })
})

describe("isJSONRequest", () => {
  test("handles various JSON content-type formats", () => {
    const variations = [
      "application/json",
      "application/json; charset=utf-8",
      "application/json;charset=UTF-8",
      "application/json; boundary=something",
      "application/vnd.api+json",
      "application/ld+json"
    ]
    
    variations.forEach(contentType => {
      const entry: HAREntry = {
        request: {
          method: "POST",
          url: "https://api.example.com",
          headers: [
            { name: "content-type", value: contentType }
          ]
        },
        response: {
          status: 200,
          statusText: "OK",
          headers: [],
          content: { size: 0, mimeType: "text/html" }
        },
        startedDateTime: "2024-01-01T00:00:00Z",
        time: 100
      } as HAREntry
      
      const isJson = contentType.includes("json")
      assert.strictEqual(isJSONRequest(entry), isJson, `Failed for content-type: ${contentType}`)
    })
  })

  test("identifies JSON request by content-type header", () => {
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com",
        headers: [
          { name: "content-type", value: "application/json" }
        ]
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: { size: 0, mimeType: "text/html" }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 100
    } as HAREntry
    
    assert.strictEqual(isJSONRequest(entry), true)
  })

  test("identifies JSON request by postData mimeType", () => {
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com",
        headers: [],
        postData: {
          mimeType: "application/json",
          text: "{}"
        }
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: { size: 0, mimeType: "text/html" }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 100
    } as HAREntry
    
    assert.strictEqual(isJSONRequest(entry), true)
  })

  test("identifies JSON request with charset in content-type", () => {
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com",
        headers: [
          { name: "Content-Type", value: "application/json; charset=utf-8" }
        ]
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: { size: 0, mimeType: "text/html" }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 100
    } as HAREntry
    
    assert.strictEqual(isJSONRequest(entry), true)
  })

  test("returns false for non-JSON request", () => {
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com",
        headers: [
          { name: "content-type", value: "text/html" }
        ]
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: { size: 0, mimeType: "text/html" }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 100
    } as HAREntry
    
    assert.strictEqual(isJSONRequest(entry), false)
  })

  test("returns false when no content-type header or postData", () => {
    const entry: HAREntry = {
      request: {
        method: "GET",
        url: "https://api.example.com",
        headers: []
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: { size: 0, mimeType: "text/html" }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 100
    } as HAREntry
    
    assert.strictEqual(isJSONRequest(entry), false)
  })
})

describe("isGraphQLRequest", () => {
  test("identifies GraphQL request with operationName", () => {
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com/graphql",
        headers: [
          { name: "content-type", value: "application/json" }
        ],
        postData: {
          mimeType: "application/json",
          text: JSON.stringify({
            operationName: "GetUser",
            query: "query GetUser { user { id } }"
          })
        }
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: { size: 0, mimeType: "application/json" }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 100
    } as HAREntry
    
    assert.strictEqual(isGraphQLRequest(entry), true)
  })

  test("identifies GraphQL request with query only", () => {
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com/graphql",
        headers: [
          { name: "content-type", value: "application/json" }
        ],
        postData: {
          mimeType: "application/json",
          text: JSON.stringify({
            query: "{ user { id } }"
          })
        }
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: { size: 0, mimeType: "application/json" }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 100
    } as HAREntry
    
    assert.strictEqual(isGraphQLRequest(entry), true)
  })

  test("returns false for non-GraphQL JSON request", () => {
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com",
        headers: [
          { name: "content-type", value: "application/json" }
        ],
        postData: {
          mimeType: "application/json",
          text: JSON.stringify({ data: "test" })
        }
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: { size: 0, mimeType: "application/json" }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 100
    } as HAREntry
    
    assert.strictEqual(isGraphQLRequest(entry), false)
  })

  test("returns false for request without postData", () => {
    const entry: HAREntry = {
      request: {
        method: "GET",
        url: "https://api.example.com/graphql",
        headers: []
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: { size: 0, mimeType: "application/json" }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 100
    } as HAREntry
    
    assert.strictEqual(isGraphQLRequest(entry), false)
  })

  test("returns false for malformed JSON in postData", () => {
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com/graphql",
        headers: [
          { name: "content-type", value: "application/json" }
        ],
        postData: {
          mimeType: "application/json",
          text: "invalid json"
        }
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: { size: 0, mimeType: "application/json" }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 100
    } as HAREntry
    
    assert.strictEqual(isGraphQLRequest(entry), false)
  })
})

describe("isJSONResponse", () => {
  test("identifies JSON response by mimeType", () => {
    const entry: HAREntry = {
      request: {
        method: "GET",
        url: "https://api.example.com/users",
        headers: []
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: {
          size: 100,
          mimeType: "application/json",
          text: '{"users": []}'
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 100
    } as HAREntry
    
    assert.strictEqual(isJSONResponse(entry), true)
  })

  test("identifies JSON response with charset", () => {
    const entry: HAREntry = {
      request: {
        method: "GET",
        url: "https://api.example.com/users",
        headers: []
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: {
          size: 100,
          mimeType: "application/json; charset=utf-8",
          text: '{"users": []}'
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 100
    } as HAREntry
    
    assert.strictEqual(isJSONResponse(entry), true)
  })

  test("returns false for non-JSON response", () => {
    const entry: HAREntry = {
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
    } as HAREntry
    
    assert.strictEqual(isJSONResponse(entry), false)
  })

  test("returns false when mimeType is undefined", () => {
    const entry: HAREntry = {
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
          size: 0,
          text: ""
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 100
    } as HAREntry
    
    assert.strictEqual(isJSONResponse(entry), false)
  })
})

describe("filterJSONAndGraphQLEntries", () => {
  test("filters entries with JSON requests", () => {
    const entries: HAREntry[] = [
      {
        request: {
          method: "POST",
          url: "https://api.example.com",
          headers: [{ name: "content-type", value: "application/json" }],
          postData: { mimeType: "application/json", text: '{"data": "test"}' }
        },
        response: {
          status: 200,
          statusText: "OK",
          headers: [],
          content: { size: 10, mimeType: "text/html", text: "<html></html>" }
        },
        startedDateTime: "2024-01-01T00:00:00Z",
        time: 100
      } as HAREntry,
      {
        request: {
          method: "GET",
          url: "https://example.com",
          headers: [{ name: "content-type", value: "text/html" }]
        },
        response: {
          status: 200,
          statusText: "OK",
          headers: [],
          content: { size: 10, mimeType: "text/html", text: "<html></html>" }
        },
        startedDateTime: "2024-01-01T00:00:00Z",
        time: 100
      } as HAREntry
    ]
    
    const filtered = filterJSONAndGraphQLEntries(entries)
    assert.strictEqual(filtered.length, 1)
    assert.strictEqual(filtered[0].request.url, "https://api.example.com")
  })

  test("filters entries with JSON responses", () => {
    const entries: HAREntry[] = [
      {
        request: {
          method: "GET",
          url: "https://api.example.com",
          headers: []
        },
        response: {
          status: 200,
          statusText: "OK",
          headers: [],
          content: { size: 10, mimeType: "application/json", text: '{"data": "test"}' }
        },
        startedDateTime: "2024-01-01T00:00:00Z",
        time: 100
      } as HAREntry,
      {
        request: {
          method: "GET",
          url: "https://example.com",
          headers: []
        },
        response: {
          status: 200,
          statusText: "OK",
          headers: [],
          content: { size: 10, mimeType: "text/html", text: "<html></html>" }
        },
        startedDateTime: "2024-01-01T00:00:00Z",
        time: 100
      } as HAREntry
    ]
    
    const filtered = filterJSONAndGraphQLEntries(entries)
    assert.strictEqual(filtered.length, 1)
    assert.strictEqual(filtered[0].request.url, "https://api.example.com")
  })

  test("excludes entries without response text", () => {
    const entries: HAREntry[] = [
      {
        request: {
          method: "POST",
          url: "https://api.example.com",
          headers: [{ name: "content-type", value: "application/json" }],
          postData: { mimeType: "application/json", text: '{"data": "test"}' }
        },
        response: {
          status: 200,
          statusText: "OK",
          headers: [],
          content: { size: 0, mimeType: "application/json" }
        },
        startedDateTime: "2024-01-01T00:00:00Z",
        time: 100
      } as HAREntry
    ]
    
    const filtered = filterJSONAndGraphQLEntries(entries)
    assert.strictEqual(filtered.length, 0)
  })

  test("returns empty array for empty input", () => {
    const filtered = filterJSONAndGraphQLEntries([])
    assert.strictEqual(filtered.length, 0)
  })
})