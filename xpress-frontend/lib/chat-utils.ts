import { ChatMessage } from '@/lib/realtime/types';

export function getClearHistoryStorageKey(userId: string): string {
  return `xpress.chat.cleared.${userId}`;
}

export function toPrivateRoomId(userAId: string, userBId: string): string {
  const [first, second] = [userAId, userBId].sort();
  return `${first}:${second}`;
}

export function toAgeLabel(isoTimestamp: string): string {
  const at = new Date(isoTimestamp).getTime();
  if (Number.isNaN(at)) return 'vài giây trước';

  const deltaMs = Math.max(0, Date.now() - at);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (deltaMs < minute) return 'vài giây trước';
  if (deltaMs < hour) return `${Math.floor(deltaMs / minute)} phút trước`;
  if (deltaMs < day) return `${Math.floor(deltaMs / hour)} giờ trước`;
  return `${Math.floor(deltaMs / day)} ngày trước`;
}

export function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((first, second) => {
    const timeDiff = first.createdAt.localeCompare(second.createdAt);
    if (timeDiff !== 0) return timeDiff;

    return first.messageId.localeCompare(second.messageId);
  });
}

export function mergeMessages(
  existing: ChatMessage[] = [],
  incoming: ChatMessage[] = [],
): ChatMessage[] {
  const merged = new Map<string, ChatMessage>();

  for (const message of existing) {
    merged.set(message.messageId, message);
  }

  for (const message of incoming) {
    merged.set(message.messageId, message);
  }

  return sortMessages(Array.from(merged.values()));
}

export function toMessagePreview(message: ChatMessage): string {
  if (message.isRecalled) {
    return 'Tin nhắn đã được thu hồi';
  }

  if (message.messageType === 'CALL_LOG') {
    return message.callLog?.mode === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại';
  }

  if (message.messageType === 'VIDEO') {
    return 'Đã gửi một video';
  }

  if (message.messageType === 'IMAGE') {
    return 'Đã gửi một ảnh';
  }
  
  if (message.messageType === 'FILE') {
    return 'Đã gửi một tệp';
  }

  if (message.messageType === 'SHARE_POST') {
    return 'Đã chia sẻ một bài viết';
  }

  return message.content;
}

export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined") return html;

  const div = document.createElement("div");
  div.innerHTML = html;

  const convertNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toUpperCase();
      let childrenVal = "";
      
      el.childNodes.forEach((child) => {
        childrenVal += convertNode(child);
      });

      switch (tagName) {
        case "B":
        case "STRONG":
          return `**${childrenVal}**`;
        case "I":
        case "EM":
          return `*${childrenVal}*`;
        case "DEL":
        case "S":
        case "STRIKE":
          return `~~${childrenVal}~~`;
        case "U":
          return `<u>${childrenVal}</u>`;
        case "SPAN": {
          const color = el.style.color;
          if (color) {
            return `<span style="color:${color}">${childrenVal}</span>`;
          }
          return childrenVal;
        }
        case "FONT": {
          const color = el.getAttribute("color");
          if (color) {
            return `<span style="color:${color}">${childrenVal}</span>`;
          }
          return childrenVal;
        }
        case "CODE":
          return `\`${childrenVal}\``;
        case "BLOCKQUOTE":
          return `> ${childrenVal}\n`;
        case "BR":
          return "\n";
        case "DIV":
        case "P":
          return `\n${childrenVal}`;
        default:
          return childrenVal;
      }
    }
    return "";
  };

  let markdown = "";
  div.childNodes.forEach((child) => {
    markdown += convertNode(child);
  });

  return markdown.trim();
}

export function markdownToHtml(md: string): string {
  if (!md) return "";
  let html = md;

  const savedTags: string[] = [];
  // Save <u> and </u>
  html = html.replace(/<\/?u>/g, (match) => {
    savedTags.push(match);
    return `___SAVED_TAG_${savedTags.length - 1}___`;
  });
  // Save <span style="color:..."> and </span>
  html = html.replace(/<span style="color:[^"]+">|<\/span>/g, (match) => {
    savedTags.push(match);
    return `___SAVED_TAG_${savedTags.length - 1}___`;
  });

  // Escape HTML tags to prevent XSS
  html = html
    .replace(/&/g, "&amp;")
    .replace(/&amp;amp;/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold (**bold**)
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic (*italic*)
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Strikethrough (~~strikethrough~~)
  html = html.replace(/~~(.*?)~~/g, "<del>$1</del>");
  // Inline code (`code`)
  html = html.replace(/`(.*?)`/g, "<code>$1</code>");
  // Blockquote (> blockquote)
  html = html.replace(/^&gt;\s+(.*)$/gm, "<blockquote>$1</blockquote>");
  
  // Restore saved tags
  savedTags.forEach((tag, index) => {
    html = html.replace(`___SAVED_TAG_${index}___`, tag);
  });

  // Line breaks
  html = html.replace(/\n/g, "<br>");
  
  return html;
}
