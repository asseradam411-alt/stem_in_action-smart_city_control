import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SIMULATION_STATE, applyCityAction } from './citySimulation';
import { processAssistantCommand } from './assistantEngine';

test('assistantEngine executes lighting, solar, metro, air, and park commands', () => {
  const lightRes = processAssistantCommand(
    'Turn on building lights and streetlights',
    DEFAULT_SIMULATION_STATE,
    null,
  );
  assert.ok(lightRes.actions.some((a) => a.type === 'SET_BUILDING_LIGHTS' && a.mode === 'on'));
  assert.ok(lightRes.actions.some((a) => a.type === 'SET_STREETLIGHTS' && a.mode === 'on'));

  const airRes = processAssistantCommand(
    'Boost air purifiers to max',
    DEFAULT_SIMULATION_STATE,
    null,
  );
  assert.ok(airRes.actions.some((a) => a.type === 'SET_AIR_TOWERS_RPM' && a.rpm === 95));

  const metroRes = processAssistantCommand(
    'Analyze metro routes and boost speed',
    DEFAULT_SIMULATION_STATE,
    null,
  );
  assert.ok(metroRes.actions.some((a) => a.type === 'SET_METRO_SPEED'));

  const parkRes = processAssistantCommand(
    'Irrigate parks now',
    DEFAULT_SIMULATION_STATE,
    null,
  );
  let nextState = DEFAULT_SIMULATION_STATE;
  for (const act of parkRes.actions) {
    nextState = applyCityAction(nextState, act);
  }
  assert.equal(nextState.parkIrrigation, true);
});

test('assistantEngine summarizes currently selected component when asked generically', () => {
  const res = processAssistantCommand(
    'Tell me about this component',
    DEFAULT_SIMULATION_STATE,
    'metro-station-west',
  );
  assert.ok(res.reply.includes('Westgate Subterranean Hub'));
  assert.ok(res.reply.includes('Underground'));
});
