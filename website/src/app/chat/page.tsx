'use client';

import { useState, useRef, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://uaj2bmeq1c.execute-api.us-east-1.amazonaws.com';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setStreamingContent('');

    try {
      const res = await fetch(`${API_URL}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
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

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullContent,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setStreamingContent('');
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }]);
      setStreamingContent('');
    }

    setLoading(false);
  };

  return (
    <main className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">E</div>
          <span className="font-semibold">EADD Agent</span>
          <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">Online</span>
        </div>
        <a href="/" className="text-sm text-gray-400 hover:text-white">← Back to Home</a>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && !loading && (
            <div className="text-center py-20">
              <div className="text-4xl mb-4">🐘</div>
              <h2 className="text-xl font-bold mb-2">EADD AI Agent</h2>
              <p className="text-gray-400 mb-8">Describe the data pipeline you want to build</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {[
                  'Build a pipeline from PostgreSQL to S3 with quality checks',
                  'Create a star schema from my Salesforce data',
                  'Generate an Airflow DAG for daily ETL',
                  'Help me map source columns to a data warehouse',
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(suggestion); }}
                    className="text-left text-sm p-3 border border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-500/5 transition"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

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

          {/* Streaming response */}
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
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Describe the pipeline you want to build..."
            disabled={loading}
            className="flex-1 px-4 py-3 bg-[#111d35] border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
        <p className="text-center text-xs text-gray-600 mt-2">
          Powered by Amazon Bedrock AI • Free tier: 20 messages/day
        </p>
      </div>
    </main>
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
