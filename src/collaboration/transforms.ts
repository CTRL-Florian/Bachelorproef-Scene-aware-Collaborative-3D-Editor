import { mat4, vec3 } from 'gl-matrix';
import type { SceneObject } from './types';

function getLocalMatrix(obj: SceneObject): mat4 {
  const m = mat4.create();
  mat4.translate(m, m, obj.position);
  mat4.rotateX(m, m, obj.rotation[0]);
  mat4.rotateY(m, m, obj.rotation[1]);
  mat4.rotateZ(m, m, obj.rotation[2]);
  return m;
}

function getWorldMatrix(obj: SceneObject, allObjects: Map<string, SceneObject>): mat4 {
  const local = getLocalMatrix(obj);
  if (obj.parentId) {
    const parent = allObjects.get(obj.parentId);
    if (parent) {
      const parentWorld = getWorldMatrix(parent, allObjects);
      const result = mat4.create();
      mat4.multiply(result, parentWorld, local);
      return result;
    }
  }
  return local;
}

function extractEulerXYZ(m: mat4): [number, number, number] {
  const sinY = -m[2];
  let rx: number, ry: number, rz: number;
  if (sinY >= 1) {
    ry = Math.PI / 2;
    rx = Math.atan2(m[4], m[5]);
    rz = 0;
  } else if (sinY <= -1) {
    ry = -Math.PI / 2;
    rx = Math.atan2(-m[4], m[5]);
    rz = 0;
  } else {
    ry = Math.asin(sinY);
    const cosY = Math.cos(ry);
    rx = Math.atan2(m[6] / cosY, m[10] / cosY);
    rz = Math.atan2(m[1] / cosY, m[0] / cosY);
  }
  return [rx, ry, rz];
}

export interface LinkResult {
  position: [number, number, number];
  rotation: [number, number, number];
}

/**
 * Compute the local-space position and rotation a child should have after being
 * attached to `parentId`, preserving its current world position.
 */
export function computeLinkTransform(
  child: SceneObject,
  parentId: string,
  allObjects: Map<string, SceneObject>,
): LinkResult {
  const parent = allObjects.get(parentId);
  if (!parent) return { position: child.position, rotation: child.rotation };

  const childWorld = getWorldMatrix(child, allObjects);
  const parentWorld = getWorldMatrix(parent, allObjects);

  const parentWorldInv = mat4.create();
  mat4.invert(parentWorldInv, parentWorld);

  const localMatrix = mat4.create();
  mat4.multiply(localMatrix, parentWorldInv, childWorld);

  const worldPos = vec3.fromValues(childWorld[12], childWorld[13], childWorld[14]);
  const localPos = vec3.create();
  vec3.transformMat4(localPos, worldPos, parentWorldInv);

  return {
    position: [localPos[0], localPos[1], localPos[2]],
    rotation: extractEulerXYZ(localMatrix),
  };
}

/**
 * Compute the world-space position and rotation a child should have after being
 * detached from its parent.
 */
export function computeUnlinkTransform(
  child: SceneObject,
  allObjects: Map<string, SceneObject>,
): LinkResult {
  const world = getWorldMatrix(child, allObjects);
  return {
    position: [world[12], world[13], world[14]],
    rotation: extractEulerXYZ(world),
  };
}
