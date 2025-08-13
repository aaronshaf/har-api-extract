import { describe, test, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { readHARFile, readHARFromStdin } from "./parser.js"

describe("readHARFile", () => {
  let tempDir: string
  let tempFile: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "har-test-"))
    tempFile = path.join(tempDir, "test.har")
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test("reads valid HAR file from disk", async () => {
    const harContent = JSON.stringify({
      log: {
        version: "1.2",
        creator: { name: "test", version: "1.0" },
        entries: []
      }
    })
    
    fs.writeFileSync(tempFile, harContent)
    
    const result = await Effect.runPromise(readHARFile(tempFile))
    assert.strictEqual(result.log.version, "1.2")
    assert.deepStrictEqual(result.log.entries, [])
  })

  test("handles file not found error", async () => {
    const nonExistentFile = path.join(tempDir, "does-not-exist.har")
    
    const result = await Effect.runPromise(
      Effect.either(readHARFile(nonExistentFile))
    )
    
    assert.strictEqual(result._tag, "Left")
    if (result._tag === "Left") {
      assert.strictEqual(result.left._tag, "ReadError")
      assert(result.left.message.includes("File not found"))
    }
  })

  test("handles permission denied error", async function() {
    // Skip on Windows as permission handling is different
    if (process.platform === "win32") {
      this.skip()
      return
    }
    
    fs.writeFileSync(tempFile, "content")
    fs.chmodSync(tempFile, 0o000) // Remove all permissions
    
    const result = await Effect.runPromise(
      Effect.either(readHARFile(tempFile))
    )
    
    // Restore permissions before assertions to allow cleanup
    fs.chmodSync(tempFile, 0o644)
    
    assert.strictEqual(result._tag, "Left")
    if (result._tag === "Left") {
      assert.strictEqual(result.left._tag, "ReadError")
      assert(result.left.message.includes("Unable to read file"))
    }
  })

  test("handles invalid JSON in file", async () => {
    fs.writeFileSync(tempFile, "not valid json")
    
    const result = await Effect.runPromise(
      Effect.either(readHARFile(tempFile))
    )
    
    assert.strictEqual(result._tag, "Left")
    if (result._tag === "Left") {
      assert.strictEqual(result.left._tag, "ParseError")
      assert(result.left.message.includes("Invalid JSON format"))
    }
  })

  test("handles valid JSON but invalid HAR structure", async () => {
    const invalidHar = JSON.stringify({
      notLog: "this is not a HAR file"
    })
    
    fs.writeFileSync(tempFile, invalidHar)
    
    const result = await Effect.runPromise(
      Effect.either(readHARFile(tempFile))
    )
    
    assert.strictEqual(result._tag, "Left")
    if (result._tag === "Left") {
      assert.strictEqual(result.left._tag, "ParseError")
      assert(result.left.message.includes("Invalid HAR file structure"))
    }
  })

  test("handles empty file", async () => {
    fs.writeFileSync(tempFile, "")
    
    const result = await Effect.runPromise(
      Effect.either(readHARFile(tempFile))
    )
    
    assert.strictEqual(result._tag, "Left")
    if (result._tag === "Left") {
      assert.strictEqual(result.left._tag, "ParseError")
    }
  })

  test("handles large HAR file with many entries", async () => {
    const entries = Array.from({ length: 100 }, (_, i) => ({
      request: {
        method: "GET",
        url: `https://api.example.com/item/${i}`,
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
          text: JSON.stringify({ id: i })
        }
      },
      startedDateTime: new Date().toISOString(),
      time: 100
    }))
    
    const harContent = JSON.stringify({
      log: {
        version: "1.2",
        creator: { name: "test", version: "1.0" },
        entries
      }
    })
    
    fs.writeFileSync(tempFile, harContent)
    
    const result = await Effect.runPromise(readHARFile(tempFile))
    assert.strictEqual(result.log.entries.length, 100)
  })

  test("handles HAR file with special characters in path", async () => {
    const specialFile = path.join(tempDir, "test file with spaces & special.har")
    const harContent = JSON.stringify({
      log: {
        version: "1.2",
        creator: { name: "test", version: "1.0" },
        entries: []
      }
    })
    
    fs.writeFileSync(specialFile, harContent)
    
    const result = await Effect.runPromise(readHARFile(specialFile))
    assert.strictEqual(result.log.version, "1.2")
  })
})

// Note: stdin tests are commented out as they require special mocking
// that is incompatible with Node.js test runner's process object
describe.skip("readHARFromStdin", () => {
  let originalStdin: NodeJS.ReadStream

  beforeEach(() => {
    originalStdin = process.stdin
  })

  afterEach(() => {
    process.stdin = originalStdin
  })

  test("reads valid HAR from stdin", async () => {
    const harContent = JSON.stringify({
      log: {
        version: "1.2",
        creator: { name: "test", version: "1.0" },
        entries: []
      }
    })
    
    // Mock stdin
    const { Readable } = await import("stream")
    const mockStdin = new Readable({
      read() {
        this.push(harContent)
        this.push(null)
      }
    }) as any
    
    mockStdin.setEncoding = () => mockStdin
    process.stdin = mockStdin
    
    const result = await Effect.runPromise(readHARFromStdin())
    assert.strictEqual(result.log.version, "1.2")
    assert.deepStrictEqual(result.log.entries, [])
  })

  test("handles invalid JSON from stdin", async () => {
    const { Readable } = await import("stream")
    const mockStdin = new Readable({
      read() {
        this.push("not valid json")
        this.push(null)
      }
    }) as any
    
    mockStdin.setEncoding = () => mockStdin
    process.stdin = mockStdin
    
    const result = await Effect.runPromise(
      Effect.either(readHARFromStdin())
    )
    
    assert.strictEqual(result._tag, "Left")
    if (result._tag === "Left") {
      assert.strictEqual(result.left._tag, "ParseError")
    }
  })

  test("handles empty stdin", async () => {
    const { Readable } = await import("stream")
    const mockStdin = new Readable({
      read() {
        this.push(null)
      }
    }) as any
    
    mockStdin.setEncoding = () => mockStdin
    process.stdin = mockStdin
    
    const result = await Effect.runPromise(
      Effect.either(readHARFromStdin())
    )
    
    assert.strictEqual(result._tag, "Left")
    if (result._tag === "Left") {
      assert.strictEqual(result.left._tag, "StdinError")
      assert(result.left.message.includes("No input received"))
    }
  })

  test("handles stdin read error", async () => {
    const { Readable } = await import("stream")
    const mockStdin = new Readable({
      read() {
        this.destroy(new Error("Read error"))
      }
    }) as any
    
    mockStdin.setEncoding = () => mockStdin
    process.stdin = mockStdin
    
    const result = await Effect.runPromise(
      Effect.either(readHARFromStdin())
    )
    
    assert.strictEqual(result._tag, "Left")
    if (result._tag === "Left") {
      assert.strictEqual(result.left._tag, "StdinError")
      assert(result.left.message.includes("Failed to read from stdin"))
    }
  })

  test("handles large input from stdin", async () => {
    const entries = Array.from({ length: 50 }, (_, i) => ({
      request: {
        method: "POST",
        url: `https://api.example.com/graphql`,
        headers: [{ name: "content-type", value: "application/json" }],
        postData: {
          mimeType: "application/json",
          text: JSON.stringify({
            operationName: `Query${i}`,
            query: `query Query${i} { item${i} { id } }`
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
          text: JSON.stringify({ data: { [`item${i}`]: { id: i } } })
        }
      },
      startedDateTime: new Date().toISOString(),
      time: 50
    }))
    
    const harContent = JSON.stringify({
      log: {
        version: "1.2",
        creator: { name: "test", version: "1.0" },
        entries
      }
    })
    
    const { Readable } = await import("stream")
    const mockStdin = new Readable({
      read() {
        this.push(harContent)
        this.push(null)
      }
    }) as any
    
    mockStdin.setEncoding = () => mockStdin
    process.stdin = mockStdin
    
    const result = await Effect.runPromise(readHARFromStdin())
    assert.strictEqual(result.log.entries.length, 50)
  })
})