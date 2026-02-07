import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

export function makeGrassTexture(rng) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#3b7d2a";
  ctx.fillRect(0, 0, size, size);

  // Speckle + blades
  for (let i = 0; i < 9000; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const g = 110 + rng() * 70;
    const a = 0.08 + rng() * 0.12;
    ctx.fillStyle = `rgba(0, ${g | 0}, 0, ${a})`;
    ctx.fillRect(x, y, 1, 1);
  }

  for (let i = 0; i < 1400; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 4 + rng() * 10;
    const angle = (-Math.PI / 2) + (rng() - 0.5) * 0.6;
    const x2 = x + Math.cos(angle) * len;
    const y2 = y + Math.sin(angle) * len;
    ctx.strokeStyle = `rgba(30, 120, 20, ${0.10 + rng() * 0.10})`;
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
