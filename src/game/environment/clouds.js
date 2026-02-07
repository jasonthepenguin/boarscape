import { Sprite, SpriteMaterial } from "three";
import { CLOUD_COUNT, CLOUD_LAYER_Y } from "../../config.js";

export function createClouds(scene, rng, cloudTexture, cloudRange) {
  const clouds = [];

  for (let i = 0; i < CLOUD_COUNT; i++) {
    const sprite = new Sprite(
      new SpriteMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.55 + rng() * 0.32,
        depthWrite: false,
      }),
    );
    const w = 24 + rng() * 46;
    sprite.scale.set(w, w * (0.55 + rng() * 0.25), 1);
    sprite.position.set(
      (rng() * 2 - 1) * cloudRange,
      CLOUD_LAYER_Y + rng() * 16,
      (rng() * 2 - 1) * cloudRange,
    );
    sprite.renderOrder = 10;
    scene.add(sprite);
    clouds.push({
      sprite,
      speed: 0.5 + rng() * 1.2,
    });
  }

  function update(dt) {
    for (const c of clouds) {
      c.sprite.position.x += c.speed * dt;
      if (c.sprite.position.x > cloudRange) c.sprite.position.x = -cloudRange;
    }
  }

  return { update };
}
