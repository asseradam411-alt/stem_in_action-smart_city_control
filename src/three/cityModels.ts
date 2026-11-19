import * as THREE from 'three';
import { CityComponentId } from '../types/city';
import { ProceduralTextureSet } from './textures';

export interface CitySceneHandles {
  root: THREE.Group;
  surfaceGroup: THREE.Group;
  undergroundGroup: THREE.Group;
  interactables: THREE.Object3D[];
  componentBounds: Map<CityComponentId, THREE.Box3>;
  selectionBracket: THREE.Group;
  // Dynamic animatables
  sunOrb: THREE.Mesh;
  sunHalo: THREE.Mesh;
  skyMaterial: THREE.ShaderMaterial;
  buildingWindowMaterials: THREE.MeshStandardMaterial[];
  streetlightBulbMaterial: THREE.MeshStandardMaterial;
  streetlightBeams: THREE.Mesh[];
  metroStationLightMaterial: THREE.MeshStandardMaterial;
  solarPanelPivots: THREE.Group[];
  airTurbineAlpha: THREE.Group;
  airTurbineBeta: THREE.Group;
  airPlumeRingsAlpha: THREE.Mesh[];
  airPlumeRingsBeta: THREE.Mesh[];
  parkMistParticles: THREE.Points;
  parkWaterMesh: THREE.Mesh;
  metroTrainEast: THREE.Group;
  metroTrainWest: THREE.Group;
  evShuttles: THREE.Group[];
  labelAnchors: { id: CityComponentId; label: string; level: 'Ground' | 'Underground'; position: THREE.Vector3 }[];
  dispose: () => void;
}

function tagClickable(obj: THREE.Object3D, id: CityComponentId, interactables: THREE.Object3D[]) {
  obj.userData.componentId = id;
  obj.traverse((child) => {
    child.userData.componentId = id;
  });
  interactables.push(obj);
}

function createContactShadow(
  tex: THREE.CanvasTexture,
  width: number,
  depth: number,
  y = 0.015,
): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

function createSkyDome(): { mesh: THREE.Mesh; material: THREE.ShaderMaterial } {
  const geo = new THREE.SphereGeometry(120, 32, 20);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTopColor: { value: new THREE.Color('#1d69b8') },
      uHorizonColor: { value: new THREE.Color('#87c5eb') },
      uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
      uSunGlowIntensity: { value: 0.55 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDir;
      uniform float uSunGlowIntensity;
      varying vec3 vWorldPos;
      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = clamp(dir.y * 1.45 + 0.08, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.65));
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        col += vec3(1.0, 0.72, 0.42) * pow(sunDot, 16.0) * uSunGlowIntensity;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, material);
  return { mesh, material };
}

function createMetroTrain(
  accentColor: number,
  windowMat: THREE.MeshStandardMaterial,
): THREE.Group {
  const train = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.25,
    metalness: 0.55,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.55,
    metalness: 0.4,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.45,
    roughness: 0.3,
  });
  const bogieMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.8,
    metalness: 0.3,
  });

  const carOffsets = [-2.15, 0, 2.15];
  for (let i = 0; i < carOffsets.length; i++) {
    const car = new THREE.Group();
    car.position.x = carOffsets[i];

    // Lower chassis & bogies
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.76), bogieMat);
    chassis.position.y = 0.09;
    car.add(chassis);

    // Main passenger hull
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.54, 0.82), bodyMat);
    hull.position.y = 0.42;
    hull.castShadow = true;
    car.add(hull);

    // Roof fairing
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.09, 0.68), roofMat);
    roof.position.y = 0.73;
    car.add(roof);

    // Illuminated window band
    const winBand = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.2, 0.84), windowMat);
    winBand.position.y = 0.46;
    car.add(winBand);

    // Cyan/emerald transit livery stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.93, 0.06, 0.835), stripeMat);
    stripe.position.y = 0.27;
    car.add(stripe);

    // Aerodynamic sloped nose cones on front/rear cars
    if (i === 0 || i === 2) {
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.45, 4), bodyMat);
      nose.rotation.y = Math.PI / 4;
      nose.rotation.z = i === 2 ? -Math.PI / 2 : Math.PI / 2;
      nose.scale.set(0.65, 1.0, 0.95);
      nose.position.set(i === 2 ? 1.12 : -1.12, 0.36, 0);
      car.add(nose);

      // Headlight strip
      const headlight = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.08, 0.48),
        new THREE.MeshBasicMaterial({ color: 0xfff3c4 }),
      );
      headlight.position.set(i === 2 ? 1.24 : -1.24, 0.28, 0);
      car.add(headlight);
    }

    train.add(car);
  }

  return train;
}

function createEvShuttle(accentColor: number): THREE.Group {
  const shuttle = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.25,
    metalness: 0.4,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.12,
    metalness: 0.8,
  });
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.85,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.5,
  });

  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.22, 0.54), bodyMat);
  lower.position.y = 0.16;
  lower.castShadow = true;
  shuttle.add(lower);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.24, 0.48), glassMat);
  cabin.position.y = 0.38;
  shuttle.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.44), trimMat);
  roof.position.y = 0.51;
  shuttle.add(roof);

  const wheelGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12);
  wheelGeo.rotateX(Math.PI / 2);
  for (const wx of [-0.32, 0.32]) {
    for (const wz of [-0.26, 0.26]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, 0.09, wz);
      shuttle.add(wheel);
    }
  }

  return shuttle;
}

function createAirPurifierTower(
  id: CityComponentId,
  scaleFactor: number,
  textures: ProceduralTextureSet,
): {
  group: THREE.Group;
  turbine: THREE.Group;
  plumeRings: THREE.Mesh[];
} {
  const group = new THREE.Group();

  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85, metalness: 0.15 });
  const alloyMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.85 });
  const finMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.65 });
  const chamberMat = new THREE.MeshPhysicalMaterial({
    color: 0x67e8f9,
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const glowRingMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });

  group.add(createContactShadow(textures.contactShadowMap, 3.0 * scaleFactor, 3.0 * scaleFactor));

  // 1. Hexagonal plinth base
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.45, 6), plinthMat);
  plinth.position.y = 0.225;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // 2. Central structural core shaft
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 4.6, 16), alloyMat);
  core.position.y = 2.6;
  core.castShadow = true;
  group.add(core);

  // 3. Translucent scrubbing glass chamber
  const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.92, 2.8, 16, 1, true), chamberMat);
  chamber.position.y = 2.2;
  chamber.renderOrder = 3;
  group.add(chamber);

  // 4. Six architectural intake louvers / fins
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.5, 0.46), finMat);
    fin.position.set(Math.cos(angle) * 0.88, 2.25, Math.sin(angle) * 0.88);
    fin.rotation.y = -angle;
    fin.castShadow = true;
    group.add(fin);
  }

  // 5. Rotating intake turbine assembly inside upper shroud
  const turbine = new THREE.Group();
  turbine.position.y = 3.95;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.35, 12), alloyMat);
  turbine.add(hub);
  for (let b = 0; b < 6; b++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, 0.2), glowRingMat);
    const a = (b / 6) * Math.PI * 2;
    blade.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42);
    blade.rotation.y = -a;
    blade.rotation.x = 0.38;
    turbine.add(blade);
  }
  group.add(turbine);

  // 6. Upper exhaust crown & beacon ring
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.11, 12, 24), alloyMat);
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 4.25;
  group.add(crown);

  const ledRing = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.05, 10, 24), glowRingMat);
  ledRing.rotation.x = Math.PI / 2;
  ledRing.position.y = 4.4;
  group.add(ledRing);

  // 7. Rising clean-air ionization rings
  const plumeRings: THREE.Mesh[] = [];
  for (let r = 0; r < 3; r++) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.028, 8, 24), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 4.6 + r * 0.65;
    ring.userData.phase = r / 3;
    group.add(ring);
    plumeRings.push(ring);
  }

  group.scale.setScalar(scaleFactor);
  group.userData.componentId = id;
  return { group, turbine, plumeRings };
}

export function buildCityScene(
  scene: THREE.Scene,
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
): CitySceneHandles {
  const root = new THREE.Group();
  const surfaceGroup = new THREE.Group();
  const undergroundGroup = new THREE.Group();
  root.add(surfaceGroup);
  root.add(undergroundGroup);

  const interactables: THREE.Object3D[] = [];
  const componentBounds = new Map<CityComponentId, THREE.Box3>();
  const buildingWindowMaterials: THREE.MeshStandardMaterial[] = [];
  const solarPanelPivots: THREE.Group[] = [];
  const streetlightBeams: THREE.Mesh[] = [];
  const evShuttles: THREE.Group[] = [];

  // Sky Dome & Sun Orb
  const { mesh: skyMesh, material: skyMaterial } = createSkyDome();
  scene.add(skyMesh);

  const sunOrb = new THREE.Mesh(
    new THREE.SphereGeometry(2.3, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff4cc }),
  );
  scene.add(sunOrb);

  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(4.0, 20, 16),
    new THREE.MeshBasicMaterial({
      color: 0xffc86b,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    }),
  );
  scene.add(sunHalo);

  // =========================================================
  // 1. CUTAWAY GEOLOGICAL BASE & SUBTERRANEAN INFRASTRUCTURE
  // =========================================================
  const strataMat = new THREE.MeshStandardMaterial({
    map: textures.strataMap,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.05,
  });
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.85,
    metalness: 0.12,
  });
  const groundDeckMat = new THREE.MeshStandardMaterial({
    color: 0x1a2536,
    roughness: 0.82,
    metalness: 0.1,
  });

  // Bottom bedrock foundation plinth (covers entire 28x19.6m footprint)
  const bedrockBase = new THREE.Mesh(new THREE.BoxGeometry(28.2, 0.6, 19.6), strataMat);
  bedrockBase.position.set(0, -4.45, -0.4);
  bedrockBase.receiveShadow = true;
  root.add(bedrockBase);

  // Solid back & middle geological block (Z from -10.2 to +3.6) leaving front Z=+3.6..+9.4 open for cutaway!
  const upperTerrainMass = new THREE.Mesh(new THREE.BoxGeometry(28.0, 4.12, 13.8), strataMat);
  upperTerrainMass.position.set(0, -2.09, -3.3);
  upperTerrainMass.receiveShadow = true;
  surfaceGroup.add(upperTerrainMass);

  // Ground surface plateau slab (Y = 0.0) over Z=[-10.2, 3.6]
  const groundSurfaceSlab = new THREE.Mesh(new THREE.BoxGeometry(28.04, 0.08, 13.84), groundDeckMat);
  groundSurfaceSlab.position.set(0, -0.02, -3.3);
  groundSurfaceSlab.receiveShadow = true;
  surfaceGroup.add(groundSurfaceSlab);

  // Subtle architectural glass promenade bridge over part of the cutaway edge so ground/underground integrate cleanly
  const cutawayRimMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.7,
  });
  const cutawayEdgeStrip = new THREE.Mesh(new THREE.BoxGeometry(28.06, 0.1, 0.14), cutawayRimMat);
  cutawayEdgeStrip.position.set(0, 0.0, 3.6);
  surfaceGroup.add(cutawayEdgeStrip);

  // Metro tunnel floor & retaining wall
  const tunnelBed = new THREE.Mesh(new THREE.BoxGeometry(27.8, 0.12, 5.4), concreteMat);
  tunnelBed.position.set(0, -4.09, 6.3);
  tunnelBed.receiveShadow = true;
  undergroundGroup.add(tunnelBed);

  const backRetainingWall = new THREE.Mesh(new THREE.BoxGeometry(27.8, 3.7, 0.25), concreteMat);
  backRetainingWall.position.set(0, -2.25, 3.68);
  backRetainingWall.receiveShadow = true;
  undergroundGroup.add(backRetainingWall);

  // Subterranean fiber-optic & power conduit pipes along cutaway wall
  const conduitCyan = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 27.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.7 }),
  );
  conduitCyan.rotation.z = Math.PI / 2;
  conduitCyan.position.set(0, -0.95, 3.84);
  undergroundGroup.add(conduitCyan);

  const conduitAmber = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 27.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.75 }),
  );
  conduitAmber.rotation.z = Math.PI / 2;
  conduitAmber.position.set(0, -1.16, 3.84);
  undergroundGroup.add(conduitAmber);

  // Curved steel/concrete tunnel cutaway ribs framing the underground rail spine
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.5 });
  for (let rx = -12.5; rx <= 12.5; rx += 2.5) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.26, 3.75, 0.4), ribMat);
    col.position.set(rx, -2.22, 3.85);
    undergroundGroup.add(col);

    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 2.8), ribMat);
    beam.position.set(rx, -0.45, 5.1);
    undergroundGroup.add(beam);
  }

  // Subterranean Rail Bed, Sleepers (InstancedMesh), Twin Steel Tracks & Third-Rail Bus
  const metroLineGroup = new THREE.Group();
  const ballastMat = new THREE.MeshStandardMaterial({ color: 0x1e2530, roughness: 0.95 });
  const ballast = new THREE.Mesh(new THREE.BoxGeometry(27.4, 0.06, 3.4), ballastMat);
  ballast.position.set(0, -4.01, 5.95);
  metroLineGroup.add(ballast);

  const sleeperGeo = new THREE.BoxGeometry(0.18, 0.06, 1.15);
  const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
  const sleeperCount = 88;
  const sleepers = new THREE.InstancedMesh(sleeperGeo, sleeperMat, sleeperCount);
  const dummy = new THREE.Object3D();
  let sIdx = 0;
  for (const trackZ of [5.15, 6.75]) {
    for (let i = 0; i < 44; i++) {
      dummy.position.set(-13.0 + i * 0.6, -3.96, trackZ);
      dummy.updateMatrix();
      sleepers.setMatrixAt(sIdx++, dummy.matrix);
    }
  }
  sleepers.instanceMatrix.needsUpdate = true;
  sleepers.computeBoundingSphere();
  metroLineGroup.add(sleepers);

  const railMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.2, metalness: 0.9 });
  const powerRailMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.7,
    roughness: 0.3,
  });

  for (const trackZ of [5.15, 6.75]) {
    for (const offset of [-0.32, 0.32]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(27.2, 0.06, 0.06), railMat);
      rail.position.set(0, -3.91, trackZ + offset);
      metroLineGroup.add(rail);
    }
    const powerBus = new THREE.Mesh(new THREE.BoxGeometry(27.2, 0.04, 0.05), powerRailMat);
    powerBus.position.set(0, -3.92, trackZ);
    metroLineGroup.add(powerBus);
  }

  // Metro Rolling Stock (2 Electric 3-Car Trains)
  const trainWindowMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.9,
    roughness: 0.15,
  });
  const metroTrainEast = createMetroTrain(0x22d3ee, trainWindowMat);
  metroTrainEast.position.set(-5.0, -3.9, 5.15);
  metroLineGroup.add(metroTrainEast);

  const metroTrainWest = createMetroTrain(0x10b981, trainWindowMat);
  metroTrainWest.position.set(5.5, -3.9, 6.75);
  metroLineGroup.add(metroTrainWest);

  // Invisible hit volume along tunnel for easy raycast clicking
  const tunnelHit = new THREE.Mesh(
    new THREE.BoxGeometry(26.5, 1.8, 3.8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  tunnelHit.position.set(0, -3.2, 6.0);
  metroLineGroup.add(tunnelHit);

  undergroundGroup.add(metroLineGroup);
  tagClickable(metroLineGroup, 'metro-tunnel-line', interactables);
  componentBounds.set('metro-tunnel-line', new THREE.Box3(new THREE.Vector3(-13.4, -4.1, 4.1), new THREE.Vector3(13.4, -1.8, 7.9)));

  // =========================================================
  // 2. UNDERGROUND METRO STATIONS (WESTGATE & CENTRAL)
  // =========================================================
  const metroStationLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.15,
    roughness: 0.2,
  });

  function buildMetroStation(id: CityComponentId, centerX: number, labelAccent: number) {
    const station = new THREE.Group();
    station.position.set(centerX, -4.02, 4.45);

    const platformMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.72, metalness: 0.15 });
    const safetyMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
    const glassShaftMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.15,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });

    // Platform deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.36, 1.35), platformMat);
    deck.position.set(0, 0.18, 0);
    deck.receiveShadow = true;
    station.add(deck);

    // Tactile yellow platform edge
    const tactile = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.04, 0.14), safetyMat);
    tactile.position.set(0, 0.38, 0.6);
    station.add(tactile);

    // Overhead concourse canopy & light strip
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.14, 1.25), concreteMat);
    canopy.position.set(0, 2.55, 0);
    station.add(canopy);

    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.08, 0.32), metroStationLightMaterial);
    lightBar.position.set(0, 2.44, 0.1);
    station.add(lightBar);

    // Structural platform pillars + accent bands
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.7 });
    const signMat = new THREE.MeshStandardMaterial({
      color: labelAccent,
      emissive: labelAccent,
      emissiveIntensity: 0.65,
    });
    for (const px of [-2.1, 0, 2.1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.15, 10), pillarMat);
      p.position.set(px, 1.42, -0.35);
      station.add(p);
    }

    const fascia = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.18, 0.08), signMat);
    fascia.position.set(0, 2.15, -0.58);
    station.add(fascia);

    // Vertical elevator shaft connecting underground concourse to surface plaza
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4.7, 0.9), glassShaftMat);
    shaft.position.set(0, 2.4, -0.85);
    shaft.renderOrder = 2;
    station.add(shaft);

    const surfaceHeadhouse = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 1.1), concreteMat);
    surfaceHeadhouse.position.set(0, 4.35, -0.85);
    station.add(surfaceHeadhouse);

    const headhouseRoof = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.08, 1.25), signMat);
    headhouseRoof.position.set(0, 4.65, -0.85);
    station.add(headhouseRoof);

    undergroundGroup.add(station);
    tagClickable(station, id, interactables);
    componentBounds.set(
      id,
      new THREE.Box3(
        new THREE.Vector3(centerX - 3.0, -4.1, 3.7),
        new THREE.Vector3(centerX + 3.0, 0.8, 5.6),
      ),
    );
  }

  buildMetroStation('metro-station-west', -7.2, 0x22d3ee);
  buildMetroStation('metro-station-east', 7.2, 0x10b981);

  // =========================================================
  // 3. SMART ROADWAYS, STREETLIGHTS & AUTONOMOUS EV SHUTTLES
  // =========================================================
  const roadGroup = new THREE.Group();
  const roadMat = new THREE.MeshStandardMaterial({
    map: textures.asphaltMap,
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0.08,
  });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });

  // East-West Transit Avenue (Z = 2.4)
  const ewRoad = new THREE.Mesh(new THREE.PlaneGeometry(27.6, 2.1), roadMat);
  ewRoad.rotation.x = -Math.PI / 2;
  ewRoad.rotation.z = Math.PI / 2;
  // Wait: rotating a plane around X then Y swaps texture orientation; better use BoxGeometry with cleanly proportioned plane
  ewRoad.geometry.dispose();
  ewRoad.geometry = new THREE.PlaneGeometry(2.1, 27.6);
  ewRoad.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  ewRoad.position.set(0, 0.025, 2.45);
  ewRoad.receiveShadow = true;
  roadGroup.add(ewRoad);

  // North-South Connector Road (X = -4.6)
  const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 11.4), roadMat);
  nsRoad.rotation.x = -Math.PI / 2;
  nsRoad.position.set(-4.6, 0.022, -4.2);
  nsRoad.receiveShadow = true;
  roadGroup.add(nsRoad);

  // Sidewalk curbs
  const ewCurb = new THREE.Mesh(new THREE.BoxGeometry(27.6, 0.06, 0.14), curbMat);
  ewCurb.position.set(0, 0.04, 1.38);
  roadGroup.add(ewCurb);

  // Composite Streetlights along avenue
  const streetlightBulbMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe4b5,
    emissive: 0xffb347,
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.8 });
  const beamGeo = new THREE.ConeGeometry(0.9, 1.8, 12, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd580,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const lightPositions: [number, number, number][] = [
    [-11.5, 1.38, 0],
    [-6.5, 1.38, 0],
    [-1.5, 1.38, 0],
    [3.5, 1.38, 0],
    [8.5, 1.38, 0],
    [12.2, 1.38, 0],
    [-3.65, -2.5, Math.PI / 2],
    [-3.65, -7.2, Math.PI / 2],
  ];

  for (const [lx, lz, rotY] of lightPositions) {
    const lamp = new THREE.Group();
    lamp.position.set(lx, 0.03, lz);
    lamp.rotation.y = rotY;

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.18, 8), curbMat);
    base.position.y = 0.09;
    lamp.add(base);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 1.85, 8), poleMat);
    pole.position.y = 1.05;
    pole.castShadow = true;
    lamp.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.55), poleMat);
    arm.position.set(0, 1.96, 0.25);
    lamp.add(arm);

    const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.28), streetlightBulbMaterial);
    fixture.position.set(0, 1.92, 0.48);
    lamp.add(fixture);

    const cone = new THREE.Mesh(beamGeo, beamMat);
    cone.position.set(0, 1.0, 0.48);
    lamp.add(cone);
    streetlightBeams.push(cone);

    roadGroup.add(lamp);
  }

  // Autonomous EV Shuttles
  const shuttle1 = createEvShuttle(0x22d3ee);
  shuttle1.position.set(-8, 0.03, 2.05);
  roadGroup.add(shuttle1);
  evShuttles.push(shuttle1);

  const shuttle2 = createEvShuttle(0x10b981);
  shuttle2.position.set(6, 0.03, 2.85);
  shuttle2.rotation.y = Math.PI;
  roadGroup.add(shuttle2);
  evShuttles.push(shuttle2);

  surfaceGroup.add(roadGroup);
  tagClickable(roadGroup, 'smart-road-grid', interactables);
  componentBounds.set('smart-road-grid', new THREE.Box3(new THREE.Vector3(-13.5, 0, 1.3), new THREE.Vector3(13.5, 2.1, 3.5)));

  // =========================================================
  // 4. ECO-RESIDENCES NORTH-WEST (SMART HOUSING + ROOFTOP PV)
  // =========================================================
  const residencesGroup = new THREE.Group();
  residencesGroup.position.set(-9.5, 0.02, -6.2);

  const resPlaza = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 0.08, 5.4),
    new THREE.MeshStandardMaterial({ color: 0x263244, roughness: 0.88 }),
  );
  resPlaza.position.y = 0.04;
  resPlaza.receiveShadow = true;
  residencesGroup.add(resPlaza);

  const resFacadeMat = new THREE.MeshStandardMaterial({
    map: textures.buildingFacadeMap,
    emissiveMap: textures.buildingEmissiveMap,
    emissive: new THREE.Color(0xffd28a),
    emissiveIntensity: 0.0,
    roughness: 0.42,
    metalness: 0.25,
  });
  buildingWindowMaterials.push(resFacadeMat);

  const timberTrimMat = new THREE.MeshStandardMaterial({ color: 0x7c5840, roughness: 0.72, metalness: 0.05 });
  const roofGreenMat = new THREE.MeshStandardMaterial({ color: 0x1e5c45, roughness: 0.85 });
  const pvMat = new THREE.MeshStandardMaterial({
    map: textures.solarCellMap,
    color: 0xffffff,
    roughness: 0.18,
    metalness: 0.65,
  });

  function addSmartHousingBlock(bx: number, bz: number, w: number, h: number, d: number) {
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, 0.08, bz);
    bGroup.add(createContactShadow(textures.contactShadowMap, w * 1.2, d * 1.2, 0.01));

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), resFacadeMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    bGroup.add(body);

    // Timber architectural cornice & balcony louvers
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.14, d + 0.16), timberTrimMat);
    cornice.position.y = h + 0.04;
    bGroup.add(cornice);

    const roofGarden = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.08, d - 0.3), roofGreenMat);
    roofGarden.position.y = h + 0.12;
    bGroup.add(roofGarden);

    // Rooftop angled PV panels
    for (let px = -w * 0.25; px <= w * 0.25; px += w * 0.5) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.38, 0.05, d * 0.55), pvMat);
      panel.position.set(px, h + 0.32, 0);
      panel.rotation.x = 0.32;
      panel.castShadow = true;
      bGroup.add(panel);
    }

    residencesGroup.add(bGroup);
  }

  addSmartHousingBlock(-1.6, -0.8, 2.6, 3.8, 2.4);
  addSmartHousingBlock(1.5, 0.6, 2.4, 2.9, 2.3);
  addSmartHousingBlock(1.4, -1.5, 2.1, 2.2, 1.6);

  // Elevated glass skybridge connecting housing blocks
  const skybridge = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.55, 0.75),
    new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, roughness: 0.15, transparent: true, opacity: 0.55 }),
  );
  skybridge.position.set(-0.1, 1.95, -0.1);
  residencesGroup.add(skybridge);

  surfaceGroup.add(residencesGroup);
  tagClickable(residencesGroup, 'eco-residences-west', interactables);
  componentBounds.set('eco-residences-west', new THREE.Box3(new THREE.Vector3(-12.9, 0, -8.9), new THREE.Vector3(-6.1, 4.5, -3.5)));

  // =========================================================
  // 5. CIVIC INNOVATION TOWER & LOFTS (EAST)
  // =========================================================
  const civicGroup = new THREE.Group();
  civicGroup.position.set(9.4, 0.02, -5.8);

  const civicPlaza = new THREE.Mesh(
    new THREE.BoxGeometry(6.6, 0.1, 5.8),
    new THREE.MeshStandardMaterial({ color: 0x243142, roughness: 0.82 }),
  );
  civicPlaza.position.y = 0.05;
  civicPlaza.receiveShadow = true;
  civicGroup.add(civicPlaza);

  const towerFacadeMat = new THREE.MeshStandardMaterial({
    map: textures.buildingFacadeMap,
    emissiveMap: textures.buildingEmissiveMap,
    emissive: new THREE.Color(0x9be7ff),
    emissiveIntensity: 0.0,
    roughness: 0.25,
    metalness: 0.45,
  });
  buildingWindowMaterials.push(towerFacadeMat);

  const steelTrimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.85 });

  // Stepped podium
  const podium = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.2, 4.0), towerFacadeMat);
  podium.position.set(0, 0.7, 0);
  podium.castShadow = true;
  podium.receiveShadow = true;
  civicGroup.add(podium);

  // Main upper tower
  const mainTower = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.4, 2.7), towerFacadeMat);
  mainTower.position.set(-0.4, 3.9, -0.2);
  mainTower.castShadow = true;
  civicGroup.add(mainTower);

  // Architectural steel exoskeleton fins
  for (const fx of [-1.85, 1.05]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 5.8, 2.85), steelTrimMat);
    fin.position.set(fx, 4.0, -0.2);
    civicGroup.add(fin);
  }

  // Cantilevered rooftop solar canopy & spire
  const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 3.0), pvMat);
  canopyRoof.position.set(-0.4, 6.72, -0.2);
  canopyRoof.rotation.x = 0.18;
  canopyRoof.castShadow = true;
  civicGroup.add(canopyRoof);

  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 1.4, 8), steelTrimMat);
  spire.position.set(-0.4, 7.45, -0.2);
  civicGroup.add(spire);

  // Side residential loft wing
  const eastLoft = new THREE.Mesh(new THREE.BoxGeometry(1.7, 3.1, 2.2), towerFacadeMat);
  eastLoft.position.set(1.65, 2.75, 0.45);
  eastLoft.castShadow = true;
  civicGroup.add(eastLoft);

  surfaceGroup.add(civicGroup);
  tagClickable(civicGroup, 'civic-innovation-east', interactables);
  componentBounds.set('civic-innovation-east', new THREE.Box3(new THREE.Vector3(6.1, 0, -8.7), new THREE.Vector3(12.7, 8.2, -2.9)));

  // =========================================================
  // 6. HELIOS GROUND SOLAR MICROGRID & BATTERY BANK
  // =========================================================
  const solarGroup = new THREE.Group();
  solarGroup.position.set(-9.5, 0.02, -0.8);

  const solarPad = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 0.06, 3.8),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }),
  );
  solarPad.position.y = 0.03;
  solarPad.receiveShadow = true;
  solarGroup.add(solarPad);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.8 });
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.5 });

  // 2x3 dual-axis solar trackers
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const px = -2.1 + col * 1.65;
      const pz = -0.85 + row * 1.65;

      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.65, 10), pedestalMat);
      pedestal.position.set(px, 0.36, pz);
      pedestal.castShadow = true;
      solarGroup.add(pedestal);

      const pivot = new THREE.Group();
      pivot.position.set(px, 0.7, pz);

      const backing = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.06, 1.05), frameMat);
      pivot.add(backing);

      const cells = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.03, 0.97), pvMat);
      cells.position.y = 0.04;
      cells.castShadow = true;
      pivot.add(cells);

      solarGroup.add(pivot);
      solarPanelPivots.push(pivot);
    }
  }

  // Containerized LiFePO4 grid battery banks
  const batteryMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.55 });
  const batteryGlowMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 0.85,
  });
  for (const bz of [-0.7, 0.7]) {
    const bank = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 1.15), batteryMat);
    bank.position.set(2.55, 0.52, bz);
    bank.castShadow = true;
    solarGroup.add(bank);

    const statusStrip = new THREE.Mesh(new THREE.BoxGeometry(0.87, 0.1, 0.85), batteryGlowMat);
    statusStrip.position.set(2.55, 0.78, bz);
    solarGroup.add(statusStrip);
  }

  surfaceGroup.add(solarGroup);
  tagClickable(solarGroup, 'solar-farm-ground', interactables);
  componentBounds.set('solar-farm-ground', new THREE.Box3(new THREE.Vector3(-12.9, 0, -2.7), new THREE.Vector3(-6.1, 1.6, 1.1)));

  // =========================================================
  // 7. AIR PURIFICATION TOWERS (ALPHA & BETA)
  // =========================================================
  const alphaBuild = createAirPurifierTower('air-purifier-alpha', 1.0, textures);
  alphaBuild.group.position.set(-1.9, 0.02, -6.5);
  surfaceGroup.add(alphaBuild.group);
  tagClickable(alphaBuild.group, 'air-purifier-alpha', interactables);
  componentBounds.set('air-purifier-alpha', new THREE.Box3(new THREE.Vector3(-3.3, 0, -7.9), new THREE.Vector3(-0.5, 5.2, -5.1)));

  const betaBuild = createAirPurifierTower('air-purifier-beta', 0.86, textures);
  betaBuild.group.position.set(9.8, 0.02, -0.6);
  surfaceGroup.add(betaBuild.group);
  tagClickable(betaBuild.group, 'air-purifier-beta', interactables);
  componentBounds.set('air-purifier-beta', new THREE.Box3(new THREE.Vector3(8.5, 0, -1.9), new THREE.Vector3(11.1, 4.5, 0.7)));

  // =========================================================
  // 8. VERDANT CENTRAL ECO-PARK (INSTANCED TREES + BIOSWALE POND)
  // =========================================================
  const parkGroup = new THREE.Group();
  parkGroup.position.set(1.6, 0.02, -2.0);

  // Stone retaining border + lush grass lawn
  const parkRim = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 0.12, 6.2),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 }),
  );
  parkRim.position.y = 0.06;
  parkRim.receiveShadow = true;
  parkGroup.add(parkRim);

  const parkLawn = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.08, 5.8),
    new THREE.MeshStandardMaterial({
      map: textures.parkGrassMap,
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0,
    }),
  );
  parkLawn.position.y = 0.12;
  parkLawn.receiveShadow = true;
  parkGroup.add(parkLawn);

  // Bioswale retention pond (offset on Y to prevent Z-fighting)
  const pondMat = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    roughness: 0.12,
    metalness: 0.2,
    clearcoat: 0.9,
    transparent: true,
    opacity: 0.88,
  });
  const parkWaterMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.4, 0.06, 24), pondMat);
  parkWaterMesh.scale.set(1.25, 1, 0.85);
  parkWaterMesh.position.set(0.3, 0.165, 0.35);
  parkGroup.add(parkWaterMesh);

  // Timber pedestrian boardwalk bridge over pond
  const boardwalk = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.08, 0.65),
    timberTrimMat,
  );
  boardwalk.position.set(0.3, 0.24, 0.35);
  boardwalk.rotation.y = 0.25;
  boardwalk.castShadow = true;
  parkGroup.add(boardwalk);

  // Composite Multi-Part Instanced Trees (24 trees with scale and tint variation)
  const treeCoords: [number, number][] = [
    [-2.8, -2.1], [-1.9, -2.3], [-0.8, -2.1], [0.5, -2.3], [1.9, -2.1], [2.9, -1.9],
    [-2.9, -1.0], [-2.4, 0.2], [-2.7, 1.5], [-1.7, 2.1], [-0.5, 2.2], [0.8, 2.1],
    [2.1, 2.0], [2.9, 1.1], [2.8, -0.3], [2.2, -1.2], [-1.3, -0.9], [1.3, -1.1],
    [-1.4, 1.2], [1.6, 1.3], [-2.1, -1.6], [2.5, 0.4], [0.1, -1.5], [-0.3, 1.6],
  ];
  const trunkGeo = new THREE.CylinderGeometry(0.06, 0.1, 0.62, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.92 });
  const canopyLowerGeo = new THREE.ConeGeometry(0.46, 0.95, 7);
  const canopyUpperGeo = new THREE.ConeGeometry(0.34, 0.72, 7);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCoords.length);
  const canopiesLow = new THREE.InstancedMesh(canopyLowerGeo, canopyMat, treeCoords.length);
  const canopiesHigh = new THREE.InstancedMesh(canopyUpperGeo, canopyMat, treeCoords.length);
  trunks.castShadow = !isSoftwareGl;
  canopiesLow.castShadow = !isSoftwareGl;
  canopiesHigh.castShadow = !isSoftwareGl;

  const palette = [new THREE.Color(0x10b981), new THREE.Color(0x16a34a), new THREE.Color(0x22c55e), new THREE.Color(0x059669)];
  for (let i = 0; i < treeCoords.length; i++) {
    const [tx, tz] = treeCoords[i];
    const s = 0.82 + ((i * 37) % 35) / 100; // ±17% natural variation
    dummy.rotation.set(0, (i * 1.1) % Math.PI, 0);

    dummy.scale.set(s, s, s);
    dummy.position.set(tx, 0.16 + 0.31 * s, tz);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tx, 0.16 + 0.85 * s, tz);
    dummy.updateMatrix();
    canopiesLow.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tx, 0.16 + 1.32 * s, tz);
    dummy.updateMatrix();
    canopiesHigh.setMatrixAt(i, dummy.matrix);

    const tint = palette[i % palette.length];
    canopiesLow.setColorAt(i, tint);
    canopiesHigh.setColorAt(i, tint.clone().offsetHSL(0, 0, 0.06));
  }
  trunks.instanceMatrix.needsUpdate = true;
  canopiesLow.instanceMatrix.needsUpdate = true;
  canopiesHigh.instanceMatrix.needsUpdate = true;
  if (canopiesLow.instanceColor) canopiesLow.instanceColor.needsUpdate = true;
  if (canopiesHigh.instanceColor) canopiesHigh.instanceColor.needsUpdate = true;
  trunks.computeBoundingSphere();
  canopiesLow.computeBoundingSphere();
  canopiesHigh.computeBoundingSphere();
  parkGroup.add(trunks, canopiesLow, canopiesHigh);

  // Irrigation mist particle system (visible when parkIrrigation is enabled)
  const mistCount = 90;
  const mistPos = new Float32Array(mistCount * 3);
  for (let i = 0; i < mistCount; i++) {
    mistPos[i * 3] = ((i * 73) % 60) / 10 - 3.0;
    mistPos[i * 3 + 1] = 0.4 + ((i * 29) % 10) / 12;
    mistPos[i * 3 + 2] = ((i * 47) % 48) / 10 - 2.4;
  }
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
  const mistMat = new THREE.PointsMaterial({
    color: 0x38bdf8,
    size: 0.14,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const parkMistParticles = new THREE.Points(mistGeo, mistMat);
  parkGroup.add(parkMistParticles);

  surfaceGroup.add(parkGroup);
  tagClickable(parkGroup, 'central-eco-park', interactables);
  componentBounds.set('central-eco-park', new THREE.Box3(new THREE.Vector3(-2.2, 0, -5.0), new THREE.Vector3(5.4, 2.2, 1.0)));

  // =========================================================
  // 9. SELECTION BRACKET HIGHLIGHTER
  // =========================================================
  const selectionBracket = new THREE.Group();
  const bracketMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.85,
  });
  // A crisp glowing base frame (updated dynamically to wrap selected componentBounds)
  const frameBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.95 }),
  );
  selectionBracket.add(frameBox);

  const ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1.0, 32),
    bracketMat,
  );
  ringMesh.rotation.x = -Math.PI / 2;
  selectionBracket.add(ringMesh);
  selectionBracket.visible = false;
  root.add(selectionBracket);

  const labelAnchors: {
    id: CityComponentId;
    label: string;
    level: 'Ground' | 'Underground';
    position: THREE.Vector3;
  }[] = [
    { id: 'eco-residences-west', label: 'Eco-Residences', level: 'Ground', position: new THREE.Vector3(-9.5, 4.7, -6.2) },
    { id: 'solar-farm-ground', label: 'Helios Solar Grid', level: 'Ground', position: new THREE.Vector3(-9.5, 1.9, -0.8) },
    { id: 'air-purifier-alpha', label: 'AeroPure Alpha', level: 'Ground', position: new THREE.Vector3(-1.9, 5.4, -6.5) },
    { id: 'central-eco-park', label: 'Central Eco-Park', level: 'Ground', position: new THREE.Vector3(1.6, 2.5, -2.0) },
    { id: 'civic-innovation-east', label: 'Innovation Tower', level: 'Ground', position: new THREE.Vector3(9.4, 8.1, -5.8) },
    { id: 'air-purifier-beta', label: 'AeroPure Beta', level: 'Ground', position: new THREE.Vector3(9.8, 4.7, -0.6) },
    { id: 'metro-station-west', label: 'Westgate Hub -14.5m', level: 'Underground', position: new THREE.Vector3(-7.2, -1.2, 4.6) },
    { id: 'metro-station-east', label: 'Central Interchange -14.5m', level: 'Underground', position: new THREE.Vector3(7.2, -1.2, 4.6) },
  ];

  scene.add(root);

  return {
    root,
    surfaceGroup,
    undergroundGroup,
    interactables,
    componentBounds,
    selectionBracket,
    sunOrb,
    sunHalo,
    skyMaterial,
    buildingWindowMaterials,
    streetlightBulbMaterial,
    streetlightBeams,
    metroStationLightMaterial,
    solarPanelPivots,
    airTurbineAlpha: alphaBuild.turbine,
    airTurbineBeta: betaBuild.turbine,
    airPlumeRingsAlpha: alphaBuild.plumeRings,
    airPlumeRingsBeta: betaBuild.plumeRings,
    parkMistParticles,
    parkWaterMesh,
    metroTrainEast,
    metroTrainWest,
    evShuttles,
    labelAnchors,
    dispose: () => {
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.LineSegments) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
      skyMesh.geometry.dispose();
      skyMaterial.dispose();
      sunOrb.geometry.dispose();
      (sunOrb.material as THREE.Material).dispose();
      sunHalo.geometry.dispose();
      (sunHalo.material as THREE.Material).dispose();
    },
  };
}
