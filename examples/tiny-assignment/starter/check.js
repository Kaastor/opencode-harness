import { add } from "./math.js";

if (add(2, 3) !== 5) {
  throw new Error("Expected add(2, 3) to equal 5");
}

console.log("check passed");
