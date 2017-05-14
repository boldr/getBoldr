/* @flow */
import fs from 'fs';
import { ASSETS_PATH, IS_DEVELOPMENT, CHUNK_MANIFEST_PATH } from '../inlinedConfig';

type AssetsMap = {|
  scripts: string[],
  styles: string[],
|};

type Chunk = {
  css: string[],
  js: string[],
};

let assetsMap: AssetsMap = {
  scripts: [],
  styles: [],
};
let loadedAssets = {};
let loadedManifest = {};
let resultCache;
function hasAssets(): boolean {
  return assetsMap.scripts.length > 0 || assetsMap.styles.length > 0;
}

export default function getBundleAssets() {
  if (hasAssets() && !IS_DEVELOPMENT) {
    return assetsMap;
  }

  try {
    loadedAssets = JSON.parse(fs.readFileSync(ASSETS_PATH, 'utf8'));
  } catch (e) {
    return null;
  }

  try {
    loadedManifest = JSON.parse(fs.readFileSync(CHUNK_MANIFEST_PATH, 'utf8'));
  } catch (e) {
    return null;
  }


  const chunks: Chunk[] = Object.keys(loadedAssets).map(
    key => loadedAssets[key],
  );
  assetsMap = chunks.reduce(
    (acc: AssetsMap, chunk: Chunk) => {
      if (chunk.js) {
        acc.scripts.push(...chunk.js);
      }

      if (chunk.css) {
        acc.styles.push(...chunk.css);
      }

      return acc;
    },
    { scripts: [], styles: [] },
  );

  return assetsMap;
}
