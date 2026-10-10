import { NexusClient, NexusChatRequest } from "@/lib/nexus-client";

export interface NexusChatResult {
  reply: string | null;
  error?: string;
}

/**
 * Try to chat using the active Nexus device (user's local Nexus)
 * Returns null if no active device, not connected, or error
 */
export async function tryNexusChat(
  text: string,
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<NexusChatResult> {
  try {
    const activeDevice = NexusClient.getActiveDevice();
    if (!activeDevice) {
      return { reply: null, error: "No active Nexus device" };
    }

    const client = new NexusClient(activeDevice);

    // Check connection first
    const status = await client.checkConnection();
    if (!status.online) {
      return { reply: null, error: status.error ?? "Nexus offline" };
    }

    // Get available models
    const models = await client.listModels();
    const model = models[0] ?? "default";

    // Build messages
    const messages: NexusChatRequest["messages"] = [
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user", content: text },
    ];

    const request: NexusChatRequest = {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 512,
      top_p: 0.9,
    };

    const response = await client.chat({ ...request, signal: AbortSignal.timeout(30000) });

    const reply = response.choices?.[0]?.message?.content;
    if (reply) {
      return { reply: reply.trim() };
    }

    return { reply: null, error: "Empty response" };
  } catch (error) {
    return {
      reply: null,
      error: error instanceof Error ? error.message : "Nexus chat error",
    };
  }
}

/**
 * Try streaming chat with Nexus
 * Returns async generator for streaming tokens
 */
export async function *tryNexusChatStream(
  text: string,
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): AsyncGenerator<{ content: string; done: boolean }, void, unknown> {
  const activeDevice = NexusClient.getActiveDevice();
  if (!activeDevice) {
    yield { content: "", done: true };
    return;
  }

  const client = new NexusClient(activeDevice);
  const status = await client.checkConnection();
  if (!status.online) {
    yield { content: "", done: true };
    return;
  }

  const models = await client.listModels();
  const model = models[0] ?? "default";

  const messages: NexusChatRequest["messages"] = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: text },
  ];

  const request: NexusChatRequest = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 512,
    top_p: 0.9,
    stream: true,
  };

  try {
    for await (const chunk of client.chatStream({ ...request })) {
      yield { content: chunk.content, done: chunk.done };
    }
  } catch {
    yield { content: "", done: true };
  }
}

/**
 * Chat with Nexus using the active device, with auto-reconnect
 * Returns async generator for streaming tokens
 */
export async function *tryNexusChatStreamWithReconnect(
  text: string,
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): AsyncGenerator<{ content: string; done: boolean }, void, unknown> {
  const activeDevice = NexusClient.getActiveDevice();
  if (!activeDevice) {
    yield { content: "", done: true };
    return;
  }

  const client = new NexusClient(activeDevice);

  // Ensure connection with auto-reconnect
  const connected = await client.ensureConnected(2);
  if (!connected) {
    yield { content: "", done: true };
    return;
  }

  const models = await client.listModels();
  const model = models[0] ?? "default";

  const messages: NexusChatRequest["messages"] = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: text },
  ];

  const request: NexusChatRequest = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 512,
    top_p: 0.9,
    stream: true,
  };

  try {
    for await (const chunk of client.chatStream({ ...request })) {
      yield { content: chunk.content, done: chunk.done };
    }
  } catch {
    yield { content: "", done: true };
  }
}