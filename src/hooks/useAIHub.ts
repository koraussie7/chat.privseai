import { AIHub } from "@/lib/ai-hub";
import { useEffect, useState } from "react";

const hubInstance = new AIHub();

export function getAIHub(): AIHub {
	return hubInstance;
}

/**
 * useAIHub — returns the shared AIHub singleton and a monotonically
 * increasing tick that increments every second. The tick is intended to be
 * spread into useMemo dependency arrays (or stored as plain state) so that
 * components automatically re-read the hub when new packages / images /
 * videos are added by other components.
 *
 * Intentionally simple: no observer pattern, no useSyncExternalStore.
 * Just a tick that callers include in their deps.
 */
export function useAIHub(): { aiHub: AIHub; tick: number } {
	const [hub] = useState<AIHub>(() => hubInstance);
	const [tick, setTick] = useState(0);

	useEffect(() => {
		// Auto-connect to P2P network if trystero is available
		if (!hub.getStats().totalPeers) {
			// The hub will pick up peers when trystero connects
		}
	}, [hub]);

	useEffect(() => {
		const interval = window.setInterval(() => {
			setTick((t) => t + 1);
		}, 1000);
		return () => window.clearInterval(interval);
	}, []);

	return { aiHub: hub, tick };
}
