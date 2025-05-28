"use client";

import { useState, useRef, useEffect } from "react";
import MessageList, { isDocumentMessage } from "./chat/MessageList";
import ChatInputForm from "./chat/ChatInputForm";
import { useChatSSE } from "@/hooks/use-chat-sse";
import { Circle, HelpCircle } from 'lucide-react';
import { TOOLS } from '@/lib/config/tools'; // Import TOOLS
import { useAuth } from "./AuthProvider";
import { initializeThread, saveMessage, subscribeToThread } from '@/lib/utils/supabase';
import { getAIResponse } from '@/lib/utils/ai';
import { useToast } from '@/hooks/use-toast';
import { usePostHog } from '@/hooks/use-posthog';

// Define questions with keys, matching the backend order
const hybridOfferQuestions = [
  { key: 'offerDescription', question: "Tell us about the offer high level" },
  { key: 'targetAudience', question: "Who is your target audience?" },
  { key: 'painPoints', question: "What are their main pain points?" },
  { key: 'solution', question: "What is the unique way you solve this problem?" },
  { key: 'pricing', question: "What is your pricing structure?" },
  { key: 'clientResult', question: "Finally, what's your biggest client result?" }
];

// Define workshop generator questions
const workshopQuestions = [
  { key: 'participantOutcomes', question: "What specific outcomes will participants achieve?" },
  { key: 'targetAudience', question: "Who is your ideal workshop participant?" },
  { key: 'problemAddressed', question: "What problem does your workshop solve?" },
  { key: 'workshopDuration', question: "How long will your workshop be?" },
  { key: 'topicsAndActivities', question: "What topics and activities will you cover?" },
  { key: 'resourcesProvided', question: "What resources will participants receive?" }
];

// Add a component for rendering markdown messages

export default function ChatArea({ selectedTool, currentChat, setCurrentChat, chats, setChats }) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResponseLoading, setIsResponseLoading] = useState(false); // Add specific response loading state
  const [collectedAnswers, setCollectedAnswers] = useState({});
  const [currentQuestionKey, setCurrentQuestionKey] = useState(null);
  const [questionsAnswered, setQuestionsAnswered] = useState(0); // Add questionsAnswered state
  const [isInitiating, setIsInitiating] = useState(false);
  const [initiationAttemptedForContext, setInitiationAttemptedForContext] = useState(false);
  const textareaRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const prevChatIdRef = useRef();
  const prevSelectedToolRef = useRef();
  const { user } = useAuth();
  const lastMessageRef = useRef(null);
  const { track } = usePostHog();
  const {
    connectToN8nResultStream,
    isWaitingForN8n,
    setIsWaitingForN8n,
    closeConnection,
  } = useChatSSE({
    user,
    currentChat,
    setCurrentChat,
    chats,
    setChats,
    scrollToBottom,
    textareaRef,
  });

  // Clean up SSE connection when component unmounts
  useEffect(() => {
    return () => {
      closeConnection();
    };
  }, []);

  // Add this useEffect to track the isWaitingForN8n state
  useEffect(() => {
    console.log(`[ChatArea state check] isWaitingForN8n changed to: ${isWaitingForN8n}`);
  }, [isWaitingForN8n]);

  // Reset state when chat or tool changes (Refactored Logic)
  useEffect(() => {
    const currentChatId = currentChat?.id;
    const previousChatId = prevChatIdRef.current;
    const currentSelectedTool = selectedTool;
    const previousSelectedTool = prevSelectedToolRef.current;

    const hasChatSwitched = currentChatId !== previousChatId;
    const hasToolSwitched = currentSelectedTool !== previousSelectedTool;
    const hasContextSwitched = hasChatSwitched || hasToolSwitched;

    console.log(`[ChatArea Context Change Effect] Triggered. ChatId: ${currentChatId}, Tool: ${currentSelectedTool}`);
    console.log(`[ChatArea Context Change Effect] Context Switch Check: ChatSwitched=${hasChatSwitched}, ToolSwitched=${hasToolSwitched}`);

    // Only reset state and close SSE if the actual chat or tool context has changed
    if (hasContextSwitched) {
      console.log(`[ChatArea Context Change Effect] Context switched. Resetting state.`);
      
      // Check if the thread has metadata to initialize properly
      if (currentChat?.metadata) {
        console.log(`[ChatArea Context Change Effect] Initializing from thread metadata:`, currentChat.metadata);
        // Initialize state from metadata if available
        setCollectedAnswers(currentChat.metadata.collectedAnswers || {});
        const questionsArray = currentSelectedTool === 'workshop-generator' ? workshopQuestions : hybridOfferQuestions;
        setCurrentQuestionKey(currentChat.metadata.currentQuestionKey || questionsArray[0]?.key);
        setQuestionsAnswered(currentChat.metadata.questionsAnswered || 0);
        
        // Check document generation state
        if (currentChat.metadata.isGeneratingDocument === true && !currentChat.metadata.documentGenerated) {
          console.log(`[ChatArea Context Change Effect] Detected active document generation, restoring state...`);
          setIsWaitingForN8n(true);
          
          // If document generation is in progress, check if we should reconnect to the stream
          if (currentChat.metadata.generationStartTime) {
            const startTime = new Date(currentChat.metadata.generationStartTime);
            const now = new Date();
            const elapsedMs = now - startTime;
            const MAX_GENERATION_TIME = 5 * 60 * 1000; // 5 minutes
            
            if (elapsedMs < MAX_GENERATION_TIME) {
              // Document generation started recently, reconnect to the stream
              console.log(`[ChatArea Context Change Effect] Document generation in progress (started ${Math.round(elapsedMs/1000)}s ago), reconnecting to stream...`);
              
              // Reconnect to the stream if we have the necessary data
              if (currentChat.metadata.collectedAnswers) {
                try {
                  const encodedAnswers = encodeURIComponent(JSON.stringify(currentChat.metadata.collectedAnswers));
                  connectToN8nResultStream(currentChat.id, encodedAnswers);
                  console.log(`[ChatArea Context Change Effect] Reconnected to N8n stream with thread ID: ${currentChat.id}`);
                } catch (err) {
                  console.error(`[ChatArea Context Change Effect] Error reconnecting to stream:`, err);
                  setIsWaitingForN8n(true); // Keep the waiting state even if reconnection fails
                }
              } else {
                console.warn(`[ChatArea Context Change Effect] Cannot reconnect to stream: missing collectedAnswers`);
                setIsWaitingForN8n(true); // Keep the waiting state even if reconnection fails
              }
            } else {
              // Document generation started a while ago, assume it's still in progress but don't reconnect
              console.log(`[ChatArea Context Change Effect] Document generation started ${Math.round(elapsedMs/1000)}s ago, showing loading state without reconnecting`);
              setIsWaitingForN8n(true); // Just set the loading state
            }
          } else {
            // No start time available, just set the loading state
            setIsWaitingForN8n(true);
          }
        } else if (currentChat.metadata.documentGenerated === true || currentChat.metadata.isGeneratingDocument === false) {
          // Document generation is complete or not in progress
          console.log(`[ChatArea Context Change Effect] Document generation complete or not in progress, clearing loading state`);
          setIsWaitingForN8n(false);
        } else {
          // Check if there are already document messages in the chat
          const hasDocumentMessages = currentChat.messages?.some(msg => isDocumentMessage(msg));
          if (hasDocumentMessages) {
            console.log(`[ChatArea Context Change Effect] Found existing document messages, clearing loading state`);
            setIsWaitingForN8n(false);
          } else {
            setIsWaitingForN8n(false);
          }
        }
        
        // If we have metadata, this thread was already initiated in the past
        setInitiationAttemptedForContext(true);
      } else {
        // Reset to default state if no metadata
        setCollectedAnswers({});
        setQuestionsAnswered(0);
        const questionsArray = currentSelectedTool === 'workshop-generator' ? workshopQuestions : hybridOfferQuestions;
        setCurrentQuestionKey(questionsArray[0]?.key);
        setIsWaitingForN8n(false);
        setInitiationAttemptedForContext(false);
      }

      // Close any active SSE connection when the context changes
      closeConnection();
    } else {
      // Context did NOT switch, but currentChat prop might have updated (e.g., with new metadata)
      // Re-apply state from metadata if available to ensure consistency
      console.log(`[ChatArea Context Change Effect] Context NOT switched. Checking for metadata updates.`);
      if ((currentSelectedTool === 'hybrid-offer' || currentSelectedTool === 'workshop-generator') && currentChat?.metadata && typeof currentChat.metadata === 'object') {
         // Compare metadata to potentially avoid redundant state updates if needed, or just re-apply
         console.log(`[ChatArea] Re-applying state from metadata on update:`, currentChat.metadata);
         setCollectedAnswers(currentChat.metadata.collectedAnswers || {});
         const questionsArray = currentSelectedTool === 'workshop-generator' ? workshopQuestions : hybridOfferQuestions;
         setCurrentQuestionKey(currentChat.metadata.currentQuestionKey || (currentChat.metadata.isComplete ? null : questionsArray[0].key));
         setQuestionsAnswered(currentChat.metadata.questionsAnswered || 0);
         
         // Check document generation state
         if (currentChat.metadata.isGeneratingDocument === true && !currentChat.metadata.documentGenerated) {
           setIsWaitingForN8n(true);
         } else if (currentChat.metadata.documentGenerated === true || currentChat.metadata.isGeneratingDocument === false) {
           setIsWaitingForN8n(false);
         }
         // Otherwise don't change isWaitingForN8n
      }
    }

    // Update refs for the next render *after* all checks
    prevChatIdRef.current = currentChatId;
    prevSelectedToolRef.current = currentSelectedTool;

  }, [currentChat, selectedTool]); // Keep dependencies: effect needs to run when chat or tool potentially changes

  // Update starting key if chat history already exists for hybrid-offer
  // This effect might be redundant if the above effect correctly initializes from metadata.
  // Consider removing or refining this if the above is sufficient.
  useEffect(() => {
      if ((selectedTool === 'hybrid-offer' || selectedTool === 'workshop-generator') && currentChat?.messages?.length > 0) {
          // A more robust way would be to persist/load answers+key with the chat 
          // For now, just don't reset to first key if history exists
          if (!currentQuestionKey) {
              const questionsArray = selectedTool === 'workshop-generator' ? workshopQuestions : hybridOfferQuestions;
              setCurrentQuestionKey(questionsArray[questionsAnswered]?.key || questionsArray[0].key); // Use questions answered to determine key
          }
      } else if (selectedTool === 'hybrid-offer') {
          setCurrentQuestionKey(hybridOfferQuestions[0].key);
      } else if (selectedTool === 'workshop-generator') {
          setCurrentQuestionKey(workshopQuestions[0].key);
      }
  }, [currentChat?.id, currentChat?.messages?.length, selectedTool, questionsAnswered]); // Re-run if chat loads or questions answered changes

  // Effect to initiate chat for tool-based chats
  useEffect(() => {
    console.log(
        `[ChatArea Initiation Check Effect] Tool=${selectedTool}, ChatID=${currentChat?.id}, ` +
        `MsgCount=${currentChat?.messages?.length}, Attempted=${initiationAttemptedForContext}, ` +
        `QuestionsAnswered=${questionsAnswered}, ` +
        `Initiating=${isInitiating}, Loading=${isLoading}`
    );
    if (
        (selectedTool === 'hybrid-offer' || selectedTool === 'workshop-generator') &&
        !initiationAttemptedForContext && 
        !isInitiating &&
        !isLoading &&
        // Ensure it's genuinely a new chat for the tool, or an existing empty one for this tool
        (!currentChat || !currentChat.messages || currentChat.messages.length === 0) &&
        (!currentChat || currentChat.tool_id === selectedTool) && // Also ensure current chat is for this tool if it exists
        // Skip initiation if we have metadata with questions already answered
        !(currentChat?.metadata?.questionsAnswered > 0)
       ) {
      console.log(`[ChatArea Initiation Check] Conditions met. Attempting initiation...`);
      setInitiationAttemptedForContext(true); 
      setIsInitiating(true);
      const chatIdToUse = currentChat?.id || Date.now().toString() + "-temp";
      if (!currentChat) {
          console.warn(`[Initiation Check] currentChat is null/undefined. Using temporary ID: ${chatIdToUse}.`);
      }
      initiateToolChat(chatIdToUse, selectedTool); 
    }
  }, [
    selectedTool,
    currentChat,
    currentChat?.messages?.length,
    initiationAttemptedForContext,
    isInitiating,
    isLoading,
    questionsAnswered,
  ]);

  // Function to call the API for the first message
  const initiateToolChat = async (chatIdToInitiate, tool) => {
      console.log(`[ChatArea Initiate Func] Starting for chat ID: ${chatIdToInitiate}`);
      setIsLoading(true);
      // setCollectedAnswers({}); // This might clear answers if an existing empty chat is re-initialized
      
      const requestBody = {
        messages: [], // For init, messages should be empty
        tool: tool,
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
          const questionsArray = tool === 'workshop-generator' ? workshopQuestions : hybridOfferQuestions;
          const nextQuestionKey = data.currentQuestionKey || (TOOLS[originalToolId] ? questionsArray[0].key : null);
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
        
       // Check if this is a streaming response (regular chat) or a JSON response (tool chat)
       const contentType = response.headers.get('Content-Type');
       let data;
       
       if (false && contentType && contentType.includes('text/plain')) {
           // Handle streaming response for regular chat
           console.log("[CHAT_DEBUG] Handling text/plain streaming response");
           const reader = response.body.getReader();
           const decoder = new TextDecoder();
           let responseText = '';
           
           // Read the streamed response
           try {
             while (true) {
                 const { done, value } = await reader.read();
                 if (done) break;
                 const chunk = decoder.decode(value, { stream: true });
                 console.log("[CHAT_DEBUG] Stream chunk received:", chunk.substring(0, 50));
                 responseText += chunk;
                 
                 // Update the UI with each chunk as it arrives
                 const tempAssistantMessage = { role: 'assistant', content: responseText, isStreaming: true };
                 const updatedChatTemp = {
                   ...chatToUpdate,
                   id: response.headers.get('X-Chat-Id') || tempId,
                   messages: [...updatedMessages, tempAssistantMessage],
                 };
                 setCurrentChat(updatedChatTemp);
             }
             
             // Final decoding to flush any remaining bytes
             const finalText = decoder.decode();
             if (finalText) responseText += finalText;
             
             console.log("[CHAT_DEBUG] Final streamed response:", responseText.substring(0, 100));
           } catch (streamError) {
             console.error("[CHAT_DEBUG] Stream reading error:", streamError);
             responseText += "\n\nAn error occurred while reading the response.";
           }
           
           // Create a simple data object that mimics the structure of the JSON response
           data = {
               message: responseText,
               chatId: response.headers.get('X-Chat-Id') || currentChat.id,
               isTextResponse: true // Flag to indicate this is a plain text response
           };
       } else {
           // Handle JSON response for tool-based chat
           try {
               data = await response.json();
               console.log("[CHAT_DEBUG] JSON response data:", {
                   chatId: data.chatId,
                   messagePreview: typeof data.message === 'string' ? data.message.substring(0, 50) + '...' : 'non-string message',
               });
           } catch (error) {
               console.error("[CHAT_DEBUG] Error parsing JSON response:", error);
               throw new Error("Failed to parse response from server");
           }
       }
       
        console.log("[CHAT_DEBUG] API response data:", {
         responseData: data.isTextResponse ? 
           {
             chatId: data.chatId,
             messagePreview: typeof data.message === 'string' ? data.message.substring(0, 50) + '...' : '',
             isTextResponse: true
           } : 
           JSON.stringify({
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
            
        // Use returned data or default values for text responses
        const returnedAnswers = data.isTextResponse ? {} : (data.collectedAnswers || collectedAnswers || {});
        const nextQuestionKey = data.isTextResponse ? null : (data.nextQuestionKey || data.currentQuestionKey || currentQuestionKey);
        const updatedQuestionsAnswered = data.isTextResponse ? 0 : (data.questionsAnswered !== undefined ? data.questionsAnswered : questionsAnswered);
        const isComplete = data.isTextResponse ? false : (data.isComplete || false);
        const correctChatId = data.chatId; 

        if (!correctChatId) {
           console.error("[CHAT_DEBUG] CRITICAL: API did not return a chatId!");
           throw new Error("Chat session ID missing from server response.");
        }

        console.log(`[CHAT_DEBUG] Received chatId from API: ${correctChatId}, comparing with tempId: ${tempId}, equal: ${correctChatId === tempId}`);
        
        // Log detailed information about returned answers (skip for text responses)
        if (!data.isTextResponse) {
        console.log("[CHAT_DEBUG] Processing returned answers:", {
          returnedKeys: Object.keys(returnedAnswers),
          currentKeys: Object.keys(collectedAnswers),
          newAnswersCount: Object.keys(returnedAnswers).length,
          nextQuestionKey,
          previousQuestionKey: currentQuestionKey,
          questionsAnswered: updatedQuestionsAnswered
        });
        }

        // Ensure we're preserving all previous answers and adding new ones
        // Skip state updates for text responses as they don't affect tool state
        if (!data.isTextResponse) {
        setCollectedAnswers(returnedAnswers);
        setCurrentQuestionKey(nextQuestionKey);
        setQuestionsAnswered(updatedQuestionsAnswered);
        }

        // Construct the updated current chat state with API response data
        const finalCurrentChat = {
          ...chatToUpdate, // Base it on the chat state before optimistic update
          id: correctChatId, // IMPORTANT: Use the ID from the API response
          messages: [...updatedMessages, assistantMessage], // User + assistant messages
          tool_id: selectedTool, // Preserve/ensure tool_id is correct
        };
        
        // Only add metadata for tool-based chats, not for regular chat text responses
        if (!data.isTextResponse) {
          finalCurrentChat.metadata = {
          currentQuestionKey: nextQuestionKey,
          questionsAnswered: updatedQuestionsAnswered,
          collectedAnswers: returnedAnswers,
          isComplete: isComplete
        };
          
          // Also update top-level convenience properties for immediate UI consistency
          finalCurrentChat.currentQuestionKey = nextQuestionKey;
          finalCurrentChat.questionsAnswered = updatedQuestionsAnswered;
          finalCurrentChat.collectedAnswers = returnedAnswers;
          finalCurrentChat.isComplete = isComplete;
        }
        
        console.log("[CHAT_DEBUG] Final chat state constructed:", {
          finalChatId: finalCurrentChat.id,
          finalMessageCount: finalCurrentChat.messages.length,
          basedOnChatId: chatToUpdate.id,
          isTextResponse: data.isTextResponse
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

        // If the hybrid offer is complete, initiate SSE connection (only for hybrid-offer tool)
        console.log('[CHAT_DEBUG] Checking for completion to start n8n wait:', { isComplete, correctChatId, selectedTool, returnedAnswersLength: Object.keys(returnedAnswers || {}).length });
        if (isComplete && correctChatId && selectedTool === 'hybrid-offer') {
            console.log(`[CHAT_DEBUG] Hybrid offer complete for chatId: ${correctChatId}. Initiating SSE connection.`);
            setIsWaitingForN8n(true);
            const encodedAnswers = encodeURIComponent(JSON.stringify(returnedAnswers || {}));
            connectToN8nResultStream(correctChatId, encodedAnswers);
        } else if (isComplete && correctChatId && selectedTool === 'workshop-generator') {
            console.log(`[CHAT_DEBUG] Workshop generator complete for chatId: ${correctChatId}. HTML should be displayed directly in the message.`);
            // Workshop generator completion is handled by the HTML generation in the API response
            // No need to trigger n8n document generation
        }

        // Trigger scroll after message updates
        setTimeout(() => {
          scrollToBottom();
        }, 100);

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
        
        // Trigger scroll after error message
        setTimeout(() => {
          scrollToBottom();
        }, 100);
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

  // Improved auto-scroll function
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      // Try multiple methods to find the scrollable element
      const scrollArea = scrollAreaRef.current;
      
      // Method 1: Look for the viewport element (Radix ScrollArea)
      let scrollElement = scrollArea.querySelector('[data-radix-scroll-area-viewport]');
      
      // Method 2: Look for any element with overflow scroll
      if (!scrollElement) {
        scrollElement = scrollArea.querySelector('div[style*="overflow"]');
      }
      
      // Method 3: Use the scroll area itself
      if (!scrollElement) {
        scrollElement = scrollArea;
      }
      
      if (scrollElement) {
        // Force scroll to bottom with multiple approaches
        scrollElement.scrollTop = scrollElement.scrollHeight;
        
        // Also try scrollIntoView on the last message if available
        if (lastMessageRef.current) {
          lastMessageRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'end' 
          });
        }
      }
    }
  };

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [currentChat?.messages?.length, isResponseLoading, isWaitingForN8n]);

  // Auto-scroll with delay to ensure DOM is rendered
  useEffect(() => {
    if (currentChat?.messages?.length > 0) {
      // Immediate scroll
      scrollToBottom();
      
      // Delayed scroll to catch any late-rendering content
      const timeoutId = setTimeout(() => {
        scrollToBottom();
      }, 100);
      
      // Additional scroll for complex content like documents
      const timeoutId2 = setTimeout(() => {
        scrollToBottom();
      }, 500);
      
      return () => {
        clearTimeout(timeoutId);
        clearTimeout(timeoutId2);
      };
    }
  }, [currentChat?.id, currentChat?.messages]);

  // Determine if the offer creation process is complete for UI feedback
  // Check both local state and metadata for completion
  const isOfferComplete = (currentQuestionKey === null && Object.keys(collectedAnswers).length > 0) || 
                         (currentChat?.metadata?.isComplete === true) ||
                         (currentChat?.metadata?.questionsAnswered >= 6);

  // Function to connect to SSE endpoint

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
    
    // Trigger scroll to show the final response
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  };

  return (
    <div className="flex flex-col h-full max-w-full">
      {/* Chat header - added responsive padding */}
      <div className="border-b p-3 sm:p-4 flex items-center justify-between sticky top-0 bg-background z-10">
        <div className="flex items-center space-x-2">
          <div className="font-semibold">
            {currentChat && currentChat.title ? (
              <span className="text-sm sm:text-base">{currentChat.title}</span>
            ) : (
              <span className="text-sm sm:text-base">New Conversation</span>
            )}
          </div>
        </div>
      </div>
        <MessageList
          currentChat={currentChat}
          user={user}
          isWaitingForN8n={isWaitingForN8n}
          isResponseLoading={isResponseLoading}
          lastMessageRef={lastMessageRef}
          scrollAreaRef={scrollAreaRef}
        />

        <ChatInputForm
          input={input}
          setInput={setInput}
          handleSubmit={handleSubmit}
          handleKeyDown={handleKeyDown}
          textareaRef={textareaRef}
          isLoading={isLoading}
          isResponseLoading={isResponseLoading}
          isWaitingForN8n={isWaitingForN8n}
        />

    </div>
  );
}