import { Mesh, MeshStandardMaterial, PlaneGeometry } from "three";

export function createGround(scene, grassTexture, fieldSize) {
  grassTexture.repeat.set(fieldSize / 6, fieldSize / 6);

  const geo = new PlaneGeometry(fieldSize, fieldSize, 1, 1);
  geo.rotateX(-Math.PI / 2);

  const mat = new MeshStandardMaterial({
    map: grassTexture,
    roughness: 1,
    metalness: 0,
  });

  const ground = new Mesh(geo, mat);
  ground.receiveShadow = true;
  ground.position.y = 0;
  scene.add(ground);
}
