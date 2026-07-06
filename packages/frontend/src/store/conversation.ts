'use client';

import { create } from 'zustand';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  artifacts?: Artifact[];
  toolCalls?: ToolCall[];
  thinking?: ThinkingStep[];
  usage?: { input_tokens: number; output_tokens: number; estimated_cost_usd: number };
  createdAt: string;
}

interface Artifact {
  id: string;
  type: string;
  title: string;
  content: string;
  language?: string;
  version: number;
}

interface ToolCall {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'error';
  durationMs?: number;
}

interface ThinkingStep {
  id: string;
  title: string;
  content: string;
  status: 'in_progress' | 'complete';
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  starred?: boolean;
}

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeArtifact: Artifact | null;
  isStreaming: boolean;
  streamingContent: string;

  // Actions
  createConversation: () => string;
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  appendToStreaming: (content: string) => void;
  setStreaming: (isStreaming: boolean) => void;
  resetStreaming: () => void;
  setActiveArtifact: (artifact: Artifact | null) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  getActiveConversation: () => Conversation | undefined;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  activeArtifact: null,
  isStreaming: false,
  streamingContent: '',

  createConversation: () => {
    const id = crypto.randomUUID();
    const conversation: Conversation = {
      id,
      title: 'New Pipeline',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set(state => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: id,
    }));
    return id;
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id, activeArtifact: null });
  },

  addMessage: (conversationId, message) => {
    set(state => ({
      conversations: state.conversations.map(conv => {
        if (conv.id !== conversationId) return conv;
        const updated = {
          ...conv,
          messages: [...conv.messages, message],
          updatedAt: new Date().toISOString(),
        };
        // Auto-title from first user message
        if (conv.messages.length === 0 && message.role === 'user') {
          updated.title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
        }
        return updated;
      }),
    }));
  },

  updateMessage: (conversationId, messageId, updates) => {
    set(state => ({
      conversations: state.conversations.map(conv => {
        if (conv.id !== conversationId) return conv;
        return {
          ...conv,
          messages: conv.messages.map(msg =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          ),
        };
      }),
    }));
  },

  appendToStreaming: (content) => {
    set(state => ({ streamingContent: state.streamingContent + content }));
  },

  setStreaming: (isStreaming) => {
    set({ isStreaming });
  },

  resetStreaming: () => {
    set({ streamingContent: '', isStreaming: false });
  },

  setActiveArtifact: (artifact) => {
    set({ activeArtifact: artifact });
  },

  deleteConversation: (id) => {
    set(state => ({
      conversations: state.conversations.filter(c => c.id !== id),
      activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
    }));
  },

  renameConversation: (id, title) => {
    set(state => ({
      conversations: state.conversations.map(conv =>
        conv.id === id ? { ...conv, title } : conv
      ),
    }));
  },

  getActiveConversation: () => {
    const state = get();
    return state.conversations.find(c => c.id === state.activeConversationId);
  },
}));
