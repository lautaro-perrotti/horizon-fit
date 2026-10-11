import type { ProviderComplete } from "./gateway.js";

export function createOpenAiCompatibleComplete(options: {
  apiKey: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}): ProviderComplete {
  const endpoint = options.endpoint ?? "https://api.openai.com/v1/chat/completions";
  const fetchImpl = options.fetchImpl ?? fetch;
  return async ({ model, messages, max_tokens }) => {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(45_000),
      headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        max_tokens,
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) throw new Error(`openai_http_${response.status}`);
    const body = (await response.json()) as {
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      choices?: Array<{ message?: { content?: string } }>;
    };
    return {
      text: body.choices?.[0]?.message?.content ?? "",
      input_tokens: Number.isFinite(body.usage?.prompt_tokens) ? Number(body.usage?.prompt_tokens) : null,
      output_tokens: Number.isFinite(body.usage?.completion_tokens) ? Number(body.usage?.completion_tokens) : null,
    };
  };
}
