import { mat4 } from 'gl-matrix';
import type { SceneObject } from '@/playground/scene/hooks/useYjsSceneStore';

// Bereken de lokale transformatiematrix van een object
export function getLocalMatrix(obj: SceneObject): mat4 {
  const matrix = mat4.create();
  mat4.translate(matrix, matrix, obj.position);
  mat4.rotateX(matrix, matrix, obj.rotation[0]);
  mat4.rotateY(matrix, matrix, obj.rotation[1]);
  mat4.rotateZ(matrix, matrix, obj.rotation[2]);
  return matrix;
}

// Bereken de wereldmatrix van een object, rekening houdend met parent-child relaties
export function getWorldMatrix(obj: SceneObject, allObjects: Record<string, SceneObject>): mat4 {
  const localMatrix = getLocalMatrix(obj);

  // Als er een parent is, vermenigvuldig met de parent's wereldmatrix
  if (obj.parentId && allObjects[obj.parentId]) {
    const parentMatrix = getWorldMatrix(allObjects[obj.parentId], allObjects);
    const result = mat4.create();
    mat4.multiply(result, parentMatrix, localMatrix);
    return result;
  }

  return localMatrix;
}

// Haal Euler-rotatie (XYZ volgorde) uit een transformatiematrix
// Let op: dit gaat ervan uit dat er geen schaling in de matrix zit
export function extractRotationFromMatrix(matrix: mat4): [number, number, number] {
  // Gebaseerd op de formules voor XYZ Euler decomposition
  // Matrix layout (column-major zoals gl-matrix):
  // [0]  [4]  [8]   [12]
  // [1]  [5]  [9]   [13]
  // [2]  [6]  [10]  [14]
  // [3]  [7]  [11]  [15]

  let rotX: number, rotY: number, rotZ: number;

  // rotY = asin(-m[2]) (element op positie row 0, col 2)
  const sinY = -matrix[2];

  // Clamp om numerieke fouten te voorkomen
  if (sinY >= 1) {
    rotY = Math.PI / 2;
    rotX = Math.atan2(matrix[4], matrix[5]);
    rotZ = 0;
  } else if (sinY <= -1) {
    rotY = -Math.PI / 2;
    rotX = Math.atan2(-matrix[4], matrix[5]);
    rotZ = 0;
  } else {
    rotY = Math.asin(sinY);
    const cosY = Math.cos(rotY);
    rotX = Math.atan2(matrix[6] / cosY, matrix[10] / cosY);
    rotZ = Math.atan2(matrix[1] / cosY, matrix[0] / cosY);
  }

  return [rotX, rotY, rotZ];
}