"use client";
import { useState, useRef, useEffect } from 'react';
import { saveMessage } from '@/lib/utils/supabase';

export function useChatSSE({ user, currentChat, setCurrentChat, chats, setChats, scrollToBottom, textareaRef }) {
  const eventSourceRef = useRef(null);
  const [isWaitingForN8n, setIsWaitingForN8n] = useState(false);

  const closeConnection = () => {
    if (eventSourceRef.current) {
      console.log('[useChatSSE] Closing EventSource connection.');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const connectToN8nResultStream = (chatId, encodedAnswers) => {
    closeConnection();

    let chatHistory = [];
    if (currentChat && currentChat.messages) {
      chatHistory = currentChat.messages.slice(-30).map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      }));
    }

    const postData = {
      chatId: chatId,
      userId: user?.id || null,
      answersData: JSON.parse(decodeURIComponent(encodedAnswers)),
      chatHistory: chatHistory
    };

    console.log(`[SSE Connect] Connecting to /api/n8n-result with POST request`);
    console.log(`[SSE Connect] POST data:`, {
      chatId,
      userId: user?.id || null,
      answersDataFields: Object.keys(postData.answersData),
      chatHistoryLength: chatHistory.length
    });

    try {
      if (user?.id) {
        const initialMessagePayload = {
          thread_id: chatId,
          role: 'assistant',
          content: `
          <div class="document-generation-status">
            <p>📝 <strong>I'm generating your document now.</strong> Please wait...</p>
            <p>This typically takes about 1 minute to complete.</p>
            <p>You can safely refresh the page - the document will appear here when it's ready.</p>
          </div>
          `,
          timestamp: new Date().toISOString(),
          metadata: {
            isGenerating: true,
            generationStarted: new Date().toISOString()
          }
        };
        console.log('[SSE Connect] Saving initial document generation message to DB:', initialMessagePayload);
        saveMessage(initialMessagePayload, user.id)
          .then(() => {
            console.log('[SSE Connect] Successfully saved initial document message to DB.');
            return fetch('/api/update-thread-metadata', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                threadId: chatId,
                metadata: {
                  ...currentChat?.metadata,
                  isGeneratingDocument: true,
                  generationStartTime: new Date().toISOString()
                }
              })
            });
          })
          .then(response => {
            if (!response.ok) {
              console.warn('[SSE Connect] Failed to update thread metadata:', response.status);
            } else {
              console.log('[SSE Connect] Successfully updated thread metadata for document generation');
            }
          })
          .catch(err => console.error('[SSE Connect] Error in document generation setup:', err));

        const initialMessage = { role: 'assistant', content: initialMessagePayload.content };
        setChats(prevChats => prevChats.map(c => {
          if (c.id === chatId) {
            return { ...c, messages: [...c.messages, initialMessage] };
          }
          return c;
        }));
        if (currentChat?.id === chatId) {
          setCurrentChat(prevChat => ({ ...prevChat, messages: [...prevChat.messages, initialMessage] }));
        }
      } else {
        console.warn('[SSE Connect] Cannot save initial document message - no user ID');
      }
    } catch (initErr) {
      console.error('[SSE Connect] Error saving initial document message:', initErr);
    }

    fetch('/api/n8n-result', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`SSE connection failed with status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const processEvents = (chunk) => {
          buffer += chunk;
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          events.forEach(eventStr => {
            if (!eventStr.trim()) return;
            const eventLines = eventStr.split('\n');
            let eventType = '';
            let eventData = '';
            eventLines.forEach(line => {
              if (line.startsWith('event:')) {
                eventType = line.substring(6).trim();
              } else if (line.startsWith('data:')) {
                eventData = line.substring(5).trim();
              }
            });
            if (eventType && eventData) {
              try {
                const parsedData = JSON.parse(eventData);
                if (eventType === 'n8n_result') {
                  handleN8nResult(parsedData);
                } else if (eventType === 'error') {
                  handleErrorEvent(parsedData);
                } else {
                  console.warn(`[SSE Connect] Unknown event type: ${eventType}`);
                }
              } catch (e) {
                console.error(`[SSE Connect] Error parsing event data: ${e.message}`);
              }
            }
          });
        };

        const handleN8nResult = (eventData) => {
          console.log("[SSE Connect] Received n8n_result event:", JSON.stringify(eventData, null, 2));
          let contentToSaveToDB = null;
          let n8nResultData = null;
          try {
            if (eventData.success && eventData.data) {
              n8nResultData = eventData.data;
              console.log("[SSE Connect] Parsed n8n result data:", JSON.stringify(n8nResultData, null, 2));
              const googleDocLink = n8nResultData.googleDocLink || n8nResultData.docUrl || n8nResultData.googleDocURL || n8nResultData.documentUrl;
              console.log("[SSE Connect] Google Doc link extracted:", googleDocLink);
              if (googleDocLink) {
                n8nResultData = { ...n8nResultData, googleDocLink };
                contentToSaveToDB = `✅ Document generated successfully!\n\n<a href="${googleDocLink}" target="_blank" rel="noopener noreferrer">View Google Doc</a>\n\nLink: ${googleDocLink}`;
              } else {
                throw new Error('No Google Doc link found in the response.');
              }
            } else {
              throw new Error(eventData.message || 'Received unsuccessful result from server.');
            }
          } catch (parseError) {
            console.error("[SSE Connect] Error parsing n8n_result data or constructing message:", parseError);
            contentToSaveToDB = "Document generated, but there was an issue displaying the link.";
          }

          if (contentToSaveToDB && user?.id) {
            try {
              const documentLinks = { googleDocLink: n8nResultData?.googleDocLink };
              console.log("[SSE Connect] Document link to save:", documentLinks);
              const messagePayload = {
                thread_id: chatId,
                role: 'assistant',
                content: contentToSaveToDB,
                timestamp: new Date().toISOString(),
                metadata: {
                  documentLinks: documentLinks,
                  isGenerating: false,
                  generationCompleted: new Date().toISOString()
                }
              };
              console.log('[SSE Connect] Saving n8n result message to DB:', JSON.stringify(messagePayload, null, 2));
              fetch('/api/update-thread-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  threadId: chatId,
                  metadata: {
                    ...currentChat?.metadata,
                    isGeneratingDocument: false,
                    documentGenerated: true,
                    documentLinks: documentLinks,
                    generationCompleteTime: new Date().toISOString()
                  }
                })
              }).then(response => {
                if (!response.ok) {
                  console.warn('[SSE Connect] Failed to update thread metadata after completion:', response.status);
                } else {
                  console.log('[SSE Connect] Successfully updated thread metadata for document completion');
                }
              }).catch(err => {
                console.error('[SSE Connect] Error updating thread metadata:', err);
              });
              saveMessage(messagePayload, user.id)
                .then(() => {
                  console.log('[SSE Connect] Successfully saved n8n result message to DB for thread:', chatId);
                  const documentMessage = {
                    role: 'assistant',
                    content: contentToSaveToDB,
                    metadata: { documentLinks: documentLinks }
                  };
                  setCurrentChat(prevChat => {
                    if (!prevChat || prevChat.id !== chatId) return prevChat;
                    const filteredMessages = prevChat.messages.filter(m =>
                      !(typeof m.content === 'string' && (
                        m.content.includes("generating your document") ||
                        m.content.includes("document-generation-status")
                      ))
                    );
                    return { ...prevChat, messages: [...filteredMessages, documentMessage] };
                  });
                  setChats(prevChats => prevChats.map(c => {
                    if (c.id === chatId) {
                      const filteredMessages = c.messages.filter(m =>
                        !(typeof m.content === 'string' && (
                          m.content.includes("generating your document") ||
                          m.content.includes("document-generation-status")
                        ))
                      );
                      return { ...c, messages: [...filteredMessages, documentMessage] };
                    }
                    return c;
                  }));
                  setIsWaitingForN8n(false);
                  setTimeout(() => { scrollToBottom(); }, 100);
                  console.log('[SSE Connect] Document ready - notification system would trigger here');
                })
                .catch(dbError => {
                  console.error('[SSE Connect] Error saving n8n result message to DB:', dbError);
                });
            } catch (dbError) {
              console.error('[SSE Connect] Error preparing to save n8n result message to DB:', dbError);
            }
          } else {
            console.warn(`[SSE Connect] Did not save n8n result message to DB. No user ID or content. contentExists=${!!contentToSaveToDB}, userId=${!!user?.id}`);
          }
        };

        const handleErrorEvent = (eventData) => {
          console.error("[SSE Connect] Received error event:", eventData);
          if (user?.id) {
            const errorMessagePayload = {
              thread_id: chatId,
              role: 'assistant',
              content: eventData.message || "Connection error while generating document. Please try again later.",
              timestamp: new Date().toISOString()
            };
            saveMessage(errorMessagePayload, user.id)
              .then(() => console.log('[SSE Connect] Successfully saved error message to DB.'))
              .catch(err => console.error('[SSE Connect] Error saving error message:', err));
          }
          const sseErrorMessage = {
            role: 'assistant',
            content: eventData.message || "Connection error while generating document. Please try again later.",
            isJSX: false
          };
          if (currentChat?.id === chatId) {
            setCurrentChat(prevChat => {
              if (!prevChat) return null;
              const filteredMessages = prevChat.messages.filter(m =>
                m.content !== "I'm generating your document now. Please wait..."
              );
              return { ...prevChat, messages: [...filteredMessages, sseErrorMessage] };
            });
            setChats(prevChats => prevChats.map(c => {
              if (c.id === chatId) {
                const filteredMessages = c.messages.filter(m =>
                  m.content !== "I'm generating your document now. Please wait..."
                );
                return { ...c, messages: [...filteredMessages, sseErrorMessage] };
              }
              return c;
            }));
          }
          setIsWaitingForN8n(false);
          setTimeout(() => { scrollToBottom(); }, 100);
          textareaRef.current?.focus();
        };

        const readNextChunk = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              console.log("[SSE Connect] Stream closed by server.");
              setIsWaitingForN8n(false);
              return;
            }
            const chunk = decoder.decode(value, { stream: true });
            processEvents(chunk);
            readNextChunk();
          }).catch(error => {
            console.error("[SSE Connect] Error reading from stream:", error);
            setIsWaitingForN8n(false);
            if (user?.id) {
              const streamErrorPayload = {
                thread_id: chatId,
                role: 'assistant',
                content: "Error streaming document data. Please try again.",
                timestamp: new Date().toISOString()
              };
              saveMessage(streamErrorPayload, user.id)
                .then(() => console.log('[SSE Connect] Successfully saved stream error message to DB.'))
                .catch(err => console.error('[SSE Connect] Error saving stream error message:', err));
            }
            const streamErrorMessage = {
              role: 'assistant',
              content: "Error streaming document data. Please try again.",
              isJSX: false
            };
            if (currentChat?.id === chatId) {
              setCurrentChat(prevChat => {
                if (!prevChat) return null;
                const filteredMessages = prevChat.messages.filter(m =>
                  m.content !== "I'm generating your document now. Please wait..."
                );
                return { ...prevChat, messages: [...filteredMessages, streamErrorMessage] };
              });
              setChats(prevChats => prevChats.map(c => {
                if (c.id === chatId) {
                  const filteredMessages = c.messages.filter(m =>
                    m.content !== "I'm generating your document now. Please wait..."
                  );
                  return { ...c, messages: [...filteredMessages, streamErrorMessage] };
                }
                return c;
              }));
            }
            setTimeout(() => { scrollToBottom(); }, 100);
            textareaRef.current?.focus();
          });
        };

        readNextChunk();
      })
      .catch(error => {
        console.error("[SSE Connect] Fetch error:", error);
        setIsWaitingForN8n(false);
        if (user?.id) {
          const connectionErrorPayload = {
            thread_id: chatId,
            role: 'assistant',
            content: `Connection error: ${error.message}. Please try again later.`,
            timestamp: new Date().toISOString()
          };
          saveMessage(connectionErrorPayload, user.id)
            .then(() => console.log('[SSE Connect] Successfully saved connection error message to DB.'))
            .catch(err => console.error('[SSE Connect] Error saving connection error message:', err));
        }
        const connectionErrorMessage = {
          role: 'assistant',
          content: `Connection error: ${error.message}. Please try again later.`,
          isJSX: false
        };
        if (currentChat?.id === chatId) {
          setCurrentChat(prevChat => {
            if (!prevChat) return null;
            const filteredMessages = prevChat.messages.filter(m =>
              m.content !== "I'm generating your document now. Please wait..."
            );
            return { ...prevChat, messages: [...filteredMessages, connectionErrorMessage] };
          });
          setChats(prevChats => prevChats.map(c => {
            if (c.id === chatId) {
              const filteredMessages = c.messages.filter(m =>
                m.content !== "I'm generating your document now. Please wait..."
              );
              return { ...c, messages: [...filteredMessages, connectionErrorMessage] };
            }
            return c;
          }));
        }
        setTimeout(() => { scrollToBottom(); }, 100);
        textareaRef.current?.focus();
      });
  };

  useEffect(() => {
    return () => {
      closeConnection();
    };
  }, []);

  return { connectToN8nResultStream, isWaitingForN8n, setIsWaitingForN8n, closeConnection };
}
