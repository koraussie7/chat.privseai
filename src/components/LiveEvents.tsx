import { useEffect, useState, useCallback } from "react";
import { useTrystero, useColibri } from "@/hooks/useTrysteroP2P";
import { IMPACT_TIER_COLORS, SEVERITY_COLORS } from "@/types/pythia";
import type { PythiaEvent, PythiaForecast, ImpactAnalysis } from "@/types/pythia";

export function LiveEvents() {
  const { events, forecasts, impacts, broadcastEvent, broadcastForecast, isConnected } = useTrystero();
  const [activeTab, setActiveTab] = useState<"events" | "forecasts" | "impacts">("events");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  const handleSendEvent = () => {
    if (!inputValue.trim()) return;
    const newEvent: PythiaEvent = {
      event_id: `manual-${Date.now()}`,
      source_agent: "privseai-ui",
      timestamp: new Date().toISOString(),
      kind: "user_input",
      severity: "info",
      title: "User Input",
      body: inputValue,
      metadata: {},
      schema_version: "1.0.0",
    };
    broadcastEvent(newEvent);
    setInputValue("");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Live Events</h1>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
          <span>{isConnected ? "Connected" : "Offline"}</span>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1">
        {(["events", "forecasts", "impacts"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "events" && (
        <>
          <EventInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSendEvent}
          />
          <EventList
            events={events}
            expandedEvent={expandedEvent}
            onExpand={setExpandedEvent}
          />
        </>
      )}

      {activeTab === "forecasts" && (
        <ForecastList forecasts={forecasts} />
      )}

      {activeTab === "impacts" && (
        <ImpactList impacts={impacts} />
      )}
    </div>
  );
}

function EventInput({
  value,
  onChange,
  onSend,
}: {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="flex gap-2">
      <input
        type="text"
        placeholder="Type a message to broadcast P2P..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-600"
      />
      <button
        onClick={onSend}
        disabled={!value.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Broadcast
      </button>
    </div>
  );
}

function EventList({
  events,
  expandedEvent,
  onExpand,
}: {
  events: PythiaEvent[];
  expandedEvent: string | null;
  onExpand: (id: string | null) => void;
}) {
  if (!events.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        No events yet. Broadcast one above to start the P2P stream.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.slice().reverse().map((event) => (
        <EventCard
          key={event.event_id}
          event={event}
          isExpanded={expandedEvent === event.event_id}
          onToggle={() => onExpand(expandedEvent === event.event_id ? null : event.event_id)}
        />
      ))}
    </div>
  );
}

function EventCard({
  event,
  isExpanded,
  onToggle,
}: {
  event: PythiaEvent;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const severityClass = SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.info;
  return (
    <div
      className="bg-gray-900/30 border border-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <span className={`text-xs font-bold uppercase ${severityClass}`}>
          {event.severity}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-200">{event.title}</span>
            <span className="text-xs text-gray-500">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-sm text-gray-300 mt-1 line-clamp-2">
            {event.body.slice(0, 200)}
            {event.body.length > 200 && "..."}
          </p>
          <span className="text-xs text-gray-500 mt-1">
            {event.source_agent} · {event.kind}
          </span>
        </div>
      </div>
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <pre className="text-xs text-gray-400 whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ForecastList({ forecasts }: { forecasts: PythiaForecast[] }) {
  if (!forecasts.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        No forecasts yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {forecasts.slice().reverse().map((f) => (
        <div key={f.forecast_id} className="bg-gray-900/30 border border-gray-700 rounded-lg p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-200">{f.hypothesis}</p>
              <p className="text-xs text-gray-500 mt-1">→ {f.outcome}</p>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    f.confidence === "high" || f.confidence === "certain"
                      ? "bg-green-500/20 text-green-400"
                      : f.confidence === "medium"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  {f.confidence}
                </span>
                <span className="text-xs text-gray-500">Agent: {f.agent_id}</span>
              </div>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(f.created_at).toLocaleTimeString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ImpactList({ impacts }: { impacts: ImpactAnalysis[] }) {
  if (!impacts.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        No impact alerts.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {impacts.slice().reverse().map((impact) => {
        const colorClass = IMPACT_TIER_COLORS[impact.tier] || IMPACT_TIER_COLORS.low;
        return (
          <div
            key={`${impact.target_id}-${impact.target_type}`}
            className="bg-gray-900/30 border border-gray-700 rounded-lg p-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase ${colorClass}`}>
                    {impact.tier}
                  </span>
                  <span className="text-xs text-gray-500">score: {impact.score.toFixed(2)}</span>
                </div>
                <p className="text-sm text-gray-200 mt-1">{impact.rationale}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {impact.affected_agents.map((agent) => (
                    <span key={agent} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                      {agent}
                    </span>
                  ))}
                </div>
                {impact.mitigations.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">Mitigations:</p>
                    <ul className="text-xs text-gray-400 list-disc list-inside">
                      {impact.mitigations.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {new Date(impact.generated_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
