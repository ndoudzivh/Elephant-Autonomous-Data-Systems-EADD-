'use client';

import { useState } from 'react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useConversationStore } from '@/store/conversation';
import {
  Plus,
  MessageSquare,
  Search,
  Pin,
  Star,
  Trash2,
  MoreHorizontal,
  PanelLeftClose,
  Database,
  Settings,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const {
    conversations,
    activeConversationId,
    createConversation,
    setActiveConversation,
    deleteConversation,
  } = useConversationStore();

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <aside className="w-72 border-r border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">EADPA</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const id = createConversation();
              setActiveConversation(id);
            }}
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
            title="New conversation (Ctrl+Shift+N)"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search pipelines..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg 
                       focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                       placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Start by describing the pipeline you want to build
            </p>
          </div>
        ) : (
          filteredConversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setActiveConversation(conv.id)}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all group',
                'hover:bg-accent/50',
                activeConversationId === conv.id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground/80'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="truncate font-medium flex-1">{conv.title}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {conv.pinned && <Pin className="h-3 w-3 text-primary" />}
                  {conv.starred && <Star className="h-3 w-3 text-yellow-500" />}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="p-0.5 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {conv.messages.length > 0
                  ? conv.messages[conv.messages.length - 1].content.slice(0, 40)
                  : 'Empty conversation'}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                {formatRelativeTime(conv.updatedAt)}
              </p>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border">
        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
