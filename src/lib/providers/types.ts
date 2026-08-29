export type ProviderName = "apimodels" | "haimaker";
export type ProviderProtocol = "openai" | "anthropic" | "gemini";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ProviderChatRequest = {
  upstreamModel: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  deepThink?: boolean;
};

export type ProviderChatResult = {
  response: Response;
  provider: ProviderName;
  protocol: ProviderProtocol;
};

export type NormalizedStreamEvent =
  | { type: "delta"; text: string }
  | { type: "usage"; inputTokens?: number; outputTokens?: number };

export type AsyncTaskResult = {
  taskId: string;
  state: "pending" | "processing" | "completed" | "failed";
  resultUrls?: string[];
  failMsg?: string;
  raw?: unknown;
};
