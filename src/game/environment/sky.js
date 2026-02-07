import { Color, Vector3 } from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import {
  BG_COLOR,
  SKY_ELEVATION,
  SKY_AZIMUTH,
  SKY_TURBIDITY,
  SKY_RAYLEIGH,
  SKY_MIE_COEFFICIENT,
  SKY_MIE_DIRECTIONAL_G,
} from "../../config.js";

export function createSky(scene) {
  scene.background = new Color(BG_COLOR);

  const sky = new Sky();
  sky.scale.setScalar(10000);
  scene.add(sky);

  const sun = new Vector3();
  const phi = (90 - SKY_ELEVATION) * (Math.PI / 180);
  const theta = SKY_AZIMUTH * (Math.PI / 180);
  sun.setFromSphericalCoords(1, phi, theta);

  sky.material.uniforms["sunPosition"].value.copy(sun);
  sky.material.uniforms["turbidity"].value = SKY_TURBIDITY;
  sky.material.uniforms["rayleigh"].value = SKY_RAYLEIGH;
  sky.material.uniforms["mieCoefficient"].value = SKY_MIE_COEFFICIENT;
  sky.material.uniforms["mieDirectionalG"].value = SKY_MIE_DIRECTIONAL_G;
}
