'use client';

import { useState, useRef, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://uaj2bmeq1c.execute-api.us-east-1.amazonaws.com';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  date: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const startNewChat = () => {
    if (messages.length > 0) {
      setConversations(prev => [{
        id: Date.now().toString(),
        title: messages[0]?.content.slice(0, 40) || 'New chat',
        date: 'Just now',
      }, ...prev]);
    }
    setMessages([]);
    setStreamingContent('');
    inputRef.current?.focus();
  };

  const sendMessage = async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msgText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setStreamingContent('');

    // Auto-resize textarea back
    if (inputRef.current) inputRef.current.style.height = 'auto';

    try {
      const res = await fetch(`${API_URL}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msgText,
          conversation_id: 'chat-1',
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const event = JSON.parse(data);
            if (event.type === 'content_delta') {
              fullContent += event.content;
              setStreamingContent(fullContent);
            }
          } catch {}
        }
      }

      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: fullContent }]);
      setStreamingContent('');
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
      setStreamingContent('');
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  const showWelcome = messages.length === 0 && !loading;

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="w-64 bg-[#0d1520] border-r border-gray-800 flex flex-col">
          {/* New Chat Button */}
          <div className="p-3">
            <button
              onClick={startNewChat}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition"
            >
              <span className="text-blue-400">+</span> New chat
              <span className="ml-auto text-xs text-gray-600">Ctrl+N</span>
            </button>
          </div>

          {/* Conversation History */}
          <div className="flex-1 overflow-y-auto px-3">
            {conversations.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 px-2 mb-1">Recents</p>
                {conversations.map(conv => (
                  <button key={conv.id} className="w-full text-left px-2 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-md truncate transition">
                    {conv.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bottom */}
          <div className="p-3 border-t border-gray-800">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">D</div>
              <span className="text-sm text-gray-300">Daniel</span>
              <span className="text-xs text-blue-400 ml-auto">Free</span>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-12 flex items-center px-4 border-b border-gray-800/50">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-gray-800 rounded-md mr-3 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <span className="text-sm text-gray-400">EADD Agent</span>
          <span className="ml-2 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">Nova Lite</span>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {showWelcome ? (
            /* Welcome Screen - Claude style */
            <div className="flex flex-col items-center justify-center h-full px-6">
              <div className="max-w-2xl w-full text-center">
                <h1 className="text-3xl md:text-4xl font-semibold mb-10">
                  <span className="text-blue-400">🐘</span> What pipeline shall we build?
                </h1>

                {/* Input Area */}
                <div className="relative mb-6">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="How can I help you today?"
                    rows={1}
                    className="w-full px-5 py-4 bg-[#111d35] border border-gray-700 rounded-2xl text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 resize-none text-base"
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="absolute right-3 bottom-3 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-lg transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                </div>

                {/* Category Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {[
                    { icon: '⚡', label: 'Pipeline' },
                    { icon: '📊', label: 'Star Schema' },
                    { icon: '🔄', label: 'ETL/ELT' },
                    { icon: '✅', label: 'Quality Checks' },
                    { icon: '☁️', label: 'Multi-Cloud' },
                    { icon: '🤖', label: 'AI picks' },
                  ].map((cat) => (
                    <button
                      key={cat.label}
                      onClick={() => {
                        const prompts: Record<string, string> = {
                          'Pipeline': 'Build me a data pipeline from PostgreSQL to S3 with Bronze/Silver/Gold layers',
                          'Star Schema': 'Help me design a star schema for an e-commerce data warehouse',
                          'ETL/ELT': 'Generate an incremental ELT pipeline with deduplication and SCD Type 2',
                          'Quality Checks': 'Generate data quality checks for a financial transactions table',
                          'Multi-Cloud': 'Build a pipeline that works on both AWS and Snowflake',
                          'AI picks': 'What can you help me build today?',
                        };
                        sendMessage(prompts[cat.label] || cat.label);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 border border-gray-700 rounded-full text-sm text-gray-300 hover:border-blue-500 hover:text-white hover:bg-blue-500/5 transition"
                    >
                      <span>{cat.icon}</span> {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map(msg => (
                <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : ''}>
                  <div className={msg.role === 'user'
                    ? 'bg-blue-600/20 border border-blue-500/20 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]'
                    : 'max-w-[90%]'
                  }>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">E</div>
                        <span className="text-xs text-gray-400">EADD Agent</span>
                      </div>
                    )}
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      <FormattedContent content={msg.content} />
                    </div>
                  </div>
                </div>
              ))}

              {streamingContent && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">E</div>
                    <span className="text-xs text-gray-400">EADD Agent</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    <FormattedContent content={streamingContent} />
                    <span className="inline-block w-0.5 h-4 bg-blue-400 animate-pulse ml-0.5"></span>
                  </div>
                </div>
              )}

              {loading && !streamingContent && (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">E</div>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:'0ms'}}></span>
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:'150ms'}}></span>
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:'300ms'}}></span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Input (when conversation is active) */}
        {!showWelcome && (
          <div className="border-t border-gray-800 px-4 py-4">
            <div className="max-w-3xl mx-auto relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask a follow-up..."
                rows={1}
                disabled={loading}
                className="w-full px-4 py-3 pr-12 bg-[#111d35] border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="absolute right-3 bottom-3 p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-lg transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function FormattedContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
          if (match) {
            return (
              <pre key={i} className="my-3 p-4 bg-black/40 border border-gray-700 rounded-lg overflow-x-auto text-xs font-mono">
                <div className="flex items-center justify-between mb-2 text-gray-500 text-[10px]">
                  <span>{match[1] || 'code'}</span>
                  <button onClick={() => navigator.clipboard.writeText(match[2])} className="hover:text-white">Copy</button>
                </div>
                <code>{match[2]}</code>
              </pre>
            );
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
