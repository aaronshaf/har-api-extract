import { Effect, pipe } from "effect"
import { Schema } from "@effect/schema"
import * as fs from "node:fs"
import { HARFile, HAREntry } from "./types.js"

export const parseHARFile = (content: string) =>
  pipe(
    Effect.try({
      try: () => JSON.parse(content),
      catch: (error) => ({
        _tag: "ParseError" as const,
        message: `Invalid JSON format. Please ensure the file is a valid HAR file exported from browser DevTools.`
      })
    }),
    Effect.flatMap((json) => 
      pipe(
        Schema.decodeUnknown(HARFile)(json),
        Effect.mapError((error) => ({
          _tag: "ParseError" as const,
          message: `Invalid HAR file structure. The file appears to be JSON but doesn't match the HAR (HTTP Archive) format. Please export a HAR file from your browser's Network tab.`
        }))
      )
    )
  )

export const readHARFile = (filePath: string) =>
  pipe(
    Effect.try({
      try: () => {
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`)
        }
        return fs.readFileSync(filePath, "utf-8")
      },
      catch: (error: any) => ({
        _tag: "ReadError" as const,
        message: error.message.includes("File not found") 
          ? `File not found: ${filePath}\n\nPlease check the file path and try again.`
          : `Unable to read file: ${filePath}\n\nError: ${error.message}`
      })
    }),
    Effect.flatMap(parseHARFile)
  )

export const readHARFromStdin = () =>
  pipe(
    Effect.async<string, { _tag: "StdinError"; message: string }>((callback) => {
      let data = ""
      process.stdin.setEncoding("utf-8")
      
      process.stdin.on("data", (chunk) => {
        data += chunk
      })
      
      process.stdin.on("end", () => {
        callback(Effect.succeed(data))
      })
      
      process.stdin.on("error", (err) => {
        callback(Effect.fail({ _tag: "StdinError", message: err.message }))
      })
    }),
    Effect.flatMap(parseHARFile)
  )

export const isJSONRequest = (entry: HAREntry): boolean => {
  const contentType = entry.request.postData?.mimeType || 
    entry.request.headers.find(h => h.name.toLowerCase() === "content-type")?.value || ""
  
  return contentType.includes("application/json")
}

export const isJSONResponse = (entry: HAREntry): boolean => {
  return entry.response.content.mimeType?.includes("application/json") || false
}

export const isGraphQLRequest = (entry: HAREntry): boolean => {
  if (!isJSONRequest(entry)) return false
  
  const postData = entry.request.postData?.text
  if (!postData) return false
  
  try {
    const parsed = JSON.parse(postData)
    return !!(parsed.operationName || parsed.query)
  } catch {
    return false
  }
}

export const filterJSONAndGraphQLEntries = (entries: HAREntry[]): HAREntry[] =>
  entries.filter(entry => 
    (isJSONRequest(entry) || isJSONResponse(entry)) && 
    entry.response.content.text !== undefined
  )