"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Circle, HelpCircle, Loader2, ExternalLink, Download, FileText, ArrowUp, MessageCircle, User, Bot, Copy, Save, Target } from 'lucide-react'; // Icons for status and Loader2
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
import { streamingClient } from '@/lib/utils/streaming';
import StreamingMessage from '@/components/StreamingMessage';
import MarkdownMessage from '@/components/markdown-message';

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

// Helper function to check if a message contains landing page HTML
function isLandingPageMessage(message) {
  return message.content && 
    (message.content.includes('<!DOCTYPE html>') || message.content.includes("```html"));
}

// Add a component for rendering HTML landing pages
function LandingPageMessage({ content }) {
  const [showPreview, setShowPreview] = useState(true); // Default to TRUE to show preview
  const [copied, setCopied] = useState(false);

  let htmlCode = null;
  let introText = content;

  const htmlBlockStartMarker = "```html";
  const htmlBlockEndMarker = "```";
  const doctypeMarker = "<!DOCTYPE html>";

  let startIndex = content.indexOf(htmlBlockStartMarker);
  if (startIndex === -1) {
    startIndex = content.indexOf(doctypeMarker);
  }

  if (startIndex !== -1) {
    let tempContent = content.substring(startIndex);
    if (tempContent.startsWith(htmlBlockStartMarker)) {
      const actualHtmlStart = htmlBlockStartMarker.length;
      const endIndex = tempContent.indexOf(htmlBlockEndMarker, actualHtmlStart);
      if (endIndex !== -1) {
        htmlCode = tempContent.substring(actualHtmlStart, endIndex).trim();
        introText = content.substring(0, startIndex).trim();
      } else { // Malformed or just raw HTML starting with ```html but no end
        htmlCode = tempContent.substring(actualHtmlStart).trim();
        introText = content.substring(0, startIndex).trim();
      }
    } else if (tempContent.startsWith(doctypeMarker)) {
      htmlCode = tempContent.trim();
      introText = content.substring(0, startIndex).trim();
    }
  } else {
    // No clear HTML markers found, assume whole content might be intro or non-LP message passed here by mistake
    introText = content;
    htmlCode = null;
  }
  // Final cleanup for introText if it was empty
  if (introText && introText.trim().length === 0) introText = null;

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

  return (
    <div className="w-full flex flex-col items-center py-2"> {/* Centering the whole block */}
      {introText && (
        <div className="flex w-full max-w-4xl justify-start mb-4 px-3 sm:px-4"> 
          <div className="flex items-start space-x-3 max-w-[85%] sm:max-w-[80%] flex-row">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-muted text-muted-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl px-4 py-3 shadow-sm bg-muted/60 text-foreground">
              <MarkdownMessage content={introText} />
            </div>
          </div>
        </div>
      )}

      {htmlCode && (
        <div className="w-full max-w-5xl p-4 border rounded-lg bg-gray-100 dark:bg-gray-800 shadow-md mx-3 sm:mx-4"> {/* Wider block for HTML tools */}
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Landing Page HTML</h4>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="text-xs">
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </Button>
              <Button variant="outline" size="sm" onClick={copyToClipboard} className="text-xs">{copied ? 'Copied!' : 'Copy HTML'}</Button>
              <Button variant="outline" size="sm" onClick={downloadHTML} className="text-xs"><Download className="h-3 w-3 mr-1" />Download</Button>
            </div>
          </div>
          {showPreview && (
            <div className="mb-4">
              <div className="border rounded bg-white" style={{ height: '400px', width: '100%', overflow: 'auto' }}>
                <iframe srcDoc={htmlCode} className="w-full h-full rounded" title="Landing Page Preview" sandbox="allow-scripts allow-same-origin" />
              </div>
            </div>
          )}
          <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 text-xs font-mono overflow-x-auto max-h-80"> {/* Increased max-h */}
            <pre className="whitespace-pre-wrap">{htmlCode}</pre>
          </div>
          <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
            <p><strong>Instructions:</strong></p>
            <ol className="list-decimal list-inside space-y-1 mt-1">{/* ...instructions... */}</ol>
          </div>
        </div>
      )}
      
      {/* Fallback if this component was rendered for non-HTML content by mistake */}
      {!introText && !htmlCode && (
         <div className="flex w-full max-w-4xl justify-start mb-4 px-3 sm:px-4">
          <div className="flex items-start space-x-3 max-w-[85%] sm:max-w-[80%] flex-row">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-muted text-muted-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl px-4 py-3 shadow-sm bg-muted/60 text-foreground">
              <MarkdownMessage content={content} /> 
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatArea({ selectedTool, currentChat, setCurrentChat, chats, setChats }) {
  // Get user from context
  const { user } = useAuth();

  // Component state
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResponseLoading, setIsResponseLoading] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [initiationAttemptedForContext, setInitiationAttemptedForContext] = useState(false);
  const [collectedAnswers, setCollectedAnswers] = useState({});
  const [currentQuestionKey, setCurrentQuestionKey] = useState(null);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [isWaitingForN8n, setIsWaitingForN8n] = useState(false);
  const eventSourceRef = useRef(null);
  const textareaRef = useRef(null);
  const scrollAreaRef = useRef(null); // This ref is for the ScrollArea component itself, for scrollToBottom
  const chatContainerRef = useRef(null); // This is the NEW ref for the text selection container
  const prevChatIdRef = useRef();
  const prevSelectedToolRef = useRef();
  const lastInitiatedChatIdRef = useRef(); // Track the last initiated chat ID to prevent loops
  const lastMessageRef = useRef(null);
  const { track } = usePostHog();
  const {
    selectedText,
    selectionContext,
    isTextSelected,
    selectionPosition,
    clearSelection
  } = useTextSelection(chatContainerRef); // Pass chatContainerRef to the hook
  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState(null);
  const [currentSourceContext, setCurrentSourceContext] = useState(null);
  const { toast } = useToast();
  const headerRef = useRef(null);
  const textSelectionMenuRef = useRef(null); // Ref for the TextSelectionMenu
  
  // Streaming state
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState(null);

  // Add this useEffect to track the isWaitingForN8n state
  useEffect(() => {
    console.log(`[ChatArea state check] isWaitingForN8n changed to: ${isWaitingForN8n}`);
  }, [isWaitingForN8n]);

  // Reset state when chat or tool changes
  useEffect(() => {
    const currentChatId = currentChat?.id;
    const previousChatId = prevChatIdRef.current;
    const currentSelectedTool = selectedTool;
    const previousSelectedTool = prevSelectedToolRef.current;

    const hasChatSwitched = currentChatId !== previousChatId;
    const hasToolSwitched = currentSelectedTool !== previousSelectedTool;
    const hasContextSwitched = hasChatSwitched || hasToolSwitched;

    // Only reset state and close SSE if the actual chat or tool context has changed
    if (hasContextSwitched) {
      setInitiationAttemptedForContext(false);
      lastInitiatedChatIdRef.current = null; // Reset the last initiated chat ID on context switch
      
      if (currentChat?.metadata) {
        // Initialize state from metadata
        setCollectedAnswers(currentChat.metadata.collectedAnswers || {});
        setQuestionsAnswered(currentChat.metadata.questionsAnswered || 0);

        if (currentSelectedTool === 'workshop-generator' || currentSelectedTool === 'hybrid-offer') {
        const questionsArray = currentSelectedTool === 'workshop-generator' ? workshopQuestions : hybridOfferQuestions;
        setCurrentQuestionKey(currentChat.metadata.currentQuestionKey || questionsArray[0]?.key);
        } else {
          setCurrentQuestionKey(null); // Not a question-based tool
        }
        
        // Document generation state
        if (currentChat.metadata.isGeneratingDocument === true && !currentChat.metadata.documentGenerated) {
          setIsWaitingForN8n(true);
          if (currentChat.metadata.generationStartTime) {
            const startTime = new Date(currentChat.metadata.generationStartTime);
            const now = new Date();
            const elapsedMs = now - startTime;
            const MAX_GENERATION_TIME = 5 * 60 * 1000; // 5 minutes
            if (elapsedMs < MAX_GENERATION_TIME && currentChat.metadata.collectedAnswers) {
                try {
                  const encodedAnswers = encodeURIComponent(JSON.stringify(currentChat.metadata.collectedAnswers));
                  connectToN8nResultStream(currentChat.id, encodedAnswers);
                } catch (err) {
                console.error(`[ChatArea] Error reconnecting to stream:`, err);
                setIsWaitingForN8n(true); 
                }
              } else {
              setIsWaitingForN8n(true); 
              }
            } else {
            setIsWaitingForN8n(true);
          }
        } else { // Covers documentGenerated or isGeneratingDocument is false
            setIsWaitingForN8n(false);
          }
      } else {
        // No metadata - reset to default for the selected context
        setCollectedAnswers({});
        setQuestionsAnswered(0);
        if (currentSelectedTool === 'workshop-generator' || currentSelectedTool === 'hybrid-offer') {
        const questionsArray = currentSelectedTool === 'workshop-generator' ? workshopQuestions : hybridOfferQuestions;
        setCurrentQuestionKey(questionsArray[0]?.key);
        } else {
          setCurrentQuestionKey(null); // Not a question-based tool
        }
        setIsWaitingForN8n(false);
      }

      // Close EventSource only if context switched
      if (eventSourceRef.current) {
          eventSourceRef.current.close(); 
          eventSourceRef.current = null;
      }
    } else {
      // Context did NOT switch, but currentChat prop might have updated (e.g., with new metadata from another source)
      // Re-apply state from metadata if available to ensure consistency, ONLY if a tool is selected
      if (currentChat?.metadata && typeof currentChat.metadata === 'object') {
        if (currentSelectedTool === 'hybrid-offer' || currentSelectedTool === 'workshop-generator') {
         setCollectedAnswers(currentChat.metadata.collectedAnswers || {});
         const questionsArray = currentSelectedTool === 'workshop-generator' ? workshopQuestions : hybridOfferQuestions;
           setCurrentQuestionKey(currentChat.metadata.currentQuestionKey || (currentChat.metadata.isComplete ? null : questionsArray[0]?.key));
         setQuestionsAnswered(currentChat.metadata.questionsAnswered || 0);
        } else {
          // If not a question-based tool, ensure tool-specific states are clear
           setCollectedAnswers(prev => Object.keys(prev).length > 0 ? {} : prev);
           setCurrentQuestionKey(prev => prev !== null ? null : prev);
           setQuestionsAnswered(prev => prev !== 0 ? 0 : prev);
        }
         
        // Document generation state check, applies regardless of tool type if metadata exists
         if (currentChat.metadata.isGeneratingDocument === true && !currentChat.metadata.documentGenerated) {
           setIsWaitingForN8n(true);
        } else { // Covers documentGenerated or isGeneratingDocument is false
           setIsWaitingForN8n(false);
         }
      }
    }

    // Update refs for the next render *after* all checks
    prevChatIdRef.current = currentChatId;
    prevSelectedToolRef.current = currentSelectedTool;
  }, [currentChat, selectedTool]); // Keep dependencies: effect needs to run when chat or tool potentially changes

  // Update starting key if chat history already exists for hybrid-offer
  useEffect(() => {
    if (currentChat?.messages?.length > 0 && (selectedTool === 'hybrid-offer' || selectedTool === 'workshop-generator') && !initiationAttemptedForContext) {
      console.log(`[ChatArea] Existing messages initiation blocked - messages exist for tool: ${selectedTool}, chatId: ${currentChat.id}`);
      setInitiationAttemptedForContext(true);
      // Don't call initiateToolChat for existing messages - tools should only init on empty chats
      }
  }, [currentChat, selectedTool, initiationAttemptedForContext]); // Dependencies for this effect

  // Effect to initiate chat for tool-based chats when there are *no* messages yet
  useEffect(() => {
    console.log(`[ChatArea Auto-Initiate Effect Check] Running for tool: ${selectedTool}, chat ID: ${currentChat?.id}`);
    console.log(`[ChatArea Auto-Initiate Condition Check] currentChat: ${!!currentChat}`);
    if (currentChat) {
      console.log(`[ChatArea Auto-Initiate Condition Check] currentChat.messages?.length: ${currentChat.messages?.length}`);
    }
    console.log(`[ChatArea Auto-Initiate Condition Check] selectedTool is tool: ${(selectedTool === 'hybrid-offer' || selectedTool === 'workshop-generator')}`);
    console.log(`[ChatArea Auto-Initiate Condition Check] !initiationAttemptedForContext: ${!initiationAttemptedForContext}`);
    console.log(`[ChatArea Auto-Initiate Condition Check] user?.id: ${!!user?.id}`);
    if (currentChat) {
      console.log(`[ChatArea Auto-Initiate Condition Check] lastInitiatedChatIdRef.current !== currentChat.id: ${lastInitiatedChatIdRef.current !== currentChat.id} (Last: ${lastInitiatedChatIdRef.current}, Current: ${currentChat.id})`);
    }

    if (
      currentChat &&
      currentChat.messages?.length === 0 &&
        (selectedTool === 'hybrid-offer' || selectedTool === 'workshop-generator') &&
      !initiationAttemptedForContext && // This should be the primary guard for a new context
      user?.id
      // lastInitiatedChatIdRef.current !== currentChat.id // <<<< TEMPORARILY REMOVING THIS CONDITION
       ) {
      console.log(`[ChatArea Auto-Initiate SUCCESS] Tool: ${selectedTool}, Chat ID: ${currentChat.id}. Initiating...`);
      setIsInitiating(true);
      setInitiationAttemptedForContext(true); // Mark this context (chat ID + tool) as having an initiation attempt
      // We can keep lastInitiatedChatIdRef if we want to prevent multiple calls within the *same execution path* if initiateToolChat was synchronous,
      // but for async, and with setInitiationAttemptedForContext, it might be redundant or causing issues.
      // Let's try without it first, relying on setInitiationAttemptedForContext and its reset in the other useEffect.
      // lastInitiatedChatIdRef.current = currentChat.id; 

      initiateToolChat(currentChat.id, selectedTool)
        .catch((error) => {
          console.error("[ChatArea Auto-Initiate] Error during tool initiation:", error);
          toast({
            title: "Tool Initiation Failed",
            description: `Could not start ${TOOLS[selectedTool].name}. Please try again.`,
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsInitiating(false);
        });
    }
  }, [currentChat, selectedTool, initiationAttemptedForContext, user?.id]);

  // Removed the second duplicate useEffect that previously attempted initiation when messages.length > 0

  const initiateToolChat = async (chatIdToInitiate, tool) => {
      console.log(`[ChatArea Initiate Func] Starting for chat ID: ${chatIdToInitiate}`);
    
    if (!user?.id) {
      console.error("User not authenticated");
      return;
    }

    // Prevent re-initialization if the chat already has messages
    if (currentChat?.id === chatIdToInitiate && currentChat?.messages?.length > 0) {
      console.log(`[ChatArea Initiate Func] Skipping initialization - chat ${chatIdToInitiate} already has ${currentChat.messages.length} messages`);
      return;
    }

    // We rely on the API to provide the correct initialization message.

    try {
      // Still call the API to set up the thread metadata
      const requestBody = {
        messages: [],
        tool: tool,
        isToolInit: true,
        chatId: chatIdToInitiate
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
              body: JSON.stringify(requestBody),
          });

          console.log(`[ChatArea Initiate Func] Fetch response status: ${response.status}`);

          if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          console.log("[ChatArea Initiate Func] API response data:", JSON.stringify(data, null, 2));

      // Use the API-provided message (data.msgPreview or data.message).
      const initialContent = data.msgPreview || data.message || "Let's build out your offer! Tell me about your core product/service at a high level.";
          
          const assistantMessage = { 
        id: Date.now() + Math.random(),
        content: initialContent,
              role: "assistant", 
        isInitial: true,
        timestamp: new Date().toISOString()
      };

      const existingMessages = currentChat?.messages || [];
          const updatedChat = {
        ...currentChat,
        id: data.chatId || chatIdToInitiate,
        messages: [...existingMessages, assistantMessage],
              metadata: {
          ...currentChat?.metadata,
          collectedAnswers: data.collectedAnswers || {},
          currentQuestionKey: data.currentQuestionKey,
          questionsAnswered: data.questionsAnswered || 0,
          isComplete: data.isComplete || false
              }
          };
          
      console.log("[ChatArea Initiate Func] Constructed updatedChat object with locked message");

      // Update chats list first
      setChats(prevChats => {
        const filteredChats = prevChats.filter(chat => chat.id !== chatIdToInitiate);
        const newChats = [...filteredChats, updatedChat];
        return newChats;
      });

      // Only update currentChat if we're still working with the same chat ID
      if (currentChat?.id === chatIdToInitiate) {
          setCurrentChat(updatedChat);
        console.log(`[ChatArea Initiate Func] setCurrentChat called with chat ID: ${updatedChat.id}. Message content: "${initialContent.substring(0, 50)}..."`);
      } else {
        console.log(`[ChatArea Initiate Func] Skipping setCurrentChat - chat ID changed from ${chatIdToInitiate} to ${currentChat?.id}`);
      }

          console.log(`[ChatArea Initiate Func] Finished setting current chat ID: ${updatedChat.id}`);

      // Update component state from the response
      setCollectedAnswers(data.collectedAnswers || {});
      setCurrentQuestionKey(data.currentQuestionKey);
      setQuestionsAnswered(data.questionsAnswered || 0);
      } catch (error) {
      console.error("[ChatArea Initiate Func] Error initiating tool chat:", error);
      } finally {
          console.log("[ChatArea Initiate Func] Finalizing initiation attempt.");
      // The initiationAttemptedForContext flag should remain true regardless of success/failure
      // to prevent repeated attempts
      }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const trimmedInput = input.trim();

    if (!currentChat) {
        console.error("handleSubmit aborted: currentChat is null or undefined.");
        alert("Cannot send message: No active chat selected.");
        return;
    }
    
    if (!trimmedInput || isLoading || isResponseLoading || isInitiating) {
      console.log(`[CHAT_DEBUG] Submit prevented: empty=${!trimmedInput}, isLoading=${isLoading}, isResponseLoading=${isResponseLoading}, isInitiating=${isInitiating}`);
      return;
    }

    setIsLoading(true);
    setIsResponseLoading(true);

    const userMessage = { role: "user", content: trimmedInput, id: `user-${Date.now()}` }; // Added ID to user message for stable key
    setInput("");

    let chatToUpdate = currentChat;
    const updatedMessages = [...chatToUpdate.messages, userMessage];
    const optimisticChat = { ...chatToUpdate, messages: updatedMessages };

    setCurrentChat(optimisticChat);
    setChats(prev => prev.map(chat => chat.id === chatToUpdate.id ? optimisticChat : chat));
    
    // Save user message to DB
    if (user?.id) {
      handleMessageSave(chatToUpdate.id, userMessage, user.id);
    }

    try {
      if (!selectedTool) {
        console.log('[CHAT_DEBUG] Using streaming for regular chat');
        
        const tempStreamingId = `streaming-${Date.now()}`;
        setStreamingMessageId(tempStreamingId); // Store the ID of the streaming message
        setStreamingContent('');
        setIsStreaming(true);
        
        const initialStreamingMessage = {
          id: tempStreamingId, 
          role: 'assistant', 
          content: '', 
          isStreaming: true 
        };

        const tempChatWithStreamingPlaceholder = {
          ...optimisticChat, // Use optimisticChat which already has the user message
          messages: [...optimisticChat.messages, initialStreamingMessage]
        };
        
        setCurrentChat(tempChatWithStreamingPlaceholder);
        setChats(prev => prev.map(chat => chat.id === chatToUpdate.id ? tempChatWithStreamingPlaceholder : chat));
        
        streamingClient.streamChat({
          messages: updatedMessages, // Send messages up to the user's new message
           tool: selectedTool,
          currentQuestionKey: currentQuestionKey,
          questionsAnswered: questionsAnswered,
          collectedAnswers: collectedAnswers,
          chatId: chatToUpdate.id,
          onChunk: (chunk, fullContent) => {
            setStreamingContent(fullContent);
            setCurrentChat(prevChat => {
              if (!prevChat || !prevChat.messages) return prevChat;
              const newMessages = prevChat.messages.map(msg => 
                msg.id === tempStreamingId ? { ...msg, content: fullContent, isStreaming: true } : msg
              );
              return { ...prevChat, messages: newMessages };
            });
            setChats(prev => prev.map(c => {
              if (c.id === chatToUpdate.id) {
                const newMessages = c.messages.map(msg => 
                  msg.id === tempStreamingId ? { ...msg, content: fullContent, isStreaming: true } : msg
                );
                return { ...c, messages: newMessages };
              }
              return c;
            }));
          },
          onComplete: (data) => {
            console.log('[CHAT_DEBUG] Streaming completed from client, final data:', data);
            setIsStreaming(false);
            setIsResponseLoading(false); // Already set by finally, but good to be explicit
            // setIsLoading(false); //isLoading is for user input, isResponseLoading for AI response
            
            const finalContent = data.message;
            const finalChatId = data.chatId || chatToUpdate.id;

            setCurrentChat(prevChat => {
              if (!prevChat || !prevChat.messages) return prevChat;
              const newMessages = prevChat.messages.map(msg => 
                msg.id === tempStreamingId ? { ...msg, content: finalContent, isStreaming: false } : msg // Keep the same ID, just update content and streaming status
              );
              return { ...prevChat, id: finalChatId, messages: newMessages };
            });

            setChats(prev => prev.map(c => {
              if (c.id === chatToUpdate.id || c.id === finalChatId) {
                const newMessages = c.messages.map(msg => 
                  msg.id === tempStreamingId ? { ...msg, content: finalContent, isStreaming: false } : msg // Keep the same ID, just update content and streaming status
                );
                return { ...c, id: finalChatId, messages: newMessages };
              }
              return c;
            }));
            
            // Save the *finalized* assistant message to database
            if (user?.id) {
              const finalAssistantMessage = {
                id: tempStreamingId, // Use the same ID that's in the UI state
                role: 'assistant',
                content: finalContent
              };
              handleMessageSave(finalChatId, finalAssistantMessage, user.id);
            }
            // NOTE: we purposely KEEP streamingMessageId so the same StreamingMessage
            // component continues to render this message even after completion. It will
            // be overwritten the next time a new streaming cycle starts.
          },
          onError: (error) => {
            console.error('[CHAT_DEBUG] Streaming error:', error);
            setIsStreaming(false);
            // setIsLoading(false);
            // isResponseLoading is cleared in finally

            setCurrentChat(prevChat => {
              if (!prevChat || !prevChat.messages) return prevChat;
              const newMessages = prevChat.messages.map(msg => 
                msg.id === tempStreamingId ? { ...msg, content: `Sorry, an error occurred: ${error.message}`, isStreaming: false, isError: true } : msg // Keep the same ID
              );
              return { ...prevChat, messages: newMessages };
            });
            setChats(prev => prev.map(c => {
              if (c.id === chatToUpdate.id) {
                const newMessages = c.messages.map(msg => 
                  msg.id === tempStreamingId ? { ...msg, content: `Sorry, an error occurred: ${error.message}`, isStreaming: false, isError: true } : msg // Keep the same ID
                );
                return { ...c, messages: newMessages };
              }
              return c;
            }));
            // Keep streamingMessageId until the next user message starts a new stream
          }
        });
        
        // setIsLoading(false); // User input is submitted, AI response is now loading.
        return; 
      }
      
      // ... (rest of the handleSubmit for non-streaming tools)
            
       const response = await fetch('/api/chat', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
               messages: updatedMessages, // This already includes the user's new message
               tool: selectedTool,
               currentQuestionKey: currentQuestionKey,
               questionsAnswered: questionsAnswered,
               collectedAnswers: collectedAnswers,
               chatId: chatToUpdate.id 
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
       
           // Handle JSON response for tool-based chat
           try {
               data = await response.json();
           } catch (error) {
               console.error("[CHAT_DEBUG] Error parsing JSON response:", error);
               throw new Error("Failed to parse response from server");
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
            ? { role: 'assistant', content: data.message, id: `assistant-${Date.now()}` } // Add ID
            : data.message || { role: 'assistant', content: "I couldn't generate a proper response.", id: `assistant-error-${Date.now()}` }; // Add ID
            
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

        console.log(`[CHAT_DEBUG] Received chatId from API: ${correctChatId}, comparing with current chat ID: ${chatToUpdate.id}, equal: ${correctChatId === chatToUpdate.id}`);
        
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
          
          // For tool-based chats, we don't need to filter temp chats since they use the same ID
          const filteredChats = prevChats;
            
          console.log(`[CHAT_DEBUG] Using existing chats without filtering:`, {
            chatCount: filteredChats.length,
            chatIds: filteredChats.map(c => c.id)
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
          } else {
            // Add new chat to the list
            result = [finalCurrentChat, ...filteredChats];
          }
          
          console.log(`[CHAT_DEBUG] Final setChats result:`, {
            resultCount: result.length,
            resultIds: result.map(c => c.id),
            operation: chatExists ? 'update' : 'add'
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
        const errorAssistantMessage = { role: "assistant", content: `Sorry, an error occurred: ${error.message}`, id: `error-${Date.now()}` };
        const errorChat = { 
          ...chatToUpdate, // Base it on the state *before* optimistic user message was added if that's cleaner
          messages: [...chatToUpdate.messages.filter(m => m.id !== userMessage.id), userMessage, errorAssistantMessage] 
        };
        setChats(prev => prev.map(chat => chat.id === errorChat.id ? errorChat : chat));
        setCurrentChat(errorChat);
        
        setTimeout(() => {
          scrollToBottom();
        }, 100);
    } finally {
      setIsLoading(false); // For user input
      setIsResponseLoading(false); // For AI response
      console.log(`[CHAT_DEBUG] handleSubmit completed, loading states cleared`);
      if (!isWaitingForN8n && textareaRef.current) {
         textareaRef.current.focus();
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
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      
        // Try multiple methods to find the scrollable element
      let scrollElement = scrollArea.querySelector('[data-radix-scroll-area-viewport]');
      
      if (!scrollElement) {
        scrollElement = scrollArea.querySelector('div[style*="overflow"]');
      }
      
      if (!scrollElement) {
        scrollElement = scrollArea;
      }
      
      if (scrollElement) {
          // Get current scroll values
          const currentScrollTop = scrollElement.scrollTop;
          const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight;
          
          // Force aggressive scroll to bottom immediately
          scrollElement.scrollTop = maxScroll + 100; // Extra padding to ensure we're at the bottom
          
          // During streaming, be extra aggressive
          if (isStreaming) {
            // Force scroll again after a tiny delay to catch any race conditions
            setTimeout(() => {
              const newMaxScroll = scrollElement.scrollHeight - scrollElement.clientHeight;
              scrollElement.scrollTop = newMaxScroll + 100;
            }, 5);
            
            // And one more time to be absolutely sure
            setTimeout(() => {
              const finalMaxScroll = scrollElement.scrollHeight - scrollElement.clientHeight;
              scrollElement.scrollTop = finalMaxScroll + 100;
            }, 20);
          }
        }
        
        // Also try scrollIntoView on the last message as backup
        if (lastMessageRef.current) {
          setTimeout(() => {
          lastMessageRef.current.scrollIntoView({ 
              behavior: 'instant',
              block: 'end',
              inline: 'nearest'
          });
          }, isStreaming ? 10 : 20);
        }
      }
    });
  };

  // Single consolidated auto-scroll useEffect to prevent conflicts
  useEffect(() => {
    // Always scroll when messages change or streaming updates
    const shouldScroll = 
      currentChat?.messages?.length > 0 || 
      isResponseLoading || 
      isWaitingForN8n || 
      (isStreaming && streamingContent);

    if (shouldScroll) {
      // Immediate scroll
      scrollToBottom();
      
      // Additional scroll for streaming content updates
      if (isStreaming && streamingContent) {
        const streamingTimeout = setTimeout(() => {
          scrollToBottom();
        }, 50);
        
        return () => clearTimeout(streamingTimeout);
      }
      
      // Standard delayed scroll for other content
      const standardTimeout = setTimeout(() => {
        scrollToBottom();
      }, 100);
      
      return () => clearTimeout(standardTimeout);
    }
  }, [
    currentChat?.messages?.length, 
    currentChat?.id, 
    isResponseLoading, 
    isWaitingForN8n, 
    isStreaming, 
    streamingContent
  ]);

  // Continuous auto-scroll during active streaming to ensure we keep up with fast content
  useEffect(() => {
    let scrollInterval;
    
    if (isStreaming && streamingContent) {
      // Set up a continuous scroll interval during streaming
      scrollInterval = setInterval(() => {
        scrollToBottom();
      }, 100); // Scroll every 100ms during active streaming
    }
      
      return () => {
      if (scrollInterval) {
        clearInterval(scrollInterval);
      }
    };
  }, [isStreaming, streamingContent]);

  // Immediate scroll when streaming starts
  useEffect(() => {
    if (isStreaming) {
      // Scroll immediately when streaming begins
      scrollToBottom();
      // And again after a tiny delay to catch any initial content
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
  }, [isStreaming]);

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
      setCurrentSourceContext(selectionContext);
      setEditingSnippet(null);
      setIsSnippetModalOpen(true);
    } else {
      toast({ title: "Cannot Save Snippet", description: "Please select some text within a message first.", variant: "destructive" });
    }
  };

  const handleSnippetSave = async (snippetData) => {
    try {
      const snippetWithUser = { ...snippetData, userId: user?.id };
      await saveSnippet(snippetWithUser);
      toast({ title: "Snippet Saved", description: "Your snippet has been saved successfully." });
      setIsSnippetModalOpen(false);
      clearSelection(); 
      setEditingSnippet(null);
      setCurrentSourceContext(null);
    } catch (error) {
      toast({ title: "Error Saving Snippet", description: error.message || "Could not save your snippet.", variant: "destructive" });
    }
  };

  const handleSnippetModalClose = () => {
    setIsSnippetModalOpen(false);
    setEditingSnippet(null);
    setCurrentSourceContext(null);
    clearSelection(); // Clear selection when modal is closed without saving
  };

  const handleCopyText = () => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText)
        .then(() => toast({ title: "Copied to Clipboard", description: "Selected text has been copied." }))
        .catch(err => toast({ title: "Copy Failed", description: "Could not copy text to clipboard.", variant: "destructive" }));
      clearSelection(); // Ensure selection is cleared after copying
    }
  };
  
  // Effect to handle clicks outside the text selection menu to close it
  // This relies on the useTextSelection hook's own mouseup listener to clear selection
  // when a click results in no text being selected. The menu visibility is tied to isTextSelected.
  // No additional click-outside listener needed here if useTextSelection is robust.

  useEffect(() => {
    const handleClickOutsideMenu = (event) => {
      if (isTextSelected && textSelectionMenuRef.current && !textSelectionMenuRef.current.contains(event.target)) {
        // If menu is open and click is outside menu, check if a new selection was made.
        // If not, it means the click was likely intended to dismiss the menu.
        setTimeout(() => { // Allow browser to process potential new selection
          const currentDOMSelection = window.getSelection()?.toString().trim();
          if (!currentDOMSelection) {
            clearSelection();
          }
        }, 0);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideMenu);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideMenu);
    };
  }, [isTextSelected, clearSelection, textSelectionMenuRef]); // textSelectionMenuRef is stable

  useEffect(() => {
    if (headerRef.current) {
      const rect = headerRef.current.getBoundingClientRect();
      console.log('[CHAT_HEADER_DEBUG] header offsetLeft:', rect.left, 'width:', rect.width);
    }
  });



  // Helper function to save messages to database
  const handleMessageSave = async (chatId, message, userId) => {
    try {
      console.log('[CHAT_DEBUG] Saving message to database:', { chatId, role: message.role });
      
      const messagePayload = {
        thread_id: chatId,
        role: message.role,
        content: message.content,
        timestamp: new Date().toISOString(),
        user_id: userId
      };
      
      // Use the imported saveMessage utility
      const savedMessage = await saveMessage(messagePayload, userId);
      console.log('[CHAT_DEBUG] Message saved successfully:', savedMessage.id);
    } catch (error) {
      console.error('[CHAT_DEBUG] Error saving message:', error);
    }
  };

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

      {/* Messages container - fixed bottom-up flow */}
      <ScrollArea
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto px-3 sm:px-4 touch-pan-y"
      >
        {/* This inner div will be the actual container for messages and text selection */}
        <div 
          ref={chatContainerRef} 
          className={`flex flex-col space-y-4 sm:space-y-6 py-4 sm:py-6 mb-32 sm:mb-36 transition-all duration-300 ease-in-out ${currentChat?.messages?.length <= 1 ? 'min-h-[calc(100vh-200px)] justify-end items-center' : 'justify-start items-center'}`}>
          {/* First message or empty state when no messages */}
          {!currentChat?.messages?.length ? (
            (isInitiating || isLoading) ? (
              <div className="flex w-full max-w-4xl justify-start">
                <div className="flex items-start space-x-3 max-w-[85%] sm:max-w-[80%]">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-muted text-muted-foreground">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl px-4 py-3 shadow-sm bg-muted/60 text-foreground">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                  Initializing {selectedTool ? TOOLS[selectedTool].name : "chat"}…
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-6 text-center max-w-md">
                <div className="p-4 rounded-full bg-muted/30">
                  <MessageCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-foreground">
                    {selectedTool && TOOLS[selectedTool] 
                      ? `Ready to use ${TOOLS[selectedTool].name}` 
                      : "Ready to chat"
                    }
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedTool && TOOLS[selectedTool] 
                      ? `${TOOLS[selectedTool].name} will start automatically. ${TOOLS[selectedTool].description || ''}`
                      : "Start a conversation or use one of the specialized tools from the sidebar."
                    }
                  </p>
                </div>
                {/* Removed the explicit Start Tool button here to restore automatic initialization */}
              </div>
            )
          ) : (
            // Render all messages including the first one
            currentChat.messages.map((message, index) => {
              const isLastMessage = index === currentChat.messages.length - 1;
              const isUser = message.role === 'user';
              
              const isCurrentStream = streamingMessageId && message.id === streamingMessageId;

              // Special rendering for LandingPageMessage - RENDER DIRECTLY WITHOUT BUBBLE WRAPPER
              if (isLandingPageMessage(message)) {
                return (
                  <LandingPageMessage 
                    key={`${message.id}-landing-${index}`} 
                    content={message.content} 
                  />
                );
              }

              // Standard message rendering starts here (WITH BUBBLE WRAPPER)
              // Handle streaming messages
              if (message.isStreaming || isCurrentStream) { // Consolidate streaming check
                return (
                  <div
                    key={message.id} // Use message.id as key
                    className={`flex w-full max-w-4xl ${isUser ? 'justify-end' : 'justify-start'}`}
                    data-message-id={message.id}
                    data-chat-id={currentChat?.id}
                    data-message-role={message.role}
                    ref={isLastMessage ? lastMessageRef : null}
                  >
                    {/* This inner div is the actual bubble for streaming messages */}
                    <div
                      className={`flex items-start space-x-3 max-w-[85%] sm:max-w-[80%] ${
                        isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'
                      }`}
                    >
                       <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          isUser
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {isUser ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </div>
                      <div
                        className={`rounded-2xl px-4 py-3 shadow-sm ${
                          isUser
                            ? 'bg-primary text-primary-foreground ml-auto'
                            : 'bg-muted/60 text-foreground'
                        }`}
                      >
                        <StreamingMessage
                          content={message.content}
                          isComplete={!message.isStreaming} // isStreaming will be false when stream ends
                        />
                      </div>
                    </div>
                  </div>
                );
              }
              // Handle error messages that might have come from streaming or other issues
              if (message.isError) {
                 return (
                  <div
                    key={message.id}
                    className={`flex w-full max-w-4xl justify-start`} // Errors are always from assistant (left)
                    ref={isLastMessage ? lastMessageRef : null}
                  >
                    <div className={`flex items-start space-x-3 max-w-[85%] sm:max-w-[80%] flex-row`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-muted text-muted-foreground`}>
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className={`rounded-2xl px-4 py-3 shadow-sm bg-destructive/10 text-destructive-foreground`}>
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }

              // Standard, non-streaming, non-error, non-landing page messages
              return (
                <div
                  key={message.id} // Use message.id as key
                  className={`flex w-full max-w-4xl ${isUser ? 'justify-end' : 'justify-start'}`}
                      data-message-id={message.id}
                      data-chat-id={currentChat?.id}
                      data-message-role={message.role}
                  ref={isLastMessage ? lastMessageRef : null}
                >
                  <div
                    className={`flex items-start space-x-3 max-w-[85%] sm:max-w-[80%] ${
                      isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        isUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isUser ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>

                    <div
                      className={`rounded-2xl px-4 py-3 shadow-sm ${
                        isUser
                          ? 'bg-primary text-primary-foreground ml-auto'
                          : 'bg-muted/60 text-foreground'
                      }`}
                    >
                      {isUser ? (
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                          {message.content}
                        </p>
                            ) : (
                              <MarkdownMessage content={message.content} />
                      )}
                    </div>
                    </div>
                  </div>
                );
              })
          )}

          {/* Loading indicator for AI response (not user input loading) */}
          {isResponseLoading && !isStreaming && currentChat?.messages?.length > 0 && (
            <div className="flex w-full max-w-4xl justify-start">
              <div className="flex items-start space-x-3 max-w-[85%] sm:max-w-[80%]">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-muted text-muted-foreground">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl px-4 py-3 shadow-sm bg-muted/60 text-foreground">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
              </div>
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
          ref={textSelectionMenuRef} // Pass the ref here
          position={selectionPosition}
          onSaveSnippet={handleSaveSnippet}
          onCopy={handleCopyText}
          onClose={clearSelection} // CRITICAL: This ensures menu closes
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