/** Simulate walkability along spawn → arena path. */
import { STAGE_01_WORLD, isWalkable, constrainMove } from "../www/play/js/adventure-world.js";

const R = 18;
const world = STAGE_01_WORLD;

console.log("Testing x=360 from y=1280 to y=400, step 5");
for (let y = 1280; y >= 400; y -= 5) {
  const ok = isWalkable(world, 360, y, R);
  if (!ok) console.log(`BLOCKED at (360, ${y})`);
}

console.log("\nSimulate move up from spawn:");
let x = 360;
let y = 1200;
for (let i = 0; i < 200; i++) {
  const next = constrainMove(world, x, y, x, y - 4, R);
  if (next.x === x && next.y === y) {
    console.log(`STUCK at (${x}, ${y}) after ${i} steps`);
    break;
  }
  x = next.x;
  y = next.y;
  if (y < 400) {
    console.log(`Reached arena at (${x}, ${y})`);
    break;
  }
}

console.log("\nCheck blocked near entrance at y=940-980:");
for (let y = 930; y <= 1000; y += 10) {
  for (const bx of [360, 340, 380]) {
    if (!isWalkable(world, bx, y, R)) {
      console.log(`  blocked (${bx}, ${y})`);
    }
  }
}
