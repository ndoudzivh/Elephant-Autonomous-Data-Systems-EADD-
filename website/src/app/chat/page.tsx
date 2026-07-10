'use client';

import { useState, useRef, useCallback, KeyboardEvent, useEffect } from 'react';
import { Send, Square } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { id: 'u_' + Date.now(), role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    let fullContent = '';
    const assistantId = 'a_' + Date.now();

    try {
      const response = await fetch(`${API_BASE}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: 'conv_1', message: trimmed }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const text = await response.text();
        processSSE(text, (content) => { fullContent += content; });
        setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: fullContent }]);
        setIsLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }
      buffer += decoder.decode();

      processSSE(buffer, (content) => { fullContent += content; });
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: fullContent }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    }

    setIsLoading(false);
  }, [input, isLoading]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a1628] text-white">
      {/* Header */}
      <header className="h-14 border-b border-white/10 flex items-center px-6">
        <span className="font-semibold">EADD Agent</span>
        <span className="ml-3 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Online</span>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-20">
              <p className="text-2xl mb-2">Welcome to EADD</p>
              <p className="text-sm">Ask me to build a data pipeline, estimate costs, or explain data engineering concepts.</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm'
              }`}>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{msg.content}</pre>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                <span className="text-sm text-gray-400 animate-pulse">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-4">
        <div className="max-w-3xl mx-auto flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you need..."
            rows={1}
            className="flex-1 resize-none bg-transparent border-0 focus:ring-0 focus:outline-none text-sm placeholder:text-gray-500"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className={`p-2 rounded-lg transition ${input.trim() && !isLoading ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-white/10 text-gray-500 cursor-not-allowed'}`}
          >
            {isLoading ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-500 mt-2">Powered by EADD Multi-Agent AI</p>
      </div>
    </div>
  );
}

function processSSE(text: string, onContent: (content: string) => void) {
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data: ')) continue;
    const data = trimmed.slice(6);
    if (data === '[DONE]') return;
    try {
      const event = JSON.parse(data);
      if (event.type === 'content_delta' && event.content) {
        onContent(event.content);
      }
    } catch {}
  }
}
