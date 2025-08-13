import { Effect, pipe } from "effect"
import { HAREntry } from "./types"

interface FormattedRequest {
  index: number
  timestamp: string
  duration: number
  method: string
  url: string
  status: number
  requestBody?: any
  responseBody?: any
  isGraphQL: boolean
  operationName?: string
}

const parseJSONSafely = (text: string | undefined): any => {
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const formatEntry = (entry: HAREntry, index: number): FormattedRequest => {
  const requestBody = parseJSONSafely(entry.request.postData?.text)
  const responseBody = parseJSONSafely(entry.response.content.text)
  
  const isGraphQL = !!(requestBody?.operationName || requestBody?.query)
  
  return {
    index: index + 1,
    timestamp: entry.startedDateTime,
    duration: Math.round(entry.time),
    method: entry.request.method,
    url: entry.request.url,
    status: entry.response.status,
    requestBody,
    responseBody,
    isGraphQL,
    operationName: requestBody?.operationName
  }
}

export const formatForLLM = (entries: FormattedRequest[]): string => {
  const sections: string[] = []
  
  sections.push("# HAR File Analysis - API Requests Summary")
  sections.push(`Total API Requests: ${entries.length}`)
  sections.push(`GraphQL Requests: ${entries.filter(e => e.isGraphQL).length}`)
  sections.push(`REST/JSON Requests: ${entries.filter(e => !e.isGraphQL).length}`)
  sections.push("\n" + "=".repeat(80) + "\n")
  
  entries.forEach(entry => {
    const lines: string[] = []
    
    lines.push(`## Request #${entry.index} ${entry.isGraphQL ? "[GraphQL]" : "[REST/JSON]"}`)
    lines.push(`**URL:** ${entry.method} ${entry.url}`)
    lines.push(`**Status:** ${entry.status}`)
    lines.push(`**Duration:** ${entry.duration}ms`)
    lines.push(`**Timestamp:** ${entry.timestamp}`)
    
    if (entry.isGraphQL && entry.operationName) {
      lines.push(`**Operation:** ${entry.operationName}`)
    }
    
    // Display GraphQL query separately if available
    if (entry.isGraphQL && entry.requestBody?.query) {
      lines.push("\n### GraphQL Query:")
      lines.push("```graphql")
      lines.push(entry.requestBody.query)
      lines.push("```")
      
      if (entry.requestBody.variables && Object.keys(entry.requestBody.variables).length > 0) {
        lines.push("\n### Variables:")
        lines.push("```json")
        lines.push(JSON.stringify(entry.requestBody.variables, null, 2))
        lines.push("```")
      }
    } else if (entry.requestBody) {
      lines.push("\n### Request Body:")
      lines.push("```json")
      lines.push(JSON.stringify(entry.requestBody, null, 2))
      lines.push("```")
    }
    
    if (entry.responseBody) {
      lines.push("\n### Response Body:")
      lines.push("```json")
      const responseStr = JSON.stringify(entry.responseBody, null, 2)
      if (responseStr.length > 1000) {
        lines.push(responseStr.substring(0, 1000) + "\n... [truncated]")
      } else {
        lines.push(responseStr)
      }
      lines.push("```")
    }
    
    sections.push(lines.join("\n"))
    sections.push("\n" + "-".repeat(80) + "\n")
  })
  
  return sections.join("\n")
}

export const formatCompact = (entries: FormattedRequest[]): string => {
  const sections: string[] = []
  
  sections.push("# API Requests Overview")
  sections.push(`${entries.length} total requests (${entries.filter(e => e.isGraphQL).length} GraphQL, ${entries.filter(e => !e.isGraphQL).length} REST)\n`)
  
  entries.forEach(entry => {
    const prefix = entry.isGraphQL ? `[GraphQL: ${entry.operationName || 'unknown'}]` : "[REST]"
    sections.push(`${prefix} ${entry.method} ${entry.url} -> ${entry.status} (${entry.duration}ms)`)
    
    if (entry.requestBody?.query) {
      // Extract first meaningful part of query (skip "query OperationName")
      const queryBody = entry.requestBody.query
        .replace(/^(query|mutation|subscription)\s+\w+\s*(\([^)]*\))?\s*{/, '{')
        .trim()
        .substring(0, 80)
      sections.push(`  Query: ${queryBody}...`)
    }
    
    if (entry.responseBody?.data) {
      const keys = Object.keys(entry.responseBody.data)
      sections.push(`  Response keys: ${keys.join(", ")}`)
    } else if (entry.responseBody) {
      const preview = JSON.stringify(entry.responseBody).substring(0, 100)
      sections.push(`  Response: ${preview}...`)
    }
    
    sections.push("")
  })
  
  return sections.join("\n")
}