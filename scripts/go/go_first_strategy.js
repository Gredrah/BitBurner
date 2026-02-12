/** @param {NS} ns */

/**
 * Choose one of the empty points on the board at random to play
 */
  const getRandomMove = (board, validMoves) => {
  const moveOptions = [];
  const size = board[0].length;

  // Look through all the points on the board
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      // Make sure the point is a valid move
      const isValidMove = validMoves[x][y] === true;
      // Leave some spaces to make it harder to capture our pieces.
      // We don't want to run out of empty node connections!
      const isNotReservedSpace = x % 2 === 1 || y % 2 === 1;

      if (isValidMove && isNotReservedSpace) {
        moveOptions.push([x, y]);
      }
    }
  }

  // Choose one of the found moves at random
  const randomIndex = Math.floor(Math.random() * moveOptions.length);
  return moveOptions[randomIndex] ?? [];
};

/**
 * 
 * Parses the raw board and chain ID grids into useable chain objects.
 * Returns {black: Chain[], white: Chain[]}
 * 
 * @param {*} board 
 * @param {*} chainIds 
 */
function analyzeChains(board, chainIds) {
    const chains = {};
    const size = board.length;

    // 1. Group all stones by their Chain ID
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            const token = board[x][y]; // "X", "O", "."
            const id = chainIds[x][y];

            if (token === "." || token === "#" || id === null) continue;

            if (!chains[id]) {
                chains[id] = { id, color: token, stones: [], liberties: [] };
            }
            chains[id].stones.push([x, y]);

            // Check neighbors for liberties
            const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
            for (const [nx, ny] of neighbors) {
                if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                    if (board[nx][ny] === ".") {
                        // Only add if not already in liberties
                        if (!chains[id].liberties.some(lib => lib[0] === nx && lib[1] === ny)) {
                            chains[id].liberties.push([nx, ny]);
                        }
                    }
                }
            }
        }
    }

    // 2. Separate by color
    const black = [];
    const white = [];

    Object.values(chains).forEach(chain => {
        const cleanChain = {
            id: chain.id,
            stones: chain.stones,
            liberties: chain.liberties
        };

        if (chain.color === "X") black.push(cleanChain);
        else if (chain.color === "O") white.push(cleanChain);
    });

    return { black, white };
}

export function getStrategyMove(ns, board, validMoves) {
    const chains = ns.go.analysis.getChains(board);

    const {black, white} = analyzeChains(board, chains);

    // ATTACK (Atari) Liberties of 1
    for (const chain of white){
        if (chain.liberties.length === 1) {
            const [x, y] = chain.liberties[0];
            if (validMoves[x][y]) {
                ns.print(`Playing strategic move to capture opponent's chain at (${x}, ${y})`);
                return [x, y];
            }
        }
    }
    // DEFEND (Atari) Liberties of 1
    for (const chain of black) {
        if (chain.liberties.length === 1) {
            const [x, y] = chain.liberties[0];
            if (validMoves[x][y]) {
                ns.print(`Playing strategic move to defend our chain at (${x}, ${y})`);
                return [x, y];
            }
        }
    }

    // DEFEND Liberties of 2 (prevent opponent from creating an atari)
    const threatenedChains = black.filter(c => c.liberties.length === 2);
    for (const chain of threatenedChains) {
        for (const [x, y] of chain.liberties) {
            if (validMoves[x][y]) {
                ns.print(`Playing safety move (2 liberties) at (${x}, ${y})`);
                return [x, y];
            }
        }
    }

    // EXPANSION in case of inability to defend, or if no immediate threats/opportunities
    // Sort by size and grow largest first
    const sortedChains = black.sort((a, b) => b.stones.length - a.stones.length);

    for (const chain of sortedChains) {
        // Try to play on a liberty of our largest chain to expand it
        for (const [x, y] of chain.liberties) {
            if (validMoves[x][y]) {
                ns.print(`Expanding largest chain at (${x}, ${y})`);
                return [x, y];
            }
        }
    }

    return null; // No strategic move found
}

export async function resetBoard(ns) {
  ns.go.resetBoardState("Netburners", 7);
}

export async function go(ns) {
  let result, x, y;

  do {
    const board = ns.go.getBoardState();
    const validMoves = ns.go.analysis.getValidMoves();

    const strategyMove = getStrategyMove(ns, board, validMoves);
    const [randX, randY] = getRandomMove(board, validMoves);

    // Choose a move from our options (currently just "random move")
    if (strategyMove) {
      [x, y] = strategyMove;
    } else {
      [x, y] = [randX, randY];
    }

    if (x === undefined) {
      // Pass turn if no moves are found
      result = await ns.go.passTurn();
    } else {
      // Play the selected move
      result = await ns.go.makeMove(x, y);
    }

    // Log opponent's next move, once it happens
    await ns.go.opponentNextTurn();

    await ns.sleep(200);

    // Keep looping as long as the opponent is playing moves
  } while (result?.type !== "gameOver");
}

  export async function main(ns) {
    while (true) {
      await(resetBoard(ns));
      await(go(ns));
    }
  }