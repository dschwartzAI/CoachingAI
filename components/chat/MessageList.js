"use client";
import { useState } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, FileText, Download } from 'lucide-react';
import LoadingMessage from "@/components/LoadingMessage";
import MarkdownMessage from "./MarkdownMessage";

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

export function isDocumentMessage(message) {
  const hasDocumentContent = typeof message.content === 'string' &&
    (message.content.includes('Document generated successfully') ||
     message.content.includes('generating your document') ||
     message.content.includes('View Google Doc') ||
     message.content.includes('document-generation-status'));
  const hasDocumentMetadata = message.metadata?.documentLinks &&
    Object.values(message.metadata.documentLinks).some(link => link);
  return hasDocumentContent || hasDocumentMetadata;
}

function HTMLContent({ content }) {
  const cleanContent = (raw) => {
    if (!raw) return '';
    let cleaned = raw.replace(/\n\nLink:\s*https?:\/\/[^\s]+/g, '');
    cleaned = cleaned.replace(/Link:\s*https?:\/\/[^\s]+/g, '');
    return cleaned.trim();
  };
  const processContent = () => {
    const cleanedContent = cleanContent(content);
    if (!cleanedContent) return '';
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanedContent;
      const links = [];
      const linkElements = tempDiv.querySelectorAll('a');
      linkElements.forEach((link, i) => {
        links.push({
          href: link.getAttribute('href'),
          text: link.textContent,
          isDownload: link.hasAttribute('download'),
          outerHTML: link.outerHTML,
          index: i
        });
      });
      if (links.length === 0) {
        return <span>{cleanedContent.replace(/<[^>]*>/g, '')}</span>;
      }
      let remaining = cleanedContent;
      const fragments = [];
      links.forEach((link, i) => {
        const idx = remaining.indexOf(link.outerHTML);
        if (idx >= 0) {
          if (idx > 0) {
            fragments.push({ type: 'text', content: remaining.substring(0, idx).replace(/<[^>]*>/g, ''), key: `text-${i}` });
          }
          fragments.push({ type: 'link', href: link.href, text: link.text, isDownload: link.isDownload, key: `link-${i}` });
          remaining = remaining.substring(idx + link.outerHTML.length);
        }
      });
      if (remaining) {
        fragments.push({ type: 'text', content: remaining.replace(/<[^>]*>/g, ''), key: 'text-final' });
      }
      return (
        <div className="space-y-2">
          {fragments.map(fragment => fragment.type === 'text' ? (
            <span key={fragment.key}>{fragment.content}</span>
          ) : (
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
          ))}
        </div>
      );
    } catch (error) {
      console.error('Error processing HTML content:', error);
      return <span>{cleanContent(content).replace(/<[^>]*>/g, '')}</span>;
    }
  };
  if (typeof document !== 'undefined') {
    return processContent();
  }
  return <div dangerouslySetInnerHTML={{ __html: cleanContent(content) }} />;
}

function DocumentMessage({ message }) {
  const isGenerationStatus = typeof message.content === 'string' && message.content.includes('document-generation-status');
  if (isGenerationStatus) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">I'm generating your document now</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-xs text-center">This typically takes about 1 minute to complete.</p>
          <p className="text-xs text-muted-foreground max-w-xs text-center">You'll receive a notification and the document will appear here when it's ready.</p>
        </div>
      </div>
    );
  }
  const documentLinks = message.metadata?.documentLinks;
  const extracted = extractN8nLinks(message.content);
  const contentHasHtml = typeof message.content === 'string' && message.content.includes('<a href');
  const docLink = documentLinks?.googleDocLink || extracted.googleDocLink;
  return (
    <div className="space-y-3">
      <div>
        {message.content.includes('<a href') ? (
          <HTMLContent content={message.content} />
        ) : (
          <MarkdownMessage content={message.content} />
        )}
      </div>
      {docLink && !contentHasHtml && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-green-800 font-medium">
            <CheckCircle2 className="h-5 w-5" />
            Your document is ready!
          </div>
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-green-600" />
            <a href={docLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline break-all">
              View Google Doc
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function LandingPageMessage({ content }) {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const extractHTMLCode = (text) => {
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
    return <MarkdownMessage content={content} />;
  }
  return (
    <div className="space-y-4">
      <div>
        <MarkdownMessage content={content.replace(/```html\n[\s\S]*?\n```/g, '').replace(/```\n<!DOCTYPE html[\s\S]*?<\/html>\n```/g, '').replace(/<!DOCTYPE html[\s\S]*?<\/html>/g, '').trim()} />
      </div>
      <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm">Landing Page HTML</h4>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="text-xs">
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </Button>
            <Button variant="outline" size="sm" onClick={copyToClipboard} className="text-xs">
              {copied ? 'Copied!' : 'Copy HTML'}
            </Button>
            <Button variant="outline" size="sm" onClick={downloadHTML} className="text-xs">
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          </div>
        </div>
        {showPreview && (
          <div className="mb-4">
            <div className="border rounded bg-white" style={{ height: '400px' }}>
              <iframe srcDoc={htmlCode} className="w-full h-full rounded" title="Landing Page Preview" sandbox="allow-same-origin" />
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

function isLandingPageMessage(message) {
  if (typeof message.content !== 'string') return false;
  const hasHTMLCode = message.content.includes('```html') ||
                     message.content.includes('<!DOCTYPE html') ||
                     (message.content.includes('<html') && message.content.includes('</html>'));
  return hasHTMLCode;
}

export default function MessageList({ currentChat, user, isWaitingForN8n, isResponseLoading, lastMessageRef, scrollAreaRef }) {
  return (
    <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-auto">
      <div className="flex flex-col gap-4 p-4 pb-20">
        {!currentChat.messages || currentChat.messages.length === 0 ? (
          <div className="text-center text-muted-foreground space-y-2">
            <h3 className="text-lg font-semibold">
              {currentChat.tool_id ? 'Answer the questions to generate your document.' : 'What can I help with?'}
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              {currentChat.tool_id ? 'Provide the requested details and we\'ll create your content.' : 'Ask me anything related to your business.'}
            </p>
          </div>
        ) : (
          currentChat.messages
            .filter((message) => {
              const isGenerationStatus = typeof message.content === 'string' &&
                message.content.includes('document-generation-status');
              if (isGenerationStatus) {
                const hasCompletedDocuments = currentChat.messages.some(msg =>
                  isDocumentMessage(msg) && !msg.content.includes('document-generation-status')
                );
                const isDocumentComplete = currentChat.metadata?.documentGenerated === true ||
                  currentChat.metadata?.isGeneratingDocument === false;
                if (hasCompletedDocuments || isDocumentComplete) {
                  return false;
                }
              }
              return true;
            })
            .map((message, index, filteredArray) => {
              const isLastMessage = index === filteredArray.length - 1;
              return (
                <div
                  key={message.id || `message-${index}`}
                  className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} `}
                  ref={isLastMessage ? lastMessageRef : null}
                >
                  <div
                    className={`
                      flex items-start gap-2 sm:gap-3 max-w-[90%] sm:max-w-[85%]
                      ${message.role === 'user' ? 'flex-row-reverse' : ''}
                    `}
                  >
                    {message.role === 'user' ? (
                      <Avatar className="h-8 w-8 sm:h-9 sm:w-9 mt-0.5">
                        <AvatarImage src="" alt="User" />
                        <div className="flex items-center justify-center h-full w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium">
                          {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      </Avatar>
                    ) : (
                      <Avatar className="h-8 w-8 sm:h-9 sm:w-9 mt-0.5">
                        <AvatarImage src="" alt="Assistant" />
                        <div className="flex items-center justify-center h-full w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium">
                          J
                        </div>
                      </Avatar>
                    )}
                    <div
                      className={`
                        relative p-3 sm:p-4 rounded-lg text-sm sm:text-base space-y-1.5
                        ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}
                      `}
                    >
                      {message.is_thinking ? (
                        <LoadingMessage content={message.content} role={message.role} />
                      ) : (
                        <>
                          {isDocumentMessage(message) ? (
                            <DocumentMessage message={message} />
                          ) : isLandingPageMessage(message) ? (
                            <LandingPageMessage content={message.content} />
                          ) : (
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
                </div>
              );
            })
        )}

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

        {isResponseLoading && !isWaitingForN8n && (
          <div className="flex items-start gap-3">
            <Avatar className="h-9 w-9 mt-0.5">
              <AvatarImage src="" alt="Assistant" />
              <div className="flex items-center justify-center h-full w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium">
                J
              </div>
            </Avatar>
            <div className="bg-muted p-4 rounded-lg">
              <LoadingMessage role="assistant" />
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
