/**
 * Fake traffic generator for Doclight — sends real events through the
 * @doclight/node SDK to exercise the full ingest pipeline.
 *
 * Usage:
 *   pnpm traffic                          # continuous at 0.5 sessions/s
 *   pnpm traffic:burst                    # 50 sessions then exit
 *   pnpm traffic -- --burst 10            # 10 sessions then exit
 *   pnpm traffic -- --rps 2              # 2 sessions/s continuous
 *   pnpm traffic -- --scenario confused  # one profile only
 */

import { createDoclight } from "@doclight/node"

// ---------------------------------------------------------------------------
// Config + CLI
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2)
  let rps = 0.5
  let burst: number | null = null
  let scenario: string | null = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--rps" && args[i + 1]) rps = Number(args[++i])
    else if (args[i] === "--burst" && args[i + 1]) burst = Number(args[++i])
    else if (args[i] === "--scenario" && args[i + 1]) scenario = args[++i]
    else if (args[i].startsWith("--rps=")) rps = Number(args[i].slice(6))
    else if (args[i].startsWith("--burst=")) burst = Number(args[i].slice(8))
    else if (args[i].startsWith("--scenario=")) scenario = args[i].slice(11)
  }

  return { rps, burst, scenario }
}

const { rps, burst, scenario } = parseArgs()

const client = createDoclight({
  apiKey: process.env.DOCLIGHT_API_KEY ?? "dev-key-123",
  projectId: process.env.DOCLIGHT_PROJECT_ID ?? "proj_demo",
  endpoint: process.env.DOCLIGHT_ENDPOINT ?? "http://localhost:8000",
  lifecycleHooks: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const randMs = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
const randInt = (lo: number, hi: number) => Math.floor(lo + Math.random() * (hi - lo + 1))
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

let totalSessions = 0
let totalEvents = 0
let failedSessions = 0
let elapsedSeconds = 0

// ---------------------------------------------------------------------------
// Agent profile: explorer
// startSession → list_resources → 2-4 × (search_docs|get_schema) → endSession(85% success)
// ---------------------------------------------------------------------------

async function runExplorer(): Promise<void> {
  const sessionId = client.startSession(pick([
    "Search developer documentation for API usage examples",
    "Find code examples for SDK integration",
    "Explore available documentation resources",
  ]))
  totalEvents++

  client.track("step_started", { sessionId, stepName: "discovery" })
  totalEvents++
  await sleep(randMs(20, 80))

  // list_resources — 2% failure
  const listFailed = Math.random() < 0.02
  const listDur = randInt(50, 400)
  client.trackToolCall({
    sessionId,
    toolName: "list_resources",
    status: listFailed ? "failed" : "success",
    durationMs: listDur,
    ...(listFailed ? { errorType: "not_found" } : {}),
  })
  totalEvents++
  await sleep(listDur + randMs(10, 40))

  client.track("step_completed", {
    sessionId,
    stepName: "discovery",
    status: listFailed ? "failed" : "success",
  })
  totalEvents++
  await sleep(randMs(20, 80))

  // 2-4 query steps
  const queryCount = randInt(2, 4)
  let anyFailed = listFailed
  for (let i = 0; i < queryCount; i++) {
    const stepName = `query_${i}`
    const tool = pick(["search_docs", "search_docs", "get_schema"]) as string
    const baseFailRate = tool === "search_docs" ? 0.08 : 0.03
    const failed = Math.random() < baseFailRate
    const dur = randInt(100, 800)

    client.track("step_started", { sessionId, stepName })
    totalEvents++
    await sleep(randMs(20, 60))

    client.trackToolCall({
      sessionId,
      toolName: tool,
      status: failed ? "failed" : "success",
      durationMs: dur,
      stepName,
      ...(failed ? { errorType: tool === "search_docs" ? "no_results" : "timeout" } : {}),
    })
    totalEvents++
    await sleep(dur + randMs(10, 40))

    client.track("step_completed", { sessionId, stepName, status: failed ? "failed" : "success" })
    totalEvents++
    await sleep(randMs(20, 80))

    if (failed) anyFailed = true
  }

  // 85% success overall
  const finalStatus = (anyFailed && Math.random() < 0.5) || Math.random() < 0.15 ? "failed" : "success"
  client.endSession(sessionId, finalStatus)
  totalEvents++
  totalSessions++
  if (finalStatus === "failed") failedSessions++
}

// ---------------------------------------------------------------------------
// Agent profile: direct
// startSession → authenticate (81% success) → search_docs|create_index → endSession
// ---------------------------------------------------------------------------

async function runDirect(): Promise<void> {
  const sessionId = client.startSession(pick([
    "Authenticate and query resources",
    "Direct API access with authentication",
    "Retrieve indexed documents",
  ]))
  totalEvents++

  client.track("step_started", { sessionId, stepName: "auth" })
  totalEvents++
  await sleep(randMs(20, 80))

  const authFailed = Math.random() < 0.19
  const authDur = randInt(100, 600)
  client.trackToolCall({
    sessionId,
    toolName: "authenticate",
    status: authFailed ? "failed" : "success",
    durationMs: authDur,
    ...(authFailed ? { errorType: "invalid_api_key" } : {}),
  })
  totalEvents++
  await sleep(authDur + randMs(10, 40))

  if (authFailed) {
    client.track("auth_failed", {
      sessionId,
      stepName: "auth",
      errorType: "invalid_api_key",
      errorMessageRedacted: "API key is invalid or has been revoked",
    })
    totalEvents++
    await sleep(randMs(10, 30))

    client.track("step_completed", { sessionId, stepName: "auth", status: "failed" })
    totalEvents++
    await sleep(randMs(10, 30))

    client.endSession(sessionId, "failed")
    totalEvents++
    totalSessions++
    failedSessions++
    return
  }

  // Auth succeeded
  client.track("step_completed", { sessionId, stepName: "auth", status: "success" })
  totalEvents++
  await sleep(randMs(20, 80))

  client.track("step_started", { sessionId, stepName: "action" })
  totalEvents++
  await sleep(randMs(20, 80))

  const tool = Math.random() < 0.6 ? "search_docs" : "create_index"
  const baseFailRate = tool === "search_docs" ? 0.08 : 0.31
  const toolFailed = Math.random() < baseFailRate
  const toolDur = randInt(100, 700)
  const toolErr = tool === "search_docs" ? "no_results" : "missing_required_param"

  client.trackToolCall({
    sessionId,
    toolName: tool,
    status: toolFailed ? "failed" : "success",
    durationMs: toolDur,
    ...(toolFailed ? { errorType: toolErr } : {}),
  })
  totalEvents++
  await sleep(toolDur + randMs(10, 40))

  client.track("step_completed", {
    sessionId,
    stepName: "action",
    status: toolFailed ? "failed" : "success",
  })
  totalEvents++
  await sleep(randMs(10, 30))

  const finalStatus = toolFailed ? "failed" : "success"
  client.endSession(sessionId, finalStatus)
  totalEvents++
  totalSessions++
  if (finalStatus === "failed") failedSessions++
}

// ---------------------------------------------------------------------------
// Agent profile: confused
// Retries create_index with wrong params 3× → always fails (demo of stuck agent)
// ---------------------------------------------------------------------------

async function runConfused(): Promise<void> {
  const sessionId = client.startSession("Index dataset with embeddings for semantic search")
  totalEvents++

  client.track("step_started", { sessionId, stepName: "index_attempt" })
  totalEvents++
  await sleep(randMs(20, 80))

  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(randMs(50, 300))

    // Always fails — missing "dimension" field
    const dur = randInt(50, 300)
    client.trackToolCall({
      sessionId,
      toolName: "create_index",
      status: "failed",
      durationMs: dur,
      stepName: "index_attempt",
      errorType: "missing_required_param",
    })
    totalEvents++
    await sleep(dur + randMs(10, 30))

    client.track("schema_validation_failed", {
      sessionId,
      toolName: "create_index",
      stepName: "index_attempt",
      errorType: "missing_required_param",
      errorMessageRedacted: "Field 'dimension' is required but was not provided",
    })
    totalEvents++
    await sleep(randMs(10, 30))

    if (attempt < 2) {
      client.track("retry_attempted", { sessionId, stepName: "index_attempt" })
      totalEvents++
      await sleep(randMs(200, 800))  // agent "thinking" delay before retry
    }
  }

  client.track("step_completed", { sessionId, stepName: "index_attempt", status: "failed" })
  totalEvents++
  await sleep(randMs(10, 30))

  client.endSession(sessionId, "failed")
  totalEvents++
  totalSessions++
  failedSessions++
}

// ---------------------------------------------------------------------------
// Agent profile: fragile
// search_docs (success) → embed_text (40% rate_limit+retry, 20% timeout, rest normal)
// ---------------------------------------------------------------------------

async function runFragile(): Promise<void> {
  const sessionId = client.startSession(pick([
    "Bulk embed technical articles for vector search",
    "Embed documentation chunks for semantic retrieval",
  ]))
  totalEvents++

  // Search step — always succeeds
  client.track("step_started", { sessionId, stepName: "search" })
  totalEvents++
  await sleep(randMs(20, 60))

  const searchDur = randInt(100, 400)
  client.trackToolCall({
    sessionId,
    toolName: "search_docs",
    status: "success",
    durationMs: searchDur,
    stepName: "search",
  })
  totalEvents++
  await sleep(searchDur + randMs(10, 40))

  client.track("step_completed", { sessionId, stepName: "search", status: "success" })
  totalEvents++
  await sleep(randMs(20, 80))

  // Embed step — fragile
  client.track("step_started", { sessionId, stepName: "embed" })
  totalEvents++
  await sleep(randMs(20, 80))

  const r = Math.random()
  let finalStatus: "success" | "failed"

  if (r < 0.40) {
    // Rate limit hit → retry
    const dur = randInt(100, 400)
    client.trackToolCall({
      sessionId,
      toolName: "embed_text",
      status: "failed",
      durationMs: dur,
      stepName: "embed",
      errorType: "rate_limit_exceeded",
    })
    totalEvents++
    await sleep(dur + randMs(10, 30))

    client.track("rate_limited", {
      sessionId,
      toolName: "embed_text",
      stepName: "embed",
      errorType: "rate_limit_exceeded",
      errorMessageRedacted: "Rate limit exceeded. Retry after 2s.",
    })
    totalEvents++
    await sleep(randMs(10, 30))

    client.track("retry_attempted", { sessionId, stepName: "embed" })
    totalEvents++
    await sleep(randMs(1800, 2500))  // wait for rate limit window

    // Retry — 50/50
    const retryFailed = Math.random() < 0.50
    const retryDur = randInt(100, 600)
    client.trackToolCall({
      sessionId,
      toolName: "embed_text",
      status: retryFailed ? "failed" : "success",
      durationMs: retryDur,
      stepName: "embed",
      ...(retryFailed ? { errorType: "rate_limit_exceeded" } : {}),
    })
    totalEvents++
    await sleep(retryDur + randMs(10, 40))

    finalStatus = retryFailed ? "failed" : "success"
    client.track("step_completed", { sessionId, stepName: "embed", status: finalStatus })
    totalEvents++

  } else if (r < 0.60) {
    // Timeout
    const dur = randInt(800, 2000)
    client.trackToolCall({
      sessionId,
      toolName: "embed_text",
      status: "timeout",
      durationMs: dur,
      stepName: "embed",
      errorType: "timeout",
    })
    totalEvents++
    await sleep(dur + randMs(10, 30))

    client.track("timeout_occurred", {
      sessionId,
      toolName: "embed_text",
      stepName: "embed",
      errorType: "timeout",
      errorMessageRedacted: "Tool call timed out after 2000ms",
    })
    totalEvents++

    finalStatus = "failed"
    client.track("step_completed", { sessionId, stepName: "embed", status: "failed" })
    totalEvents++

  } else {
    // Normal path
    const embedFailed = Math.random() < 0.12
    const dur = randInt(100, 600)
    client.trackToolCall({
      sessionId,
      toolName: "embed_text",
      status: embedFailed ? "failed" : "success",
      durationMs: dur,
      stepName: "embed",
      ...(embedFailed ? { errorType: "rate_limit_exceeded" } : {}),
    })
    totalEvents++
    await sleep(dur + randMs(10, 40))

    finalStatus = embedFailed ? "failed" : "success"
    client.track("step_completed", { sessionId, stepName: "embed", status: finalStatus })
    totalEvents++
  }

  await sleep(randMs(10, 30))
  client.endSession(sessionId, finalStatus)
  totalEvents++
  totalSessions++
  if (finalStatus === "failed") failedSessions++
}

// ---------------------------------------------------------------------------
// Profile dispatch
// ---------------------------------------------------------------------------

type ProfileFn = () => Promise<void>

const PROFILES: Array<{ name: string; weight: number; fn: ProfileFn }> = [
  { name: "explorer", weight: 0.40, fn: runExplorer },
  { name: "direct",   weight: 0.30, fn: runDirect },
  { name: "confused", weight: 0.20, fn: runConfused },
  { name: "fragile",  weight: 0.10, fn: runFragile },
]

function pickProfile(): ProfileFn {
  if (scenario) {
    const found = PROFILES.find((p) => p.name === scenario)
    if (!found) {
      console.error(`Unknown scenario: ${scenario}. Valid: ${PROFILES.map((p) => p.name).join(", ")}`)
      process.exit(1)
    }
    return found.fn
  }
  const r = Math.random()
  let cumulative = 0
  for (const p of PROFILES) {
    cumulative += p.weight
    if (r < cumulative) return p.fn
  }
  return PROFILES[0].fn
}

async function runOneSession(): Promise<void> {
  try {
    await pickProfile()()
  } catch (err) {
    // Log but never crash the generator — SDK handles API errors internally
    console.error(`[warn] session error: ${String(err)}`)
  }
}

// ---------------------------------------------------------------------------
// Continuous mode
// ---------------------------------------------------------------------------

async function runContinuous(): Promise<void> {
  const intervalMs = 1000 / rps
  console.log(`Starting continuous traffic at ${rps} sessions/s (interval: ${intervalMs.toFixed(0)}ms)`)
  console.log("Press Ctrl+C to stop.\n")

  let running = true
  let summaryInterval: ReturnType<typeof setInterval>

  process.on("SIGINT", async () => {
    running = false
    clearInterval(summaryInterval)
    console.log("\nShutting down — flushing remaining events…")
    await client.shutdown()
    printSummary()
    process.exit(0)
  })

  summaryInterval = setInterval(() => {
    elapsedSeconds += 10
    printLiveLine()
  }, 10_000)

  while (running) {
    const start = Date.now()
    // Fire session without awaiting — run concurrently at configured rate
    runOneSession().catch(() => {})
    const elapsed = Date.now() - start
    const wait = Math.max(0, intervalMs - elapsed)
    await sleep(wait)
  }
}

// ---------------------------------------------------------------------------
// Burst mode
// ---------------------------------------------------------------------------

async function runBurst(): Promise<void> {
  const n = burst!
  console.log(`Burst mode: sending ${n} sessions concurrently…`)

  const tasks = Array.from({ length: n }, () => runOneSession())
  await Promise.all(tasks)

  console.log("Flushing…")
  await client.shutdown()
  printSummary()
  console.log(`\nBurst complete — all ${n} sessions sent.`)
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function printLiveLine(): void {
  const stats = client.getStats()
  const queue = stats.enqueued - stats.sent - stats.droppedQueueFull - stats.droppedInvalid
  process.stdout.write(
    `[${elapsedSeconds}s] sent: ${totalSessions} sessions | ${totalEvents} events | ${failedSessions} failed | queue: ${Math.max(0, queue)}\n`,
  )
}

function printSummary(): void {
  console.log(`\n=== Traffic Summary ===`)
  console.log(`Sessions : ${totalSessions} total | ${failedSessions} failed | ${totalSessions - failedSessions} success`)
  console.log(`Events   : ${totalEvents} total`)
  const stats = client.getStats()
  console.log(`SDK stats: sent=${stats.sent} dropped_full=${stats.droppedQueueFull} dropped_invalid=${stats.droppedInvalid} failed_sends=${stats.failedSends}`)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (burst !== null) {
  runBurst()
} else {
  runContinuous()
}
