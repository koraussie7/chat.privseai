import { BrowserRouter as Router, Routes, Route, NavLink, Outlet } from "react-router-dom";
import { WorldCockpit } from "@/components/WorldCockpit";
import { LiveEvents } from "@/components/LiveEvents";
import { ImpactAnalysis } from "@/components/ImpactAnalysis";
import { EvidenceExplorer } from "@/components/EvidenceExplorer";
import { ForecastLedger } from "@/components/ForecastLedger";

export function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-gray-100">
        <nav className="bg-gray-900/80 border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-xl font-bold text-blue-400">privseai</span>
                <span className="text-xs text-gray-600">/</span>
                <span className="text-xs font-semibold text-gray-400">trystero</span>
              </div>
              <div className="flex gap-1">
                <NavItem to="/" label="World Cockpit" />
                <NavItem to="/events" label="Live Events" />
                <NavItem to="/forecasts" label="Forecast Ledger" />
                <NavItem to="/evidence" label="Evidence Explorer" />
                <NavItem to="/impact" label="Impact Analysis" />
              </div>
            </div>
          </div>
        </nav>
        <main>
          <Routes>
            <Route path="/" element={<WorldCockpit />} />
            <Route path="/events" element={<LiveEvents />} />
            <Route path="/forecasts" element={<ForecastLedger />} />
            <Route path="/evidence" element={<EvidenceExplorer />} />
            <Route path="/impact" element={<ImpactAnalysis />} />
            <Route path="*" element={<WorldCockpit />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          isActive
            ? "bg-blue-600 text-white"
            : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
        }`
      }
    >
      {label}
    </NavLink>
  );
}
