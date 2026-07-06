'use client';

import { useRef, useEffect } from 'react';
import { useConversationStore } from '@/store/conversation';
import { MessageBubble } from './message-bubble';
import { ChatInput } from './chat-input';
import { WelcomeScreen } from './welcome-screen';
import { PanelLeft } from 'lucide-react';

interface ChatAreaProps {
  onToggleSidebar: () => void;
  onOpenArtifact: () => void;
}

export function ChatArea({ onToggleSidebar, onOpenArtifact }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    activeConversationId,
    conversations,
    isStreaming,
    streamingContent,
  } = useConversationStore();

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const messages = activeConversation?.messages || [];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingContent]);

  return (
    <div className="flex flex-col h-full">
      {/* Header Bar */}
      <header className="h-12 border-b border-border flex items-center px-4 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 hover:bg-accent rounded-md transition-colors mr-3"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate">
            {activeConversation?.title || 'EADPA'}
          </h1>
        </div>
        {activeConversation && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{messages.length} messages</span>
          </div>
        )}
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {!activeConversation || messages.length === 0 ? (
          <WelcomeScreen />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onArtifactClick={onOpenArtifact}
              />
            ))}

            {/* Streaming message */}
            {isStreaming && streamingContent && (
              <MessageBubble
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingContent,
                  status: 'streaming',
                  createdAt: new Date().toISOString(),
                }}
                onArtifactClick={onOpenArtifact}
                isStreaming
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <ChatInput />
    </div>
  );
}
