/**
 * API client for communicating with the EADPA backend.
 * Handles streaming SSE responses for the chat interface.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface StreamCallbacks {
  onContentDelta?: (content: string) => void;
  onToolCallStart?: (toolCall: any) => void;
  onToolCallEnd?: (toolCallId: string, result: any) => void;
  onThinkingStart?: (step: any) => void;
  onThinkingEnd?: (stepId: string) => void;
  onArtifactCreated?: (artifact: any) => void;
  onMessageEnd?: (messageId: string, usage: any) => void;
  onError?: (error: { code: string; message: string }) => void;
}

/**
 * Send a message to the agent with streaming response via SSE
 */
export async function sendMessage(
  conversationId: string,
  message: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const response = await fetch(`${API_BASE}/agent/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      message,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    callbacks.onError?.({ code: 'API_ERROR', message: error.message || 'Request failed' });
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);

      if (data === '[DONE]') return;

      try {
        const event = JSON.parse(data);
        switch (event.type) {
          case 'content_delta':
            callbacks.onContentDelta?.(event.content);
            break;
          case 'tool_call_start':
            callbacks.onToolCallStart?.(event.tool_call);
            break;
          case 'tool_call_end':
            callbacks.onToolCallEnd?.(event.tool_call_id, event.result);
            break;
          case 'thinking_start':
            callbacks.onThinkingStart?.(event.step);
            break;
          case 'thinking_end':
            callbacks.onThinkingEnd?.(event.step_id);
            break;
          case 'artifact_created':
            callbacks.onArtifactCreated?.(event.artifact);
            break;
          case 'message_end':
            callbacks.onMessageEnd?.(event.message_id, event.usage);
            break;
          case 'error':
            callbacks.onError?.(event);
            break;
        }
      } catch (e) {
        // Skip malformed JSON lines
      }
    }
  }
}

export async function stopGeneration(conversationId: string, messageId: string) {
  await fetch(`${API_BASE}/agent/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
    body: JSON.stringify({ conversation_id: conversationId, message_id: messageId }),
  });
}

export async function regenerateResponse(conversationId: string, messageId: string) {
  return fetch(`${API_BASE}/agent/regenerate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
    body: JSON.stringify({ conversation_id: conversationId, message_id: messageId }),
  });
}

function getToken(): string {
  // In development, return a mock token
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('eadpa_token') || 'dev-token';
}
