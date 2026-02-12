/** @param {NS} ns */

import { buildMoveContext, getBestScoredMove } from "scripts/go/go_util.js";

export async function resetBoard(ns) {
  ns.go.resetBoardState("Netburners", 7);
}

export async function go(ns) {
  let result, x, y;

  do {
    const board = ns.go.getBoardState();
    const validMoves = ns.go.analysis.getValidMoves();
    const context = buildMoveContext(ns, board, validMoves);
    const bestMove = getBestScoredMove(board, validMoves, context);

    if (bestMove) {
      [x, y] = bestMove;
    } else {
      x = undefined;
    }

    if (x === undefined) {
      result = await ns.go.passTurn();
    } else {
      result = await ns.go.makeMove(x, y);
    }

    await ns.go.opponentNextTurn();
    await ns.sleep(200);
  } while (result?.type !== "gameOver");
}

export async function main(ns) {
  while (true) {
    await resetBoard(ns);
    await go(ns);
  }
}
