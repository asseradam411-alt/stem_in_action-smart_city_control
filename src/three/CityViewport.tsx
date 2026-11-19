import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CameraPreset,
  CityComponentId,
  CitySimulationState,
} from '../types/city';
import {
  computeSunState,
  getComponentDetails,
  computeCityMetrics,
  isLightingLit,
} from '../simulation/citySimulation';
import { createProceduralTextures } from './textures';
import { buildCityScene, CitySceneHandles } from './cityModels';

interface CityViewportProps {
  simulationState: CitySimulationState;
  selectedComponentId: CityComponentId | null;
  cameraPreset: CameraPreset;
  cameraTriggerNonce: number;
  showLabels: boolean;
  onSelectComponent: (id: CityComponentId | null) => void;
  onAdvanceTime: (deltaHours: number) => void;
}

const CAMERA_PRESETS: Record<
  CameraPreset,
  { position: [number, number, number]; target: [number, number, number] }
> = {
  isometric: {
    position: [16.5, 15.2, 26.8],
    target: [0.3, -0.5, 0.2],
  },
  underground: {
    position: [4.5, 1.4, 19.8],
    target: [0, -2.5, 5.4],
  },
  aerial: {
    position: [0.2, 29.0, 9.0],
    target: [0, 0, -0.8],
  },
  solar: {
    position: [-15.5, 7.2, 8.8],
    target: [-9.4, 0.8, -0.8],
  },
};

// Module-scope scratch math objects (zero GC inside render loop)
const _mouse = new THREE.Vector2();
const _sunDir = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _boxCenter = new THREE.Vector3();
const _boxSize = new THREE.Vector3();
const _colorA = new THREE.Color();
const _colorB = new THREE.Color();
const _projVec = new THREE.Vector3();

const LABEL_METADATA: { id: CityComponentId; label: string; level: 'Ground' | 'Underground' }[] = [
  { id: 'eco-residences-west', label: 'Eco-Residences', level: 'Ground' },
  { id: 'solar-farm-ground', label: 'Helios Solar Grid', level: 'Ground' },
  { id: 'air-purifier-alpha', label: 'AeroPure Alpha', level: 'Ground' },
  { id: 'central-eco-park', label: 'Central Eco-Park', level: 'Ground' },
  { id: 'civic-innovation-east', label: 'Innovation Tower', level: 'Ground' },
  { id: 'air-purifier-beta', label: 'AeroPure Beta', level: 'Ground' },
  { id: 'metro-station-west', label: 'Westgate Hub -14.5m', level: 'Underground' },
  { id: 'metro-station-east', label: 'Central Interchange -14.5m', level: 'Underground' },
];

export const CityViewport: React.FC<CityViewportProps> = ({
  simulationState,
  selectedComponentId,
  cameraPreset,
  cameraTriggerNonce,
  showLabels,
  onSelectComponent,
  onAdvanceTime,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [webglError, setWebglError] = useState<string | null>(null);

  const showLabelsRef = useRef(showLabels);
  showLabelsRef.current = showLabels;

  // Latest props in refs so WebGL effect runs only once
  const stateRef = useRef(simulationState);
  stateRef.current = simulationState;

  const selectedRef = useRef(selectedComponentId);
  selectedRef.current = selectedComponentId;

  const onSelectRef = useRef(onSelectComponent);
  onSelectRef.current = onSelectComponent;

  const onAdvanceTimeRef = useRef(onAdvanceTime);
  onAdvanceTimeRef.current = onAdvanceTime;

  const cameraGoalRef = useRef<{
    active: boolean;
    position: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    position: new THREE.Vector3(...CAMERA_PRESETS.isometric.position),
    target: new THREE.Vector3(...CAMERA_PRESETS.isometric.target),
  });

  // Respond to camera preset triggers
  useEffect(() => {
    const preset = CAMERA_PRESETS[cameraPreset];
    cameraGoalRef.current.position.set(...preset.position);
    cameraGoalRef.current.target.set(...preset.target);
    cameraGoalRef.current.active = true;
  }, [cameraPreset, cameraTriggerNonce]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGL rendering context is unavailable in this browser.');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 720;
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('3D graphics context interrupted. Attempting recovery...');
    };
    const handleContextRestored = () => {
      setWebglError(null);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#4576a8', 0.0115);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.25, 260);
    camera.position.set(...CAMERA_PRESETS.isometric.position);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.isometric.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 8;
    controls.maxDistance = 46;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minAzimuthAngle = -Math.PI * 0.65;
    controls.maxAzimuthAngle = Math.PI * 0.65;
    controls.update();

    const handleControlsStart = () => {
      cameraGoalRef.current.active = false;
    };
    controls.addEventListener('start', handleControlsStart);

    // Three-point + outdoor daylight rig (only 1 shadow caster)
    const hemiLight = new THREE.HemisphereLight(0x9bd2ff, 0x203042, 0.9);
    scene.add(hemiLight);

    const sunKeyLight = new THREE.DirectionalLight(0xfff5e0, 2.4);
    sunKeyLight.position.set(16, 30, 14);
    sunKeyLight.castShadow = !isSoftwareGl;
    sunKeyLight.shadow.mapSize.width = 1024;
    sunKeyLight.shadow.mapSize.height = 1024;
    sunKeyLight.shadow.camera.near = 2;
    sunKeyLight.shadow.camera.far = 90;
    const d = 18;
    sunKeyLight.shadow.camera.left = -d;
    sunKeyLight.shadow.camera.right = d;
    sunKeyLight.shadow.camera.top = d;
    sunKeyLight.shadow.camera.bottom = -d;
    sunKeyLight.shadow.bias = -0.0005;
    sunKeyLight.shadow.normalBias = 0.02;
    scene.add(sunKeyLight);

    // Subtle cool underground cutaway fill so tunnels stay crisp at night too
    const undergroundFillLeft = new THREE.PointLight(0x38bdf8, 1.35, 16, 1.5);
    undergroundFillLeft.position.set(-7.2, -2.0, 5.5);
    scene.add(undergroundFillLeft);

    const undergroundFillRight = new THREE.PointLight(0x34d399, 1.35, 16, 1.5);
    undergroundFillRight.position.set(7.2, -2.0, 5.5);
    scene.add(undergroundFillRight);

    const maxAnisotropy = isSoftwareGl ? 1 : renderer.capabilities.getMaxAnisotropy();
    const textures = createProceduralTextures(maxAnisotropy);
    const city: CitySceneHandles = buildCityScene(scene, textures, isSoftwareGl);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting for component click & hover
    const raycaster = new THREE.Raycaster();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverTime = 0;

    const updateMouseFromEvent = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const pickComponent = (): CityComponentId | null => {
      raycaster.setFromCamera(_mouse, camera);
      const hits = raycaster.intersectObjects(city.interactables, true);
      for (const hit of hits) {
        let cur: THREE.Object3D | null = hit.object;
        while (cur) {
          if (cur.visible === false) break;
          if (cur.userData?.componentId) {
            // Skip invisible layers when cutaway mode hides them
            const st = stateRef.current;
            const id = cur.userData.componentId as CityComponentId;
            const isUnderground =
              id === 'metro-station-west' ||
              id === 'metro-station-east' ||
              id === 'metro-tunnel-line';
            if (st.cutawayMode === 'surface' && isUnderground) break;
            if (st.cutawayMode === 'underground' && !isUnderground) break;
            return id;
          }
          cur = cur.parent;
        }
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (dx * dx + dy * dy > 36) return; // Dragged camera, ignore click
      updateMouseFromEvent(e);
      const picked = pickComponent();
      if (picked) {
        onSelectRef.current(picked);
        const st = stateRef.current;
        const details = getComponentDetails(picked, st, computeCityMetrics(st));
        cameraGoalRef.current.target.set(...details.focusTarget);
        cameraGoalRef.current.position.set(
          details.focusTarget[0] + details.cameraOffset[0],
          details.focusTarget[1] + details.cameraOffset[1],
          details.focusTarget[2] + details.cameraOffset[2],
        );
        cameraGoalRef.current.active = true;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 65) return;
      lastHoverTime = now;
      updateMouseFromEvent(e);
      const hovered = pickComponent();
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    // ResizeObserver keeps 70% canvas perfectly sized
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(1, Math.floor(entry.contentRect.width));
        const h = Math.max(1, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    // Animation loop state
    let frameId = 0;
    let disposed = false;
    let lastTimestamp = performance.now();
    let trainEastX = -8;
    let trainWestX = 8;
    let shuttle1X = -10;
    let shuttle2X = 10;
    let mistTime = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        if (disposed) return;
        const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 6);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 6);
    }

    function updateSceneFromState(dt: number, elapsedSec: number) {
      const st = stateRef.current;

      // Advance solar time if playing
      if (st.isPlayingTime) {
        onAdvanceTimeRef.current(dt * st.timeSpeed);
      }

      const sun = computeSunState(st.timeHour);
      const buildingLit = isLightingLit(st.buildingLights, sun);
      const streetLit = isLightingLit(st.streetlights, sun);

      // Update sky & sun arc
      city.sunOrb.position.set(...sun.sunPosition);
      city.sunHalo.position.set(...sun.sunPosition);
      city.sunOrb.visible = sun.sunPosition[1] > -4;
      city.sunHalo.visible = sun.sunPosition[1] > -4;

      _sunDir.set(...sun.sunPosition).normalize();
      city.skyMaterial.uniforms.uTopColor.value.set(sun.skyTopHex);
      city.skyMaterial.uniforms.uHorizonColor.value.set(sun.skyHorizonHex);
      city.skyMaterial.uniforms.uSunDir.value.copy(_sunDir);
      city.skyMaterial.uniforms.uSunGlowIntensity.value = sun.isNight ? 0.05 : sun.isDuskOrDawn ? 0.85 : 0.45;

      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set(sun.fogHex);
      }

      sunKeyLight.position.set(
        sun.sunPosition[0] * 0.7,
        Math.max(sun.sunPosition[1] * 0.7, 4),
        sun.sunPosition[2] * 0.7,
      );
      sunKeyLight.color.set(sun.keyLightHex);
      sunKeyLight.intensity = sun.keyLightIntensity;

      hemiLight.color.set(sun.hemiSkyHex);
      hemiLight.groundColor.set(sun.hemiGroundHex);
      hemiLight.intensity = sun.hemiIntensity;

      // Building window emissives (faster response so time jumps feel immediate)
      const targetWinEmissive = buildingLit ? 1.35 : 0.04;
      for (const mat of city.buildingWindowMaterials) {
        mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, targetWinEmissive, 14, dt);
      }

      // Streetlights
      const targetStreetEmissive = streetLit ? 1.9 : 0.0;
      city.streetlightBulbMaterial.emissiveIntensity = THREE.MathUtils.damp(
        city.streetlightBulbMaterial.emissiveIntensity,
        targetStreetEmissive,
        14,
        dt,
      );
      const targetBeamOpacity = streetLit ? 0.065 : 0.0;
      for (const beam of city.streetlightBeams) {
        const bm = beam.material as THREE.MeshBasicMaterial;
        bm.opacity = THREE.MathUtils.damp(bm.opacity, targetBeamOpacity, 14, dt);
      }

      // Metro station lights
      const stationGlow = st.metroStationLights ? 1.25 : 0.12;
      city.metroStationLightMaterial.emissiveIntensity = THREE.MathUtils.damp(
        city.metroStationLightMaterial.emissiveIntensity,
        stationGlow,
        6,
        dt,
      );
      undergroundFillLeft.intensity = st.metroStationLights ? 1.4 : 0.35;
      undergroundFillRight.intensity = st.metroStationLights ? 1.4 : 0.35;

      // Solar panels track sun azimuth/elevation
      const targetTiltX = st.solarTracking && st.solarArrayActive
        ? THREE.MathUtils.clamp((sun.sunPosition[2] / 46) * 0.45, -0.45, 0.45)
        : 0.28;
      const targetTiltZ = st.solarTracking && st.solarArrayActive && !sun.isNight
        ? THREE.MathUtils.clamp((-sun.sunPosition[0] / 46) * 0.52, -0.52, 0.52)
        : 0.0;
      for (const pivot of city.solarPanelPivots) {
        pivot.rotation.x = THREE.MathUtils.damp(pivot.rotation.x, targetTiltX, 4, dt);
        pivot.rotation.z = THREE.MathUtils.damp(pivot.rotation.z, targetTiltZ, 4, dt);
      }

      // Air purification turbines + ionization plume rings
      city.airTurbineAlpha.rotation.y += dt * (st.airTowerAlphaRpm / 100) * 8.5;
      city.airTurbineBeta.rotation.y += dt * (st.airTowerBetaRpm / 100) * 8.5;

      const updatePlumes = (rings: THREE.Mesh[], rpm: number) => {
        const active = rpm > 5;
        for (const ring of rings) {
          ring.visible = active;
          if (!active) continue;
          const phase = ((ring.userData.phase as number) + elapsedSec * (0.28 + rpm / 220)) % 1;
          ring.position.y = 4.45 + phase * 1.9;
          const scale = 0.75 + phase * 0.7;
          ring.scale.setScalar(scale);
          (ring.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.48;
        }
      };
      updatePlumes(city.airPlumeRingsAlpha, st.airTowerAlphaRpm);
      updatePlumes(city.airPlumeRingsBeta, st.airTowerBetaRpm);

      // Park irrigation mist & water shimmer
      const mistMat = city.parkMistParticles.material as THREE.PointsMaterial;
      mistMat.opacity = THREE.MathUtils.damp(mistMat.opacity, st.parkIrrigation ? 0.72 : 0.0, 5, dt);
      if (st.parkIrrigation) {
        mistTime += dt;
        city.parkMistParticles.position.y = Math.sin(mistTime * 2.5) * 0.08;
      }
      _colorA.setHex(st.parkIrrigation ? 0x0ea5e9 : 0x0369a1);
      _colorB.copy((city.parkWaterMesh.material as THREE.MeshPhysicalMaterial).color);
      _colorB.lerp(_colorA, Math.min(1, dt * 4));
      (city.parkWaterMesh.material as THREE.MeshPhysicalMaterial).color.copy(_colorB);

      // Underground Metro Trains animation
      if (st.metroActive) {
        const speed = 4.2 * st.metroSpeedMultiplier;
        trainEastX += dt * speed;
        if (trainEastX > 10.6) trainEastX = -10.6;
        trainWestX -= dt * speed;
        if (trainWestX < -10.6) trainWestX = 10.6;
      }
      city.metroTrainEast.position.x = trainEastX;
      city.metroTrainWest.position.x = trainWestX;

      // Ground EV Shuttles gliding smoothly
      shuttle1X += dt * 2.4;
      if (shuttle1X > 12.6) shuttle1X = -12.6;
      shuttle2X -= dt * 2.1;
      if (shuttle2X < -12.6) shuttle2X = 12.6;
      city.evShuttles[0].position.x = shuttle1X;
      city.evShuttles[1].position.x = shuttle2X;

      // Layer visibility mode (Cutaway / Surface / Underground)
      city.surfaceGroup.visible = st.cutawayMode !== 'underground';
      city.undergroundGroup.visible = st.cutawayMode !== 'surface';

      // Selection bracket highlight
      const selId = selectedRef.current;
      if (selId && city.componentBounds.has(selId)) {
        const box = city.componentBounds.get(selId)!;
        box.getCenter(_boxCenter);
        box.getSize(_boxSize);
        city.selectionBracket.visible = true;
        const frame = city.selectionBracket.children[0] as THREE.LineSegments;
        frame.position.copy(_boxCenter);
        frame.scale.set(_boxSize.x + 0.35, _boxSize.y + 0.3, _boxSize.z + 0.35);

        const ring = city.selectionBracket.children[1] as THREE.Mesh;
        ring.position.set(_boxCenter.x, box.min.y + 0.06, _boxCenter.z);
        const radius = Math.max(_boxSize.x, _boxSize.z) * 0.56;
        ring.scale.setScalar(radius);
      } else {
        city.selectionBracket.visible = false;
      }

      // Smooth damped camera preset transitions
      if (cameraGoalRef.current.active) {
        _targetCamPos.copy(cameraGoalRef.current.position);
        _targetLook.copy(cameraGoalRef.current.target);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 5.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 5.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 5.5, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetLook.x, 5.5, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetLook.y, 5.5, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetLook.z, 5.5, dt);

        if (
          camera.position.distanceToSquared(_targetCamPos) < 0.02 &&
          controls.target.distanceToSquared(_targetLook) < 0.02
        ) {
          cameraGoalRef.current.active = false;
        }
      }
      controls.update();

      // Project 3D engineering callout labels cleanly onto DOM overlay
      const cw = container?.clientWidth || 1;
      const ch = container?.clientHeight || 1;
      const labelsEnabled = showLabelsRef.current;
      for (const anchor of city.labelAnchors) {
        const el = labelRefs.current[anchor.id];
        if (!el) continue;
        const hiddenByLayer =
          (st.cutawayMode === 'surface' && anchor.level === 'Underground') ||
          (st.cutawayMode === 'underground' && anchor.level === 'Ground');

        if (!labelsEnabled || hiddenByLayer) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }

        _projVec.copy(anchor.position).project(camera);
        if (_projVec.z > 1 || _projVec.z < -1) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }
        const sx = (_projVec.x * 0.5 + 0.5) * cw;
        const sy = (-_projVec.y * 0.5 + 0.5) * ch;
        const inBounds = sx > 36 && sx < cw - 36 && sy > 64 && sy < ch - 76;
        if (!inBounds) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
        el.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0) translate(-50%, -100%)`;
      }
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.12, Math.max(0.001, (now - lastTimestamp) / 1000));
      lastTimestamp = now;

      updateSceneFromState(dt, now / 1000);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    // Initial render & loop start
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', handleControlsStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      city.dispose();
      textures.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      className="relative w-full h-full bg-[#060B14] overflow-hidden"
      data-testid="city-canvas-container"
      data-selected-component={selectedComponentId ?? 'none'}
      data-time-hour={simulationState.timeHour.toFixed(1)}
      data-cutaway-mode={simulationState.cutawayMode}
    >
      <div ref={mountRef} className="w-full h-full" />

      {/* Projected 3D Engineering Callout Labels */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {LABEL_METADATA.map((item) => {
          const isSelected = selectedComponentId === item.id;
          return (
            <button
              key={item.id}
              ref={(el) => {
                labelRefs.current[item.id] = el;
              }}
              type="button"
              onClick={() => onSelectComponent(item.id)}
              style={{ opacity: 0, left: 0, top: 0 }}
              className={`absolute px-2 py-0.5 rounded text-[10px] font-mono-num font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-md'
                  : item.level === 'Underground'
                    ? 'bg-[#070E1A]/90 text-emerald-300 border-emerald-400/40 hover:border-emerald-300'
                    : 'bg-[#070E1A]/90 text-slate-200 border-cyan-400/30 hover:border-cyan-300'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#060B14]/95 p-6 text-center">
          <div className="max-w-md border border-cyan-500/30 bg-[#0D1526] p-6 rounded-xl">
            <h2 className="font-display text-lg font-semibold text-slate-100">
              3D Engineering Viewport Notice
            </h2>
            <p className="mt-2 text-sm text-slate-300">{webglError}</p>
          </div>
        </div>
      )}
    </div>
  );
};
