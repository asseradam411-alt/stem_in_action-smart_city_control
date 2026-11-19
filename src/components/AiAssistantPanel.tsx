import React, { useEffect, useRef, useState } from 'react';
import { Send, Terminal } from 'lucide-react';
import {
  AssistantChatMessage,
  CityComponentId,
  CityMetrics,
  CitySimulationState,
} from '../types/city';
import { getComponentDetails } from '../simulation/citySimulation';

interface AiAssistantPanelProps {
  messages: AssistantChatMessage[];
  isSending: boolean;
  selectedComponentId: CityComponentId;
  simulationState: CitySimulationState;
  metrics: CityMetrics;
  onSendMessage: (text: string) => void;
}

const QUICK_COMMANDS = [
  'Check solar energy',
  'Turn on building lights',
  'Analyze metro routes',
  'Monitor air quality',
  'Irrigate parks',
];

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  messages,
  isSending,
  selectedComponentId,
  simulationState,
  metrics,
  onSendMessage,
}) => {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const selectedDetails = getComponentDetails(selectedComponentId, simulationState, metrics);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;
    setDraft('');
    onSendMessage(trimmed);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Selected Component Context Strip */}
      <div className="px-4 py-2.5 bg-[#0D1526] border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="text-[11px] text-slate-400">Active Context</div>
          <div className="text-xs font-medium text-cyan-200 truncate">
            {selectedDetails.name}
          </div>
        </div>
        <span className="text-[11px] font-mono-num text-emerald-400 shrink-0">
          {selectedDetails.level}
        </span>
      </div>

      {/* Chat Log */}
      <div className="flex-1 overflow-y-auto eng-scroll p-4 space-y-3">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed border ${
                  isUser
                    ? 'bg-cyan-500/15 border-cyan-400/35 text-slate-100'
                    : 'bg-[#0D1526] border-slate-800 text-slate-200'
                }`}
              >
                <p>{msg.content}</p>
                {msg.appliedActions && msg.appliedActions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800/90 flex flex-wrap gap-1.5">
                    {msg.appliedActions.map((label) => (
                      <span
                        key={label}
                        className="text-[11px] font-mono-num text-emerald-300 bg-emerald-500/10 border border-emerald-400/25 px-2 py-0.5 rounded"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-1 px-1 flex items-center gap-2 text-[10px] text-slate-500 font-mono-num">
                <span>{isUser ? 'Operator' : 'City AI'}</span>
                <span aria-hidden="true">·</span>
                <span>{msg.timestamp}</span>
              </div>
            </div>
          );
        })}
        {isSending && (
          <div className="flex items-start">
            <div className="rounded-xl px-3.5 py-2.5 text-xs bg-[#0D1526] border border-slate-800 text-cyan-300">
              Analyzing city telemetry...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick Command Suggestions + Prompt Input */}
      <div className="p-3 border-t border-slate-800 bg-[#080E1B] space-y-2.5 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto eng-scroll pb-1">
          {QUICK_COMMANDS.map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => onSendMessage(cmd)}
              disabled={isSending}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[#0D1526] border border-slate-800 hover:border-cyan-400/45 text-slate-300 hover:text-cyan-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {cmd}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <label htmlFor="ai-city-input" className="sr-only">
            Ask AI City Assistant
          </label>
          <div className="relative flex-1">
            <Terminal className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="ai-city-input"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Command lights, solar, metro, air, parks..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-[#0D1526] border border-slate-700/80 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            aria-label="Send command"
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
