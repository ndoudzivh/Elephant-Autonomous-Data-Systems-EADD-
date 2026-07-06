'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Copy,
  Check,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  Bot,
  User,
  Code,
  FileText,
} from 'lucide-react';
import { CodeBlock } from './code-block';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  artifacts?: any[];
  toolCalls?: any[];
  thinking?: any[];
  usage?: { input_tokens: number; output_tokens: number; estimated_cost_usd: number };
  createdAt: string;
}

interface MessageBubbleProps {
  message: Message;
  onArtifactClick?: () => void;
  isStreaming?: boolean;
}

export function MessageBubble({ message, onArtifactClick, isStreaming }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = message.role === 'user';
  const isError = message.status === 'error';

  return (
    <div className={cn('animate-fade-in', isUser ? 'flex justify-end' : '')}>
      <div className={cn('flex gap-3 max-w-full', isUser ? 'flex-row-reverse max-w-[80%]' : '')}>
        {/* Avatar */}
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-accent border border-border'
        )}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>

        {/* Message Content */}
        <div className={cn('flex-1 min-w-0', isUser ? 'text-right' : '')}>
          {/* User message */}
          {isUser && (
            <div className="inline-block text-left bg-primary/10 rounded-2xl rounded-tr-md px-4 py-2.5 text-sm">
              {message.content}
            </div>
          )}

          {/* Assistant message */}
          {!isUser && (
            <div className="space-y-2">
              {/* Thinking indicator */}
              {message.thinking && message.thinking.length > 0 && (
                <button
                  onClick={() => setShowThinking(!showThinking)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showThinking ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Thinking...
                </button>
              )}

              {/* Streaming indicator */}
              {isStreaming && !message.content && (
                <div className="typing-indicator flex items-center gap-1 py-2">
                  <span className="w-2 h-2 rounded-full bg-primary/60" />
                  <span className="w-2 h-2 rounded-full bg-primary/60" />
                  <span className="w-2 h-2 rounded-full bg-primary/60" />
                </div>
              )}

              {/* Content with markdown/code rendering */}
              <div className={cn(
                'prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed',
                isError && 'text-destructive',
                isStreaming && 'streaming-cursor'
              )}>
                <MessageContent content={message.content} />
              </div>

              {/* Artifacts */}
              {message.artifacts && message.artifacts.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {message.artifacts.map((artifact: any) => (
                    <button
                      key={artifact.id}
                      onClick={onArtifactClick}
                      className="flex items-center gap-2 px-3 py-2 bg-accent/50 border border-border 
                                 rounded-lg text-xs hover:bg-accent transition-colors"
                    >
                      {artifact.language === 'yaml' ? <FileText className="h-3.5 w-3.5" /> : <Code className="h-3.5 w-3.5" />}
                      <span className="font-medium">{artifact.title}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Actions bar */}
              {message.status === 'complete' && (
                <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                  <button
                    onClick={handleCopy}
                    className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy message"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="Regenerate"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="Good response"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="Bad response"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                  {message.usage && (
                    <span className="text-[10px] text-muted-foreground/50 ml-2">
                      {message.usage.input_tokens + message.usage.output_tokens} tokens
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Parse message content and render code blocks */
function MessageContent({ content }: { content: string }) {
  if (!content) return null;

  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
          if (match) {
            return <CodeBlock key={index} code={match[2]} language={match[1] || 'text'} />;
          }
        }

        // Render plain text with basic formatting
        return (
          <span key={index} className="whitespace-pre-wrap">
            {part.split('\n').map((line, i) => {
              if (line.startsWith('# ')) return <h3 key={i} className="text-base font-bold mt-4 mb-2">{line.slice(2)}</h3>;
              if (line.startsWith('## ')) return <h4 key={i} className="text-sm font-bold mt-3 mb-1">{line.slice(3)}</h4>;
              if (line.startsWith('- ')) return <li key={i} className="ml-4">{line.slice(2)}</li>;
              if (line.startsWith('**') && line.endsWith('**')) return <strong key={i}>{line.slice(2, -2)}</strong>;
              if (line.match(/^\d+\./)) return <li key={i} className="ml-4 list-decimal">{line.replace(/^\d+\.\s*/, '')}</li>;
              return <span key={i}>{line}{i < part.split('\n').length - 1 ? '\n' : ''}</span>;
            })}
          </span>
        );
      })}
    </>
  );
}
