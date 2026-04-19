import { useState, useEffect } from 'react';
import { sendMcpMessage, getAiChatHistory } from '@/services/mcp.service';
import { ChatMessage, MessageType } from '@/lib/realtime/types';

export function useAiChat(currentUserId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    async function loadHistory() {
      setIsLoading(true);
      try {
        const history = await getAiChatHistory();
        const mappedHistory: ChatMessage[] = history.map((msg) => ({
          messageId: msg.messageId || `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conversationId: 'AI_ASSISTANT',
          senderId: msg.role === 'ai' ? 'AI_ASSISTANT' : currentUserId,
          receiverId: msg.role === 'ai' ? currentUserId : 'AI_ASSISTANT',
          content: msg.message,
          messageType: msg.fileUrl ? 'FILE' : 'TEXT',
          fileUrl: msg.fileUrl,
          isDeleted: false,
          isRecalled: false,
          createdAt: msg.createdAt || new Date().toISOString(),
          updatedAt: msg.createdAt || new Date().toISOString(),
        }));
        setMessages(mappedHistory);
      } catch (error) {
        console.error('Failed to load AI chat history:', error);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    }
    loadHistory();
  }, [currentUserId]);

  // We rely on the existing MessageInput to handle S3 uploads explicitly
  const handleSend = async (content: string, fileUrl?: string, messageType?: MessageType, fileName?: string, fileSize?: number, mimeType?: string) => {
    
    // 1. Add User Message immediately
    const userMessageId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userMessage: ChatMessage = {
      messageId: userMessageId,
      conversationId: "AI_ASSISTANT",
      senderId: currentUserId,
      receiverId: "AI_ASSISTANT",
      content,
      messageType: messageType || "TEXT",
      fileUrl,
      fileName,
      fileSize,
      mimeType,
      isDeleted: false,
      isRecalled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // 2. Call backend for MCP execution / LLM response
      const response = await sendMcpMessage({ message: content, fileUrl });
      
      // 3. Render AI Response
      const aiMessage: ChatMessage = {
        messageId: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conversationId: "AI_ASSISTANT",
        senderId: "AI_ASSISTANT",
        receiverId: currentUserId,
        content: response.reply,
        messageType: "TEXT",
        isDeleted: false,
        isRecalled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const errorMsg: ChatMessage = {
        messageId: `ai-error-${Date.now()}`,
        conversationId: "AI_ASSISTANT",
        senderId: "AI_ASSISTANT",
        receiverId: currentUserId,
        content: `[Lỗi] Không thể kết nối tới AI Assistant: ${(error as Error).message}`,
        messageType: "TEXT",
        isDeleted: false,
        isRecalled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (confirm('Bạn có chắc muốn xóa lịch sử trò chuyện cục bộ này?')) {
      setMessages([]);
    }
  };

  return {
    messages,
    isLoading,
    isInitialized,
    handleSend,
    clearChat,
  };
}
