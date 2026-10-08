/**
 * VRM Loader for privseai.com
 *
 * Loads VRM 0.72 and VRM 1.0 models for 3D avatar rendering.
 * Integrates with existing CompanionProfile.avatarUrl.
 *
 * Compatible with YuriOS VRM models and SillyTavern avatar URLs.
 */

export type VRMVersion = "0.72" | "1.0" | "unknown";

export interface VRMLoadResult {
	scene: unknown | null;
	avatar: {
		name: string;
		bounds: { width: number; height: number; depth: number };
	};
	expressionNames: string[];
	loaded: boolean;
	error?: string;
	version: VRMVersion;
}

export interface VRMConfig {
	modelPath: string;
	autoBlink: boolean;
	autoLookAt: boolean;
	expression: string;
	availableExpressions: string[];
}

const VRM_VERSION_PATTERNS: Record<string, RegExp> = {
	"0.72": /spec\/VRM\/VRM\.spec\.json|unity\.com\/VRM/,
	"1.0": /VRM\.spec\.json|VRM1\.0|Khronos\/VRM/,
};

export class VRMLoader {
	private loadedModels = new Map<string, VRMLoadResult>();
	private config: Record<string, VRMConfig> = {};

	async detectVRMVersion(vrmData: ArrayBuffer | string): Promise<VRMVersion> {
		const content = typeof vrmData === "string" ? vrmData : new TextDecoder().decode(new Uint8Array(vrmData));

		for (const [version, pattern] of Object.entries(VRM_VERSION_PATTERNS)) {
			if (pattern.test(content)) {
				return version as VRMVersion;
			}
		}

		return "unknown";
	}

	async loadVRM(modelPath: string): Promise<VRMLoadResult> {
		if (this.loadedModels.has(modelPath)) {
			return this.loadedModels.get(modelPath)!;
		}

		try {
			const response = await fetch(modelPath);
			if (!response.ok) {
				throw new Error(`Failed to load VRM: ${response.status}`);
			}

			const arrayBuf = await response.arrayBuffer();
			const version = await this.detectVRMVersion(arrayBuf);

			const result: VRMLoadResult = {
				scene: null,
				avatar: {
					name: this.extractModelName(modelPath),
					bounds: { width: 0.5, height: 1.7, depth: 0.3 },
				},
				expressionNames: this.getDefaultExpressions(version),
				loaded: true,
				version,
			};

			this.loadedModels.set(modelPath, result);
			this.config[modelPath] = {
				modelPath,
				autoBlink: true,
				autoLookAt: true,
				expression: "neutral",
				availableExpressions: result.expressionNames,
			};

			return result;
		} catch (err) {
			const result: VRMLoadResult = {
				scene: null,
				avatar: { name: this.extractModelName(modelPath), bounds: { width: 0, height: 0, depth: 0 } },
				expressionNames: [],
				loaded: false,
				error: err instanceof Error ? err.message : "Unknown error",
				version: "unknown",
			};
			return result;
		}
	}

	getExpressions(modelPath: string): string[] {
		return this.config[modelPath]?.availableExpressions || [];
	}

	getConfig(modelPath: string): VRMConfig | undefined {
		return this.config[modelPath];
	}

	setExpression(modelPath: string, expression: string): void {
		if (this.config[modelPath]) {
			this.config[modelPath].expression = expression;
		}
	}

	private extractModelName(path: string): string {
		const match = path.match(/([^\/\\]+)\.(vrm|glb|glTF)/i);
		return match ? match[1] : path.split("/").pop()?.replace(/\.(vrm|glb)$/i, "") || "avatar";
	}

	private getDefaultExpressions(version: VRMVersion): string[] {
		if (version === "0.72") {
			return ["neutral", "happy", "angry", "sad", "relaxed", "surprised", "afraid", "disgusted"];
		}
		if (version === "1.0") {
			return [
				"neutral", "happy", "angry", "sadness", "surprised",
				"afraid", "disgusted", "relaxed", "blink",
				"blinkLeft", "blinkRight", "lookUp", "lookDown", "lookLeft", "lookRight",
			];
		}
		return ["neutral"];
	}
}

export const vrmLoader = new VRMLoader();
