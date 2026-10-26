/**
 * FORME Studio — refinamento de caimento v2 para tee.glb
 *
 * Execute a partir da raiz do projeto:
 *   node scripts/caimento-camiseta.mjs
 *
 * Entrada:  public/models/tee.glb
 * Saída:    public/models/tee-caimento-v2.glb
 *
 * Mantém o modelo original intacto. Adiciona dobras mais visíveis, porém suaves, ao
 * corpo/barra/mangas, usando os normais existentes como direção da deformação.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const INPUT = path.resolve('public/models/tee.glb');
const OUTPUT = path.resolve('public/models/tee-caimento-v2.glb');

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function normalize3(x, y, z) {
  const length = Math.hypot(x, y, z);
  if (length < 1e-12) return [0, 1, 0];
  return [x / length, y / length, z / length];
}

function recalculateSmoothNormals(positions, indices, vertexCount) {
  // Normais ponderadas pela área de cada triângulo.
  const accum = new Float64Array(vertexCount * 3);

  for (let i = 0; i + 2 < indices.length; i += 3) {
    const ia = indices[i] * 3;
    const ib = indices[i + 1] * 3;
    const ic = indices[i + 2] * 3;

    const abx = positions[ib] - positions[ia];
    const aby = positions[ib + 1] - positions[ia + 1];
    const abz = positions[ib + 2] - positions[ia + 2];
    const acx = positions[ic] - positions[ia];
    const acy = positions[ic + 1] - positions[ia + 1];
    const acz = positions[ic + 2] - positions[ia + 2];

    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;

    for (const offset of [ia, ib, ic]) {
      accum[offset] += nx;
      accum[offset + 1] += ny;
      accum[offset + 2] += nz;
    }
  }

  // Alguns modelos têm vértices duplicados em costuras UV. Fazemos a média
  // dos normais em posições praticamente iguais para evitar facetas artificiais.
  const groups = new Map();
  const precision = 100000;

  for (let i = 0; i < vertexCount; i++) {
    const p = i * 3;
    const key = `${Math.round(positions[p] * precision)},${Math.round(positions[p + 1] * precision)},${Math.round(positions[p + 2] * precision)}`;
    let group = groups.get(key);
    if (!group) {
      group = { x: 0, y: 0, z: 0, members: [] };
      groups.set(key, group);
    }
    group.x += accum[p];
    group.y += accum[p + 1];
    group.z += accum[p + 2];
    group.members.push(i);
  }

  const result = new Float32Array(vertexCount * 3);
  for (const group of groups.values()) {
    const [nx, ny, nz] = normalize3(group.x, group.y, group.z);
    for (const vertexIndex of group.members) {
      const p = vertexIndex * 3;
      result[p] = nx;
      result[p + 1] = ny;
      result[p + 2] = nz;
    }
  }
  return result;
}

async function main() {
  try {
    await fs.access(INPUT);
  } catch {
    throw new Error(`Não encontrei ${INPUT}. Rode este script na raiz de closet-3d e confirme que tee.glb está em public/models/.`);
  }

  const decoder = await draco3d.createDecoderModule();
  const encoder = await draco3d.createEncoderModule();
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      'draco3d.decoder': decoder,
      'draco3d.encoder': encoder,
    });

  const document = await io.read(INPUT);
  const primitives = document.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives());
  let processedVertices = 0;

  for (const primitive of primitives) {
    const positionAccessor = primitive.getAttribute('POSITION');
    const normalAccessor = primitive.getAttribute('NORMAL');
    const indexAccessor = primitive.getIndices();

    if (!positionAccessor || !normalAccessor || !indexAccessor) {
      console.warn('Pulando uma malha sem POSITION, NORMAL ou índices.');
      continue;
    }

    const sourcePositions = positionAccessor.getArray();
    const sourceNormals = normalAccessor.getArray();
    const sourceIndices = indexAccessor.getArray();
    if (!sourcePositions || !sourceNormals || !sourceIndices) continue;

    const positions = new Float32Array(sourcePositions);
    const normals = new Float32Array(sourceNormals);
    const indices = sourceIndices;
    const vertexCount = positions.length / 3;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]);
      maxX = Math.max(maxX, positions[i]);
      minY = Math.min(minY, positions[i + 1]);
      maxY = Math.max(maxY, positions[i + 1]);
    }

    const centerX = (minX + maxX) * 0.5;
    const halfWidth = Math.max((maxX - minX) * 0.5, 1e-6);
    const height = Math.max(maxY - minY, 1e-6);
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 2; i < positions.length; i += 3) {
      minZ = Math.min(minZ, positions[i]);
      maxZ = Math.max(maxZ, positions[i]);
    }
    const depth = Math.max(maxZ - minZ, 1e-6);
    // Escala baseada na própria camiseta. A versão anterior usava deslocamentos
    // absolutos muito pequenos, quase invisíveis depois da escala do modelo.
    const clothScale = Math.min(height, Math.max((maxX - minX) * 0.82, depth * 1.8));
    const centerZ = (minZ + maxZ) * 0.5;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];
      const nx = normals[i];
      const ny = normals[i + 1];
      const nz = normals[i + 2];

      const yn = clamp01((y - minY) / height); // 0 = barra, 1 = gola/ombros
      const xn = (x - centerX) / halfWidth;
      const absX = Math.abs(xn);
      const zn = (z - centerZ) / Math.max(depth * 0.5, 1e-6);

      // Dobras verticais com amplitudes proporcionais à camiseta. As ondas têm
      // escalas variadas para não parecerem listras mecânicas uniformes.
      const bodyHeightMask = smoothstep(0.045, 0.18, yn) * (1 - smoothstep(0.70, 0.84, yn));
      const bodyWidthMask = 1 - smoothstep(0.47, 0.68, absX);
      const bodyMask = bodyHeightMask * bodyWidthMask;
      const lowerWeight = 0.78 + 0.22 * (1 - yn);
      const verticalFolds =
        Math.sin(xn * 5.7 * Math.PI + Math.sin(yn * 3.7 * Math.PI) * 0.42) * 0.48 +
        Math.sin(xn * 9.1 * Math.PI - yn * 4.2 * Math.PI) * 0.29 +
        Math.sin(xn * 3.4 * Math.PI + yn * 7.3 * Math.PI + zn * 0.35) * 0.23;
      let normalOffset = clothScale * 0.020 * verticalFolds * bodyMask * lowerWeight;

      // Dobras secundárias nas mangas, ainda mais suaves do que no corpo.
      const sleeveWidthMask = smoothstep(0.36, 0.59, absX) * (1 - smoothstep(0.82, 0.98, absX));
      const sleeveHeightMask = smoothstep(0.39, 0.53, yn) * (1 - smoothstep(0.75, 0.88, yn));
      normalOffset += clothScale * 0.008 * sleeveWidthMask * sleeveHeightMask *
        (Math.sin(yn * 15.5 + absX * 11.0) * 0.65 + Math.sin(yn * 24.0 - absX * 7.0) * 0.35);

      // Barra levemente irregular e com uma pequena queda central por gravidade.
      const hemMask = (1 - smoothstep(0.012, 0.13, yn)) * (1 - smoothstep(0.43, 0.70, absX));
      const hemWave = clothScale * 0.008 * Math.sin(xn * 5.5 * Math.PI + zn * 2.8 + 0.35) * hemMask;
      const centerSagMask = (1 - smoothstep(0.08, 0.58, absX)) *
        (1 - smoothstep(0.025, 0.15, yn));
      const centerSag = clothScale * 0.008 * centerSagMask;

      positions[i] += nx * normalOffset;
      positions[i + 1] += ny * normalOffset + hemWave - centerSag;
      positions[i + 2] += nz * normalOffset;
    }

    const updatedNormals = recalculateSmoothNormals(positions, indices, vertexCount);
    positionAccessor.setArray(positions);
    normalAccessor.setArray(updatedNormals);
    processedVertices += vertexCount;
  }

  if (processedVertices === 0) {
    throw new Error('Não encontrei nenhuma malha compatível para deformar. O modelo original não foi alterado.');
  }

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await io.write(OUTPUT, document);
  const stats = await fs.stat(OUTPUT);
  console.log(`\nPronto! Modelo com dobras salvo em:\n${OUTPUT}`);
  console.log(`Vértices processados: ${processedVertices.toLocaleString('pt-BR')}`);
  console.log(`Tamanho do arquivo: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log('\nO arquivo tee.glb original foi preservado.');
}

main().catch((error) => {
  console.error('\nNão foi possível gerar o modelo com caimento.');
  console.error(error?.stack || error);
  process.exitCode = 1;
});
