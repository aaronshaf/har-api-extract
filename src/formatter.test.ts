import { describe, test, expect } from "bun:test"
import { formatEntry, formatCompact, formatForLLM } from "./formatter"
import type { HAREntry } from "./types"

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
    expect(formatted.index).toBe(1)
    expect(formatted.method).toBe("GET")
    expect(formatted.url).toBe("https://api.example.com/users")
    expect(formatted.status).toBe(200)
    expect(formatted.duration).toBe(150)
    expect(formatted.isGraphQL).toBe(false)
    expect(formatted.responseBody).toEqual({ users: [] })
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
    expect(formatted.isGraphQL).toBe(true)
    expect(formatted.operationName).toBe("GetUsers")
    expect(formatted.requestBody.query).toBe("query GetUsers { users { id name } }")
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
    expect(output).toContain("1 total requests (1 GraphQL, 0 REST)")
    expect(output).toContain("[GraphQL: GetUser]")
    expect(output).toContain("200 (100ms)")
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
    expect(output).toContain("# HAR File Analysis - API Requests Summary")
    expect(output).toContain("Total API Requests: 1")
    expect(output).toContain("## Request #1 [REST/JSON]")
    expect(output).toContain("**URL:** GET https://api.example.com/users")
    expect(output).toContain("**Status:** 200")
  })
})