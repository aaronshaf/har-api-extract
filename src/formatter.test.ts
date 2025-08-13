import { describe, test } from "node:test"
import assert from "node:assert"
import { formatEntry, formatForLLM } from "./formatter.js"
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

  test("handles malformed JSON in request body", () => {
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com/data",
        headers: [],
        postData: {
          mimeType: "application/json",
          text: "invalid json"
        }
      },
      response: {
        status: 400,
        statusText: "Bad Request",
        headers: [],
        content: {
          size: 20,
          mimeType: "application/json",
          text: '{"error": "Invalid JSON"}'
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 50
    } as HAREntry
    
    const formatted = formatEntry(entry, 2)
    assert.strictEqual(formatted.index, 3)
    assert.strictEqual(formatted.requestBody, "invalid json")
    assert.strictEqual(formatted.isGraphQL, false)
    assert.deepStrictEqual(formatted.responseBody, { error: "Invalid JSON" })
  })

  test("handles malformed JSON in response body", () => {
    const entry: HAREntry = {
      request: {
        method: "GET",
        url: "https://api.example.com/broken",
        headers: []
      },
      response: {
        status: 500,
        statusText: "Internal Server Error",
        headers: [],
        content: {
          size: 50,
          mimeType: "application/json",
          text: "broken response"
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 1000
    } as HAREntry
    
    const formatted = formatEntry(entry, 5)
    assert.strictEqual(formatted.index, 6)
    assert.strictEqual(formatted.requestBody, undefined)
    assert.strictEqual(formatted.responseBody, "broken response")
    assert.strictEqual(formatted.duration, 1000)
  })

  test("handles entry without postData", () => {
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
          text: JSON.stringify({ users: [] })
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 150
    } as HAREntry
    
    const formatted = formatEntry(entry, 0)
    assert.strictEqual(formatted.requestBody, undefined)
    assert.strictEqual(formatted.isGraphQL, false)
    assert.strictEqual(formatted.operationName, undefined)
  })

  test("handles fractional time values", () => {
    const entry: HAREntry = {
      request: {
        method: "GET",
        url: "https://api.example.com/fast",
        headers: []
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: {
          size: 10,
          mimeType: "application/json",
          text: '{"ok": true}'
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 123.456
    } as HAREntry
    
    const formatted = formatEntry(entry, 0)
    assert.strictEqual(formatted.duration, 123)
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

  test("formats GraphQL request with variables", () => {
    const entries = [
      {
        index: 1,
        timestamp: "2024-01-01T00:00:00Z",
        duration: 150,
        method: "POST",
        url: "https://api.example.com/graphql",
        status: 200,
        requestBody: {
          operationName: "GetUserById",
          query: "query GetUserById($id: ID!) { user(id: $id) { id name } }",
          variables: { id: "123" }
        },
        responseBody: { data: { user: { id: "123", name: "John" } } },
        isGraphQL: true,
        operationName: "GetUserById"
      }
    ]
    
    const output = formatForLLM(entries)
    assert(output.includes('<request index="1" type="graphql">'))
    assert(output.includes('<operation>GetUserById</operation>'))
    assert(output.includes('<graphql_query>'))
    assert(output.includes('<variables>'))
    assert(output.includes('"id": "123"'))
  })

  test("truncates large response bodies", () => {
    const largeResponse = { data: "x".repeat(2000) }
    const entries = [
      {
        index: 1,
        timestamp: "2024-01-01T00:00:00Z",
        duration: 100,
        method: "GET",
        url: "https://api.example.com/large",
        status: 200,
        requestBody: undefined,
        responseBody: largeResponse,
        isGraphQL: false,
        operationName: undefined
      }
    ]
    
    const output = formatForLLM(entries)
    assert(output.includes("... [truncated]"))
  })

  test("handles empty request/response bodies", () => {
    const entries = [
      {
        index: 1,
        timestamp: "2024-01-01T00:00:00Z",
        duration: 100,
        method: "DELETE",
        url: "https://api.example.com/users/123",
        status: 204,
        requestBody: undefined,
        responseBody: undefined,
        isGraphQL: false,
        operationName: undefined
      }
    ]
    
    const output = formatForLLM(entries)
    assert(output.includes('<request index="1" type="rest">'))
    assert(output.includes('<status code="204"'))
    assert(!output.includes('<request_body>'))
    assert(!output.includes('<response>'))
  })

  test("handles GraphQL mutation", () => {
    const entries = [
      {
        index: 1,
        timestamp: "2024-01-01T00:00:00Z",
        duration: 200,
        method: "POST",
        url: "https://api.example.com/graphql",
        status: 200,
        requestBody: {
          operationName: "CreateUser",
          query: "mutation CreateUser($input: UserInput!) { createUser(input: $input) { id name } }",
          variables: { input: { name: "John", email: "john@example.com" } }
        },
        responseBody: { data: { createUser: { id: "123", name: "John" } } },
        isGraphQL: true,
        operationName: "CreateUser"
      }
    ]
    
    const output = formatForLLM(entries)
    assert(output.includes('<operation>CreateUser</operation>'))
    assert(output.includes('mutation CreateUser'))
    assert(output.includes('"email": "john@example.com"'))
  })

  test("handles GraphQL subscription", () => {
    const entries = [
      {
        index: 1,
        timestamp: "2024-01-01T00:00:00Z",
        duration: 50,
        method: "POST",
        url: "https://api.example.com/graphql",
        status: 200,
        requestBody: {
          operationName: "OnMessageAdded",
          query: "subscription OnMessageAdded { messageAdded { id text } }",
          variables: {}
        },
        responseBody: { data: { messageAdded: { id: "1", text: "Hello" } } },
        isGraphQL: true,
        operationName: "OnMessageAdded"
      }
    ]
    
    const output = formatForLLM(entries)
    assert(output.includes('subscription OnMessageAdded'))
  })

  test("handles GraphQL errors in response", () => {
    const entries = [
      {
        index: 1,
        timestamp: "2024-01-01T00:00:00Z",
        duration: 100,
        method: "POST",
        url: "https://api.example.com/graphql",
        status: 200,
        requestBody: {
          query: "{ user { id } }"
        },
        responseBody: {
          errors: [
            {
              message: "User not found",
              extensions: { code: "USER_NOT_FOUND" }
            }
          ]
        },
        isGraphQL: true,
        operationName: undefined
      }
    ]
    
    const output = formatForLLM(entries)
    assert(output.includes('USER_NOT_FOUND'))
    assert(output.includes('User not found'))
  })

  test("handles special characters in request/response", () => {
    const entries = [
      {
        index: 1,
        timestamp: "2024-01-01T00:00:00Z",
        duration: 100,
        method: "POST",
        url: "https://api.example.com/data",
        status: 200,
        requestBody: {
          text: "<script>alert('XSS')</script>",
          emoji: "🎉🔥💯",
          unicode: "Hello 世界"
        },
        responseBody: {
          html: "<div class=\"test\">Content & more</div>",
          special: "Line1\nLine2\tTabbed"
        },
        isGraphQL: false,
        operationName: undefined
      }
    ]
    
    const output = formatForLLM(entries)
    assert(output.includes("<script>alert('XSS')</script>"))
    assert(output.includes("🎉🔥💯"))
    assert(output.includes("Hello 世界"))
  })

  test("handles very long URLs", () => {
    const longPath = "a".repeat(500)
    const entries = [
      {
        index: 1,
        timestamp: "2024-01-01T00:00:00Z",
        duration: 100,
        method: "GET",
        url: `https://api.example.com/${longPath}`,
        status: 200,
        requestBody: undefined,
        responseBody: { ok: true },
        isGraphQL: false,
        operationName: undefined
      }
    ]
    
    const output = formatForLLM(entries)
    assert(output.includes(longPath))
  })

  test("handles null values in JSON", () => {
    const entries = [
      {
        index: 1,
        timestamp: "2024-01-01T00:00:00Z",
        duration: 100,
        method: "POST",
        url: "https://api.example.com/data",
        status: 200,
        requestBody: {
          name: null,
          age: 30,
          address: {
            street: null,
            city: "New York"
          }
        },
        responseBody: {
          success: true,
          data: null,
          errors: null
        },
        isGraphQL: false,
        operationName: undefined
      }
    ]
    
    const output = formatForLLM(entries)
    assert(output.includes('"name": null'))
    assert(output.includes('"data": null'))
  })

  test("handles mixed GraphQL and REST requests", () => {
    const entries = [
      {
        index: 1,
        timestamp: "2024-01-01T00:00:00Z",
        duration: 100,
        method: "GET",
        url: "https://api.example.com/users",
        status: 200,
        requestBody: undefined,
        responseBody: { users: [] },
        isGraphQL: false,
        operationName: undefined
      },
      {
        index: 2,
        timestamp: "2024-01-01T00:00:01Z",
        duration: 150,
        method: "POST",
        url: "https://api.example.com/graphql",
        status: 200,
        requestBody: {
          query: "{ user { id } }"
        },
        responseBody: { data: { user: { id: "1" } } },
        isGraphQL: true,
        operationName: undefined
      }
    ]
    
    const output = formatForLLM(entries)
    assert(output.includes('total="2" graphql="1" rest="1"'))
    assert(output.includes('<request index="1" type="rest">'))
    assert(output.includes('<request index="2" type="graphql">'))
  })
})