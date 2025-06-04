import { OpenAI } from 'openai'

// Minimal client wrapper for the new OpenAI Assistants API. This lets us incrementally
// migrate existing Chat Completions logic without touching every call-site at once.
//
// Usage pattern (non-streaming for v1):
//   const { response, threadId } = await runAssistant({
//     userMessage: "How do I price my service?",
//     threadId: existingThreadId      // optional – pass to continue a conversation
//   });
//
//   console.log(response); // assistant text
//   console.log(threadId); // persist in DB to keep future context
//
// NOTE: Streaming & tool-call handling are coming in a later migration step.
// This helper intentionally keeps feature-parity with the current ChatCompletions flow
// (single response returned) so we can swap it in behind existing abstractions.

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface RunAssistantArgs {
  userMessage: string
  threadId?: string | null
  additionalInstructions?: string
}

interface RunAssistantResult {
  response: string
  threadId: string
  runId: string
}

export async function runAssistant({
  userMessage,
  threadId,
  additionalInstructions,
}: RunAssistantArgs): Promise<RunAssistantResult> {
  const assistantId = process.env.OPENAI_ASSISTANT_ID
  if (!assistantId) {
    throw new Error('OPENAI_ASSISTANT_ID env var is missing')
  }

  // 1. Ensure a thread exists
  let workingThreadId = threadId ?? null
  if (!workingThreadId) {
    const thread = await openai.beta.threads.create({
      metadata: {
        createdAt: new Date().toISOString(),
      },
    })
    workingThreadId = thread.id
  }

  // 2. Add user message to thread
  await openai.beta.threads.messages.create(workingThreadId, {
    role: 'user',
    content: userMessage,
  })

  // 3. Kick off a run
  const run = await openai.beta.threads.runs.create(workingThreadId, {
    assistant_id: assistantId,
    ...(additionalInstructions ? { additional_instructions: additionalInstructions } : {}),
  })

  // 4. Simple polling loop until complete (v1). In production we'll migrate to webhooks/streaming.
  let runStatus
  for (;;) {
    runStatus = await openai.beta.threads.runs.retrieve(workingThreadId, run.id)
    if (runStatus.status === 'completed') break
    if (['failed', 'cancelled', 'expired'].includes(runStatus.status)) {
      throw new Error(`Assistant run ${runStatus.status}`)
    }
    // Wait 1s then poll again
    await new Promise((r) => setTimeout(r, 1000))
  }

  // 5. Grab the latest assistant message
  const messages = await openai.beta.threads.messages.list(workingThreadId)
  const assistantMsg = messages.data.find((m) => m.role === 'assistant')
  if (!assistantMsg) throw new Error('No assistant message returned')

  let responseText = ''
  for (const part of assistantMsg.content) {
    if (part.type === 'text') {
      // @ts-ignore – the type definition is loose in the SDK
      responseText += part.text.value
    }
  }

  return {
    response: responseText.trim(),
    threadId: workingThreadId,
    runId: run.id,
  }
} 