# Assistants API Migration Implementation Plan

## Executive Summary

This document outlines the migration from OpenAI's Chat Completions API to the Assistants API for the CoachingAI platform. The goal is to improve response speed while maintaining all current functionality including memory, tools, and streaming capabilities.

## Current System Analysis

### Current Architecture
```
User Message → Profile Context → Memory Retrieval → Vector Search + Tool Analysis (Parallel) → James Coaching Response → Streaming
```

### Current Performance Bottlenecks
- **Memory Retrieval**: ~50-100ms (database query)
- **Vector Search**: ~200-300ms (knowledge base search)
- **Tool Analysis**: ~100-200ms (parallel with vector search)
- **James Response**: ~500-1500ms (streaming generation)
- **Total**: ~850-2100ms per request

### Current Components
- ✅ Memory system (coaching context)
- ✅ Vector search (knowledge base)
- ✅ Tool suggestion analysis
- ✅ Profile context building
- ✅ Streaming responses
- ✅ Three specialized tools (JamesBot, Hybrid Offer, Workshop Generator)

## Assistants API Benefits & Challenges

### Benefits
- **Built-in Vector Store**: Eliminates custom vector search implementation
- **Native Tool Calling**: Streamlined tool integration
- **Thread Management**: Built-in conversation persistence
- **Knowledge Retrieval**: Automatic context injection
- **State Management**: Reduced client-side complexity

### Challenges
- **Latency**: Additional API round-trips for thread/run management
- **Streaming Limitations**: More complex streaming implementation
- **Memory Integration**: Need to preserve custom coaching memory system
- **Tool Customization**: Less control over tool execution logic
- **Cost**: Potentially higher token usage due to built-in features

## Migration Strategy

### Phase 1: Hybrid Implementation (Week 1-2)
Implement Assistants API alongside current system for A/B testing.

### Phase 2: Core Migration (Week 3-4)
Migrate core chat functionality while preserving critical features.

### Phase 3: Optimization (Week 5-6)
Performance tuning and feature parity completion.

### Phase 4: Cleanup (Week 7)
Remove legacy code and finalize migration.

## Detailed Implementation Plan

### 1. Assistant Configuration

#### 1.1 Create Coaching Assistant
```javascript
// lib/assistants/coaching-assistant.js
const coachingAssistant = await openai.beta.assistants.create({
  name: "James Camp Coaching Assistant",
  instructions: `You are James Camp, a world-class business coach...`, // Move system prompt here
  model: "gpt-4o",
  tools: [
    { type: "file_search" }, // For knowledge base
    { type: "function", function: hybridOfferTool },
    { type: "function", function: workshopGeneratorTool },
    { type: "function", function: memoryRetrievalTool }
  ],
  tool_resources: {
    file_search: {
      vector_store_ids: [vectorStoreId]
    }
  },
  temperature: 0.7,
  response_format: { type: "text" }
});
```

#### 1.2 Vector Store Migration
```javascript
// lib/assistants/vector-store.js
const vectorStore = await openai.beta.vectorStores.create({
  name: "James Camp Knowledge Base",
  expires_after: {
    anchor: "last_active_at",
    days: 30
  }
});

// Upload knowledge base files
const knowledgeFiles = await uploadKnowledgeBase(vectorStore.id);
```

### 2. Thread Management

#### 2.1 Thread Creation & Persistence
```javascript
// lib/assistants/thread-manager.js
class ThreadManager {
  async getOrCreateThread(chatId, userId) {
    // Check if thread exists in our database
    const existingThread = await db.query.threads.findFirst({
      where: eq(threadsTable.chatId, chatId)
    });
    
    if (existingThread?.assistantThreadId) {
      return existingThread.assistantThreadId;
    }
    
    // Create new Assistant thread
    const thread = await openai.beta.threads.create({
      metadata: {
        chatId,
        userId,
        createdAt: new Date().toISOString()
      }
    });
    
    // Save to our database
    await db.insert(threadsTable).values({
      chatId,
      userId,
      assistantThreadId: thread.id,
      metadata: { threadId: thread.id }
    });
    
    return thread.id;
  }
}
```

### 3. Enhanced Tool System

#### 3.1 Memory Integration Tool
```javascript
// lib/assistants/tools/memory-tool.js
const memoryRetrievalTool = {
  name: "retrieve_coaching_memory",
  description: "Retrieve relevant coaching context and memories for the user",
  parameters: {
    type: "object",
    properties: {
      userId: { type: "string" },
      contextType: { type: "string", enum: ["recent", "goals", "challenges", "progress"] }
    },
    required: ["userId"]
  }
};

async function handleMemoryRetrieval(userId, contextType = "recent") {
  const memories = await getCoachingContext(userId);
  return {
    memories: memories.slice(0, 5), // Limit for token efficiency
    summary: generateMemorySummary(memories),
    contextType
  };
}
```

#### 3.2 Enhanced Tool Definitions
```javascript
// lib/assistants/tools/hybrid-offer-tool.js
const hybridOfferTool = {
  name: "hybrid_offer_creator",
  description: "Create and iterate on hybrid coaching offers with guided questions",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["start", "answer", "complete"] },
      questionKey: { type: "string" },
      answer: { type: "string" },
      chatId: { type: "string" }
    },
    required: ["action", "chatId"]
  }
};
```

### 4. Streaming Implementation

#### 4.1 Assistant Streaming Handler
```javascript
// lib/assistants/streaming.js
class AssistantStreaming {
  async createStreamingRun(threadId, assistantId, message, profileContext) {
    // Add user message to thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
      metadata: {
        profileContext: JSON.stringify(profileContext),
        timestamp: new Date().toISOString()
      }
    });
    
    // Create streaming run
    const stream = openai.beta.threads.runs.stream(threadId, {
      assistant_id: assistantId,
      additional_instructions: this.buildAdditionalInstructions(profileContext),
      temperature: 0.7,
      max_tokens: 2000
    });
    
    return this.handleStreamEvents(stream);
  }
  
  async handleStreamEvents(stream) {
    const encoder = new TextEncoder();
    
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            switch (event.event) {
              case 'thread.message.delta':
                const delta = event.data.delta.content?.[0]?.text?.value;
                if (delta) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
                }
                break;
                
              case 'thread.run.requires_action':
                const toolCalls = event.data.required_action.submit_tool_outputs.tool_calls;
                const toolOutputs = await this.handleToolCalls(toolCalls);
                
                // Submit tool outputs and continue streaming
                await openai.beta.threads.runs.submitToolOutputsStream(
                  event.data.thread_id,
                  event.data.id,
                  { tool_outputs: toolOutputs }
                );
                break;
                
              case 'thread.run.completed':
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'completed' })}\n\n`));
                controller.close();
                break;
                
              case 'thread.run.failed':
                controller.error(new Error('Assistant run failed'));
                break;
            }
          }
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }
}
```

### 5. Performance Optimizations

#### 5.1 Parallel Processing Preservation
```javascript
// lib/assistants/optimizations.js
class PerformanceOptimizer {
  async preProcessRequest(userId, message) {
    // Run these in parallel while Assistant processes
    const [memories, profileContext] = await Promise.all([
      this.getCoachingMemories(userId),
      this.getProfileContext(userId)
    ]);
    
    return { memories, profileContext };
  }
  
  buildAdditionalInstructions(profileContext, memories) {
    return `
COACHING CONTEXT:
${this.formatProfileContext(profileContext)}

RELEVANT MEMORIES:
${this.formatMemories(memories)}

Focus on providing personalized coaching based on this context.
    `.trim();
  }
}
```

#### 5.2 Caching Strategy
```javascript
// lib/assistants/cache.js
class AssistantCache {
  constructor() {
    this.assistantCache = new Map();
    this.threadCache = new Map();
    this.profileCache = new Map();
  }
  
  async getCachedAssistant(type = 'coaching') {
    if (this.assistantCache.has(type)) {
      return this.assistantCache.get(type);
    }
    
    const assistant = await this.createOrRetrieveAssistant(type);
    this.assistantCache.set(type, assistant);
    return assistant;
  }
}
```

### 6. API Route Migration

#### 6.1 New Chat Route Structure
```javascript
// app/api/chat/route.js (Assistants API version)
export async function POST(request) {
  try {
    const { message, chatId, userId, toolId } = await request.json();
    
    // Get or create assistant thread
    const threadId = await threadManager.getOrCreateThread(chatId, userId);
    
    // Pre-process context in parallel
    const { memories, profileContext } = await optimizer.preProcessRequest(userId, message);
    
    // Get cached assistant
    const assistant = await assistantCache.getCachedAssistant('coaching');
    
    // Create streaming response
    const stream = await assistantStreaming.createStreamingRun(
      threadId,
      assistant.id,
      message,
      { ...profileContext, memories }
    );
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Assistant API error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
```

### 7. Database Schema Updates

#### 7.1 Assistant Threads Table
```sql
-- Add to db/schema/assistant-threads-schema.ts
CREATE TABLE assistant_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  assistant_thread_id TEXT NOT NULL UNIQUE,
  assistant_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 8. Migration Checklist

#### 8.1 Pre-Migration Setup
- [ ] Create Assistants API configuration
- [ ] Set up vector store with knowledge base
- [ ] Implement thread management
- [ ] Create enhanced tool definitions
- [ ] Set up streaming infrastructure

#### 8.2 Migration Steps
- [ ] Deploy hybrid API route (A/B testing)
- [ ] Migrate 10% of traffic
- [ ] Monitor performance metrics
- [ ] Migrate 50% of traffic
- [ ] Complete migration
- [ ] Remove legacy code

#### 8.3 Testing Plan
- [ ] Unit tests for all Assistant functions
- [ ] Integration tests for tool calling
- [ ] Performance benchmarking
- [ ] Memory system validation
- [ ] Streaming response validation

### 9. Performance Expectations

#### 9.1 Expected Improvements
```
Current System:     850-2100ms average response time
Assistants API:     600-1200ms average response time (estimated)

Breakdown:
- Thread retrieval:  ~50ms (cached)
- Context building:  ~100ms (parallel)
- Assistant run:     ~450-1050ms (streaming)
- Tool execution:    ~0-200ms (as needed)
```

#### 9.2 Monitoring Metrics
- Response time (p50, p95, p99)
- Token usage comparison
- Tool execution success rate
- Memory retrieval accuracy
- User satisfaction scores

### 10. Risk Mitigation

#### 10.1 Rollback Strategy
- Maintain current API route during migration
- Feature flags for gradual rollout
- Database backup before schema changes
- Performance monitoring dashboards

#### 10.2 Contingency Plans
- Fallback to current system if performance degrades
- Manual tool calling if Assistant tools fail
- Local vector search backup if file_search fails

### 11. Implementation Timeline

```
Week 1: Setup & Configuration
  - Days 1-2: Assistant creation & vector store setup
  - Days 3-4: Tool definitions & thread management
  - Days 5-7: Streaming implementation

Week 2: Core Migration
  - Days 1-3: API route implementation
  - Days 4-5: Database schema updates
  - Days 6-7: Testing & validation

Week 3: Performance Optimization
  - Days 1-3: Caching implementation
  - Days 4-5: Parallel processing optimization
  - Days 6-7: Load testing

Week 4: Deployment & Monitoring
  - Days 1-2: Staged deployment (10% traffic)
  - Days 3-4: Monitor & adjust (50% traffic)
  - Days 5-7: Full migration & cleanup
```

### 12. Success Criteria

- [ ] Response time improved by 20-40%
- [ ] All current functionality preserved
- [ ] Memory system working correctly
- [ ] Tool interactions functioning properly
- [ ] Streaming responses working smoothly
- [ ] No increase in error rates
- [ ] Token usage within acceptable range (+/- 15%)

---

**Next Steps**: Upon approval, begin with Phase 1 implementation focusing on Assistant setup and vector store migration while maintaining current system functionality. 