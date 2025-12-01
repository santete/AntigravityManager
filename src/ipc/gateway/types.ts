export interface ProxyToken {
  account_id: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  timestamp: number;
  email: string;
  account_path: string;
  project_id?: string;
  session_id: string;
}

// OpenAI Types
export interface OpenAIMessage {
  role: string;
  content: string | ContentPart[];
  name?: string;
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  size?: string;
  quality?: string;
  user?: string;
  [key: string]: any; // Extra params
}

// Anthropic Types
export interface AnthropicContent {
  type: 'text' | 'image' | 'thinking';
  text?: string; // for text or thinking
  thinking?: string;
  signature?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface AnthropicMessage {
  role: string;
  content: AnthropicContent[] | string; // Can be string in some clients
  thought_signature?: string;
}

export interface AnthropicChatRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string | any[]; // System prompt
  max_tokens?: number;
  metadata?: any;
  stop_sequences?: string[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  top_k?: number;
}

// Gemini Types
export interface GeminiInlineData {
  mimeType: string;
  data: string;
}

export interface GeminiPart {
  text?: string;
  inlineData?: GeminiInlineData;
  thoughtSignature?: string;
}

export interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}
