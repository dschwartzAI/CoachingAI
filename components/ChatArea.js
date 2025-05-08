"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, Circle, HelpCircle, Loader2, ExternalLink, Download, FileText, ArrowUp } from 'lucide-react'; // Icons for status and Loader2
import LoadingMessage from "@/components/LoadingMessage"; // Import the LoadingMessage component
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TOOLS } from '@/lib/config/tools'; // Import TOOLS

// Define questions with keys, matching the backend order
const hybridOfferQuestions = [
  { key: 'offerDescription', question: "Tell us about the offer high level" },
  { key: 'targetAudience', question: "Who is your target audience?" },
  { key: 'painPoints', question: "What are their main pain points?" },
  { key: 'solution', question: "What is the unique way you solve this problem?" },
  { key: 'pricing', question: "What is your pricing structure?" },
  { key: 'clientResult', question: "Finally, what's your biggest client result?" }
];

// Add a component for rendering markdown messages
function MarkdownMessage({ content }) {
  return (
    <ReactMarkdown
      //className="prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:mb-2 prose-headings:mt-4 prose-pre:my-1 max-w-none" 
      remarkPlugins={[remarkGfm]}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function ChatArea({ selectedTool, currentChat, setCurrentChat, chats, setChats }) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResponseLoading, setIsResponseLoading] = useState(false); // Add specific response loading state
  const [collectedAnswers, setCollectedAnswers] = useState({});
  const [currentQuestionKey, setCurrentQuestionKey] = useState(null);
  const [questionsAnswered, setQuestionsAnswered] = useState(0); // Add questionsAnswered state
  const [isInitiating, setIsInitiating] = useState(false);
  const [initiationAttemptedForContext, setInitiationAttemptedForContext] = useState(false);
  const [isWaitingForN8n, setIsWaitingForN8n] = useState(false);
  const eventSourceRef = useRef(null);
  const textareaRef = useRef(null);
  const scrollAreaRef = useRef(null);

  // Reset state when chat or tool changes
  useEffect(() => {
    // Log details at the beginning of the effect
    console.log('[ChatArea Context Change Effect] Triggered. SelectedTool:', selectedTool);
    console.log('[ChatArea Context Change Effect] CurrentChat details:', currentChat ? 
      { id: currentChat.id, tool_id: currentChat.tool_id, messages: currentChat.messages?.length, metadata: JSON.stringify(currentChat.metadata), title: currentChat.title } : 'null');

    console.log(`[ChatArea Context Change Effect] ChatID: ${currentChat?.id}, Tool: ${selectedTool}, Metadata:`, currentChat?.metadata);
    
    // Ensure selectedTool is aligned with currentChat.tool_id if currentChat exists
    // This assumes selectedTool might be passed by a parent that's already done this, 
    // or ChatArea needs to derive it. For now, we rely on the incoming selectedTool prop reflecting currentChat.

    if (selectedTool === 'hybrid-offer' && currentChat) {
      if (currentChat.metadata && typeof currentChat.metadata === 'object') {
        console.log(`[ChatArea] Restoring hybrid-offer state from metadata:`, currentChat.metadata);
        setCollectedAnswers(currentChat.metadata.collectedAnswers || {});
        // Default to first question if metadata doesn't have a key, or if it's explicitly null (e.g. completed)
        setCurrentQuestionKey(currentChat.metadata.currentQuestionKey || (currentChat.metadata.isComplete ? null : hybridOfferQuestions[0].key));
        setQuestionsAnswered(currentChat.metadata.questionsAnswered || 0);
      } else if (currentChat.collectedAnswers || currentChat.currentQuestionKey || typeof currentChat.questionsAnswered === 'number') {
        // Fallback if metadata is not there or not an object, but direct properties exist
        console.warn(`[ChatArea] Metadata missing or not an object for hybrid-offer chat ${currentChat.id}. Falling back to direct properties.`);
        setCollectedAnswers(currentChat.collectedAnswers || {});
        setCurrentQuestionKey(currentChat.currentQuestionKey || hybridOfferQuestions[0].key);
        setQuestionsAnswered(currentChat.questionsAnswered || 0);
      } else {
        // If hybrid-offer tool is selected but no state in currentChat or its metadata, reset to initial.
        console.log(`[ChatArea] Initializing hybrid-offer state for new or empty chat.`);
        setCollectedAnswers({});
        setQuestionsAnswered(0);
        setCurrentQuestionKey(hybridOfferQuestions[0]?.key || null);
      }
    } else {
      // Reset for non-hybrid-offer tools or if no currentChat/selectedTool
      console.log(`[ChatArea] Resetting tool state (not hybrid-offer or no chat/tool).`);
      setCollectedAnswers({});
      setQuestionsAnswered(0);
      setCurrentQuestionKey(null); // Ensure currentQuestionKey is also reset
    }
    
    setInitiationAttemptedForContext(false); // Reset initiation attempt for the current context
    setIsWaitingForN8n(false); // Reset n8n waiting state

    // Close any existing EventSource connection when chat or tool changes
    if (eventSourceRef.current) {
        console.log("[ChatArea Context Change Effect] Closing existing EventSource.");
        eventSourceRef.current.close();
        eventSourceRef.current = null;
    }
  }, [currentChat, selectedTool]); // Key dependencies: currentChat and selectedTool

  // Update starting key if chat history already exists for hybrid-offer
  // This effect might be redundant if the above effect correctly initializes from metadata.
  // Consider removing or refining this if the above is sufficient.
  useEffect(() => {
      if (selectedTool === 'hybrid-offer' && currentChat?.messages?.length > 0) {
          // A more robust way would be to persist/load answers+key with the chat 
          // For now, just don't reset to first key if history exists
          if (!currentQuestionKey) {
              setCurrentQuestionKey(hybridOfferQuestions[questionsAnswered]?.key || hybridOfferQuestions[0].key); // Use questions answered to determine key
          }
      } else if (selectedTool === 'hybrid-offer') {
          setCurrentQuestionKey(hybridOfferQuestions[0].key);
      }
  }, [currentChat?.id, currentChat?.messages?.length, selectedTool, questionsAnswered]); // Re-run if chat loads or questions answered changes

  // Effect to initiate chat for Hybrid Offer tool
  useEffect(() => {
    console.log(
        `[ChatArea Initiation Check Effect] Tool=${selectedTool}, ChatID=${currentChat?.id}, ` +
        `MsgCount=${currentChat?.messages?.length}, Attempted=${initiationAttemptedForContext}, ` +
        `Initiating=${isInitiating}, Loading=${isLoading}`
    );
    if (
        selectedTool === 'hybrid-offer' &&
        !initiationAttemptedForContext && 
        !isInitiating &&
        !isLoading &&
        // Ensure it's genuinely a new chat for the tool, or an existing empty one for this tool
        (!currentChat || !currentChat.messages || currentChat.messages.length === 0) &&
        (!currentChat || currentChat.tool_id === 'hybrid-offer') // Also ensure current chat is for this tool if it exists
       ) {
      console.log(`[ChatArea Initiation Check] Conditions met. Attempting initiation...`);
      setInitiationAttemptedForContext(true); 
      setIsInitiating(true);
      const chatIdToUse = currentChat?.id || Date.now().toString() + "-temp";
      if (!currentChat) {
          console.warn(`[Initiation Check] currentChat is null/undefined. Using temporary ID: ${chatIdToUse}.`);
      }
      initiateHybridOfferChat(chatIdToUse); 
    }
  }, [
    selectedTool,
    currentChat,
    currentChat?.messages?.length,
    initiationAttemptedForContext,
    isInitiating,
    isLoading,
  ]);

  // Function to call the API for the first message
  const initiateHybridOfferChat = async (chatIdToInitiate) => {
      console.log(`[ChatArea Initiate Func] Starting for chat ID: ${chatIdToInitiate}`);
      setIsLoading(true);
      // setCollectedAnswers({}); // This might clear answers if an existing empty chat is re-initialized
      
      const requestBody = {
        messages: [], // For init, messages should be empty
        tool: 'hybrid-offer',
        isToolInit: true,
        chatId: chatIdToInitiate, // Use the passed chatId, which could be temp or real
        // Ensure collectedAnswers and currentQuestionKey are not sent or are explicitly empty for a true init
        collectedAnswers: {}, 
        currentQuestionKey: null 
      };
      console.log(`[ChatArea Initiate Func] Calling fetch for initial message. Request Body:`, JSON.stringify(requestBody));

      try {
          const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
          });

          console.log(`[ChatArea Initiate Func] Fetch response status: ${response.status}`);
          if (!response.ok) {
              const errorText = await response.text(); 
              throw new Error(`API failed (${response.status}): ${errorText}`);
          }
          const data = await response.json();
          console.log("[ChatArea Initiate Func] API response data:", JSON.stringify(data, null, 2));
          
          const assistantMessage = { 
              role: "assistant", 
              content: data.message || "Let's start creating your hybrid offer."
          };
          
          // IMPORTANT FIXES HERE:
          const finalChatId = data.chatId; // Use the permanent ID from the API response
          const originalToolId = selectedTool; // selectedTool should be 'hybrid-offer' at this point
          
          // If API returns collectedAnswers and currentQuestionKey use them, otherwise default to first question
          const returnedAnswers = data.collectedAnswers || {};
          const nextQuestionKey = data.currentQuestionKey || (TOOLS[originalToolId] ? hybridOfferQuestions[0].key : null);
          const initialQuestionsAnswered = data.questionsAnswered || 0;
          const initialIsComplete = data.isComplete || false;

          const updatedChat = {
              id: finalChatId,      // NEW: Use the permanent ID from API
              title: TOOLS[originalToolId]?.name || "New Chat", // Use tool name for title, or a fallback
              tool_id: originalToolId, // NEW: Ensure tool_id is set
              messages: [assistantMessage], 
              isTemporary: false, // It's now a real chat in the DB
              // Initialize metadata based on API response
              metadata: {
                  currentQuestionKey: nextQuestionKey,
                  questionsAnswered: initialQuestionsAnswered,
                  collectedAnswers: returnedAnswers,
                  isComplete: initialIsComplete
              }
          };
          
          console.log("[ChatArea Initiate Func] Constructed updatedChat (with fixes):", JSON.stringify(updatedChat, null, 2));

          console.log("[ChatArea Initiate Func] Updating chats list and setting current chat...");
          setChats(prev => {
              const chatIndex = prev.findIndex(c => c.id === chatIdToInitiate);
              if (chatIndex > -1) {
                   const newList = [...prev];
                   newList[chatIndex] = updatedChat;
                   return newList;
              } else {
                  console.warn(`[ChatArea Initiate Func] Chat ID ${chatIdToInitiate} not found in list, adding newly.`);
                  return [updatedChat, ...prev];
              }
          });
          setCurrentChat(updatedChat);
          console.log(`[ChatArea Initiate Func] Finished setting current chat ID: ${updatedChat.id}`);

      } catch (error) {
          console.error('[ChatArea Initiate Func] Error initiating chat:', error);
          const errorAssistantMessage = { role: "assistant", content: `Sorry, I couldn't start the session: ${error.message}` };
          const errorChat = { id: chatIdToInitiate, title: "Initiation Error", messages: [errorAssistantMessage] };
          setChats(prev => { 
               const chatIndex = prev.findIndex(c => c.id === chatIdToInitiate);
               if(chatIndex > -1) { 
                   const newList = [...prev];
                   newList[chatIndex] = errorChat;
                   return newList;
               } else return [errorChat, ...prev];
           });
           setCurrentChat(errorChat);
      } finally {
          console.log("[ChatArea Initiate Func] Finalizing initiation attempt.");
          setIsLoading(false);
          setIsInitiating(false); 
          textareaRef.current?.focus();
      }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const trimmedInput = input.trim();

    // Add a check here for currentChat right at the start
    if (!currentChat) {
        console.error("handleSubmit aborted: currentChat is null or undefined.");
        alert("Cannot send message: No active chat selected."); // User feedback
        return;
    }
    
    // Prevent submission if loading
    if (!trimmedInput || isLoading || isResponseLoading || isInitiating) {
      console.log(`[CHAT_DEBUG] Submit prevented: empty=${!trimmedInput}, isLoading=${isLoading}, isResponseLoading=${isResponseLoading}, isInitiating=${isInitiating}`);
      return;
    }

    console.log(`[CHAT_DEBUG] Starting handleSubmit with chat ID: ${currentChat?.id}`, {
      currentChatState: JSON.stringify({id: currentChat?.id, messageCount: currentChat?.messages?.length}),
      chatsState: JSON.stringify(chats.map(c => ({id: c.id, messageCount: c.messages.length}))),
      inputLength: trimmedInput.length
    });

    // Set both loading states immediately for better visual feedback
    setIsLoading(true);
    setIsResponseLoading(true);

    const newMessage = { role: "user", content: trimmedInput };
    setInput("");

    let chatToUpdate = currentChat; // Use the guaranteed currentChat
    const tempId = chatToUpdate.id; // Store the temporary ID for reference

    const updatedMessages = [...chatToUpdate.messages, newMessage];
    const optimisticChat = { ...chatToUpdate, messages: updatedMessages };

    console.log(`[CHAT_DEBUG] Before optimistic update - tempId: ${tempId}`, {
      optimisticChatId: optimisticChat.id,
      optimisticMessageCount: optimisticChat.messages.length
    });

    // Optimistic update
    setCurrentChat(optimisticChat);
    setChats(prev => {
      const updated = prev.map(chat => chat.id === chatToUpdate.id ? optimisticChat : chat);
      console.log(`[CHAT_DEBUG] After setChats optimistic update`, {
        updatedChatIds: updated.map(c => c.id)
      });
      return updated;
    });

    try {
       console.log(`[CHAT_DEBUG] Sending message to API with thread ID: ${currentChat.id}`, {
         threadId: currentChat.id,
         messageCount: updatedMessages.length,
         existingMessages: currentChat.messages.length,
         currentQuestionKey,
         questionsAnswered,
         requestBody: JSON.stringify({
           messageCount: updatedMessages.length,
           tool: selectedTool,
           currentQuestionKey,
           questionsAnswered,
           hasCollectedAnswers: !!collectedAnswers,
           chatId: currentChat.id
         })
       });
            
       const response = await fetch('/api/chat', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
               messages: updatedMessages,
               tool: selectedTool,
               currentQuestionKey: currentQuestionKey,
               questionsAnswered: questionsAnswered,
               collectedAnswers: collectedAnswers,
               chatId: currentChat.id // Explicitly include the chatId
           }),
       });
        if (!response.ok) {
           console.error(`[CHAT_DEBUG] API response not OK: ${response.status}`);
           const errorData = await response.json().catch(() => ({ error: "Request failed with status: " + response.status }));
           throw new Error(errorData.details || errorData.error || 'API request failed');
        }
        
        const data = await response.json();
        console.log("[CHAT_DEBUG] API response data:", {
          responseData: JSON.stringify({
            chatId: data.chatId,
            messageContent: typeof data.message === 'string' ? data.message.substring(0, 50) + '...' : 'non-string message',
            currentQuestionKey: data.currentQuestionKey,
            questionsAnswered: data.questionsAnswered,
            answersCount: data.collectedAnswers ? Object.keys(data.collectedAnswers).length : 0,
            isComplete: data.isComplete
          })
        });
        
        // Check if this is an initial response that needs polling
        if (data.isInitialResponse && data.status === "processing" && data.threadId && data.runId) {
          console.log("[CHAT_DEBUG] Received initial response, starting polling for completion", {
            threadId: data.threadId,
            runId: data.runId
          });
          
          // Add a temporary thinking message
          const thinkingMessage = { 
            role: 'assistant', 
            content: data.message || "I'm thinking...",
            isTemporary: true 
          };
          
          // Update UI with thinking message
          const chatWithThinking = {
            ...chatToUpdate,
            id: data.chatId,
            messages: [...updatedMessages, thinkingMessage],
          };
          
          setCurrentChat(chatWithThinking);
          setChats(prev => prev.map(chat => 
            chat.id === chatToUpdate.id ? chatWithThinking : chat
          ));
          
          // Start polling for the real response
          pollForAssistantResponse(data.threadId, data.runId, data.chatId, chatWithThinking, updatedMessages);
          return; // Exit early since we'll update UI when polling completes
        }

        // Create assistant message
        const assistantMessage = typeof data.message === 'string' 
            ? { role: 'assistant', content: data.message }
            : data.message || { role: 'assistant', content: "I couldn't generate a proper response." };
            
        // Use returned data
        const returnedAnswers = data.collectedAnswers || collectedAnswers || {};
        const nextQuestionKey = data.nextQuestionKey || data.currentQuestionKey || currentQuestionKey;
        const updatedQuestionsAnswered = data.questionsAnswered !== undefined ? data.questionsAnswered : questionsAnswered;
        const isComplete = data.isComplete || false;
        const correctChatId = data.chatId; 

        if (!correctChatId) {
           console.error("[CHAT_DEBUG] CRITICAL: API did not return a chatId!");
           throw new Error("Chat session ID missing from server response.");
        }

        console.log(`[CHAT_DEBUG] Received chatId from API: ${correctChatId}, comparing with tempId: ${tempId}, equal: ${correctChatId === tempId}`);
        
        // Log detailed information about returned answers
        console.log("[CHAT_DEBUG] Processing returned answers:", {
          returnedKeys: Object.keys(returnedAnswers),
          currentKeys: Object.keys(collectedAnswers),
          newAnswersCount: Object.keys(returnedAnswers).length,
          nextQuestionKey,
          previousQuestionKey: currentQuestionKey,
          questionsAnswered: updatedQuestionsAnswered
        });

        // Ensure we're preserving all previous answers and adding new ones
        setCollectedAnswers(returnedAnswers);
        setCurrentQuestionKey(nextQuestionKey);
        setQuestionsAnswered(updatedQuestionsAnswered);

        // Construct the updated current chat state with API response data
        const finalCurrentChat = {
          ...chatToUpdate, // Base it on the chat state before optimistic update
          id: correctChatId, // IMPORTANT: Use the ID from the API response
          messages: [...updatedMessages, assistantMessage], // User + assistant messages
          collectedAnswers: returnedAnswers, // Store answers in the chat object
          currentQuestionKey: nextQuestionKey, // Store current question in chat object
          questionsAnswered: updatedQuestionsAnswered // Store questions answered count
        };
        
        console.log("[CHAT_DEBUG] Final chat state constructed:", {
          finalChatId: finalCurrentChat.id,
          finalMessageCount: finalCurrentChat.messages.length,
          basedOnChatId: chatToUpdate.id
        });

        // Update both the current chat state AND the chats list
        setCurrentChat(finalCurrentChat);
        
        // Update the chats array, handling both existing and new chats
        setChats(prevChats => {
          console.log(`[CHAT_DEBUG] Before setChats update - prevChats:`, {
            chatCount: prevChats.length,
            chatIds: prevChats.map(c => c.id)
          });
          
          // First check if the new chat already exists in the list
          // This makes the update idempotent (safe to call multiple times)
          if (prevChats.some(chat => chat.id === correctChatId)) {
            console.log(`[CHAT_DEBUG] Chat with ID ${correctChatId} already exists in list, just updating`);
            return prevChats.map(chat => 
              chat.id === correctChatId ? finalCurrentChat : chat
            );
          }
          
          // Next, remove any temporary version of this chat
          const filteredChats = tempId !== correctChatId 
            ? prevChats.filter(chat => chat.id !== tempId)
            : prevChats;
            
          console.log(`[CHAT_DEBUG] After filtering temp chat:`, {
            filteredCount: filteredChats.length,
            removedTempChat: tempId !== correctChatId,
            filteredIds: filteredChats.map(c => c.id)
          });
            
          // Final safety check if chat exists after filtering
          const chatExists = filteredChats.some(chat => chat.id === correctChatId);
          
          console.log(`[CHAT_DEBUG] Chat existence check:`, {
            chatExists,
            correctChatId,
            finalChatId: finalCurrentChat.id
          });
          
          let result;
          if (chatExists) {
            // Update existing chat in the list
            result = filteredChats.map(chat => 
              chat.id === correctChatId ? finalCurrentChat : chat
            );
            console.log(`[CHAT_DEBUG] Updated existing chat in list`);
          } else {
            // Add as a new chat if it doesn't exist in the list
            result = [finalCurrentChat, ...filteredChats];
            console.log(`[CHAT_DEBUG] Added new chat to list with ID: ${correctChatId}`);
          }
          
          console.log(`[CHAT_DEBUG] Final chats state:`, {
            resultCount: result.length,
            resultIds: result.map(c => c.id)
          });
          
          return result;
        });

        // If the offer is complete, initiate SSE connection
        if (isComplete && correctChatId) {
            console.log(`[CHAT_DEBUG] Offer complete for chatId: ${correctChatId}. Initiating SSE connection.`);
            setIsWaitingForN8n(true);
            const encodedAnswers = encodeURIComponent(JSON.stringify(returnedAnswers || {}));
            connectToN8nResultStream(correctChatId, encodedAnswers);
        }

    } catch (error) {
        console.error('[CHAT_DEBUG] Error in handleSubmit:', error);
        const errorAssistantMessage = { role: "assistant", content: `Sorry, an error occurred: ${error.message}` };
        const errorChat = { ...optimisticChat, messages: [...updatedMessages, errorAssistantMessage] };
        setChats(prev => {
          console.log(`[CHAT_DEBUG] Setting error chat state:`, {
            errorChatId: errorChat.id,
            prevChatCount: prev.length
          });
          return prev.map(chat => chat.id === errorChat.id ? errorChat : chat);
        });
        setCurrentChat(errorChat);
    } finally {
      setIsLoading(false);
      setIsResponseLoading(false); // Make sure to clear response loading state
      console.log(`[CHAT_DEBUG] handleSubmit completed, loading states cleared`);
      if (!isWaitingForN8n) {
         textareaRef.current?.focus();
      } 
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-scroll for both messages and loading state changes
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[style*="overflow: hidden scroll"]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [currentChat?.messages, isResponseLoading]);

  // Determine if the offer creation process is complete for UI feedback
  const isOfferComplete = currentQuestionKey === null && Object.keys(collectedAnswers).length > 0;

  // Function to connect to SSE endpoint
  const connectToN8nResultStream = (chatId, encodedAnswers) => {
    if (eventSourceRef.current) {
      console.log("[SSE Connect] Closing existing EventSource before creating new one.");
      eventSourceRef.current.close(); // Close any previous connection
    }

    console.log(`[SSE Connect] Connecting to /api/n8n-result?chatId=${chatId}&answersData=${encodedAnswers}`);
    const es = new EventSource(`/api/n8n-result?chatId=${chatId}&answersData=${encodedAnswers}`);
    eventSourceRef.current = es; // Store the reference

    es.onopen = () => {
      console.log("[SSE Connect] EventSource connection opened.");
    };

    // Listen for the specific event from the backend
    es.addEventListener('n8n_result', (event) => {
      console.log("[SSE Connect] Received n8n_result event:", event.data);
      let resultMessageContent = null; // Initialize as null

      try {
        const eventData = JSON.parse(event.data);
        if (eventData.success && eventData.data) {
          // --- Construct JSX message content ---
          const n8nResult = eventData.data;
          resultMessageContent = (
            <div className="space-y-3"> {/* Added spacing */}
              <div className="flex items-center gap-2 font-medium"> {/* Success message style */}
                 <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                 <span>Document generated successfully!</span>
              </div>
              <div className="flex flex-wrap gap-2"> {/* Use flex-wrap for buttons */}
                 {n8nResult.pdfWebViewLink && (
                   <Button variant="outline" size="sm" asChild>
                      <a href={n8nResult.pdfWebViewLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" /> View PDF
                      </a>
                   </Button>
                 )}
                 {n8nResult.pdfDownlaodLink && ( // Typo corrected from original request
                   <Button variant="outline" size="sm" asChild>
                      <a href={n8nResult.pdfDownlaodLink} target="_blank" rel="noopener noreferrer" download> {/* Added download attribute */}
                         <Download className="mr-2 h-4 w-4" /> Download PDF
                      </a>
                   </Button>
                 )}
                 {n8nResult.googleDocLink && ( // Updated key name
                    <Button variant="outline" size="sm" asChild>
                       <a href={n8nResult.googleDocLink} target="_blank" rel="noopener noreferrer">
                           <FileText className="mr-2 h-4 w-4" /> View Google Doc
                       </a>
                    </Button>
                  )}
                  {n8nResult.offerInMd && ( // Updated key name
                       <MarkdownMessage content={n8nResult.offerInMd} />
                  )}
              </div>
            </div>
          );
          // --- End JSX construction ---
        } else {
           throw new Error(eventData.message || 'Received unsuccessful result from server.');
        }
      } catch (parseError) {
        console.error("[SSE Connect] Error parsing n8n_result data or constructing message:", parseError);
        // Fallback text message on error
        resultMessageContent = "✅ Document generated, but there was an issue displaying the links.";
      }

      // Add the message (JSX or fallback text) to the chat state
      if (resultMessageContent !== null && currentChat?.id === chatId) { // Ensure chat context is still correct
          const resultMessage = { role: 'assistant', content: resultMessageContent, isJSX: true }; // Add isJSX flag
          setCurrentChat(prevChat => {
              if (!prevChat || prevChat.id !== chatId) return prevChat; // Safety check
              return {...prevChat, messages: [...prevChat.messages, resultMessage]};
          });
          setChats(prevChats => prevChats.map(c => {
              if (c.id === chatId) {
                  return {...c, messages: [...c.messages, resultMessage]};
              }
              return c;
          }));
      } else {
          console.warn("[SSE Connect] Could not add result message - chat context might have changed or content was null.");
      }

      setIsWaitingForN8n(false);
      es.close();
      eventSourceRef.current = null;
      console.log("[SSE Connect] Closed connection after n8n_result.");
      textareaRef.current?.focus();
    });

    // Handle generic errors
    es.onerror = (error) => {
      console.error("[SSE Connect] EventSource error:", error);
      setIsWaitingForN8n(false);
      // Add an error message (text) to the chat
      const sseErrorMessage = { role: 'assistant', content: "Connection error while generating document. Please try again later.", isJSX: false }; // Mark as not JSX
       if (currentChat?.id === chatId) { // Add error only if chat context is still relevant
            setCurrentChat(prevChat => prevChat ? {...prevChat, messages: [...prevChat.messages, sseErrorMessage]} : null);
            setChats(prevChats => prevChats.map(c => c.id === chatId ? {...c, messages: [...c.messages, sseErrorMessage]} : c));
       }
      es.close();
      eventSourceRef.current = null;
    };
  };

  const pollForAssistantResponse = async (threadId, runId, chatId, chatWithThinking, updatedMessages) => {
    console.log("[CHAT_DEBUG] Starting to poll for assistant response");
    
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts x 2 seconds = 60 seconds max
    
    const poll = async () => {
      if (attempts >= maxAttempts) {
        console.error("[CHAT_DEBUG] Polling timed out after max attempts");
        // Update with an error message
        const errorMessage = { 
          role: 'assistant', 
          content: "I'm sorry, the request timed out. Please try again." 
        };
        updateChatWithFinalResponse(chatWithThinking, errorMessage, chatId, updatedMessages);
        return;
      }
      
      attempts++;
      console.log(`[CHAT_DEBUG] Polling attempt ${attempts}/${maxAttempts}`);
      
      try {
        const response = await fetch('/api/assistant-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId,
            runId,
            chatId
          }),
        });
        
        if (!response.ok) {
          console.error(`[CHAT_DEBUG] Polling API error: ${response.status}`);
          throw new Error(`Polling request failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[CHAT_DEBUG] Polling response:`, {
          status: data.status,
          messagePreview: data.message ? data.message.substring(0, 50) + '...' : 'no message'
        });
        
        if (data.status === "completed") {
          // We got the final response
          const assistantMessage = { role: 'assistant', content: data.message };
          updateChatWithFinalResponse(chatWithThinking, assistantMessage, chatId, updatedMessages);
          return;
        } else if (data.status === "failed" || data.status === "cancelled") {
          // Handle error
          const errorMessage = { 
            role: 'assistant', 
            content: `Sorry, an error occurred: ${data.error || 'Unknown error'}` 
          };
          updateChatWithFinalResponse(chatWithThinking, errorMessage, chatId, updatedMessages);
          return;
        }
        
        // If still processing, wait and try again
        setTimeout(poll, 2000); // Poll every 2 seconds
      } catch (error) {
        console.error("[CHAT_DEBUG] Error during polling:", error);
        
        // If there's an error, we'll try a few more times
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          // Too many errors, give up
          const errorMessage = { 
            role: 'assistant', 
            content: `Sorry, there was an error retrieving the response: ${error.message}` 
          };
          updateChatWithFinalResponse(chatWithThinking, errorMessage, chatId, updatedMessages);
        }
      }
    };
    
    // Start polling
    setTimeout(poll, 1000); // Start after 1 second
  };
  
  const updateChatWithFinalResponse = (chatWithThinking, finalMessage, chatId, userMessages) => {
    console.log("[CHAT_DEBUG] Updating chat with final response", {
      chatId,
      messageLengthBeforeUpdate: chatWithThinking.messages.length,
      finalMessagePreview: finalMessage.content.substring(0, 50) + '...'
    });
    
    // Remove the temporary thinking message and add the final response
    const updatedMessages = [
      ...userMessages, // Original user messages
      finalMessage     // Final assistant response
    ];
    
    const finalChat = {
      ...chatWithThinking,
      messages: updatedMessages,
    };
    
    setIsResponseLoading(false);
    
    // Update both current chat and chats list
    setCurrentChat(finalChat);
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? finalChat : chat
    ));
  };

  return (
    <div className="flex-1 flex flex-col h-full relative"> {/* Added relative positioning */}
       {/* --- Status Display --- */}
       {selectedTool === 'hybrid-offer' && (
           <div className="absolute top-4 right-4 bg-background border rounded-lg p-3 shadow-md max-w-[200px] z-10">
                <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Offer Status</h4>
                <div className="text-xs mb-2 font-medium">{questionsAnswered}/6 Questions Answered</div>
                <ul className="space-y-1">
                    {hybridOfferQuestions.map((q, index) => (
                        <li key={q.key} className="flex items-center gap-2 text-xs">
                            {collectedAnswers[q.key] ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                            ) : index === questionsAnswered ? (
                                <HelpCircle className="h-3 w-3 text-blue-500 flex-shrink-0 animate-pulse" />
                            ) : (
                                <Circle className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                            )}
                            <span className={`${index === questionsAnswered ? 'font-medium' : 'text-muted-foreground'} truncate`} title={q.question}>
                                {q.question.split(' ').slice(0, 4).join(' ')}...
                            </span>
                        </li>
                    ))}
                </ul>
           </div>
       )}
       {/* --- End Status Display --- */}
       

      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 pt-16 gap-4"> {/* Reduced padding-top */}
          {/* Initial Welcome Message (simplified) */}  
          {!currentChat?.messages?.length && selectedTool === "hybrid-offer" && (
              <div className="text-center space-y-2 p-4 bg-muted rounded-lg">
              <h2 className="text-xl font-semibold">Welcome to Hybrid Offer Creator</h2>
              <p className="text-muted-foreground text-sm">
                  Let's gather the details for your offer. I'll ask a few questions.
              </p>
              </div>
          )}
          {!currentChat?.messages?.length && selectedTool !== "hybrid-offer" && (
              <div className="text-center space-y-2 p-4">
                  <h2 className="text-xl font-semibold">Start Chatting</h2>
              </div>
          )} 
          
          {/* Chat Messages */}  
          {currentChat?.messages?.map((message, i) => (
              <div
              key={`${currentChat.id}-${i}`}
              className={`flex gap-3 mb-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
              {message.role === "assistant" && (
                  <Avatar className="flex-shrink-0">
                  <AvatarImage src="/bot-avatar.png" alt="AI" />
                  </Avatar>
              )}
              <div
                  className={`rounded-lg p-3 max-w-[80%] text-sm ${
                  message.role === "user"
                      ? "bg-primary text-primary-foreground whitespace-pre-wrap" // Keep for user text
                      : "bg-muted overflow-auto"
                  } ${message.isJSX ? '' : (message.role === 'assistant' ? '' : 'whitespace-pre-wrap')}`} // Only whitespace-pre-wrap for non-JSX user messages
              >
                  {/* Render content with markdown for assistant messages, directly for JSX, or as text for user */}
                  {message.isJSX ? (
                    message.content
                  ) : message.role === 'assistant' ? (
                    <MarkdownMessage content={message.content} />
                  ) : (
                    message.content
                  )}
              </div>
              {message.role === "user" && (
                  <Avatar className="flex-shrink-0">
                  <AvatarImage src="/user-avatar.png" alt="User" />
                  </Avatar>
              )}
              </div>
          ))}
          
          {/* Loading Message while waiting for response */}
          {isResponseLoading && (
            <>
              <LoadingMessage />
              {console.log('[CHAT_DEBUG] Rendering LoadingMessage component')}
            </>
          )}
          
          {/* N8N Loading Indicator */} 
          {isWaitingForN8n && (
             <div className="flex items-center justify-center m-2 mx-10 gap-2 p-3 bg-muted rounded-lg ring-1 ring-blue-500 bg-gradient-to-t from-blue-500/20 via-transparent to-transparent">
                 <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                 <span className="text-sm text-muted-foreground">Generating document... (approx. 1 min)</span>
             </div>
          )}
          
          
      </ScrollArea>

      {/* Input Form */}  
      <form onSubmit={handleSubmit} className="p-4 border-t bg-background">
        <div className="max-w-2xl mx-auto flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isOfferComplete ? "Offer data sent." : isWaitingForN8n ? "Generating document..." : isLoading || isResponseLoading ? "Waiting for response..." : "Type your message..."}
            className="min-h-[40px] max-h-[200px] resize-none text-sm flex-1 rounded-2xl hover:border-primary focus-visible:ring-1 focus-visible:ring-primary"
            rows={1}
            disabled={isLoading || isInitiating || isOfferComplete || isWaitingForN8n || isResponseLoading} // Add isResponseLoading
          />
          <Button 
             type="submit" 
             disabled={isLoading || isInitiating || !input.trim() || isOfferComplete || isWaitingForN8n || isResponseLoading} // Add isResponseLoading
             size="sm"
             className="rounded-full h-10 w-10"
          >
            {isLoading || isInitiating || isWaitingForN8n || isResponseLoading ? 
             <Loader2 className="h-4 w-4 animate-spin" />
            : 
            <ArrowUp className="h-4 w-4" />
          }
          </Button>
        </div>
      </form>
    </div>
  );
}