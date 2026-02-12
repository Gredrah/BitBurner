/** @param {NS} ns */

const DEFAULT_LOG_TOP_N = 5;

const SCORE_WEIGHTS = {
  defendAtari: 1000,
  captureAtari: 800,
  center: 50,
  createEye: 200,
  corner: 50,
  cornerEyeBonus: 100,
  cornerDefenseMultiplier: 1.5,
  threeThreeInvasion: 150
};

function analyzeChains(board, chainIds) {
  const chains = {};
  const size = board.length;

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const token = board[x][y];
      const id = chainIds[x][y];

      if (token === "." || token === "#" || id === null) continue;

      if (!chains[id]) {
        chains[id] = { id, color: token, stones: [], liberties: [] };
      }
      chains[id].stones.push([x, y]);

      const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
          if (board[nx][ny] === ".") {
            if (!chains[id].liberties.some(lib => lib[0] === nx && lib[1] === ny)) {
              chains[id].liberties.push([nx, ny]);
            }
          }
        }
      }
    }
  }

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

function isEye(board, x, y, myColor = "X") {
  const size = board.length;
  const enemy = myColor === "X" ? "O" : "X";

  const neighbors = [
    [x + 1, y], [x - 1, y],
    [x, y + 1], [x, y - 1]
  ];

  // ALL orthogonal neighbors must be either friendly stones or board edges
  for (const [nx, ny] of neighbors) {
    if (nx < 0 || nx >= size || ny < 0 || ny >= size) {
      continue; // Edge is safe
    } else if (board[nx][ny] === myColor) {
      continue; // Friendly stone is safe
    } else {
      return false; // Enemy or empty = not a true eye
    }
  }

  const diagonals = [
    [x + 1, y + 1], [x + 1, y - 1],
    [x - 1, y + 1], [x - 1, y - 1]
  ];
  for (const [dx, dy] of diagonals) {
    if (dx >= 0 && dx < size && dy >= 0 && dy < size) {
      if (board[dx][dy] === enemy) return false;
    }
  }

  return true;
}

function isEyeAssumingStone(board, x, y, myColor, placedX, placedY) {
  const size = board.length;
  const enemy = myColor === "X" ? "O" : "X";

  const neighbors = [
    [x + 1, y], [x - 1, y],
    [x, y + 1], [x, y - 1]
  ];

  // ALL orthogonal neighbors must be either friendly stones, the placed stone, or board edges
  for (const [nx, ny] of neighbors) {
    if (nx < 0 || nx >= size || ny < 0 || ny >= size) {
      continue; // Edge is safe
    } else if ((nx === placedX && ny === placedY) || board[nx][ny] === myColor) {
      continue; // Friendly stone or placed stone is safe
    } else {
      return false; // Enemy or empty = not a true eye
    }
  }

  const diagonals = [
    [x + 1, y + 1], [x + 1, y - 1],
    [x - 1, y + 1], [x - 1, y - 1]
  ];
  for (const [dx, dy] of diagonals) {
    if (dx >= 0 && dx < size && dy >= 0 && dy < size) {
      if (dx === placedX && dy === placedY) continue;
      if (board[dx][dy] === enemy) return false;
    }
  }

  return true;
}

function countEyes(board, myColor = "X") {
  const size = board.length;
  const visited = Array.from({ length: size }, () => Array(size).fill(false));
  let eyeRegions = 0;

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (board[x][y] !== "." || visited[x][y]) continue;
      if (!isEye(board, x, y, myColor)) continue;

      // Found a new eye region - flood fill to mark all connected eye points
      const stack = [[x, y]];
      visited[x][y] = true;
      
      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        const neighbors = [
          [cx + 1, cy], [cx - 1, cy],
          [cx, cy + 1], [cx, cy - 1]
        ];
        
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
          if (visited[nx][ny]) continue;
          if (board[nx][ny] !== ".") continue;
          if (!isEye(board, nx, ny, myColor)) continue;
          
          visited[nx][ny] = true;
          stack.push([nx, ny]);
        }
      }
      
      eyeRegions++;
    }
  }

  return eyeRegions;
}

function countEyesAfterMove(board, x, y, myColor = "X") {
  const size = board.length;
  const tempBoard = board.map(row => [...row]);
  tempBoard[x][y] = myColor;
  return countEyes(tempBoard, myColor);
}

function createsEyeByMove(board, x, y, myColor = "X") {
  const currentEyes = countEyes(board, myColor);
  const eyesAfter = countEyesAfterMove(board, x, y, myColor);
  return eyesAfter > currentEyes;
}

function countEmptyNeighbors(board, x, y) {
  const size = board.length;
  const neighbors = [
    [x + 1, y], [x - 1, y],
    [x, y + 1], [x, y - 1]
  ];
  let empty = 0;

  for (const [nx, ny] of neighbors) {
    if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
      if (board[nx][ny] === ".") empty++;
    }
  }

  return empty;
}

function isLibertyOfChain(chain, x, y) {
  return chain.liberties.some(lib => lib[0] === x && lib[1] === y);
}

function isCornerRegion(x, y, size) {
  const cornerDist = 2;
  return (x <= cornerDist || x >= size - 1 - cornerDist) &&
         (y <= cornerDist || y >= size - 1 - cornerDist);
}

function isChainInCorner(chain, size) {
  return chain.stones.some(([x, y]) => isCornerRegion(x, y, size));
}

function is33InvasionPoint(board, x, y, size) {
  const invasionDist = Math.floor(size / 3);
  const invasionPoints = [
    [invasionDist, invasionDist],
    [invasionDist, size - 1 - invasionDist],
    [size - 1 - invasionDist, invasionDist],
    [size - 1 - invasionDist, size - 1 - invasionDist]
  ];
  
  if (!invasionPoints.some(([px, py]) => px === x && py === y)) {
    return false;
  }
  
  const cornerRadius = 3;
  let enemyPresence = false;
  
  for (let dx = -cornerRadius; dx <= cornerRadius; dx++) {
    for (let dy = -cornerRadius; dy <= cornerRadius; dy++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        if (board[nx][ny] === "O") {
          enemyPresence = true;
        }
      }
    }
  }
  
  return enemyPresence;
}

export function buildMoveContext(ns, board, validMoves) {
  const chainIds = ns.go.analysis.getChains(board);
  const chains = analyzeChains(board, chainIds);
  const eyeCount = countEyes(board, "X");

  return {
    ns,
    board,
    validMoves,
    size: board.length,
    chains,
    eyeCount
  };
}

export function scoreMove(board, validMoves, x, y, context) {
  if (!validMoves[x][y]) return -Infinity;

  const { chains, size, eyeCount } = context;
  let score = 0;

  for (const chain of chains.black) {
    if (chain.liberties.length === 1 && isLibertyOfChain(chain, x, y)) {
      let defendScore = SCORE_WEIGHTS.defendAtari;
      if (isChainInCorner(chain, size)) {
        defendScore *= SCORE_WEIGHTS.cornerDefenseMultiplier;
      }
      score += defendScore;
    }
  }

  let capturesAtari = false;

  for (const chain of chains.white) {
    if (chain.liberties.length === 1 && isLibertyOfChain(chain, x, y)) {
      score += SCORE_WEIGHTS.captureAtari;
      capturesAtari = true;
    }
  }

  const center = (size - 1) / 2;
  const maxDist = center * 2 || 1;
  const dist = Math.abs(x - center) + Math.abs(y - center);
  const centerScore = 1 - (dist / maxDist);
  score += centerScore * SCORE_WEIGHTS.center;

  if (isCornerRegion(x, y, size)) {
    score += SCORE_WEIGHTS.corner;
  }

  if (is33InvasionPoint(board, x, y, size)) {
    score += SCORE_WEIGHTS.threeThreeInvasion;
  }

  if (eyeCount < 2) {
    const eyesAfter = countEyesAfterMove(board, x, y, "X");
    const eyeGain = eyesAfter - eyeCount;
    
    if (eyeGain > 0) {
      let eyeScore = SCORE_WEIGHTS.createEye * eyeGain;
      if (isCornerRegion(x, y, size)) {
        eyeScore += SCORE_WEIGHTS.cornerEyeBonus;
      }
      score += eyeScore;
    }
  }

  if (!capturesAtari && countEmptyNeighbors(board, x, y) < 2) {
    return -Infinity;
  }

  return score;
}

export function getBestScoredMove(board, validMoves, context, options = {}) {
  const size = board.length;
  const logTopN = options.logTopN ?? DEFAULT_LOG_TOP_N;

  let bestScore = -Infinity;
  let bestMove = null;
  const scoredMoves = [];
  let index = 0;

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (!validMoves[x][y]) continue;

      const score = scoreMove(board, validMoves, x, y, context);
      scoredMoves.push({ x, y, score, index });
      index++;

      if (score > bestScore) {
        bestScore = score;
        bestMove = [x, y];
      }
    }
  }

  if (context?.ns && logTopN > 0 && scoredMoves.length > 0) {
    const top = scoredMoves
      .sort((a, b) => (b.score - a.score) || (a.index - b.index))
      .slice(0, logTopN)
      .map(m => `(${m.x}, ${m.y}): ${m.score}`)
      .join(" | ");

    context.ns.print(`Top ${logTopN} scored moves: ${top}`);
  }

  return bestMove;
}
