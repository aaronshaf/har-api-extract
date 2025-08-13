import { describe, test } from "node:test"
import assert from "node:assert"
import { Effect } from "effect"
import { parseHARFile, isJSONRequest, isJSONResponse, isGraphQLRequest, filterJSONAndGraphQLEntries } from "./parser.js"
import { formatEntry, formatForLLM } from "./formatter.js"
import type { HAREntry } from "./types.js"

describe("Edge cases and extreme inputs", () => {
  test("handles HAR with deeply nested JSON structures", () => {
    const deeplyNested = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                level6: {
                  level7: {
                    level8: {
                      level9: {
                        level10: "deep value"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com/nested",
        headers: [],
        postData: {
          mimeType: "application/json",
          text: JSON.stringify(deeplyNested)
        }
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: {
          size: 100,
          mimeType: "application/json",
          text: JSON.stringify({ result: deeplyNested })
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 100
    } as HAREntry
    
    const formatted = formatEntry(entry, 0)
    assert.deepStrictEqual(formatted.requestBody.level1.level2.level3.level4.level5.level6.level7.level8.level9.level10, "deep value")
  })

  test("handles circular reference detection in JSON parsing", () => {
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com/data",
        headers: [],
        postData: {
          mimeType: "application/json",
          text: '{"a": 1, "b": "{\\"c\\": 2}"}'  // Nested JSON string
        }
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: {
          size: 100,
          mimeType: "application/json",
          text: '{"result": "success"}'
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 50
    } as HAREntry
    
    const formatted = formatEntry(entry, 0)
    assert.strictEqual(formatted.requestBody.a, 1)
    assert.strictEqual(formatted.requestBody.b, '{"c": 2}')
  })

  test("handles extremely large numbers in JSON", () => {
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com/numbers",
        headers: [],
        postData: {
          mimeType: "application/json",
          text: JSON.stringify({
            maxSafeInt: Number.MAX_SAFE_INTEGER,
            minSafeInt: Number.MIN_SAFE_INTEGER,
            infinity: Infinity,
            negInfinity: -Infinity,
            notANumber: NaN,
            bigNumber: 9999999999999999999999999999,
            smallNumber: 0.00000000000000000001
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
          text: '{"ok": true}'
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 50
    } as HAREntry
    
    const formatted = formatEntry(entry, 0)
    assert.strictEqual(formatted.requestBody.maxSafeInt, Number.MAX_SAFE_INTEGER)
    assert.strictEqual(formatted.requestBody.infinity, null) // JSON.stringify converts Infinity to null
  })

  test("handles various date formats in HAR entries", () => {
    const dates = [
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:00.000Z",
      "2024-01-01T00:00:00+00:00",
      "2024-01-01T00:00:00-05:00",
      "2024-12-31T23:59:59.999Z"
    ]
    
    dates.forEach(date => {
      const entry: HAREntry = {
        request: {
          method: "GET",
          url: "https://api.example.com/test",
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
        startedDateTime: date,
        time: 100
      } as HAREntry
      
      const formatted = formatEntry(entry, 0)
      assert.strictEqual(formatted.timestamp, date)
    })
  })

  test("handles empty strings vs null vs undefined", () => {
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com/empty",
        headers: [],
        postData: {
          mimeType: "application/json",
          text: JSON.stringify({
            emptyString: "",
            nullValue: null,
            undefinedValue: undefined,
            falseValue: false,
            zeroValue: 0,
            emptyArray: [],
            emptyObject: {}
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
          text: JSON.stringify({
            emptyString: "",
            nullValue: null,
            // undefined is not valid in JSON
            falseValue: false,
            zeroValue: 0,
            emptyArray: [],
            emptyObject: {}
          })
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 50
    } as HAREntry
    
    const formatted = formatEntry(entry, 0)
    assert.strictEqual(formatted.requestBody.emptyString, "")
    assert.strictEqual(formatted.requestBody.nullValue, null)
    assert.strictEqual(formatted.requestBody.undefinedValue, undefined)
    assert.strictEqual(formatted.requestBody.falseValue, false)
    assert.strictEqual(formatted.requestBody.zeroValue, 0)
    assert.deepStrictEqual(formatted.requestBody.emptyArray, [])
    assert.deepStrictEqual(formatted.requestBody.emptyObject, {})
  })

  test("handles binary data in response text", () => {
    const entry: HAREntry = {
      request: {
        method: "GET",
        url: "https://api.example.com/binary",
        headers: []
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: {
          size: 100,
          mimeType: "application/octet-stream",
          text: Buffer.from([0x00, 0x01, 0x02, 0xFF]).toString('base64'),
          encoding: "base64"
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 50
    } as HAREntry
    
    assert.strictEqual(isJSONResponse(entry), false)
  })

  test("handles mixed case headers", () => {
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com/test",
        headers: [
          { name: "Content-Type", value: "application/json" },
          { name: "CONTENT-TYPE", value: "text/html" },
          { name: "content-TYPE", value: "application/xml" },
          { name: "CoNtEnT-tYpE", value: "application/json" }
        ]
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
      time: 50
    } as HAREntry
    
    // Should find the first content-type header (case-insensitive)
    assert.strictEqual(isJSONRequest(entry), true)
  })

  test("handles zero-time requests", () => {
    const entry: HAREntry = {
      request: {
        method: "GET",
        url: "https://api.example.com/instant",
        headers: []
      },
      response: {
        status: 304,
        statusText: "Not Modified",
        headers: [],
        content: {
          size: 0,
          mimeType: "application/json",
          text: ""
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 0
    } as HAREntry
    
    const formatted = formatEntry(entry, 0)
    assert.strictEqual(formatted.duration, 0)
  })

  test("handles GraphQL introspection query", () => {
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          queryType { name }
          mutationType { name }
          subscriptionType { name }
          types { ...FullType }
          directives {
            name
            description
            locations
            args { ...InputValue }
          }
        }
      }
    `
    
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com/graphql",
        headers: [{ name: "content-type", value: "application/json" }],
        postData: {
          mimeType: "application/json",
          text: JSON.stringify({
            query: introspectionQuery
          })
        }
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: {
          size: 1000,
          mimeType: "application/json",
          text: JSON.stringify({
            data: {
              __schema: {
                queryType: { name: "Query" },
                mutationType: { name: "Mutation" }
              }
            }
          })
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 150
    } as HAREntry
    
    assert.strictEqual(isGraphQLRequest(entry), true)
    const formatted = formatEntry(entry, 0)
    assert(formatted.requestBody.query.includes("__schema"))
  })

  test("handles array of requests in filterJSONAndGraphQLEntries", () => {
    const entries: HAREntry[] = Array.from({ length: 100 }, (_, i) => ({
      request: {
        method: i % 2 === 0 ? "GET" : "POST",
        url: `https://api.example.com/item/${i}`,
        headers: i % 2 === 0 ? [] : [{ name: "content-type", value: "application/json" }],
        postData: i % 2 === 0 ? undefined : {
          mimeType: "application/json",
          text: JSON.stringify({ id: i })
        }
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: {
          size: 100,
          mimeType: i % 3 === 0 ? "text/html" : "application/json",
          text: i % 3 === 0 ? "<html></html>" : JSON.stringify({ id: i })
        }
      },
      startedDateTime: new Date().toISOString(),
      time: 50 + i
    } as HAREntry))
    
    const filtered = filterJSONAndGraphQLEntries(entries)
    assert(filtered.length > 0)
    assert(filtered.length < entries.length)
    
    // All filtered entries should have JSON request or response
    filtered.forEach(entry => {
      const hasJSONRequest = isJSONRequest(entry)
      const hasJSONResponse = isJSONResponse(entry)
      assert(hasJSONRequest || hasJSONResponse)
    })
  })

  test("handles various HTTP status codes", () => {
    const statusCodes = [
      100, 101, 102, 103,  // Informational
      200, 201, 202, 204, 206,  // Success
      300, 301, 302, 304, 307, 308,  // Redirection
      400, 401, 403, 404, 405, 408, 409, 410, 422, 429,  // Client errors
      500, 501, 502, 503, 504, 511  // Server errors
    ]
    
    statusCodes.forEach(status => {
      const entry: HAREntry = {
        request: {
          method: "GET",
          url: `https://api.example.com/status/${status}`,
          headers: []
        },
        response: {
          status,
          statusText: "Status " + status,
          headers: [],
          content: {
            size: 10,
            mimeType: "application/json",
            text: JSON.stringify({ status })
          }
        },
        startedDateTime: "2024-01-01T00:00:00Z",
        time: 50
      } as HAREntry
      
      const formatted = formatEntry(entry, 0)
      assert.strictEqual(formatted.status, status)
    })
  })

  test("handles URL with query parameters and fragments", () => {
    const complexURL = "https://api.example.com/path?param1=value1&param2=value%202&array[]=1&array[]=2#fragment"
    
    const entry: HAREntry = {
      request: {
        method: "GET",
        url: complexURL,
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
      time: 50
    } as HAREntry
    
    const formatted = formatEntry(entry, 0)
    assert.strictEqual(formatted.url, complexURL)
  })

  test("handles different HTTP methods", () => {
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "CONNECT", "TRACE"]
    
    methods.forEach(method => {
      const entry: HAREntry = {
        request: {
          method,
          url: "https://api.example.com/test",
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
        time: 50
      } as HAREntry
      
      const formatted = formatEntry(entry, 0)
      assert.strictEqual(formatted.method, method)
    })
  })

  test("handles response without content text", () => {
    const entry: HAREntry = {
      request: {
        method: "DELETE",
        url: "https://api.example.com/resource/123",
        headers: []
      },
      response: {
        status: 204,
        statusText: "No Content",
        headers: [],
        content: {
          size: 0,
          mimeType: ""
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 30
    } as HAREntry
    
    const filtered = filterJSONAndGraphQLEntries([entry])
    assert.strictEqual(filtered.length, 0)  // Should be filtered out due to no text
  })

  test("handles GraphQL with fragments", () => {
    const queryWithFragment = `
      fragment UserFields on User {
        id
        name
        email
      }
      
      query GetUser {
        user {
          ...UserFields
          posts {
            id
            title
          }
        }
      }
    `
    
    const entry: HAREntry = {
      request: {
        method: "POST",
        url: "https://api.example.com/graphql",
        headers: [{ name: "content-type", value: "application/json" }],
        postData: {
          mimeType: "application/json",
          text: JSON.stringify({
            operationName: "GetUser",
            query: queryWithFragment,
            variables: {}
          })
        }
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: {
          size: 200,
          mimeType: "application/json",
          text: JSON.stringify({
            data: {
              user: {
                id: "1",
                name: "John",
                email: "john@example.com",
                posts: []
              }
            }
          })
        }
      },
      startedDateTime: "2024-01-01T00:00:00Z",
      time: 100
    } as HAREntry
    
    assert.strictEqual(isGraphQLRequest(entry), true)
    const formatted = formatEntry(entry, 0)
    assert(formatted.requestBody.query.includes("fragment UserFields"))
  })

  test("handles concurrent identical requests", () => {
    const entries: HAREntry[] = Array.from({ length: 10 }, () => ({
      request: {
        method: "GET",
        url: "https://api.example.com/same",
        headers: []
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [],
        content: {
          size: 100,
          mimeType: "application/json",
          text: '{"result": "same"}'
        }
      },
      startedDateTime: "2024-01-01T00:00:00.000Z",
      time: 50
    } as HAREntry))
    
    const formatted = entries.map((entry, index) => formatEntry(entry, index))
    
    // All should have different indices but same content
    formatted.forEach((entry, index) => {
      assert.strictEqual(entry.index, index + 1)
      assert.strictEqual(entry.url, "https://api.example.com/same")
      assert.deepStrictEqual(entry.responseBody, { result: "same" })
    })
  })
})