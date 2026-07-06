/**
 * Conversation Service
 * Manages chat conversations, messages, and context
 */

import { v4 as uuidv4 } from 'uuid';
import type { Conversation, Message, PipelineContext } from '@eadpa/shared';

interface ConversationStore {
  [id: string]: Conversation;
}

// In-memory store for development; production uses DynamoDB
const store: ConversationStore = {};

export class ConversationService {
  async listConversations(params: {
    userId: string;
    workspaceId: string;
    page: number;
    limit: number;
    search?: string;
  }) {
    let conversations = Object.values(store)
      .filter(c => c.user_id === params.userId)
      .filter(c => c.status !== 'deleted')
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    if (params.search) {
      const query = params.search.toLowerCase();
      conversations = conversations.filter(c =>
        c.title.toLowerCase().includes(query) ||
        c.messages.some(m => m.content.toLowerCase().includes(query))
      );
    }

    const total = conversations.length;
    const offset = (params.page - 1) * params.limit;
    const items = conversations.slice(offset, offset + params.limit);

    return {
      items: items.map(c => ({
        id: c.id,
        title: c.title,
        status: c.status,
        pinned: c.pinned,
        starred: c.starred,
        tags: c.tags,
        message_count: c.messages.length,
        last_message_at: c.updated_at,
        pipeline_context: c.pipeline_context,
        created_at: c.created_at,
      })),
      total,
      page: params.page,
      limit: params.limit,
      has_more: offset + params.limit < total,
    };
  }

  async getConversation(id: string, userId: string) {
    const conversation = store[id];
    if (!conversation || conversation.user_id !== userId) {
      return null;
    }
    return conversation;
  }

  async createConversation(params: {
    userId: string;
    workspaceId: string;
    title: string;
    pipelineContext?: PipelineContext;
  }): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: uuidv4(),
      title: params.title,
      user_id: params.userId,
      workspace_id: params.workspaceId,
      status: 'active',
      messages: [],
      pipeline_context: params.pipelineContext,
      created_at: now,
      updated_at: now,
      pinned: false,
      starred: false,
      tags: [],
    };

    store[conversation.id] = conversation;
    return conversation;
  }

  async updateConversation(
    id: string,
    userId: string,
    updates: Partial<Pick<Conversation, 'title' | 'pinned' | 'starred' | 'status' | 'tags'>>
  ) {
    const conversation = store[id];
    if (!conversation || conversation.user_id !== userId) {
      throw new Error('Conversation not found');
    }

    Object.assign(conversation, {
      ...updates,
      updated_at: new Date().toISOString(),
    });

    return conversation;
  }

  async deleteConversation(id: string, userId: string) {
    const conversation = store[id];
    if (!conversation || conversation.user_id !== userId) {
      throw new Error('Conversation not found');
    }
    conversation.status = 'deleted';
    conversation.updated_at = new Date().toISOString();
  }

  async addMessage(conversationId: string, message: Message) {
    const conversation = store[conversationId];
    if (!conversation) throw new Error('Conversation not found');

    conversation.messages.push(message);
    conversation.updated_at = new Date().toISOString();

    // Auto-title from first user message
    if (conversation.messages.length === 1 && message.role === 'user') {
      conversation.title = this.generateTitle(message.content);
    }

    return message;
  }

  async forkConversation(id: string, userId: string, fromMessageId: string) {
    const original = store[id];
    if (!original || original.user_id !== userId) {
      throw new Error('Conversation not found');
    }

    const msgIndex = original.messages.findIndex(m => m.id === fromMessageId);
    if (msgIndex === -1) throw new Error('Message not found');

    const forked = await this.createConversation({
      userId,
      workspaceId: original.workspace_id,
      title: `${original.title} (fork)`,
      pipelineContext: original.pipeline_context,
    });

    forked.messages = original.messages.slice(0, msgIndex + 1).map(m => ({
      ...m,
      id: uuidv4(),
      conversation_id: forked.id,
    }));

    store[forked.id] = forked;
    return forked;
  }

  private generateTitle(content: string): string {
    // Extract a meaningful title from the first message
    const cleaned = content.replace(/\n/g, ' ').trim();
    if (cleaned.length <= 50) return cleaned;
    return cleaned.substring(0, 47) + '...';
  }
}
