const THREE = require('three');

const geo = new THREE.SphereGeometry(1, 8, 8, 0, Math.PI);
const pos = geo.attributes.position.array;

let maxX = -Infinity;
let minX = Infinity;
let maxZ = -Infinity;
let minZ = Infinity;

for(let i=0; i<pos.length; i+=3) {
  if (pos[i] > maxX) maxX = pos[i];
  if (pos[i] < minX) minX = pos[i];
  if (pos[i+2] > maxZ) maxZ = pos[i+2];
  if (pos[i+2] < minZ) minZ = pos[i+2];
}

console.log("X range:", minX.toFixed(2), "to", maxX.toFixed(2));
console.log("Z range:", minZ.toFixed(2), "to", maxZ.toFixed(2));

// Test phiStart = Math.PI / 2
const geo2 = new THREE.SphereGeometry(1, 8, 8, Math.PI/2, Math.PI);
const pos2 = geo2.attributes.position.array;
let maxX2 = -Infinity, minX2 = Infinity, maxZ2 = -Infinity, minZ2 = Infinity;
for(let i=0; i<pos2.length; i+=3) {
  if (pos2[i] > maxX2) maxX2 = pos2[i];
  if (pos2[i] < minX2) minX2 = pos2[i];
  if (pos2[i+2] > maxZ2) maxZ2 = pos2[i+2];
  if (pos2[i+2] < minZ2) minZ2 = pos2[i+2];
}
console.log("Geo2 X range:", minX2.toFixed(2), "to", maxX2.toFixed(2));
console.log("Geo2 Z range:", minZ2.toFixed(2), "to", maxZ2.toFixed(2));
