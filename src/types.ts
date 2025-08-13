import { Schema } from "@effect/schema"

export const HARHeader = Schema.Struct({
  name: Schema.String,
  value: Schema.String
})

export const HARPostData = Schema.Struct({
  mimeType: Schema.String,
  text: Schema.String
})

export const HARRequest = Schema.Struct({
  method: Schema.String,
  url: Schema.String,
  httpVersion: Schema.optional(Schema.String),
  headers: Schema.Array(HARHeader),
  queryString: Schema.optional(Schema.Array(Schema.Unknown)),
  cookies: Schema.optional(Schema.Array(Schema.Unknown)),
  headersSize: Schema.optional(Schema.Number),
  bodySize: Schema.optional(Schema.Number),
  postData: Schema.optional(HARPostData)
})

export const HARContent = Schema.Struct({
  size: Schema.Number,
  mimeType: Schema.String,
  text: Schema.optional(Schema.String),
  encoding: Schema.optional(Schema.String)
})

export const HARResponse = Schema.Struct({
  status: Schema.Number,
  statusText: Schema.String,
  httpVersion: Schema.optional(Schema.String),
  headers: Schema.Array(HARHeader),
  cookies: Schema.optional(Schema.Array(Schema.Unknown)),
  content: HARContent,
  redirectURL: Schema.optional(Schema.String),
  headersSize: Schema.optional(Schema.Number),
  bodySize: Schema.optional(Schema.Number)
})

export const HAREntry = Schema.Struct({
  _connectionId: Schema.optional(Schema.String),
  _initiator: Schema.optional(Schema.Unknown),
  _priority: Schema.optional(Schema.String),
  _resourceType: Schema.optional(Schema.String),
  cache: Schema.optional(Schema.Unknown),
  connection: Schema.optional(Schema.String),
  pageref: Schema.optional(Schema.String),
  request: HARRequest,
  response: HARResponse,
  serverIPAddress: Schema.optional(Schema.String),
  startedDateTime: Schema.String,
  time: Schema.Number,
  timings: Schema.optional(Schema.Unknown)
})

export const HARLog = Schema.Struct({
  version: Schema.String,
  creator: Schema.Struct({
    name: Schema.String,
    version: Schema.String
  }),
  pages: Schema.optional(Schema.Array(Schema.Unknown)),
  entries: Schema.Array(HAREntry)
})

export const HARFile = Schema.Struct({
  log: HARLog
})

export type HARFile = Schema.Schema.Type<typeof HARFile>
export type HAREntry = Schema.Schema.Type<typeof HAREntry>
export type HARRequest = Schema.Schema.Type<typeof HARRequest>
export type HARResponse = Schema.Schema.Type<typeof HARResponse>