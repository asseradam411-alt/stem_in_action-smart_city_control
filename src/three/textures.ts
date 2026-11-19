import * as THREE from 'three';

export interface ProceduralTextureSet {
  asphaltMap: THREE.CanvasTexture;
  strataMap: THREE.CanvasTexture;
  parkGrassMap: THREE.CanvasTexture;
  buildingFacadeMap: THREE.CanvasTexture;
  buildingEmissiveMap: THREE.CanvasTexture;
  solarCellMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function configureTexture(
  tex: THREE.CanvasTexture,
  maxAnisotropy: number,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  // 1. Asphalt Roadway Texture
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 512;
  roadCanvas.height = 512;
  const rCtx = roadCanvas.getContext('2d')!;
  rCtx.fillStyle = '#1d2430';
  rCtx.fillRect(0, 0, 512, 512);

  // Subtle aggregate speckle
  for (let i = 0; i < 4500; i++) {
    const x = (i * 73) % 512;
    const y = (i * 137) % 512;
    const v = 24 + ((i * 19) % 24);
    rCtx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 10})`;
    rCtx.fillRect(x, y, 2, 2);
  }

  // Road shoulder lines
  rCtx.fillStyle = '#94a3b8';
  rCtx.fillRect(24, 0, 6, 512);
  rCtx.fillRect(482, 0, 6, 512);

  // Inductive EV charging lane subtle cyan guide strips
  rCtx.fillStyle = 'rgba(34, 211, 238, 0.35)';
  for (let y = 16; y < 512; y += 64) {
    rCtx.fillRect(130, y, 8, 28);
    rCtx.fillRect(374, y, 8, 28);
  }

  // Center dashed divider
  rCtx.fillStyle = '#e2e8f0';
  for (let y = 12; y < 512; y += 64) {
    rCtx.fillRect(252, y, 8, 34);
  }

  const asphaltMap = configureTexture(new THREE.CanvasTexture(roadCanvas), maxAnisotropy, true, 1, 3);

  // 2. Geological Cutaway Strata Texture
  const strataCanvas = document.createElement('canvas');
  strataCanvas.width = 512;
  strataCanvas.height = 256;
  const sCtx = strataCanvas.getContext('2d')!;

  const grad = sCtx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#334155'); // Concrete cap slab
  grad.addColorStop(0.12, '#473c33'); // Topsoil / engineered fill
  grad.addColorStop(0.38, '#3a3330'); // Compacted clay
  grad.addColorStop(0.72, '#252b38'); // Fractured limestone
  grad.addColorStop(1.0, '#141926'); // Deep bedrock
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 512, 256);

  // Subtle horizontal sedimentary striations
  for (let y = 32; y < 250; y += 14) {
    sCtx.fillStyle = y % 28 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.12)';
    sCtx.fillRect(0, y, 512, 3);
  }

  // Engineering elevation grid lines
  sCtx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  sCtx.lineWidth = 1;
  for (let x = 0; x <= 512; x += 64) {
    sCtx.beginPath();
    sCtx.moveTo(x, 0);
    sCtx.lineTo(x, 256);
    sCtx.stroke();
  }
  for (let y = 64; y < 256; y += 64) {
    sCtx.beginPath();
    sCtx.moveTo(0, y);
    sCtx.lineTo(512, y);
    sCtx.stroke();
  }

  const strataMap = configureTexture(new THREE.CanvasTexture(strataCanvas), maxAnisotropy, true, 3, 1);

  // 3. Urban Eco-Park Grass Texture
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 256;
  grassCanvas.height = 256;
  const gCtx = grassCanvas.getContext('2d')!;
  gCtx.fillStyle = '#1f4e3c';
  gCtx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 32) {
    gCtx.fillStyle = (x / 32) % 2 === 0 ? 'rgba(52, 211, 153, 0.08)' : 'rgba(6, 78, 59, 0.14)';
    gCtx.fillRect(x, 0, 32, 256);
  }
  for (let i = 0; i < 1800; i++) {
    const x = (i * 53) % 256;
    const y = (i * 97) % 256;
    gCtx.fillStyle = i % 3 === 0 ? 'rgba(74, 222, 128, 0.14)' : 'rgba(15, 58, 43, 0.25)';
    gCtx.fillRect(x, y, 2, 2);
  }
  const parkGrassMap = configureTexture(new THREE.CanvasTexture(grassCanvas), maxAnisotropy, true, 2, 2);

  // 4. Smart Building Facade & Emissive Window Maps
  const fCanvas = document.createElement('canvas');
  fCanvas.width = 256;
  fCanvas.height = 512;
  const fCtx = fCanvas.getContext('2d')!;

  const eCanvas = document.createElement('canvas');
  eCanvas.width = 256;
  eCanvas.height = 512;
  const eCtx = eCanvas.getContext('2d')!;

  // Concrete/composite architectural facade base
  fCtx.fillStyle = '#253244';
  fCtx.fillRect(0, 0, 256, 512);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, 256, 512);

  const cols = 4;
  const rows = 8;
  const padX = 12;
  const padY = 12;
  const winW = (256 - padX * (cols + 1)) / cols;
  const winH = (512 - padY * (rows + 1)) / rows;

  for (let r = 0; r < rows; r++) {
    // Horizontal floor slab trim
    fCtx.fillStyle = '#36475e';
    fCtx.fillRect(0, r * (winH + padY), 256, 4);

    for (let c = 0; c < cols; c++) {
      const x = padX + c * (winW + padX);
      const y = padY + r * (winH + padY);
      // Window glass pane
      fCtx.fillStyle = '#0f2338';
      fCtx.fillRect(x, y, winW, winH);
      // Subtle cyan architectural reflection highlight
      fCtx.fillStyle = 'rgba(103, 232, 249, 0.18)';
      fCtx.fillRect(x + 2, y + 2, winW - 4, 6);

      // Deterministic occupancy pattern for night illumination
      const litSeed = (r * 7 + c * 13) % 10;
      if (litSeed > 1) {
        eCtx.fillStyle = litSeed % 3 === 0 ? '#ffd89b' : litSeed % 2 === 0 ? '#bfefff' : '#ffe4b5';
        eCtx.fillRect(x + 2, y + 2, winW - 4, winH - 4);
      }
    }
  }

  const buildingFacadeMap = configureTexture(new THREE.CanvasTexture(fCanvas), maxAnisotropy, true, 1, 1);
  const buildingEmissiveMap = configureTexture(new THREE.CanvasTexture(eCanvas), maxAnisotropy, true, 1, 1);

  // 5. Solar Photovoltaic Cell Map
  const pvCanvas = document.createElement('canvas');
  pvCanvas.width = 256;
  pvCanvas.height = 256;
  const pCtx = pvCanvas.getContext('2d')!;
  pCtx.fillStyle = '#0b1e3b';
  pCtx.fillRect(0, 0, 256, 256);

  pCtx.strokeStyle = '#60a5fa';
  pCtx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 32) {
    pCtx.beginPath();
    pCtx.moveTo(x, 0);
    pCtx.lineTo(x, 256);
    pCtx.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    pCtx.beginPath();
    pCtx.moveTo(0, y);
    pCtx.lineTo(256, y);
    pCtx.stroke();
  }
  // Thin metallic busbars
  pCtx.fillStyle = 'rgba(203, 213, 225, 0.35)';
  for (let x = 16; x < 256; x += 32) {
    pCtx.fillRect(x, 0, 1, 256);
  }
  const solarCellMap = configureTexture(new THREE.CanvasTexture(pvCanvas), maxAnisotropy, true, 2, 2);

  // 6. Soft Contact Shadow Radial Disc
  const shCanvas = document.createElement('canvas');
  shCanvas.width = 128;
  shCanvas.height = 128;
  const shCtx = shCanvas.getContext('2d')!;
  const shGrad = shCtx.createRadialGradient(64, 64, 8, 64, 64, 62);
  shGrad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  shGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
  shGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadowMap = new THREE.CanvasTexture(shCanvas);
  contactShadowMap.needsUpdate = true;

  return {
    asphaltMap,
    strataMap,
    parkGrassMap,
    buildingFacadeMap,
    buildingEmissiveMap,
    solarCellMap,
    contactShadowMap,
    dispose: () => {
      asphaltMap.dispose();
      strataMap.dispose();
      parkGrassMap.dispose();
      buildingFacadeMap.dispose();
      buildingEmissiveMap.dispose();
      solarCellMap.dispose();
      contactShadowMap.dispose();
    },
  };
}
