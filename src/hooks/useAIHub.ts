import { AIHub } from "@/lib/ai-hub";
import { useEffect, useState } from "react";

const hubInstance = new AIHub();

export function getAIHub(): AIHub {
	return hubInstance;
}

export function useAIHub() {
	const [hub] = useState<AIHub>(() => hubInstance);

	useEffect(() => {
		// Auto-connect to P2P network if trystero is available
		if (!hub.getStats().totalPeers) {
			// The hub will pick up peers when trystero connects
		}
	}, [hub]);

	return hub;
}
