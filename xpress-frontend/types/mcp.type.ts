export interface McpChatMessage {
  messageId?: string;
  role: 'user' | 'ai';
  message: string;
  fileUrl?: string; // If user attached a file in this message
  createdAt?: string;
}

export interface McpChatRequest {
  message: string;
  fileUrl?: string;
}

export interface McpChatResponse {
  reply: string;
}