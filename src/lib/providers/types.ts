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
  provider: string;
  protocol: ProviderProtocol;
  providerRequestId?: string;
  providerReportedCost?: { amount: string; currency: "USD" };
};

export type NormalizedProviderUsage = {
  inputTokens?: string;
  outputTokens?: string;
  cachedInputTokens?: string;
  cacheWriteTokens?: string;
  reasoningTokens?: string;
  providerRequestId?: string;
  providerReportedCost?: { amount: string; currency: "USD" | "PKR" | "CREDIT" };
};

export type NormalizedStreamEvent =
  | { type: "delta"; text: string }
  | ({ type: "usage" } & NormalizedProviderUsage);

export type AsyncTaskResult = {
  taskId: string;
  state: "pending" | "processing" | "completed" | "failed";
  resultUrls?: string[];
  failMsg?: string;
  providerReportedCost?: { amount: string; currency: "USD" };
  raw?: unknown;
};
