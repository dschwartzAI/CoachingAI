"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Circle, HelpCircle, Loader2, ExternalLink, Download, FileText, ArrowUp } from 'lucide-react'; // Icons for status and Loader2
import LoadingMessage from "@/components/LoadingMessage"; // Import the LoadingMessage component
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TOOLS } from '@/lib/config/tools'; // Import TOOLS
import { useAuth } from "./AuthProvider";
import { initializeThread, saveMessage, subscribeToThread } from '@/lib/utils/supabase';
import { getAIResponse } from '@/lib/utils/ai';
import { useToast } from '@/hooks/use-toast';
import { usePostHog } from '@/hooks/use-posthog';
import { useTextSelection } from '@/lib/hooks/use-text-selection';
import TextSelectionMenu from '@/components/TextSelectionMenu';
import SnippetModal from '@/components/SnippetModal';
import { saveSnippet } from '@/lib/utils/snippets';

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
function MarkdownMessage({ content }) {
  return (
    <ReactMarkdown
      //className="prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:mb-2 prose-headings:mt-4 prose-pre:my-1 max-w-none" 
      remarkPlugins={[remarkGfm]}
      components={{
        // Allow <a> tags to be rendered properly
        a: ({ node, ...props }) => (
          <a 
            {...props} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-600 hover:underline"
          />
        )
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// Add a utility to extract links from message content
function extractN8nLinks(content) {
  if (typeof content !== 'string') return {};
  const googleDocMatch = content.match(/View Google Doc: (https?:\/\/[^\s]+)/);
  const pdfWebViewMatch = content.match(/View PDF: (https?:\/\/[^\s]+)/);
  const pdfDownloadMatch = content.match(/Download PDF: (https?:\/\/[^\s]+)/);
  return {
    googleDocLink: googleDocMatch ? googleDocMatch[1] : null,
    pdfWebViewLink: pdfWebViewMatch ? pdfWebViewMatch[1] : null,
    pdfDownloadLink: pdfDownloadMatch ? pdfDownloadMatch[1] : null,
  };
}

// Add a function to check if a message is a document message
function isDocumentMessage(message) {
  const hasDocumentContent = typeof message.content === 'string' && 
    (message.content.includes('Document generated successfully') || 
     message.content.includes('generating your document') ||
     message.content.includes('View Google Doc') ||
     message.content.includes('document-generation-status'));
  
  const hasDocumentMetadata = message.metadata?.documentLinks && 
    Object.values(message.metadata.documentLinks).some(link => link);
  
  const result = hasDocumentContent || hasDocumentMetadata;
  
  console.log('[isDocumentMessage] Checking message:', {
    messageId: message.id,
    hasDocumentContent,
    hasDocumentMetadata,
    contentPreview: typeof message.content === 'string' ? message.content.substring(0, 100) + '...' : 'non-string',
    metadata: message.metadata,
    result
  });
  
  return result;
}

// Function to render HTML content directly
function HTMLContent({ content }) {
  // Clean up content by removing redundant "Link:" text that follows HTML links
  const cleanContent = (rawContent) => {
    if (!rawContent) return '';
    
    // Remove "Link: [URL]" patterns that appear after HTML links
    let cleaned = rawContent.replace(/\n\nLink:\s*https?:\/\/[^\s]+/g, '');
    
    // Also remove just "Link:" followed by URL on same line
    cleaned = cleaned.replace(/Link:\s*https?:\/\/[^\s]+/g, '');
    
    return cleaned.trim();
  };
  
  // Parse the content to extract links and render them as proper React components
  const processContent = () => {
    const cleanedContent = cleanContent(content);
    if (!cleanedContent) return '';
    
    try {
      // Create a temporary div to parse the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanedContent;
      
      // Extract all links
      const links = [];
      const linkElements = tempDiv.querySelectorAll('a');
      linkElements.forEach((link, index) => {
        const href = link.getAttribute('href');
        const text = link.textContent;
        const isDownload = link.hasAttribute('download');
        
        links.push({
          href,
          text,
          isDownload,
          index,
          outerHTML: link.outerHTML // Store the original HTML for comparison
        });
      });
      
      // If no links found, just return the content as is
      if (links.length === 0) {
        return <span>{cleanedContent.replace(/<[^>]*>/g, '')}</span>;
      }
      
      // Split content at link positions
      let remainingContent = cleanedContent;
      const fragments = [];
      
      links.forEach((link, i) => {
        const linkIndex = remainingContent.indexOf(link.outerHTML);
        if (linkIndex >= 0) {
          // Add text before the link
          if (linkIndex > 0) {
            fragments.push({
              type: 'text',
              content: remainingContent.substring(0, linkIndex).replace(/<[^>]*>/g, ''),
              key: `text-${i}`
            });
          }
          
          // Add the link
          fragments.push({
            type: 'link',
            href: link.href,
            text: link.text,
            isDownload: link.isDownload,
            key: `link-${i}`
          });
          
          // Update remaining content
          remainingContent = remainingContent.substring(linkIndex + link.outerHTML.length);
        }
      });
      
      // Add any remaining text
      if (remainingContent) {
        fragments.push({
          type: 'text',
          content: remainingContent.replace(/<[^>]*>/g, ''),
          key: `text-final`
        });
      }
      
      // Render the fragments
      return (
        <div className="space-y-2">
          {fragments.map(fragment => {
            if (fragment.type === 'text') {
              return <span key={fragment.key}>{fragment.content}</span>;
            } else {
              return (
                <a 
                  key={fragment.key}
                  href={fragment.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={fragment.isDownload}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {fragment.text}
                </a>
              );
            }
          })}
        </div>
      );
    } catch (error) {
      console.error('Error processing HTML content:', error);
      // Fallback to simply removing HTML tags
      return <span>{cleanContent(content).replace(/<[^>]*>/g, '')}</span>;
    }
  };
  
  // If we're in the browser, process the content with React elements
  if (typeof document !== 'undefined') {
    return processContent();
  }
  
  // Fallback to dangerouslySetInnerHTML if running on server
  return <div dangerouslySetInnerHTML={{ __html: cleanContent(content) }} />;
}

// Define the DocumentMessage component
function DocumentMessage({ message }) {
  // Check if this is a document generation status message
  const isGenerationStatus = typeof message.content === 'string' && 
    message.content.includes('document-generation-status');
  
  // If it's a generation status message, show a proper loading UI
  if (isGenerationStatus) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">I'm generating your document now</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-xs text-center">
            This typically takes about 1 minute to complete.
          </p>
          <p className="text-xs text-muted-foreground max-w-xs text-center">
            You'll receive a notification and the document will appear here when it's ready.
          </p>
        </div>
      </div>
    );
  }
  
  // First check if message has metadata with document links
  const documentLinks = message.metadata?.documentLinks;
  const hasMetadataLinks = documentLinks && documentLinks.googleDocLink;
  
  // Then check for n8n links in the message content as a fallback
  const extractedLinks = extractN8nLinks(message.content);
  const hasExtractedLinks = extractedLinks.googleDocLink;
  
  // Check if the content already contains HTML links
  const contentHasHtmlLinks = typeof message.content === 'string' && message.content.includes('<a href');
  
  // Get the Google Doc link, prioritizing metadata links
  const docLink = documentLinks?.googleDocLink || extractedLinks.googleDocLink;
  
  return (
    <div className="space-y-3">
      <div>
        {/* Check if content contains HTML and render appropriately */}
        {message.content.includes('<a href') ? (
          <HTMLContent content={message.content} />
        ) : (
          <MarkdownMessage content={message.content} />
        )}
      </div>
      {/* Only show the separate link section if content doesn't already have HTML links */}
      {docLink && !contentHasHtmlLinks && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-green-800 font-medium">
            <CheckCircle2 className="h-5 w-5" />
            Your document is ready!
          </div>
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-green-600" />
            <a 
              href={docLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline break-all"
            >
              View Google Doc
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// Add a component for rendering HTML landing pages
function LandingPageMessage({ content }) {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Extract HTML code from the message content
  const extractHTMLCode = (text) => {
    // Look for HTML code blocks or complete HTML documents
    const htmlMatch = text.match(/```html\n([\s\S]*?)\n```/) || 
                     text.match(/```\n(<!DOCTYPE html[\s\S]*?<\/html>)\n```/) ||
                     text.match(/(<!DOCTYPE html[\s\S]*?<\/html>)/);
    
    return htmlMatch ? htmlMatch[1] : null;
  };

  const htmlCode = extractHTMLCode(content);
  
  const copyToClipboard = async () => {
    if (htmlCode) {
      try {
        await navigator.clipboard.writeText(htmlCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const downloadHTML = () => {
    if (htmlCode) {
      const blob = new Blob([htmlCode], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'landing-page.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (!htmlCode) {
    // If no HTML code found, render as regular markdown
    return <MarkdownMessage content={content} />;
  }

  return (
    <div className="space-y-4">
      {/* Regular message content without the HTML code block */}
      <div>
        <MarkdownMessage content={content.replace(/```html\n[\s\S]*?\n```/g, '').replace(/```\n<!DOCTYPE html[\s\S]*?<\/html>\n```/g, '').replace(/<!DOCTYPE html[\s\S]*?<\/html>/g, '').trim()} />
      </div>
      
      {/* HTML Code Section */}
      <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm">Landing Page HTML</h4>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs"
            >
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              className="text-xs"
            >
              {copied ? 'Copied!' : 'Copy HTML'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadHTML}
              className="text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          </div>
        </div>
        
        {showPreview && (
          <div className="mb-4">
            <div className="border rounded bg-white" style={{ height: '400px' }}>
              <iframe
                srcDoc={htmlCode}
                className="w-full h-full rounded"
                title="Landing Page Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}
        
        <div className="bg-gray-100 dark:bg-gray-900 rounded p-3 text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto">
          <pre className="whitespace-pre-wrap">{htmlCode}</pre>
        </div>
        
        <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
          <p><strong>Instructions:</strong></p>
          <ol className="list-decimal list-inside space-y-1 mt-1">
            <li>Copy the HTML code above</li>
            <li>In HighLevel, go to Sites → Pages → Create New Page</li>
            <li>Choose "Custom Code" or "Blank Page"</li>
            <li>Paste the HTML code into the custom code section</li>
            <li>Save and publish your landing page</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// Add a function to check if a message contains landing page HTML
function isLandingPageMessage(message) {
  if (typeof message.content !== 'string') return false;
  
  // Check if the message contains HTML code blocks or complete HTML documents
  const hasHTMLCode = message.content.includes('```html') || 
                     message.content.includes('<!DOCTYPE html') ||
                     (message.content.includes('<html') && message.content.includes('</html>'));
  
  return hasHTMLCode;
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
  const scrollAreaRef = useRef(null); // This ref is for the ScrollArea component itself, for scrollToBottom
  const chatContainerRef = useRef(null); // This is the NEW ref for the text selection container
  const prevChatIdRef = useRef();
  const prevSelectedToolRef = useRef();
  const { user } = useAuth();
  const lastMessageRef = useRef(null);
  const { track } = usePostHog();
  const {
    selectedText,
    selectionContext,
    clearSelection,
    // containerRef, // Removed from here
    isTextSelected,
    selectionPosition
  } = useTextSelection(chatContainerRef); // Pass chatContainerRef to the hook
  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState(null);
  const [currentSourceContext, setCurrentSourceContext] = useState(null);
  const { toast } = useToast();
  const headerRef = useRef(null);

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
      setInitiationAttemptedForContext(false); // <<< ADDED THIS RESET HERE
      
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
        // setInitiationAttemptedForContext(true); // This line is now effectively superseded by the reset above if context truly switched
      } else {
        // Reset to default state if no metadata
        setCollectedAnswers({});
        setQuestionsAnswered(0);
        const questionsArray = currentSelectedTool === 'workshop-generator' ? workshopQuestions : hybridOfferQuestions;
        setCurrentQuestionKey(questionsArray[0]?.key);
        setIsWaitingForN8n(false);
        // setInitiationAttemptedForContext(false); // Already set above if hasContextSwitched
      }

      // Close EventSource only if context switched
      if (eventSourceRef.current) {
          console.log("[ChatArea Context Change Effect] Closing existing EventSource due to context switch.");
          eventSourceRef.current.close(); // Close any previous connection
          eventSourceRef.current = null;
      }
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
          
          console.log("[ChatArea Initiate Func] Constructed updatedChat object:", JSON.stringify(updatedChat, null, 2));

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
          console.log(`[ChatArea Initiate Func] setCurrentChat called with chat ID: ${updatedChat.id}. Message content: "${updatedChat.messages[0]?.content?.substring(0, 50)}..."`);
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
  const connectToN8nResultStream = (chatId, encodedAnswers) => {
    if (eventSourceRef.current) {
      console.log("[SSE Connect] Closing existing EventSource before creating new one.");
      eventSourceRef.current.close(); // Close any previous connection
    }

    // Get the last 30 messages from the current chat
    let chatHistory = [];
    if (currentChat && currentChat.messages) {
      chatHistory = currentChat.messages.slice(-30).map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) // Ensure content is string
      }));
    }

    // Create the request body as a JSON object instead of URL params
    const postData = {
      chatId: chatId,
      userId: user?.id || null,
      answersData: JSON.parse(decodeURIComponent(encodedAnswers)), // Parse since we already have encoded JSON
      chatHistory: chatHistory
    };

    console.log(`[SSE Connect] Connecting to /api/n8n-result with POST request`);
    console.log(`[SSE Connect] POST data:`, {
      chatId,
      userId: user?.id || null,
      answersDataFields: Object.keys(postData.answersData),
      chatHistoryLength: chatHistory.length
    });

    // First, save an initial document generation message that will persist across refreshes
    try {
      if (user?.id) {
        // Save both a text message for DB persistence and thread-level metadata to track generation state
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
            // Also update the thread metadata to indicate document generation is in progress
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
          
        // Also add to UI state to reflect message immediately - ENSURE IT GOES AT THE END
        const initialMessage = { role: 'assistant', content: initialMessagePayload.content };
        setChats(prevChats => prevChats.map(c => {
          if (c.id === chatId) {
            // Make sure we append to the end of the messages array
            return {...c, messages: [...c.messages, initialMessage]};
          }
          return c;
        }));
        if (currentChat?.id === chatId) {
          setCurrentChat(prevChat => ({...prevChat, messages: [...prevChat.messages, initialMessage]}));
        }
      } else {
        console.warn('[SSE Connect] Cannot save initial document message - no user ID');
      }
    } catch (initErr) {
      console.error('[SSE Connect] Error saving initial document message:', initErr);
    }

    // We need to use a custom implementation for EventSource with POST
    // First, make the initial request to establish the connection
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
      
      // Create a reader for the response body stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Track the buffer and last event info
      let buffer = '';
      
      // Function to process SSE events from the buffer
      const processEvents = (chunk) => {
        buffer += chunk;
        
        // Process each event (separated by double newlines)
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        
        events.forEach(eventStr => {
          if (!eventStr.trim()) return;
          
          // Parse the event type and data
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
            // Handle the event based on its type
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
      
      // Handle n8n_result events
      const handleN8nResult = (eventData) => {
        console.log("[SSE Connect] Received n8n_result event:", JSON.stringify(eventData, null, 2));
        let contentToSaveToDB = null;   // For saving to DB
        let n8nResultData = null;

        try {
          if (eventData.success && eventData.data) {
            n8nResultData = eventData.data; // Store for later use
            console.log("[SSE Connect] Parsed n8n result data:", JSON.stringify(n8nResultData, null, 2));
            
            // Look for Google Doc link with different possible property names
            const googleDocLink = n8nResultData.googleDocLink || n8nResultData.docUrl || n8nResultData.googleDocURL || n8nResultData.documentUrl;
            
            // Log the link to debug
            console.log("[SSE Connect] Google Doc link extracted:", googleDocLink);
            
            if (googleDocLink) {
              // Update n8nResultData with normalized link
              n8nResultData = {
                ...n8nResultData,
                googleDocLink: googleDocLink
              };
              
              // Construct plain text version with HTML link embedded directly in the content
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

        // Save the text version to DB (if content exists)
        if (contentToSaveToDB && user?.id) {
          try {
            // Create a dedicated links object for the Google Doc only
            const documentLinks = {
              googleDocLink: n8nResultData?.googleDocLink
            };
            
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
            
            // Update thread metadata to indicate generation is complete
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
            
            // Call saveMessage and wait for it to complete
            saveMessage(messagePayload, user.id)
              .then(() => {
                console.log('[SSE Connect] Successfully saved n8n result message to DB for thread:', chatId);
                
                // Update the UI for other open instances of this chat
                const documentMessage = { 
                  role: 'assistant', 
                  content: contentToSaveToDB,
                  metadata: {
                    documentLinks: documentLinks
                  }
                };
                
                // Remove any "generating document" messages and add the new result message at the end
                setCurrentChat(prevChat => {
                  if (!prevChat || prevChat.id !== chatId) return prevChat;
                  
                  // Filter out any "generating document" messages first
                  const filteredMessages = prevChat.messages.filter(m => 
                    !(typeof m.content === 'string' && (
                      m.content.includes("generating your document") || 
                      m.content.includes("document-generation-status"))
                    )
                  );
                  
                  // Always add the new document message at the end
                  return {...prevChat, messages: [...filteredMessages, documentMessage]};
                });
                
                setChats(prevChats => prevChats.map(c => {
                  if (c.id === chatId) {
                    // Filter out any "generating document" messages
                    const filteredMessages = c.messages.filter(m => 
                      !(typeof m.content === 'string' && (
                        m.content.includes("generating your document") || 
                        m.content.includes("document-generation-status"))
                      )
                    );
                    
                    // Always add the new document message at the end
                    return {...c, messages: [...filteredMessages, documentMessage]};
                  }
                  return c;
                }));
                
                // Clear the waiting state
                setIsWaitingForN8n(false);
                
                // Trigger scroll to show the new document message
                setTimeout(() => {
                  scrollToBottom();
                }, 100);
                
                // TODO: Add notification system here
                // This is where we would trigger a notification to let the user know
                // their document is ready, even if they're not currently viewing this chat
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
      
      // Handle error events
      const handleErrorEvent = (eventData) => {
        console.error("[SSE Connect] Received error event:", eventData);
        
        // Always save error to DB so it persists through refreshes
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
        
        // Add an error message to the chat if we're on the relevant chat
        const sseErrorMessage = { 
          role: 'assistant', 
          content: eventData.message || "Connection error while generating document. Please try again later.", 
          isJSX: false
        }; 
        
        if (currentChat?.id === chatId) {
          setCurrentChat(prevChat => {
            if (!prevChat) return null;
            
            // Remove any "generating document" messages
            const filteredMessages = prevChat.messages.filter(m => 
              m.content !== "I'm generating your document now. Please wait..."
            );
            
            return {...prevChat, messages: [...filteredMessages, sseErrorMessage]};
          });
          
          setChats(prevChats => prevChats.map(c => {
            if (c.id === chatId) {
              // Remove any "generating document" messages
              const filteredMessages = c.messages.filter(m => 
                m.content !== "I'm generating your document now. Please wait..."
              );
              return {...c, messages: [...filteredMessages, sseErrorMessage]};
            }
            return c;
          }));
        }
        
        setIsWaitingForN8n(false);
        
        // Trigger scroll to show the error message
        setTimeout(() => {
          scrollToBottom();
        }, 100);
        
        textareaRef.current?.focus();
      };
      
      // Function to read the next chunk
      const readNextChunk = () => {
        reader.read().then(({ done, value }) => {
          if (done) {
            console.log("[SSE Connect] Stream closed by server.");
            setIsWaitingForN8n(false);
            return;
          }
          
          const chunk = decoder.decode(value, { stream: true });
          processEvents(chunk);
          readNextChunk(); // Continue reading
        }).catch(error => {
          console.error("[SSE Connect] Error reading from stream:", error);
          setIsWaitingForN8n(false);
          
          // Save stream error to DB
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
          
          // Add an error message to the chat
          const streamErrorMessage = { 
            role: 'assistant', 
            content: "Error streaming document data. Please try again.", 
            isJSX: false
          };
          
          if (currentChat?.id === chatId) {
            setCurrentChat(prevChat => {
              if (!prevChat) return null;
              
              // Remove any "generating document" messages
              const filteredMessages = prevChat.messages.filter(m => 
                m.content !== "I'm generating your document now. Please wait..."
              );
              
              return {...prevChat, messages: [...filteredMessages, streamErrorMessage]};
            });
            
            setChats(prevChats => prevChats.map(c => {
              if (c.id === chatId) {
                // Remove any "generating document" messages
                const filteredMessages = c.messages.filter(m => 
                  m.content !== "I'm generating your document now. Please wait..."
                );
                return {...c, messages: [...filteredMessages, streamErrorMessage]};
              }
              return c;
            }));
          }
          
          // Trigger scroll to show the stream error message
          setTimeout(() => {
            scrollToBottom();
          }, 100);
          
          textareaRef.current?.focus();
        });
      };
      
      // Start reading from the stream
      readNextChunk();
    })
    .catch(error => {
      console.error("[SSE Connect] Fetch error:", error);
      setIsWaitingForN8n(false);
      
      // Save connection error to DB
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
      
      // Add an error message to the chat
      const connectionErrorMessage = { 
        role: 'assistant', 
        content: `Connection error: ${error.message}. Please try again later.`, 
        isJSX: false
      };
      
      if (currentChat?.id === chatId) {
        setCurrentChat(prevChat => {
          if (!prevChat) return null;
          
          // Remove any "generating document" messages
          const filteredMessages = prevChat.messages.filter(m => 
            m.content !== "I'm generating your document now. Please wait..."
          );
          
          return {...prevChat, messages: [...filteredMessages, connectionErrorMessage]};
        });
        
        setChats(prevChats => prevChats.map(c => {
          if (c.id === chatId) {
            // Remove any "generating document" messages
            const filteredMessages = c.messages.filter(m => 
              m.content !== "I'm generating your document now. Please wait..."
            );
            return {...c, messages: [...filteredMessages, connectionErrorMessage]};
          }
          return c;
        }));
      }
      
      // Trigger scroll to show the connection error message
      setTimeout(() => {
        scrollToBottom();
      }, 100);
      
      textareaRef.current?.focus();
    });
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
    
    // Trigger scroll to show the final response
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  };

  // Snippet Handling Functions
  const handleSaveSnippet = () => {
    if (selectedText && selectionContext) {
      console.log("[ChatArea] Opening snippet modal for new snippet. Context:", selectionContext);
      setCurrentSourceContext(selectionContext);
      setEditingSnippet(null);
      setIsSnippetModalOpen(true);
    } else {
      console.warn("[ChatArea] Cannot save snippet: No text selected or context missing.");
      toast({ title: "Cannot Save Snippet", description: "Please select some text within a message first.", variant: "destructive" });
    }
  };

  const handleSnippetSave = async (snippetData) => {
    try {
      const snippetWithUser = {
        ...snippetData,
        userId: user?.id,
      };
      await saveSnippet(snippetWithUser);
      toast({ title: "Snippet Saved", description: "Your snippet has been saved successfully." });
      setIsSnippetModalOpen(false);
      clearSelection();
      setEditingSnippet(null);
      setCurrentSourceContext(null);
    } catch (error) {
      console.error("[ChatArea] Failed to save snippet:", error);
      toast({ title: "Error Saving Snippet", description: error.message || "Could not save your snippet.", variant: "destructive" });
    }
  };

  const handleSnippetModalClose = () => {
    setIsSnippetModalOpen(false);
    setEditingSnippet(null);
    setCurrentSourceContext(null);
  };

  const handleCopyText = () => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText)
        .then(() => toast({ title: "Copied to Clipboard", description: "Selected text has been copied." }))
        .catch(err => {
          console.error("[ChatArea] Failed to copy text:", err);
          toast({ title: "Copy Failed", description: "Could not copy text to clipboard.", variant: "destructive" });
        });
      clearSelection();
    }
  };
  // End of Snippet Handling Functions

  useEffect(() => {
    if (headerRef.current) {
      const rect = headerRef.current.getBoundingClientRect();
      console.log('[CHAT_HEADER_DEBUG] header offsetLeft:', rect.left, 'width:', rect.width);
    }
  });

  return (
    <div className="flex-1 flex flex-col h-screen relative bg-background">
      {/* Chat header - flush against sidebar on desktop */}
      <div ref={headerRef} className="border-b pl-3 pr-3 py-3 md:pl-4 md:pr-4 md:py-4 mb-4 sm:mb-5 sticky top-0 bg-background z-10">
        <div className="font-semibold text-left">
          {currentChat && currentChat.title ? (
            <span className="text-sm sm:text-base">{currentChat.title}</span>
          ) : (
            <span className="text-sm sm:text-base">New Conversation</span>
          )}
        </div>
      </div>

      {/* Messages container - updated for bottom-up flow */}
      <ScrollArea
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto px-3 sm:px-4 touch-pan-y"
      >
        <div 
          ref={chatContainerRef} 
          className={`flex flex-col space-y-4 sm:space-y-6 py-4 sm:py-6 mb-20 sm:mb-24 transition-all duration-300 ease-in-out ${!currentChat?.messages?.length ? 'min-h-[calc(100vh-200px)] justify-end items-center' : 'justify-start items-center'}`}
        >
          {/* First message or empty state when no messages */}
          {!currentChat?.messages?.length ? (
            (isInitiating || isLoading) ? (
              <div className="flex flex-col items-center justify-center space-y-3 animate-in fade-in-50 duration-500">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground font-medium">
                  Initializing {selectedTool ? TOOLS[selectedTool].name : "chat"}…
                </p>
              </div>
            ) : (
              <div className="text-center space-y-4 sm:space-y-6 max-w-md px-4 animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
                <h3 className="text-xl sm:text-2xl font-semibold">
                  {selectedTool ? TOOLS[selectedTool].name : "Start a New Conversation"}
                </h3>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                  {selectedTool 
                    ? TOOLS[selectedTool].description
                    : "Ask me anything related to your business."}
                </p>
                {selectedTool && (
                  <div className="mt-6 p-3 bg-muted/50 rounded-lg border-l-4 border-primary/30">
                    <p className="text-sm text-muted-foreground">
                      👋 Ready to get started? Just type your first response below!
                    </p>
                  </div>
                )}
              </div>
            )
          ) : (
            currentChat.messages
              .filter((message) => {
                // Filter out document generation status messages if document is already complete
                const isGenerationStatus = typeof message.content === 'string' && 
                  message.content.includes('document-generation-status');
                
                if (isGenerationStatus) {
                  // Check if there are any completed document messages in the chat
                  const hasCompletedDocuments = currentChat.messages.some(msg => 
                    isDocumentMessage(msg) && !msg.content.includes('document-generation-status')
                  );
                  
                  // Also check metadata for completion
                  const isDocumentComplete = currentChat.metadata?.documentGenerated === true || 
                    currentChat.metadata?.isGeneratingDocument === false;
                  
                  // Filter out generation status if document is complete
                  if (hasCompletedDocuments || isDocumentComplete) {
                    console.log('[ChatArea] Filtering out generation status message - document is complete');
                    return false;
                  }
                }
                
                return true;
              })
              .map((message, index, filteredArray) => {
                // Check if this is the last message in the filtered array
                const isLastMessage = index === filteredArray.length - 1;
                
                return (
                  <div
                    key={message.id || `message-${index}`}
                    className={`w-full max-w-3xl flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    ref={isLastMessage ? lastMessageRef : null}
                  >
                    <div
                      className={`
                        ${message.role === "user" ? "bg-muted px-4 py-2 rounded-lg" : ""}
                        text-sm sm:text-base leading-relaxed max-w-prose
                      `}
                      data-message-id={message.id}
                      data-chat-id={currentChat?.id}
                      data-message-role={message.role}
                    >
                      {message.is_thinking ? (
                        <LoadingMessage content={message.content} role={message.role} />
                      ) : (
                        // Conditional rendering for different message types
                        <>
                          {isDocumentMessage(message) ? (
                            <DocumentMessage message={message} />
                          ) : isLandingPageMessage(message) ? (
                            <LandingPageMessage content={message.content} />
                          ) : (
                            // Check for HTML content
                            message.content.includes('<a href') ? (
                              <HTMLContent content={message.content} />
                            ) : (
                              <MarkdownMessage content={message.content} />
                            )
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
          )}

          {/* Show n8n document generation loader */}
          {isWaitingForN8n && (
            <div className="flex items-center justify-center py-6">
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground font-medium">Generating document...</span>
                </div>
                <p className="text-xs text-muted-foreground max-w-xs text-center">
                  This may take up to 1-3 minutes. Your document is being created based on your answers.
                </p>
              </div>
            </div>
          )}

          {/* Loading state for AI response */}
          {isResponseLoading && !isWaitingForN8n && (
            <div className="w-full max-w-3xl flex justify-start">
              <LoadingMessage role="assistant" />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area - made responsive for mobile devices */}
      <div className="fixed bottom-2 left-0 right-0 md:left-[280px] bg-background shadow-[0_-1px_3px_rgba(0,0,0,0.05)] pt-2 pb-2 sm:pt-3 sm:pb-3 pb-[env(safe-area-inset-bottom)] z-40 flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-3xl flex flex-col space-y-2 mobile-input-wrapper">
          <div className="relative w-full">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="resize-none pr-14 py-3 max-h-28 min-h-[48px] text-sm font-medium mobile-input touch-none rounded-lg border"
              rows={1}
              disabled={isLoading || isResponseLoading || isWaitingForN8n}
              style={{ fontSize: '16px', touchAction: 'manipulation' }} /* Prevent iOS zoom and improve touch responsiveness */
              inputMode="text"
              autoComplete="off"
              autoCorrect="on"
              spellCheck="true"
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full touch-target shadow-md"
              disabled={!input.trim() || isLoading || isResponseLoading || isWaitingForN8n}
            >
              <ArrowUp className="h-6 w-6" />
            </Button>
          </div>
        </form>
      </div>

      {/* Text Selection Menu */}
      {isTextSelected && selectionPosition && (
        <TextSelectionMenu
          position={selectionPosition}
          onSaveSnippet={handleSaveSnippet} // This should point to handleSaveSnippet to open the modal
          onCopy={handleCopyText}
          onClose={clearSelection} // Close menu and clear selection
          selectedText={selectedText}
        />
      )}

      {/* Snippet Modal */}
      {isSnippetModalOpen && (
        <SnippetModal
          isOpen={isSnippetModalOpen}
          onClose={handleSnippetModalClose}
          onSave={handleSnippetSave} // This should point to handleSnippetSave
          selectedText={editingSnippet ? null : selectedText}
          existingSnippet={editingSnippet}
          sourceContext={currentSourceContext}
        />
      )}
    </div>
  );
}