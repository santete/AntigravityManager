import {
  OpenAIChatRequest,
  OpenAIMessage,
  GeminiContent,
  GeminiPart,
  GeminiInlineData,
  AnthropicChatRequest,
  AnthropicMessage,
  AnthropicContent,
  ContentPart,
} from './types';
import { logger } from '../../utils/logger';

// Helper to extract text from content
function getTextFromContent(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content;
  return content
    .map((p) => {
      if (p.type === 'text') return p.text || '';
      return '';
    })
    .join('');
}

function getPreview(content: string | ContentPart[]): string {
  const text = getTextFromContent(content);
  return text.length > 200 ? text.substring(0, 200) + '...' : text;
}

export const Converter = {
  /**
   * Convert OpenAI messages to Gemini contents
   */
  convertOpenAIToGeminiContents(messages: OpenAIMessage[]): GeminiContent[] {
    const contents: GeminiContent[] = [];
    const pendingImages: GeminiInlineData[] = [];

    // Regex for markdown images: ![alt](data:image/png;base64,...)
    // Group 1: mime, Group 2: data
    const reMarkdown =
      /!\[.*?\]\(data:\s*(image\/[a-zA-Z+-]+)\s*;\s*base64\s*,\s*([a-zA-Z0-9+/=\s]+)\)/g;
    // Regex for explicit data URLs
    const reDataUrl = /data:\s*(image\/[a-zA-Z+-]+)\s*;\s*base64\s*,\s*([a-zA-Z0-9+/=\s]+)/;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      // logger.info(`Msg[${i}][${msg.role}] content=${getPreview(msg.content)}`);

      const role = msg.role === 'assistant' ? 'model' : msg.role === 'system' ? 'user' : msg.role;
      const parts: GeminiPart[] = [];

      // 1. Inject Pending Images from Assistant history to User
      if (role === 'user' && pendingImages.length > 0) {
        logger.info(`Injecting ${pendingImages.length} pending images to User message`);
        while (pendingImages.length > 0) {
          const img = pendingImages.shift();
          if (img) parts.push({ inlineData: img });
        }
      }

      // 2. Parse Content
      if (typeof msg.content === 'string') {
        const text = msg.content;
        let lastEnd = 0;
        let match;

        // Reset regex state
        reMarkdown.lastIndex = 0;

        while ((match = reMarkdown.exec(text)) !== null) {
          const matchStart = match.index;
          const matchEnd = reMarkdown.lastIndex;

          if (matchStart > lastEnd) {
            const textPart = text.substring(lastEnd, matchStart);
            if (textPart) parts.push({ text: textPart });
          }

          const mimeType = match[1];
          const data = match[2].replace(/\s/g, '');
          const inlineData = { mimeType, data };

          if (role === 'model') {
            pendingImages.push(inlineData);
          } else {
            parts.push({ inlineData });
          }
          lastEnd = matchEnd;
        }

        if (lastEnd < text.length) {
          const textPart = text.substring(lastEnd);
          if (textPart) parts.push({ text: textPart });
        }
      } else if (Array.isArray(msg.content)) {
        // Array format
        for (const part of msg.content) {
          if (part.type === 'text') {
            if (part.text) parts.push({ text: part.text });
          } else if (part.type === 'image_url' && part.image_url) {
            const url = part.image_url.url;
            const validMatch = url.match(reDataUrl);
            if (validMatch) {
              const mimeType = validMatch[1];
              const data = validMatch[2].replace(/\s/g, '');
              const inlineData = { mimeType, data };

              if (role === 'model') {
                pendingImages.push(inlineData);
              } else {
                parts.push({ inlineData });
              }
            } else {
              logger.warn(`Ignoring unsupported image URL format`);
            }
          }
        }
      }

      // 3. Fallbacks
      if (role === 'model' && parts.length === 0 && pendingImages.length > 0) {
        // Was likely just an image in assistant history, we moved it to pending.
        // But model message cannot be empty?
        // Actually the loop above pushes for 'model' into pendingImages ONLY if it matches helper logic.
        // If the loops finishes and we have parts, good.
        // If empty and we put stuff in pendingImages, we need a placeholder?
        parts.push({ text: '[Image Generated]' });
      }

      if (parts.length === 0) {
        parts.push({ text: '' });
      }

      contents.push({ role, parts });
    }

    // Merge User Messages
    return this.mergeConsecutiveUserMessages(contents);
  },

  convertAnthropicToGeminiContents(
    request: AnthropicChatRequest,
    signatureMap?: Map<string, string>,
  ): GeminiContent[] {
    const contents: GeminiContent[] = [];

    for (const msg of request.messages) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts: GeminiPart[] = [];

      const msgContent = Array.isArray(msg.content)
        ? msg.content
        : [{ type: 'text', text: msg.content } as AnthropicContent];

      for (const content of msgContent) {
        if (content.type === 'text' && content.text) {
          parts.push({ text: content.text });
        } else if (content.type === 'image' && content.source && content.source.type === 'base64') {
          parts.push({
            inlineData: {
              mimeType: content.source.media_type,
              data: content.source.data,
            },
          });
        } else if (content.type === 'thinking') {
          // Ignore thinking input
        }
      }

      // Thought Signature Injection (for Assistant)
      if (role === 'model' && signatureMap) {
        const latest = signatureMap.get('latest');
        if (latest) {
          parts.push({ thoughtSignature: latest });
        }
      }

      contents.push({ role, parts });
    }

    return this.mergeConsecutiveUserMessages(contents);
  },

  mergeConsecutiveUserMessages(contents: GeminiContent[]): GeminiContent[] {
    let i = 1;
    while (i < contents.length) {
      if (contents[i].role === 'user' && contents[i - 1].role === 'user') {
        const prev = contents[i - 1];
        const curr = contents[i];

        // Add separator if needed
        const prevLast = prev.parts[prev.parts.length - 1];
        const currFirst = curr.parts[0];

        if (prevLast && prevLast.text !== undefined && currFirst && currFirst.text !== undefined) {
          prev.parts.push({ text: '\n\n' });
        }

        prev.parts.push(...curr.parts);
        contents.splice(i, 1);
      } else {
        i++;
      }
    }
    return contents;
  },
};
