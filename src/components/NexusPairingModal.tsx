import { useState, useEffect } from "react";
import { NexusClient, NexusConfig, validateNexusUrl, generateDeviceId } from "@/lib/nexus-client";

interface Props {
  onDevicePaired?: (device: NexusConfig) => void;
  onClose: () => void;
}

export function NexusPairingModal({ onDevicePaired, onClose }: Props) {
  const [devices, setDevices] = useState<NexusConfig[]>(() => NexusClient.getStoredDevices());
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(() =>
    NexusClient.getActiveDevice()?.deviceId ?? null
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDeviceUrl, setNewDeviceUrl] = useState("");
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceApiKey, setNewDeviceApiKey] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);

  useEffect(() => {
    setDevices(NexusClient.getStoredDevices());
    setActiveDeviceId(NexusClient.getActiveDevice()?.deviceId ?? null);
  }, []);

  const handleTestConnection = async (url: string, apiKey?: string) => {
    setTesting(url);
    setTestResult(null);
    const validation = validateNexusUrl(url);
    if (!validation.valid) {
      setTestResult({ success: false, message: validation.error ?? "유효하지 않은 URL" });
      setTesting(null);
      return;
    }

    try {
      const tempClient = new NexusClient({
        baseUrl: url,
        apiKey,
        deviceId: "temp_test",
        deviceName: "Test",
        pairedAt: Date.now(),
      });
      const status = await tempClient.checkConnection();
      if (status.online) {
        setTestResult({
          success: true,
          message: `연결 성공! 버전: ${status.version ?? "알 수 없음"}, 모델: ${status.models?.length ?? 0}개`,
        });
      } else {
        setTestResult({ success: false, message: status.error ?? "연결 실패" });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "연결 오류",
      });
    } finally {
      setTesting(null);
    }
  };

  const handleAddDevice = async () => {
    if (!newDeviceUrl.trim() || !newDeviceName.trim()) {
      setPairingError("URL과 이름을 모두 입력해주세요");
      return;
    }

    const validation = validateNexusUrl(newDeviceUrl);
    if (!validation.valid) {
      setPairingError(validation.error ?? "유효하지 않은 URL");
      return;
    }

    setAdding(true);
    setPairingError(null);
    setTestResult(null);

    try {
      // Test connection first
      const tempClient = new NexusClient({
        baseUrl: newDeviceUrl,
        apiKey: newDeviceApiKey || undefined,
        deviceId: "temp_test",
        deviceName: "Test",
        pairedAt: Date.now(),
      });
      const status = await tempClient.checkConnection();
      if (!status.online) {
        throw new Error(status.error ?? "연결 실패");
      }

      // Create and store device
      const deviceId = generateDeviceId();
      const newDevice: NexusConfig = {
        baseUrl: newDeviceUrl,
        apiKey: newDeviceApiKey || undefined,
        deviceId,
        deviceName: newDeviceName.trim(),
        pairedAt: Date.now(),
        lastConnectedAt: Date.now(),
        capabilities: {
          models: status.models ?? [],
          maxTokens: 4096,
          supportsStreaming: true,
        },
      };

      NexusClient.storeDevice(newDevice);
      NexusClient.setActiveDevice(deviceId);
      setDevices(NexusClient.getStoredDevices());
      setActiveDeviceId(deviceId);

      onDevicePaired?.(newDevice);
      onClose();

      // Reset form
      setNewDeviceUrl("");
      setNewDeviceName("");
      setNewDeviceApiKey("");
      setShowAddForm(false);
    } catch (error) {
      setPairingError(error instanceof Error ? error.message : "페어링 실패");
    } finally {
      setAdding(false);
    }
  };

  const handleSetActive = (deviceId: string) => {
    NexusClient.setActiveDevice(deviceId);
    setActiveDeviceId(deviceId);
  };

  const handleRemoveDevice = (deviceId: string) => {
    if (!confirm("이 디바이스를 제거하시겠습니까?")) return;
    NexusClient.removeDevice(deviceId);
    setDevices(NexusClient.getStoredDevices());
    if (activeDeviceId === deviceId) {
      NexusClient.setActiveDevice(null);
      setActiveDeviceId(null);
    }
  };

  const handleTestExisting = (device: NexusConfig) => {
    handleTestConnection(device.baseUrl, device.apiKey);
  };

  if (!showAddForm && devices.length === 0) {
    // No devices yet, show add form directly
    setShowAddForm(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-[#13141f] border border-white/10 shadow-2xl p-6 sm:p-8 text-gray-100 my-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-purple-600 flex items-center justify-center text-xl text-white shadow-lg shadow-cyan-500/30">
            🔗
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Nexus 디바이스 연결</h2>
            <p className="text-xs text-gray-400">
              로컬 Nexus 인스턴스를 연결하여 무료 로컬 LLM 채팅 사용
            </p>
          </div>
        </div>

        {pairingError && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
            {pairingError}
          </div>
        )}

        {/* Existing Devices */}
        {devices.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">연결된 디바이스</h3>
            <div className="space-y-2">
              {devices.map((device) => (
                <div
                  key={device.deviceId}
                  className={`p-4 rounded-2xl border transition-all ${
                    activeDeviceId === device.deviceId
                      ? "border-cyan-500/50 bg-cyan-500/5"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-white">
                        🖥️
                      </div>
                      <div>
                        <div className="font-semibold text-white">{device.deviceName}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-xs">
                          {device.baseUrl}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {device.capabilities?.models?.length ?? 0}개 모델 ·{" "}
                          {device.lastConnectedAt
                            ? `마지막 연결: ${new Date(device.lastConnectedAt).toLocaleString()}`
                            : "미연결"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeDeviceId !== device.deviceId && (
                        <button
                          type="button"
                          onClick={() => handleSetActive(device.deviceId)}
                          className="px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-xs font-semibold transition"
                        >
                          활성화
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleTestExisting(device)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 text-xs font-semibold transition"
                      >
                        테스트
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveDevice(device.deviceId)}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold transition"
                      >
                        제거
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Device Form */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className={`w-full px-4 py-2.5 rounded-2xl font-semibold text-sm transition ${
              showAddForm
                ? "bg-gray-500/10 text-gray-300"
                : "bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
            }`}
          >
            {showAddForm ? "취소" : "새 디바이스 추가"}
          </button>

          {showAddForm && (
            <div className="space-y-4 p-4 bg-white/5 rounded-2xl border border-white/10">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  디바이스 이름
                </label>
                <input
                  type="text"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder="예: 내 데스크톱 Nexus"
                  className="w-full px-4 py-2.5 bg-[#1b1c2b] border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Nexus URL
                </label>
                <input
                  type="url"
                  value={newDeviceUrl}
                  onChange={(e) => setNewDeviceUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8080"
                  className="w-full px-4 py-2.5 bg-[#1b1c2b] border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  로컬 Nexus: http://127.0.0.1:8080 또는 https://로컬도메인:포트
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  API Key (선택사항)
                </label>
                <input
                  type="password"
                  value={newDeviceApiKey}
                  onChange={(e) => setNewDeviceApiKey(e.target.value)}
                  placeholder="Nexus에 인증이 필요한 경우"
                  className="w-full px-4 py-2.5 bg-[#1b1c2b] border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {testResult && (
                <div className={`p-3 rounded-xl text-sm ${
                  testResult.success
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                }`}>
                  {testResult.message}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleTestConnection(newDeviceUrl, newDeviceApiKey || undefined)}
                  disabled={!newDeviceUrl.trim() || testing === newDeviceUrl}
                  className="flex-1 px-4 py-2 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 text-sm font-semibold transition disabled:opacity-50"
                >
                  {testing === newDeviceUrl ? "테스트 중..." : "연결 테스트"}
                </button>
                <button
                  type="button"
                  onClick={handleAddDevice}
                  disabled={!newDeviceUrl.trim() || !newDeviceName.trim() || adding}
                  className="flex-1 px-4 py-2 rounded-xl bg-cyan-500 text-white font-semibold text-sm hover:bg-cyan-600 transition disabled:opacity-50"
                >
                  {adding ? "추가 중..." : "추가 및 연결"}
                </button>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="mt-6 p-3 bg-[#0e0f17] rounded-xl border border-white/5 text-xs text-gray-400">
            <div className="font-semibold text-gray-300 mb-1">연결 안내</div>
            <ul className="space-y-1 text-gray-500">
              <li>• Nexus는 사용자 기기에서 로컬 LLM(Ollama, vLLM, LM Studio 등)을 OpenAI 호환 API로 제공</li>
              <li>• HTTPS 사이트에서 로컬 HTTP 접근 시 브라우저 정책상 차단될 수 있음 (HTTPS Nexus 권장)</li>
              <li>• Nexus 설치/모델 다운로드/GPU는 사용자 책임, PrivseAI는 UI만 제공</li>
              <li>• 무료 = 호스팅 API 요금 없음, 하드웨어/전력/모델 다운로드는 사용자 부담</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}