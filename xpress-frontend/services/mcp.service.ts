import { authFetch } from '../lib/auth-client';
import { McpChatRequest, McpChatResponse, McpChatMessage } from '../types/mcp.type';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

export async function sendMcpMessage(data: McpChatRequest): Promise<McpChatResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const response = await authFetch(`${API_BASE_URL}/mcp/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMsg = 'Failed to send message to AI Assistant';
    try {
      const errorData = await response.json();
      errorMsg = errorData.message || errorMsg;
    } catch {
      // Ignore JSON parse error
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function getAiChatHistory(): Promise<McpChatMessage[]> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const response = await authFetch(`${API_BASE_URL}/mcp/chat/history`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch AI chat history');
  }

  return response.json();
}
