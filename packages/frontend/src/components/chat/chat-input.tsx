'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Send, Square, Paperclip, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConversationStore } from '@/store/conversation';
import { sendMessage, stopGeneration } from '@/lib/api';

export function ChatInput() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    activeConversationId,
    isStreaming,
    createConversation,
    addMessage,
    setStreaming,
    appendToStreaming,
    resetStreaming,
    updateMessage,
  } = useConversationStore();

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    let convId = activeConversationId;
    if (!convId) {
      convId = createConversation();
    }

    // Add user message
    const userMsgId = crypto.randomUUID();
    addMessage(convId, {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      status: 'complete',
      createdAt: new Date().toISOString(),
    });

    setInput('');
    setStreaming(true);

    // Add placeholder assistant message
    const assistantMsgId = crypto.randomUUID();
    addMessage(convId, {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: new Date().toISOString(),
    });

    let fullContent = '';

    try {
      await sendMessage(convId, trimmed, {
        onContentDelta: (content) => {
          fullContent += content;
          appendToStreaming(content);
        },
        onToolCallStart: (toolCall) => {
          // Update message with tool call info
        },
        onArtifactCreated: (artifact) => {
          // Handle artifact creation
        },
        onMessageEnd: (messageId, usage) => {
          updateMessage(convId!, assistantMsgId, {
            content: fullContent,
            status: 'complete',
            usage,
          });
          resetStreaming();
        },
        onError: (error) => {
          updateMessage(convId!, assistantMsgId, {
            content: fullContent || `Error: ${error.message}`,
            status: 'error',
          });
          resetStreaming();
        },
      });
    } catch (error: any) {
      updateMessage(convId, assistantMsgId, {
        content: `Connection error: ${error.message}`,
        status: 'error',
      });
      resetStreaming();
    }
  }, [input, isStreaming, activeConversationId, createConversation, addMessage, setStreaming, appendToStreaming, resetStreaming, updateMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleStop = () => {
    if (activeConversationId) {
      stopGeneration(activeConversationId, '');
      resetStreaming();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (value: string) => {
    setInput(value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-2 bg-card border border-border rounded-2xl px-4 py-3 
                        focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent 
                        transition-all shadow-sm">
          {/* Attachment button */}
          <button
            className="p-1.5 hover:bg-accent rounded-lg transition-colors text-muted-foreground 
                       hover:text-foreground shrink-0 mb-0.5"
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Input area */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the pipeline you want to build..."
            rows={1}
            className="flex-1 resize-none bg-transparent border-0 focus:ring-0 focus:outline-none 
                       text-sm placeholder:text-muted-foreground max-h-[200px] py-0.5"
          />

          {/* Send / Stop button */}
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="p-2 bg-destructive text-destructive-foreground rounded-lg 
                         hover:bg-destructive/90 transition-colors shrink-0"
              title="Stop generating"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className={cn(
                'p-2 rounded-lg transition-all shrink-0',
                input.trim()
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
              title="Send message (Enter)"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between mt-2 px-2">
          <p className="text-[10px] text-muted-foreground/60">
            <Sparkles className="h-3 w-3 inline mr-1" />
            Powered by Claude via AWS Bedrock
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
