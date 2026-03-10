import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

function hash(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
}

export function makeGrassTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#3b7d2a";
  ctx.fillRect(0, 0, size, size);

  // Speckle + blades
  for (let i = 0; i < 9000; i++) {
    const x = hash(i * 4 + 1) * size;
    const y = hash(i * 4 + 2) * size;
    const g = 110 + hash(i * 4 + 3) * 70;
    const a = 0.08 + hash(i * 4 + 4) * 0.12;
    ctx.fillStyle = `rgba(0, ${g | 0}, 0, ${a})`;
    ctx.fillRect(x, y, 1, 1);
  }

  for (let i = 0; i < 1400; i++) {
    const x = hash(i * 5 + 10001) * size;
    const y = hash(i * 5 + 10002) * size;
    const len = 4 + hash(i * 5 + 10003) * 10;
    const angle = (-Math.PI / 2) + (hash(i * 5 + 10004) - 0.5) * 0.6;
    const x2 = x + Math.cos(angle) * len;
    const y2 = y + Math.sin(angle) * len;
    ctx.strokeStyle = `rgba(30, 120, 20, ${0.10 + hash(i * 5 + 10005) * 0.10})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
