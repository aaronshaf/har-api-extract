import { describe, test, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { execSync } from "child_process"
import * as fs from "node:fs"
import * as path from "path"
import * as os from "os"

describe("CLI integration tests", () => {
  let tempDir: string
  let tempFile: string
  const cliPath = path.join(process.cwd(), "har.ts")

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "har-cli-test-"))
    tempFile = path.join(tempDir, "test.har")
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test("processes valid HAR file", () => {
    const harContent = JSON.stringify({
      log: {
        version: "1.2",
        creator: { name: "test", version: "1.0" },
        entries: [{
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
          time: 100
        }]
      }
    })
    
    fs.writeFileSync(tempFile, harContent)
    
    const output = execSync(`tsx ${cliPath} ${tempFile}`, { encoding: "utf-8" })
    
    assert(output.includes('<api_requests total="1"'))
    assert(output.includes('graphql="0" rest="1"'))
    assert(output.includes('<url method="GET">https://api.example.com/users</url>'))
  })

  test("handles empty HAR file with no JSON requests", () => {
    const harContent = JSON.stringify({
      log: {
        version: "1.2",
        creator: { name: "test", version: "1.0" },
        entries: [{
          request: {
            method: "GET",
            url: "https://example.com/image.png",
            headers: []
          },
          response: {
            status: 200,
            statusText: "OK",
            headers: [],
            content: {
              size: 1000,
              mimeType: "image/png",
              text: "binary data"
            }
          },
          startedDateTime: "2024-01-01T00:00:00Z",
          time: 50
        }]
      }
    })
    
    fs.writeFileSync(tempFile, harContent)
    
    const output = execSync(`tsx ${cliPath} ${tempFile}`, { encoding: "utf-8" })
    
    assert(output.includes("No JSON or GraphQL requests found"))
  })

  test("processes HAR from stdin", () => {
    const harContent = JSON.stringify({
      log: {
        version: "1.2",
        creator: { name: "test", version: "1.0" },
        entries: [{
          request: {
            method: "POST",
            url: "https://api.example.com/graphql",
            headers: [{ name: "content-type", value: "application/json" }],
            postData: {
              mimeType: "application/json",
              text: JSON.stringify({
                operationName: "TestQuery",
                query: "query TestQuery { test { id } }"
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
              text: JSON.stringify({ data: { test: { id: "1" } } })
            }
          },
          startedDateTime: "2024-01-01T00:00:00Z",
          time: 75
        }]
      }
    })
    
    const output = execSync(`echo '${harContent}' | tsx ${cliPath}`, { encoding: "utf-8" })
    
    assert(output.includes('<api_requests total="1"'))
    assert(output.includes('graphql="1" rest="0"'))
    assert(output.includes('<operation>TestQuery</operation>'))
  })

  test("shows help with --help flag", () => {
    const output = execSync(`tsx ${cliPath} --help`, { encoding: "utf-8" })
    
    assert(output.includes("har - Extract and format JSON/GraphQL requests"))
    assert(output.includes("Usage:"))
    assert(output.includes("Options:"))
    assert(output.includes("-h, --help"))
    assert(output.includes("-a, --all"))
  })

  test("handles --all flag to include non-JSON requests", () => {
    const harContent = JSON.stringify({
      log: {
        version: "1.2",
        creator: { name: "test", version: "1.0" },
        entries: [
          {
            request: {
              method: "GET",
              url: "https://example.com/page.html",
              headers: []
            },
            response: {
              status: 200,
              statusText: "OK",
              headers: [],
              content: {
                size: 500,
                mimeType: "text/html",
                text: "<html><body>Test</body></html>"
              }
            },
            startedDateTime: "2024-01-01T00:00:00Z",
            time: 30
          },
          {
            request: {
              method: "GET",
              url: "https://api.example.com/data",
              headers: []
            },
            response: {
              status: 200,
              statusText: "OK",
              headers: [],
              content: {
                size: 50,
                mimeType: "application/json",
                text: '{"data": "test"}'
              }
            },
            startedDateTime: "2024-01-01T00:00:01Z",
            time: 40
          }
        ]
      }
    })
    
    fs.writeFileSync(tempFile, harContent)
    
    const outputWithAll = execSync(`tsx ${cliPath} ${tempFile} --all`, { encoding: "utf-8" })
    const outputWithoutAll = execSync(`tsx ${cliPath} ${tempFile}`, { encoding: "utf-8" })
    
    // With --all flag, should include HTML request
    assert(outputWithAll.includes('total="2"'))
    assert(outputWithAll.includes('https://example.com/page.html'))
    
    // Without --all flag, should only include JSON request
    assert(outputWithoutAll.includes('total="1"'))
    assert(!outputWithoutAll.includes('https://example.com/page.html'))
  })

  test("handles file not found error gracefully", () => {
    const nonExistentFile = path.join(tempDir, "does-not-exist.har")
    
    try {
      execSync(`tsx ${cliPath} ${nonExistentFile}`, { encoding: "utf-8" })
      assert.fail("Should have thrown an error")
    } catch (error: any) {
      assert(error.stderr.includes("File not found") || error.stdout.includes("File not found"))
    }
  })

  test("handles invalid JSON gracefully", () => {
    fs.writeFileSync(tempFile, "not valid json")
    
    try {
      execSync(`tsx ${cliPath} ${tempFile}`, { encoding: "utf-8" })
      assert.fail("Should have thrown an error")
    } catch (error: any) {
      assert(error.stderr.includes("Invalid JSON") || error.stdout.includes("Invalid JSON"))
    }
  })
})