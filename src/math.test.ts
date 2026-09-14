import {
  anyValidEquation,
  evaluateOrdered,
  findEquation,
  formatDraftEquation,
  formatOrderedMiss,
} from "./math";

function assert(ok: boolean, message: string): void {
  if (!ok) throw new Error(message);
}

function checkTapOrderCounts(): void {
  assert(findEquation([4, 4, 16], "×") !== null, "4 × 4 = 16 should bust in tap order");
  assert(findEquation([4, 4, 16], "÷") === null, "4 ÷ 4 = 16 must not rearrange to 16 ÷ 4 = 4");
  assert(findEquation([16, 4, 4], "÷") !== null, "16 ÷ 4 = 4 should bust when tapped in that order");
  assert(findEquation([16, 4, 4], "×") === null, "16 × 4 is not 4");

  const plus = findEquation([20, 5, 25], "+");
  assert(plus?.a === 20 && plus.b === 5 && plus.c === 25, "plus should keep tap order");
  assert(findEquation([5, 25, 20], "+") === null, "5 + 25 = 20 must not rearrange to 20 + 5 = 25");
}

function checkAnyOrderStillFindsAPath(): void {
  const found = anyValidEquation([4, 4, 16]);
  assert(found !== null, "4, 4, 16 should still be a valid trio for hints");
  assert(
    (found?.op === "×" && found.a === 4 && found.b === 4 && found.c === 16) ||
      (found?.op === "÷" && found.a === 16 && found.c === 4),
    "anyValidEquation may pick × or ÷ but must be a true ordered equation",
  );
}

function checkEvaluateAndMissCopy(): void {
  const hit = evaluateOrdered([4, 4, 16], "×");
  assert("hit" in hit && hit.hit.c === 16, "matching tap order is a hit");

  const missDiv = evaluateOrdered([4, 4, 16], "÷");
  assert("miss" in missDiv, "4 ÷ 4 = 16 is a miss");
  if ("miss" in missDiv) {
    assert(missDiv.miss.actual === 1, "miss should expose 4 ÷ 4 = 1");
    assert(missDiv.miss.expected === 16, "miss should keep the tapped answer");
    assert(
      formatOrderedMiss(missDiv.miss) === "4 ÷ 4 = 1  ·  not 16",
      `unexpected miss copy: ${formatOrderedMiss(missDiv.miss)}`,
    );
  }

  const missWhole = evaluateOrdered([4, 16, 4], "÷");
  assert("miss" in missWhole && missWhole.miss.actual === null, "4 ÷ 16 is not a whole number");
  if ("miss" in missWhole) {
    assert(
      formatOrderedMiss(missWhole.miss).includes("isn’t a whole number"),
      "non-integer divide should say it isn’t a whole number",
    );
    assert(formatOrderedMiss(missWhole.miss).includes("not 4"), "should still show the tapped answer");
  }
}

function checkDraftReadout(): void {
  assert(formatDraftEquation([]) === "_  □  _  =  _", "empty draft keeps equals and a blank op");
  assert(formatDraftEquation([4]) === "4  □  _  =  _", "first pick fills a");
  assert(formatDraftEquation([4, 4]) === "4  □  4  =  _", "second pick fills b");
  assert(formatDraftEquation([4, 4, 16]) === "4  □  4  =  16", "third pick fills the answer");
  assert(formatDraftEquation([4, 4, 16], "×") === "4  ×  4  =  16", "chosen op fills the blank");
}

checkTapOrderCounts();
checkAnyOrderStillFindsAPath();
checkEvaluateAndMissCopy();
checkDraftReadout();
console.log("ordered equation checks ok");
