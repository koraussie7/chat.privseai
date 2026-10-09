declare module "@xenova/transformers" {
	export interface ProgressInfo {
		progress: number;
		status: string;
	}

	export interface GenerationOptions {
		max_new_tokens?: number;
		temperature?: number;
		top_p?: number;
		top_k?: number;
		do_sample?: boolean;
		repetition_penalty?: number;
		streamer?: {
			next: (token: { text: string }) => void;
			return: () => void;
		};
	}

	export interface GenerationResult {
		generated_text: string;
	}

	export type TextGenerationPipeline = (
		messages: { role: string; content: string }[],
		options?: GenerationOptions & { streamer?: GenerationOptions["streamer"] },
	) => Promise<GenerationResult[]>;

	export function pipeline(
		task: "text-generation",
		model: string,
		options?: {
			device?: string;
			dtype?: string;
			progress_callback?: (progress: ProgressInfo) => void;
		},
	): Promise<TextGenerationPipeline>;

	export const AutoTokenizer: Record<string, unknown>;
	export const AutoModelForCausalLM: Record<string, unknown>;
}

declare module "@mlc-ai/web-llm" {
	export interface ChatCompletionMessage {
		role: string;
		content: string;
	}

	export interface ChatCompletionRequest {
		model: string;
		messages: ChatCompletionMessage[];
		stream?: boolean;
	}

	export interface ChatCompletionChunk {
		choices: Array<{
			delta?: { content?: string };
			finish_reason?: string;
		}>;
	}

	export interface ChatCompletionResponse {
		choices: Array<{
			message: { content: string };
			finish_reason: string;
		}>;
	}

	export interface InitParams {
		model: string;
		verbose?: boolean;
	}

	export interface MLCEngineInterface {
		init(params: InitParams): Promise<void>;
		chatCompletion(
			params: ChatCompletionRequest,
		): Promise<ChatCompletionResponse | ChatCompletionChunk>;
		unload(): Promise<void>;
	}

	export function createWebLLMEngine(initParams: InitParams): Promise<MLEngineInterface>;

	export interface MLEngineInterface extends MLCEngineInterface {}
}
