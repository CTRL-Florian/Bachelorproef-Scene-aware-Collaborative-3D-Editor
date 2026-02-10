import { mat4 } from 'gl-matrix';
import { SceneObject } from '@/playground/scene/hooks/useYjsSceneStore';

// Bereken de wereldmatrix van een object, rekening houdend met parent-child relaties
export function getWorldMatrix(obj: SceneObject, allObjects: Record<string, SceneObject>): mat4 {
  let matrix = mat4.create();
  // Eigen transformatie
  mat4.translate(matrix, matrix, obj.position);
  mat4.rotateX(matrix, matrix, obj.rotation[0]);
  mat4.rotateY(matrix, matrix, obj.rotation[1]);
  mat4.rotateZ(matrix, matrix, obj.rotation[2]);
  // Parent transformatie
  if (obj.parentId && allObjects[obj.parentId]) {
    const parentMatrix = getWorldMatrix(allObjects[obj.parentId], allObjects);
    mat4.multiply(matrix, parentMatrix, matrix);
  }
  return matrix;
}