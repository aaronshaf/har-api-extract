#!/usr/bin/env bun
import { Args, Command, Options } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Console, Effect, pipe, Option } from "effect"
import { readHARFile, readHARFromStdin, filterJSONAndGraphQLEntries } from "./parser"
import { formatEntry, formatForLLM, formatCompact } from "./formatter"

const filePath = Args.text({ name: "file" }).pipe(
  Args.withDescription("Path to HAR file (omit to read from stdin)"),
  Args.optional
)

const compact = Options.boolean("compact").pipe(
  Options.withAlias("c"),
  Options.withDescription("Output in compact format"),
  Options.withDefault(false)
)

const all = Options.boolean("all").pipe(
  Options.withAlias("a"),
  Options.withDescription("Include all requests, not just JSON/GraphQL"),
  Options.withDefault(false)
)

const har = Command.make(
  "har",
  { file: filePath, compact, all },
  ({ file, compact, all }) =>
    pipe(
      Option.match(file, {
        onNone: () => readHARFromStdin(),
        onSome: (path) => readHARFile(path)
      }),
      Effect.map((harFile) => {
        const entries = all 
          ? harFile.log.entries 
          : filterJSONAndGraphQLEntries(harFile.log.entries)
        
        if (entries.length === 0) {
          return "No JSON or GraphQL requests found in the HAR file."
        }
        
        const formatted = entries.map((entry, index) => formatEntry(entry, index))
        return compact ? formatCompact(formatted) : formatForLLM(formatted)
      }),
      Effect.flatMap(Console.log),
      Effect.catchAll((error) =>
        Console.error(`Error: ${JSON.stringify(error)}`)
      )
    )
).pipe(
  Command.withDescription("Extract and format JSON/GraphQL requests from HAR files for LLM analysis")
)

const cli = Command.run(har, {
  name: "har",
  version: "1.0.0"
})

pipe(
  cli(process.argv.slice(2)),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)