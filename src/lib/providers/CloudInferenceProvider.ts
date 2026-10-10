/**
 * Cloud Inference Provider (OpenAI, Anthropic, Google, Groq, etc.)
 * 
 * 클라우드 API를 통한 고성능 추론 폴백 프로바이더입니다.
 * P2P/로컬 추론 실패 시 자동으로 폴백됩니다.
 */

import type {
  InferenceProvider,
  InferenceRequest,
  InferenceChunk,
  HealthStatus,
  ModelReference,
  UnifiedCompanion,
  CloudProvider,
} from '@/types/unified';

export interface CloudProviderConfig {
  provider: CloudProvider;
  apiKey: string;
  baseUrl?: string;           // 커스텀 엔드포인트 (예: Together, Groq)
  defaultModel: string;
  models: string[];           // 사용 가능한 모델 목록
  organization?: string;      // OpenAI organization ID
}

  openai: { provider: 'openai', baseUrl: 'https://api.openai.com/v1' },
  anthropic: { provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  google: { provider: 'google', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  groq: { provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1' },
  together: { provider: 'together', baseUrl: 'https://api.together.xyz/v1' },
  custom: { provider: 'custom', baseUrl: '' },
};

export class CloudInferenceProvider implements InferenceProvider {
  id: string;
  name: string;
  type = 'cloud' as const;
  description: string;
  supportsStreaming = true;
  supportsTools = true;
  supportsVision = true;
  maxContextLength = 128000;

  private config: CloudProviderConfig;
  private headers: Record<string, string>;

  constructor(config: CloudProviderConfig) {
    this.config = config;
    this.id = `cloud-${config.provider}`;
    this.name = `Cloud (${config.provider.toUpperCase()})`;
    this.description = `${config.provider} 클라우드 API 추론`;
    
    this.headers = this.buildHeaders();
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    switch (this.config.provider) {
      case 'anthropic':
        headers['x-api-key'] = this.config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'google':
        // Google은 API key를 쿼리 파라미터로 전달
        break;
      default:
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        if (this.config.organization) {
          headers['OpenAI-Organization'] = this.config.organization;
        }
    }

    return headers;
  }

  estimateCost(request: InferenceRequest): number {
    // 대략적인 비용 추정 (USD per 1K tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
      'claude-3-5-haiku': { input: 0.25, output: 1.25 },
      'gemini-1.5-pro': { input: 1.25, output: 5.00 },
      'gemini-1.5-flash': { input: 0.075, output: 0.30 },
      'llama-3.1-70b': { input: 0.80, output: 0.80 },  // Groq/Together
      'llama-3.1-8b': { input: 0.10, output: 0.10 },
    };

    const model = this.config.defaultModel;
    const rates = pricing[model] || { input: 1.0, output: 2.0 };
    
    // 입력 토큰 추정 (대략적)
    const inputTokens = this.estimateTokens(request.messages);
    const outputTokens = request.maxTokens ?? 512;
    
    return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
  }

  private estimateTokens(messages: InferenceRequest['messages']): number {
    let total = 0;
    for (const msg of messages) {
      total += msg.content.length / 4;  // 대략 4 chars = 1 token
    }
    return total;
  }

  async *infer(request: InferenceRequest): AsyncGenerator<InferenceChunk> {
    const companion = request.companion;
    const systemPrompt = this.buildSystemPrompt(companion);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...request.messages.map(m => ({ 
        role: m.role === 'tool' ? 'tool' : m.role, 
        content: m.content,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
      }))
    ];

    try {
      switch (this.config.provider) {
        case 'openai':
        case 'groq':
        case 'together':
        case 'custom':
          yield* this.inferOpenAICompatible(messages, request);
          break;
        case 'anthropic':
          yield* this.inferAnthropic(messages, request);
          break;
        case 'google':
          yield* this.inferGoogle(messages, request);
          break;
      }
    } catch (error) {
      yield { 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Cloud inference failed' 
      };
    }
  }

  private async *inferOpenAICompatible(
    messages: any[],
    request: InferenceRequest
  ): AsyncGenerator<InferenceChunk> {
    const url = `${this.config.baseUrl}/chat/completions`;
    
    const body = {
      model: this.config.defaultModel,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 512,
      top_p: request.topP ?? 0.9,
      stream: true,
      ...(request.tools?.length ? { tools: request.tools } : {}),
      ...(request.stopSequences?.length ? { stop: request.stopSequences } : {}),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.config.provider} API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      yield { type: 'error', error: 'No response stream' };
      return;
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              yield { type: 'done' };
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
              
              if (content) {
                yield { type: 'content', content };
              }
              if (toolCalls) {
                for (const tc of toolCalls) {
                  yield { 
                    type: 'tool_call', 
                    toolCall: {
                      id: tc.id,
                      type: 'function',
                      function: {
                        name: tc.function?.name || '',
                        arguments: tc.function?.arguments || '',
                      },
                    },
                  };
                }
              }
            } catch {
              // 파싱 에러 무시
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async *inferAnthropic(
    messages: any[],
    request: InferenceRequest
  ): AsyncGenerator<InferenceChunk> {
    // Anthropic은 system prompt를 별도 필드로 전달
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system');

    const url = `${this.config.baseUrl}/messages`;
    
    const body = {
      model: this.config.defaultModel,
      system: systemPrompt,
      messages: userMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      max_tokens: request.maxTokens ?? 512,
      temperature: request.temperature ?? 0.7,
      stream: true,
      ...(request.tools?.length ? { tools: this.convertToolsToAnthropic(request.tools) } : {}),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      yield { type: 'error', error: 'No response stream' };
      return;
    }

    try {
      let currentToolCall: any = null;
      let currentToolArgs = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              yield { type: 'done' };
              return;
            }
            try {
              const parsed = JSON.parse(data);
              
              // content_block_delta 이벤트 처리
              if (parsed.type === 'content_block_delta') {
                if (parsed.delta.type === 'text_delta') {
                  yield { type: 'content', content: parsed.delta.text };
                } else if (parsed.delta.type === 'input_json_delta') {
                  currentToolArgs += parsed.delta.partial_json;
                }
              } else if (parsed.type === 'content_block_start') {
                if (parsed.content_block.type === 'tool_use') {
                  currentToolCall = {
                    id: parsed.content_block.id,
                    name: parsed.content_block.name,
                    arguments: '',
                  };
                }
              } else if (parsed.type === 'content_block_stop' && currentToolCall) {
                currentToolCall.arguments = currentToolArgs;
                yield { 
                  type: 'tool_call', 
                  toolCall: {
                    id: currentToolCall.id,
                    type: 'function',
                    function: {
                      name: currentToolCall.name,
                      arguments: currentToolCall.arguments,
                    },
                  },
                };
                currentToolCall = null;
                currentToolArgs = '';
              }
            } catch {
              // 파싱 에러 무시
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async *inferGoogle(
    messages: any[],
    request: InferenceRequest
  ): AsyncGenerator<InferenceChunk> {
    // Google Gemini API (OpenAI 호환 모드 사용 권장)
    // 여기서는 OpenAI 호환 엔드포인트 사용
    const url = `${this.config.baseUrl}/models/${this.config.defaultModel}:streamGenerateContent?key=${this.config.apiKey}`;
    
    // Google 형식으로 변환
    const contents = messages.map(m => ({
      role: m.role === 'system' ? 'user' : m.role,
      parts: [{ text: m.content }],
    }));

    const body = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 512,
        topP: request.topP ?? 0.9,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API error: ${response.status} ${error}`);
    }

    // Google 스트리밍 파싱 (간소화)
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      yield { type: 'error', error: 'No response stream' };
      return;
    }

    try {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
        // Google 스트리밍 파싱 로직
        // 실제 구현 필요
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: 'done' };
  }

  private buildSystemPrompt(companion: UnifiedCompanion): string {
    const personality = companion.personality.join(', ');
    return `${companion.systemPrompt}\n\nPersonality: ${personality}\n\nYou are ${companion.name}. Stay in character.`;
  }

  private convertToolsToAnthropic(tools: any[]): any[] {
    return tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }

  async checkHealth(): Promise<HealthStatus> {
    try {
      const start = Date.now();
      const url = `${this.config.baseUrl}/models`;
      const response = await fetch(url, { headers: this.headers, method: 'GET' });
      
      return {
        healthy: response.ok,
        latencyMs: Date.now() - start,
        message: response.ok ? 'Cloud API reachable' : `HTTP ${response.status}`,
      };
    } catch (error) {
      return { 
        healthy: false, 
        message: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  async getAvailableModels(): Promise<ModelReference[]> {
    return this.config.models.map(model => ({
      type: 'cloud' as const,
      cloudProvider: this.config.provider,
      cloudModel: model,
      modelName: model,
    }));
  }

  // 설정 업데이트
  updateConfig(config: Partial<CloudProviderConfig>): void {
    this.config = { ...this.config, ...config };
    this.headers = this.buildHeaders();
  }
}

// 팩토리 함수들
export function createOpenAIProvider(apiKey: string, model = 'gpt-4o-mini'): CloudInferenceProvider {
  return new CloudInferenceProvider({
    provider: 'openai',
    apiKey,
    defaultModel: model,
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  });
}

export function createAnthropicProvider(apiKey: string, model = 'claude-3-5-haiku'): CloudInferenceProvider {
  return new CloudInferenceProvider({
    provider: 'anthropic',
    apiKey,
    defaultModel: model,
    models: ['claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'],
  });
}

export function createGroqProvider(apiKey: string, model = 'llama-3.1-8b-instant'): CloudInferenceProvider {
  return new CloudInferenceProvider({
    provider: 'groq',
    apiKey,
    defaultModel: model,
    models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b'],
  });
}

export function createTogetherProvider(apiKey: string, model = 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'): CloudInferenceProvider {
  return new CloudInferenceProvider({
    provider: 'together',
    apiKey,
    defaultModel: model,
    models: ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'],
  });
}