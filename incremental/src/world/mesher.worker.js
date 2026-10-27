// Mesher worker: turns padded density blocks into surface-nets meshes off the main thread.
import { meshChunk } from './mesher.js';
import { setFieldSeed } from './field.js';

self.onmessage = (ev) => {
  const { id, dens, ox, oy, oz, seed } = ev.data;
  setFieldSeed(seed);
  const m = meshChunk(dens, ox, oy, oz);
  self.postMessage({ id, ...m }, [m.positions.buffer, m.normals.buffer, m.attribs.buffer, m.indices.buffer]);
};
