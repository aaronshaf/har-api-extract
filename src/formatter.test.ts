import { describe, test } from "node:test"
import assert from "node:assert"
import { formatEntry, formatCompact, formatForLLM } from "./formatter.js"
import type { HAREntry } from "./types.js"

describe("formatEntry", () => {
  test("formats basic REST request", () => {
    const entry: HAREntry = {
      request: {
        method: "GET",
        url: "https://api.example.com/users",
        headers: [],
        postData: undefined
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: {
          size: 100,
          mimeType: "application/json",
          text: JSON.stringify({ users: [] })
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 150
    } as HAREntry
    
    const formatted = formatEntry(entry, 0)
    assert.strictEqual(formatted.index, 1)
    assert.strictEqual(formatted.method, "GET")
    assert.strictEqual(formatted.url, "https://api.example.com/users")
    assert.strictEqual(formatted.status, 200)
    assert.strictEqual(formatted.duration, 150)
    assert.strictEqual(formatted.isGraphQL, false)
    assert.deepStrictEqual(formatted.responseBody, { users: [] })
  })

  test("formats GraphQL request with operation name", () => {
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com/graphql",
        headers: [],
        postData: {
          mimeType: "application/json",
          text: JSON.stringify({
            operationName: "GetUsers",
            query: "query GetUsers { users { id name } }",
            variables: {}
          })
        }
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: {
          size: 100,
          mimeType: "application/json",
          text: JSON.stringify({ data: { users: [] } })
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 75
    } as HAREntry
    
    const formatted = formatEntry(entry, 0)
    assert.strictEqual(formatted.isGraphQL, true)
    assert.strictEqual(formatted.operationName, "GetUsers")
    assert.strictEqual(formatted.requestBody.query, "query GetUsers { users { id name } }")
  })
})

describe("formatCompact", () => {
  test("generates compact output", () => {
    const entries = [
      {
        index: 1,
        timestamp: "2024-01-01T00:00:00Z",
        duration: 100,
        method: "POST",
        url: "https://api.example.com/graphql",
        status: 200,
        requestBody: {
          operationName: "GetUser",
          query: "query GetUser { user { id } }"
        },
        responseBody: { data: { user: { id: "1" } } },
        isGraphQL: true,
        operationName: "GetUser"
      }
    ]
    
    const output = formatCompact(entries)
    assert(output.includes("1 total requests (1 GraphQL, 0 REST)"))
    assert(output.includes("[GraphQL: GetUser]"))
    assert(output.includes("200 (100ms)"))
  })
})

describe("formatForLLM", () => {
  test("generates detailed LLM-optimized output", () => {
    const entries = [
      {
        index: 1,
        timestamp: "2024-01-01T00:00:00Z",
        duration: 100,
        method: "GET",
        url: "https://api.example.com/users",
        status: 200,
        requestBody: undefined,
        responseBody: { users: [{ id: "1", name: "Test" }] },
        isGraphQL: false,
        operationName: undefined
      }
    ]
    
    const output = formatForLLM(entries)
    assert(output.includes('<api_requests total="1"'))
    assert(output.includes('<request index="1" type="rest">'))
    assert(output.includes('<url method="GET">https://api.example.com/users</url>'))
    assert(output.includes('<status code="200"'))
  })
})