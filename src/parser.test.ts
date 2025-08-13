import { describe, test } from "node:test"
import assert from "node:assert"
import { Effect } from "effect"
import { parseHARFile, isJSONRequest, isGraphQLRequest, filterJSONAndGraphQLEntries } from "./parser.js"
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
})

describe("isJSONRequest", () => {
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
})