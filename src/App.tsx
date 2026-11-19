import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Bot, SlidersHorizontal, Sun, Activity, TrainFront, Zap } from 'lucide-react';
import {
  AssistantChatMessage,
  CameraPreset,
  CityAction,
  CityComponentId,
  CitySimulationState,
} from './types/city';
import {
  DEFAULT_SIMULATION_STATE,
  applyCityAction,
  computeCityMetrics,
  computeSunState,
  formatClockHour,
} from './simulation/citySimulation';
import { processAssistantCommand } from './simulation/assistantEngine';
import { CityViewport } from './three/CityViewport';
import { ViewportHud } from './components/ViewportHud';
import { SystemInspector } from './components/SystemInspector';
import { AiAssistantPanel } from './components/AiAssistantPanel';

type SidebarTab = 'inspector' | 'assistant';

const INITIAL_MESSAGES: AssistantChatMessage[] = [
  {
    id: 'welcome-1',
    role: 'assistant',
    content:
      'VerdantGrid 3D engineering assistant ready. Click any ground structure or underground metro asset in the cutaway viewport to inspect it, or issue commands to control lights, solar tracking, air purification towers, park irrigation, and metro routes.',
    timestamp: formatClockHour(DEFAULT_SIMULATION_STATE.timeHour),
  },
];

export default function App() {
  const [simulationState, setSimulationState] = useState<CitySimulationState>(
    DEFAULT_SIMULATION_STATE,
  );
  const [selectedComponentId, setSelectedComponentId] = useState<CityComponentId>(
    'solar-farm-ground',
  );
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('inspector');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('isometric');
  const [cameraTriggerNonce, setCameraTriggerNonce] = useState(0);
  const [showLabels, setShowLabels] = useState(true);
  const [messages, setMessages] = useState<AssistantChatMessage[]>(INITIAL_MESSAGES);
  const [isSending, setIsSending] = useState(false);

  // Accumulator to cap React time-animation updates at <= 10Hz
  const timeAccumRef = useRef({ delta: 0, lastFlush: 0 });

  const sunEnv = useMemo(
    () => computeSunState(simulationState.timeHour),
    [simulationState.timeHour],
  );
  const metrics = useMemo(
    () => computeCityMetrics(simulationState),
    [simulationState],
  );

  const handleDispatchAction = useCallback((action: CityAction) => {
    if (action.type === 'SELECT_COMPONENT') {
      setSelectedComponentId(action.id);
      return;
    }
    if (action.type === 'SET_CAMERA_PRESET') {
      setCameraPreset(action.preset);
      setCameraTriggerNonce((n) => n + 1);
      return;
    }
    setSimulationState((prev) => applyCityAction(prev, action));
  }, []);

  const handleSelectCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    setCameraTriggerNonce((n) => n + 1);
  }, []);

  const handleSelectComponent = useCallback((id: CityComponentId | null) => {
    if (!id) return;
    setSelectedComponentId(id);
  }, []);

  const handleAdvanceTime = useCallback((deltaHours: number) => {
    timeAccumRef.current.delta += deltaHours;
    const now = performance.now();
    if (now - timeAccumRef.current.lastFlush < 100) return;
    const step = timeAccumRef.current.delta;
    timeAccumRef.current.delta = 0;
    timeAccumRef.current.lastFlush = now;

    setSimulationState((prev) => {
      if (!prev.isPlayingTime) return prev;
      return {
        ...prev,
        timeHour: (prev.timeHour + step) % 24,
      };
    });
  }, []);

  const handleSendMessage = useCallback(
    async (text: string) => {
      const clockStamp = formatClockHour(simulationState.timeHour);
      const userMsg: AssistantChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: clockStamp,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);

      try {
        const res = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            selectedComponentId,
            simulationState,
          }),
        });

        let payload: {
          reply: string;
          actions: CityAction[];
          appliedLabels: string[];
          sourceMode?: 'gemini' | 'local-engine';
        };

        if (res.ok) {
          payload = await res.json();
        } else {
          payload = {
            ...processAssistantCommand(text, simulationState, selectedComponentId),
            sourceMode: 'local-engine',
          };
        }

        // Apply all returned simulation actions atomically
        for (const action of payload.actions) {
          handleDispatchAction(action);
        }

        const aiMsg: AssistantChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: payload.reply,
          timestamp: clockStamp,
          appliedActions: payload.appliedLabels,
          sourceMode: payload.sourceMode,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch {
        const local = processAssistantCommand(text, simulationState, selectedComponentId);
        for (const action of local.actions) {
          handleDispatchAction(action);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: local.reply,
            timestamp: clockStamp,
            appliedActions: local.appliedLabels,
            sourceMode: 'local-engine',
          },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [simulationState, selectedComponentId, handleDispatchAction],
  );

  return (
    <div className="flex flex-col lg:flex-row w-screen h-screen overflow-hidden bg-[#060B14] text-slate-100">
      {/* Left 70%: Interactive 3D Cutaway Engineering City Viewport */}
      <main className="relative w-full lg:w-[70%] h-[52vh] lg:h-full shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800/90">
        <CityViewport
          simulationState={simulationState}
          selectedComponentId={selectedComponentId}
          cameraPreset={cameraPreset}
          cameraTriggerNonce={cameraTriggerNonce}
          showLabels={showLabels}
          onSelectComponent={handleSelectComponent}
          onAdvanceTime={handleAdvanceTime}
        />
        <ViewportHud
          timeHour={simulationState.timeHour}
          isPlayingTime={simulationState.isPlayingTime}
          sunEnv={sunEnv}
          cutawayMode={simulationState.cutawayMode}
          cameraPreset={cameraPreset}
          showLabels={showLabels}
          onToggleLabels={() => setShowLabels((v) => !v)}
          onDispatchAction={handleDispatchAction}
          onSelectCameraPreset={handleSelectCameraPreset}
        />
      </main>

      {/* Right 30%: Dynamic Control Sidebar & AI City Assistant */}
      <aside
        className="w-full lg:w-[30%] h-[48vh] lg:h-full flex flex-col bg-[#080E1B] min-h-0"
        aria-label="Engineering control and AI assistant sidebar"
      >
        {/* City-Wide Live Telemetry Strip */}
        <div className="grid grid-cols-4 border-b border-slate-800 bg-[#0A1120] shrink-0">
          <div className="px-3 py-2.5 border-r border-slate-800/80">
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Sun className="w-3 h-3 text-amber-300 shrink-0" />
              <span className="truncate">Solar</span>
            </div>
            <div className="font-mono-num text-xs font-semibold text-white mt-0.5">
              {metrics.solarGenerationMW.toFixed(1)}
              <span className="text-[10px] text-cyan-400 ml-0.5">MW</span>
            </div>
          </div>

          <div className="px-3 py-2.5 border-r border-slate-800/80">
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate">Grid Net</span>
            </div>
            <div
              className={`font-mono-num text-xs font-semibold mt-0.5 ${
                metrics.netGridBalanceMW >= 0 ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {metrics.netGridBalanceMW >= 0 ? '+' : ''}
              {metrics.netGridBalanceMW.toFixed(1)}
              <span className="text-[10px] text-slate-400 ml-0.5">MW</span>
            </div>
          </div>

          <div className="px-3 py-2.5 border-r border-slate-800/80">
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">Air AQI</span>
            </div>
            <div className="font-mono-num text-xs font-semibold text-emerald-300 mt-0.5">
              {metrics.airQualityIndex}
              <span className="text-[10px] text-slate-400 ml-0.5">idx</span>
            </div>
          </div>

          <div className="px-3 py-2.5">
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <TrainFront className="w-3 h-3 text-sky-400 shrink-0" />
              <span className="truncate">Metro</span>
            </div>
            <div className="font-mono-num text-xs font-semibold text-slate-100 mt-0.5">
              {simulationState.metroActive ? `${simulationState.metroSpeedMultiplier.toFixed(1)}x` : 'Hold'}
            </div>
          </div>
        </div>

        {/* Sidebar Navigation Tabs */}
        <div
          className="grid grid-cols-2 gap-1 p-1.5 bg-[#060B14] border-b border-slate-800 shrink-0"
          role="tablist"
          aria-label="Sidebar workspace mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={sidebarTab === 'inspector'}
            onClick={() => setSidebarTab('inspector')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              sidebarTab === 'inspector'
                ? 'bg-[#0D1526] text-cyan-200 border border-cyan-400/35'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>System Inspector</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={sidebarTab === 'assistant'}
            onClick={() => setSidebarTab('assistant')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              sidebarTab === 'assistant'
                ? 'bg-[#0D1526] text-emerald-200 border border-emerald-400/35'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AI City Assistant</span>
          </button>
        </div>

        {/* Active Sidebar Panel */}
        {sidebarTab === 'inspector' ? (
          <SystemInspector
            selectedComponentId={selectedComponentId}
            simulationState={simulationState}
            metrics={metrics}
            onSelectComponent={handleSelectComponent}
            onDispatchAction={handleDispatchAction}
          />
        ) : (
          <AiAssistantPanel
            messages={messages}
            isSending={isSending}
            selectedComponentId={selectedComponentId}
            simulationState={simulationState}
            metrics={metrics}
            onSendMessage={handleSendMessage}
          />
        )}
      </aside>
    </div>
  );
}
