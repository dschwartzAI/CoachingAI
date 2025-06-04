// Utility functions for handling streaming chat responses

export class StreamingChatClient {
  constructor() {
    this.abortController = null;
  }

  async streamChat({
    messages,
    tool,
    currentQuestionKey,
    questionsAnswered,
    collectedAnswers,
    chatId,
    onChunk,
    onComplete,
    onError
  }) {
    // Abort any existing stream
    this.abort();
    
    this.abortController = new AbortController();
    
    try {
      console.log('[Streaming] Starting streaming chat request');
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          messages,
          tool,
          currentQuestionKey,
          questionsAnswered,
          collectedAnswers,
          chatId
        }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errorData.error || `Request failed with status: ${response.status}`);
      }

      // Check if this is a streaming response
      const contentType = response.headers.get('Content-Type');
      if (contentType?.includes('text/event-stream')) {
        console.log('[Streaming] Received streaming response');
        await this.handleStreamingResponse(response, onChunk, onComplete, onError);
      } else {
        console.log('[Streaming] Received JSON response, falling back to regular handling');
        const data = await response.json();
        onComplete(data);
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[Streaming] Request was aborted');
        return;
      }
      console.error('[Streaming] Error in streaming chat:', error);
      onError(error);
    }
  }

  async handleStreamingResponse(response, onChunk, onComplete, onError) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('[Streaming] Stream completed');
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages in the buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(line.slice(6));
              
              if (jsonData.type === 'chunk' && jsonData.content) {
                // Add a small delay for more natural streaming feel
                await new Promise(resolve => setTimeout(resolve, 25));
                
                fullResponse += jsonData.content;
                onChunk(jsonData.content, fullResponse);
                
              } else if (jsonData.type === 'complete') {
                console.log('[Streaming] Received completion signal');
                
                onComplete({
                  message: fullResponse,
                  chatId: jsonData.chatId,
                  isStreaming: true
                });
                return;
              } else if (jsonData.type === 'error') {
                throw new Error(jsonData.error || 'Streaming error');
              }
            } catch (parseError) {
              console.error('[Streaming] Error parsing SSE data:', parseError, 'Line:', line);
            }
          }
        }
      }
    } catch (error) {
      console.error('[Streaming] Error reading stream:', error);
      onError(error);
    } finally {
      reader.releaseLock();
    }
  }

  abort() {
    if (this.abortController) {
      console.log('[Streaming] Aborting current request');
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

// Singleton instance for the app
export const streamingClient = new StreamingChatClient(); 