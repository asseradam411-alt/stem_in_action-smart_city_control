import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { processAssistantCommand, describeAction } from './src/simulation/assistantEngine';
import {
  computeCityMetrics,
  computeSunState,
  formatClockHour,
  getComponentDetails,
} from './src/simulation/citySimulation';
import { CityAction, CityComponentId, CitySimulationState } from './src/types/city';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function hasUsableGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.length > 10);
}

const ai = hasUsableGeminiKey()
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

interface AssistantRequestBody {
  message: string;
  selectedComponentId: CityComponentId | null;
  simulationState: CitySimulationState;
}

function sanitizeActions(rawActions: unknown): CityAction[] {
  if (!Array.isArray(rawActions)) return [];
  const valid: CityAction[] = [];

  for (const item of rawActions) {
    if (!item || typeof item !== 'object') continue;
    const act = item as Record<string, unknown>;
    switch (act.type) {
      case 'SET_TIME':
        if (typeof act.hour === 'number' && Number.isFinite(act.hour)) {
          valid.push({ type: 'SET_TIME', hour: act.hour });
        }
        break;
      case 'SET_TIME_PLAYING':
        if (typeof act.playing === 'boolean') {
          valid.push({ type: 'SET_TIME_PLAYING', playing: act.playing });
        }
        break;
      case 'SET_BUILDING_LIGHTS':
        if (act.mode === 'auto' || act.mode === 'on' || act.mode === 'off') {
          valid.push({ type: 'SET_BUILDING_LIGHTS', mode: act.mode });
        }
        break;
      case 'SET_STREETLIGHTS':
        if (act.mode === 'auto' || act.mode === 'on' || act.mode === 'off') {
          valid.push({ type: 'SET_STREETLIGHTS', mode: act.mode });
        }
        break;
      case 'SET_SOLAR_TRACKING':
        if (typeof act.enabled === 'boolean') {
          valid.push({ type: 'SET_SOLAR_TRACKING', enabled: act.enabled });
        }
        break;
      case 'SET_SOLAR_ACTIVE':
        if (typeof act.enabled === 'boolean') {
          valid.push({ type: 'SET_SOLAR_ACTIVE', enabled: act.enabled });
        }
        break;
      case 'SET_AIR_TOWERS_RPM':
        if (typeof act.rpm === 'number' && Number.isFinite(act.rpm)) {
          valid.push({ type: 'SET_AIR_TOWERS_RPM', rpm: act.rpm });
        }
        break;
      case 'SET_PARK_IRRIGATION':
        if (typeof act.enabled === 'boolean') {
          valid.push({ type: 'SET_PARK_IRRIGATION', enabled: act.enabled });
        }
        break;
      case 'SET_METRO_ACTIVE':
        if (typeof act.active === 'boolean') {
          valid.push({ type: 'SET_METRO_ACTIVE', active: act.active });
        }
        break;
      case 'SET_METRO_SPEED':
        if (typeof act.multiplier === 'number' && Number.isFinite(act.multiplier)) {
          valid.push({ type: 'SET_METRO_SPEED', multiplier: act.multiplier });
        }
        break;
      case 'SET_METRO_STATION_LIGHTS':
        if (typeof act.enabled === 'boolean') {
          valid.push({ type: 'SET_METRO_STATION_LIGHTS', enabled: act.enabled });
        }
        break;
      case 'SET_CUTAWAY_MODE':
        if (act.mode === 'cutaway' || act.mode === 'surface' || act.mode === 'underground') {
          valid.push({ type: 'SET_CUTAWAY_MODE', mode: act.mode });
        }
        break;
      case 'SET_CAMERA_PRESET':
        if (
          act.preset === 'isometric' ||
          act.preset === 'underground' ||
          act.preset === 'aerial' ||
          act.preset === 'solar'
        ) {
          valid.push({ type: 'SET_CAMERA_PRESET', preset: act.preset });
        }
        break;
      default:
        break;
    }
  }
  return valid;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, geminiConfigured: Boolean(ai) });
  });

  app.post('/api/assistant', async (req, res) => {
    const body = req.body as Partial<AssistantRequestBody>;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const simulationState = body.simulationState;
    const selectedComponentId = body.selectedComponentId ?? null;

    if (!message || !simulationState) {
      res.status(400).json({ error: 'Missing message or simulationState' });
      return;
    }

    // If Gemini API is not configured, run deterministic smart city command engine
    if (!ai) {
      const local = processAssistantCommand(message, simulationState, selectedComponentId);
      res.json({ ...local, sourceMode: 'local-engine' });
      return;
    }

    try {
      const metrics = computeCityMetrics(simulationState);
      const sun = computeSunState(simulationState.timeHour);
      const selectedDetails = selectedComponentId
        ? getComponentDetails(selectedComponentId, simulationState, metrics)
        : null;

      const contextSummary = {
        clockTime: formatClockHour(simulationState.timeHour),
        solarPhase: sun.phaseLabel,
        solarElevationDeg: sun.elevationDeg,
        state: simulationState,
        metrics,
        selectedComponent: selectedDetails,
      };

      const systemInstruction = `You are the chief systems engineering assistant for VerdantGrid 3D, a smart sustainable city engineering simulator.
Respond concisely (2-4 crisp engineering sentences, plain text without markdown clutter) and return executable simulation actions when the user asks to control lights, time of day, solar tracking, air purification towers, park irrigation, metro trains/speed, cutaway layers, or camera presets.
Use the live telemetry context accurately. Do not invent numbers outside the provided context.

Available action objects in the "actions" array:
- {"type":"SET_TIME","hour":number (0..24)}
- {"type":"SET_TIME_PLAYING","playing":boolean}
- {"type":"SET_BUILDING_LIGHTS","mode":"auto"|"on"|"off"}
- {"type":"SET_STREETLIGHTS","mode":"auto"|"on"|"off"}
- {"type":"SET_SOLAR_TRACKING","enabled":boolean}
- {"type":"SET_SOLAR_ACTIVE","enabled":boolean}
- {"type":"SET_AIR_TOWERS_RPM","rpm":number (0..100)}
- {"type":"SET_PARK_IRRIGATION","enabled":boolean}
- {"type":"SET_METRO_ACTIVE","active":boolean}
- {"type":"SET_METRO_SPEED","multiplier":number (0.5..2.0)}
- {"type":"SET_METRO_STATION_LIGHTS","enabled":boolean}
- {"type":"SET_CUTAWAY_MODE","mode":"cutaway"|"surface"|"underground"}
- {"type":"SET_CAMERA_PRESET","preset":"isometric"|"underground"|"aerial"|"solar"}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Live City Telemetry:\n${JSON.stringify(contextSummary)}\n\nOperator Command/Question:\n${message}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: 'Concise engineering response explaining findings or changes.',
              },
              actions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    hour: { type: Type.NUMBER },
                    playing: { type: Type.BOOLEAN },
                    mode: { type: Type.STRING },
                    enabled: { type: Type.BOOLEAN },
                    rpm: { type: Type.NUMBER },
                    active: { type: Type.BOOLEAN },
                    multiplier: { type: Type.NUMBER },
                    preset: { type: Type.STRING },
                  },
                  required: ['type'],
                },
              },
            },
            required: ['reply', 'actions'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        reply?: string;
        actions?: unknown;
      };
      const actions = sanitizeActions(parsed.actions);
      const reply =
        typeof parsed.reply === 'string' && parsed.reply.trim().length > 0
          ? parsed.reply.trim()
          : processAssistantCommand(message, simulationState, selectedComponentId).reply;

      res.json({
        reply,
        actions,
        appliedLabels: actions.map(describeAction),
        suggestedPrompts: [
          'Check solar energy',
          'Turn on building lights',
          'Analyze metro routes',
          'Boost air purifiers',
          'Irrigate parks',
        ],
        sourceMode: 'gemini',
      });
    } catch (error) {
      // Fallback gracefully to deterministic command engine if upstream request fails
      console.warn('Gemini assistant fallback to local command engine:', error instanceof Error ? error.message : error);
      const local = processAssistantCommand(message, simulationState, selectedComponentId);
      res.json({ ...local, sourceMode: 'local-engine' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VerdantGrid 3D simulator running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
