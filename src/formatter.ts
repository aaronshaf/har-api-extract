import { Effect, pipe } from "effect"
import { HAREntry } from "./types.js"

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
  
  sections.push(`<api_requests total="${entries.length}" graphql="${entries.filter(e => e.isGraphQL).length}" rest="${entries.filter(e => !e.isGraphQL).length}">`)
  
  entries.forEach(entry => {
    const type = entry.isGraphQL ? 'graphql' : 'rest'
    sections.push(`\n<request index="${entry.index}" type="${type}">`)
    sections.push(`  <url method="${entry.method}">${entry.url}</url>`)
    sections.push(`  <status code="${entry.status}" duration="${entry.duration}ms"/>`)
    
    if (entry.isGraphQL && entry.operationName) {
      sections.push(`  <operation>${entry.operationName}</operation>`)
    }
    
    // Display GraphQL query separately if available
    if (entry.isGraphQL && entry.requestBody?.query) {
      sections.push(`  <graphql_query>`)
      sections.push(entry.requestBody.query)
      sections.push(`  </graphql_query>`)
      
      if (entry.requestBody.variables && Object.keys(entry.requestBody.variables).length > 0) {
        sections.push(`  <variables>`)
        sections.push(JSON.stringify(entry.requestBody.variables, null, 2))
        sections.push(`  </variables>`)
      }
    } else if (entry.requestBody) {
      sections.push(`  <request_body>`)
      sections.push(JSON.stringify(entry.requestBody, null, 2))
      sections.push(`  </request_body>`)
    }
    
    if (entry.responseBody) {
      sections.push(`  <response>`)
      const responseStr = JSON.stringify(entry.responseBody, null, 2)
      if (responseStr.length > 1000) {
        sections.push(responseStr.substring(0, 1000) + "\n... [truncated]")
      } else {
        sections.push(responseStr)
      }
      sections.push(`  </response>`)
    }
    
    sections.push(`</request>`)
  })
  
  sections.push(`\n</api_requests>`)
  
  return sections.join("\n")
}

