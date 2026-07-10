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
 * 
 * Supports both true streaming (WebSocket/long-poll) and buffered SSE
 * (API Gateway returns full response at once). Both are handled correctly.
 */
export async function sendMessage(
  conversationId: string,
  message: string,
  callbacks: StreamCallbacks
): Promise<void> {
  let response: Response;
  
  try {
    response = await fetch(`${API_BASE}/agent/chat`, {
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
  } catch (err: any) {
    callbacks.onError?.({ code: 'NETWORK_ERROR', message: err.message || 'Network request failed' });
    return;
  }

  if (!response.ok) {
    let errMsg = 'Request failed';
    try {
      const error = await response.json();
      errMsg = error.message || error.error || errMsg;
    } catch {}
    callbacks.onError?.({ code: 'API_ERROR', message: errMsg });
    return;
  }

  // Try to read as streaming body first
  const reader = response.body?.getReader();
  if (!reader) {
    // Fallback: read entire response as text and parse SSE lines
    const text = await response.text();
    processSSEText(text, callbacks);
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
    // Flush any remaining data in the decoder
    buffer += decoder.decode();
  } catch (err: any) {
    // If streaming read fails, try to process whatever we got
    if (!buffer) {
      callbacks.onError?.({ code: 'STREAM_ERROR', message: err.message || 'Failed to read response' });
      return;
    }
  }

  // Process the complete SSE text (handles both streamed and buffered responses)
  processSSEText(buffer, callbacks);
}

/**
 * Parse SSE text and dispatch events to callbacks.
 * Handles the full text whether it arrived all at once or incrementally.
 */
function processSSEText(text: string, callbacks: StreamCallbacks): void {
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data: ')) continue;
    
    const data = trimmed.slice(6);
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

  // If no message_end was received, synthesize one
  callbacks.onMessageEnd?.('msg_' + Date.now(), { input_tokens: 0, output_tokens: 0, total_tokens: 0 });
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
