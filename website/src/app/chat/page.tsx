'use client';

import { useState, useRef, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://uaj2bmeq1c.execute-api.us-east-1.amazonaws.com';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: AttachedFile[];
}

interface AttachedFile {
  name: string;
  type: 'file' | 'image' | 'repo';
  size?: number;
  content?: string;
  preview?: string;
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
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [connectedRepo, setConnectedRepo] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msgText, attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedFiles([]);
    setLoading(true);
    setStreamingContent('');

    // Auto-resize textarea back
    if (inputRef.current) inputRef.current.style.height = 'auto';

    try {
      const res = await fetch(`${API_URL}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msgText + (userMsg.attachments?.length ? `\n\n[Attached files: ${userMsg.attachments.map(f => f.name).join(', ')}]${userMsg.attachments.filter(f => f.content).map(f => `\n\n--- File: ${f.name} ---\n${f.content?.slice(0, 5000)}`).join('')}` : ''),
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'file' | 'image') => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const newFile: AttachedFile = {
          name: file.name,
          type: fileType,
          size: file.size,
          content: fileType === 'file' ? reader.result as string : undefined,
          preview: fileType === 'image' ? reader.result as string : undefined,
        };
        setAttachedFiles(prev => [...prev, newFile]);
      };

      if (fileType === 'image') {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });

    // Reset input so same file can be re-uploaded
    e.target.value = '';
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
            <div className="max-w-3xl mx-auto">
              {/* Attached files preview */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {attachedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-lg text-xs">
                      <span>{file.type === 'image' ? '🖼️' : file.type === 'repo' ? '🔗' : '📄'}</span>
                      <span className="text-gray-300 max-w-[150px] truncate">{file.name}</span>
                      <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-500 hover:text-red-400">×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input row */}
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe what you need..."
                  rows={1}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-[#111d35] border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={(!input.trim() && attachedFiles.length === 0) || loading}
                  className="absolute right-3 top-3 p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-lg transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>

              {/* Toolbar row — Kiro style */}
              <div className="flex items-center justify-between mt-2 px-1">
                {/* Left: Action buttons (green/highlighted) */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2 py-1 text-green-400 hover:bg-green-400/10 rounded-md transition text-xs"
                    title="Upload file"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"/></svg>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2 py-1 text-green-400 hover:bg-green-400/10 rounded-md transition text-xs"
                    title="Attach file (CSV, SQL, YAML, requirements doc)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"/></svg>
                  </button>
                  <button
                    onClick={() => setShowRepoModal(true)}
                    className="flex items-center gap-1.5 px-2 py-1 text-green-400 hover:bg-green-400/10 rounded-md transition text-xs"
                    title="Connect GitHub/GitLab repo"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                    <span>{connectedRepo ? connectedRepo.split('/').pop() : 'Select repo'}</span>
                  </button>
                </div>

                {/* Right: Model + Mode */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">Nova Lite</span>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span>🤖</span>
                    <span>Autonomous</span>
                    <div className="w-8 h-4 bg-gray-700 rounded-full relative cursor-pointer">
                      <div className="w-3 h-3 bg-blue-500 rounded-full absolute top-0.5 right-0.5"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hidden file inputs */}
              <input ref={fileInputRef} type="file" className="hidden" accept=".csv,.json,.yaml,.yml,.sql,.py,.sas,.dtsx,.xml,.parquet,.txt,.md,.pdf,.doc,.docx" multiple onChange={(e) => handleFileUpload(e, 'file')} />
              <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} />
            </div>

            {/* Repo Connect Modal */}
            {showRepoModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRepoModal(false)}>
                <div className="bg-[#111d35] border border-gray-700 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                  <h3 className="font-bold text-lg mb-4">🔗 Connect Repository</h3>
                  <p className="text-sm text-gray-400 mb-4">Connect a GitHub or GitLab repo so EADD can analyze your existing code and pipelines.</p>
                  <input
                    type="text"
                    placeholder="https://github.com/username/repo"
                    className="w-full px-4 py-3 bg-[#0a1628] border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 mb-3"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value;
                        if (val) {
                          setConnectedRepo(val);
                          setAttachedFiles(prev => [...prev, { name: val.split('/').slice(-1)[0], type: 'repo' }]);
                          setShowRepoModal(false);
                        }
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowRepoModal(false)} className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm hover:bg-gray-800 transition">Cancel</button>
                    <button
                      onClick={() => {
                        const input = document.querySelector<HTMLInputElement>('[placeholder*="github"]');
                        if (input?.value) {
                          setConnectedRepo(input.value);
                          setAttachedFiles(prev => [...prev, { name: input.value.split('/').slice(-1)[0], type: 'repo' }]);
                          setShowRepoModal(false);
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition"
                    >Connect</button>
                  </div>
                </div>
              </div>
            )}
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
        // Render markdown-like text
        return <MarkdownText key={i} text={part} />;
      })}
    </>
  );
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let tableRows: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table detection
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (!inTable) { inTable = true; tableRows = []; }
      if (!line.match(/^\|[\s-|]+\|$/)) { // Skip separator rows
        tableRows.push(line);
      }
      continue;
    } else if (inTable) {
      // End of table
      elements.push(<SimpleTable key={`tbl-${i}`} rows={tableRows} />);
      tableRows = [];
      inTable = false;
    }

    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={i} className="my-3 border-gray-700" />);
      continue;
    }
    // Headers
    if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-base font-bold mt-4 mb-2">{renderInline(line.slice(3))}</h3>);
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={i} className="text-lg font-bold mt-4 mb-2">{renderInline(line.slice(2))}</h2>);
      continue;
    }
    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(<blockquote key={i} className="border-l-2 border-blue-500 pl-3 my-2 text-gray-300">{renderInline(line.slice(2))}</blockquote>);
      continue;
    }
    // Bullet list
    if (line.match(/^[\s]*[•\-\*]\s/)) {
      elements.push(<li key={i} className="ml-4 list-disc">{renderInline(line.replace(/^[\s]*[•\-\*]\s/, ''))}</li>);
      continue;
    }
    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      elements.push(<li key={i} className="ml-4 list-decimal">{renderInline(line.replace(/^\d+\.\s/, ''))}</li>);
      continue;
    }
    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }
    // Regular paragraph
    elements.push(<p key={i} className="my-0.5">{renderInline(line)}</p>);
  }

  // Flush any remaining table
  if (inTable && tableRows.length > 0) {
    elements.push(<SimpleTable key="tbl-end" rows={tableRows} />);
  }

  return <>{elements}</>;
}

function SimpleTable({ rows }: { rows: string[] }) {
  if (rows.length === 0) return null;
  const parseRow = (row: string) => row.split('|').filter(c => c.trim() !== '').map(c => c.trim());
  const header = parseRow(rows[0]);
  const body = rows.slice(1).map(parseRow);

  return (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-700">
            {header.map((h, i) => <th key={i} className="text-left py-1.5 px-2 text-gray-300 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-800">
              {row.map((cell, ci) => <td key={ci} className="py-1.5 px-2 text-gray-400">{renderInline(cell)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    }
    // Inline code: `text`
    const codeParts = part.split(/(`[^`]+`)/g);
    return codeParts.map((cp, j) => {
      if (cp.startsWith('`') && cp.endsWith('`')) {
        return <code key={`${i}-${j}`} className="px-1 py-0.5 bg-gray-800 rounded text-blue-300 text-xs">{cp.slice(1, -1)}</code>;
      }
      return <span key={`${i}-${j}`}>{cp}</span>;
    });
  });
}
