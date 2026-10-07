const actions = new Map<string, Record<string, unknown>>();

const createAction = () => ({
  onMessage: null,
  onReceive: null,
  onReceiveProgress: null,
  send: vi.fn(),
  request: vi.fn(),
  requestMany: vi.fn(),
});

const makeAction = vi.fn((actionId: string) => {
  if (!actions.has(actionId)) {
    actions.set(actionId, createAction());
  }
  return actions.get(actionId)!;
});

export const mockRoom = {
  onPeerJoin: null as unknown,
  onPeerLeave: null as unknown,
  onPeerStream: null as unknown,
  onPeerTrack: null as unknown,
  makeAction,
  leave: vi.fn(),
  getPeers: vi.fn(() => ({})),
  ping: vi.fn().mockResolvedValue(50),
  _actions: actions,
  _reset() {
    this.onPeerJoin = null;
    this.onPeerLeave = null;
    this.onPeerStream = null;
    this.onPeerTrack = null;
    actions.clear();
    this.makeAction.mockClear();
    this.leave.mockClear();
    this.getPeers.mockClear();
    this.ping.mockClear();
    this.ping.mockResolvedValue(50);
    this.makeAction.mockImplementation((actionId: string) => {
      if (!actions.has(actionId)) {
        actions.set(actionId, createAction());
      }
      return actions.get(actionId)!;
    });
  },
};

export const joinRoom = vi.fn(() => mockRoom);
export const selfId = "test-peer-12345";
export const getRelaySockets = vi.fn();
export const pauseRelayReconnection = vi.fn();
export const resumeRelayReconnection = vi.fn();
