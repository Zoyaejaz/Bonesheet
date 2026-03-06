import { shiftFormula } from './src/lib/parser';

console.log("TEST 1: Moving Row 1 to Row 3 (down)");
console.log("Expected: =SUM(A2:B6) + C1");
console.log("Actual:   " + shiftFormula("=SUM(A1:B5) + C2", "row", 0, 2));

console.log("\nTEST 2: Moving Col A to Col C (right)");
console.log("Expected: =SUM(D1:E5) + B2");
console.log("Actual:   " + shiftFormula("=SUM(C1:D5) + A2", "col", 0, 2));

console.log("\nTEST 3: Moving Row 5 to Row 1 (up)");
console.log("Expected: =SUM(A1:A6)"); // 5 -> 1 (4 becomes 5, etc)
console.log("Actual:   " + shiftFormula("=SUM(A1:A5)", "row", 4, 0));
