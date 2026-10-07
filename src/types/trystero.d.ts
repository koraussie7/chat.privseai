declare module "trystero" {
  export interface TrysteroConfig {
    appId: string;
    relayConfig?: { urls: string[]; supabaseKey?: string };
    turnConfig?: RTCIceServer[];
    password?: string;
    ctcp?: boolean;
  }

  export interface RoomConfig {
    kind: "request" | "bidirectional";
    onRequest?: (data: unknown, peerId: string) => Promise<unknown> | unknown;
    onReceive?: (data: unknown, peerId: string) => void;
    onReceiveProgress?: (data: unknown, peerId: string) => void;
  }

  export interface SendOptions {
    reliable?: boolean;
    ordered?: boolean;
    maxPacketSize?: number;
    target?: string;
    timeoutMs?: number;
  }

  export interface ClientEvent {
    type: string;
    data: unknown;
    peerId: string;
  }

  export interface BaseAction {
    onMessage: ((data: unknown, peerId: { peerId: string }) => void) | null;
    onReceive: ((data: unknown, peerId: { peerId: string }) => void) | null;
    onReceiveProgress: ((data: unknown, peerId: { peerId: string }) => void) | null;
    send: (data: unknown, opts?: SendOptions) => void;
    request: (data: unknown, opts?: SendOptions) => Promise<unknown>;
    requestMany: (data: unknown, opts?: SendOptions) => Promise<unknown>;
  }

  export interface Room {
    onPeerJoin: ((peerId: string) => void) | null;
    onPeerLeave: ((peerId: string) => void) | null;
    onPeerStream: ((stream: MediaStream, peerId: string) => void) | null;
    onPeerTrack: ((track: MediaStreamTrack, stream: MediaStream, peerId: string) => void) | null;
    makeAction: (actionId: string, config?: RoomConfig) => BaseAction;
    leave: () => void;
    getPeers: () => Record<string, unknown>;
    ping: () => Promise<number>;
  }

  export function joinRoom(config: TrysteroConfig, roomId: string): Room;
  export const selfId: string;
  export function getRelaySockets(): unknown[];
  export function pauseRelayReconnection(): void;
  export function resumeRelayReconnection(): void;
}
