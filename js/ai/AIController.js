/**
 * AIController - SIMPLE & RELIABLE Snake Autopilot
 * 
 * NO complex algorithms, just simple rules that WORK:
 * 1. Always move to an ADJACENT cell only
 * 2. Never move into walls or self
 * 3. Prefer moves with more space
 * 4. Chase food when safe
 */

export class AIController {
    constructor(gridSize, difficulty = 'pro') {
        this.gridSize = gridSize;
        this.maxCoord = Math.floor(gridSize / 2) - 1; // 9 for gridSize 20
        this.difficulty = difficulty;
        this.inDanger = false;
    }

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
    }

    getNextDirection(headPos, currentDir, occupiedCells, foodPos, activePowerUps) {
        const head = { x: headPos.gridX, z: headPos.gridZ };
        const food = { x: foodPos.x, z: foodPos.z };
        const snake = occupiedCells;
        const snakeLength = snake.length;

        // Get all 4 possible directions
        const directions = [
            { x: 0, z: -1, name: 'UP' },
            { x: 0, z: 1, name: 'DOWN' },
            { x: -1, z: 0, name: 'LEFT' },
            { x: 1, z: 0, name: 'RIGHT' }
        ];

        // Find all VALID moves (adjacent, not wall, not self)
        const validMoves = [];

        for (const dir of directions) {
            // Skip going backwards (180-degree turn)
            if (currentDir.x !== 0 || currentDir.z !== 0) {
                if (dir.x === -currentDir.x && dir.z === -currentDir.z) {
                    continue;
                }
            }

            // Calculate new position (MUST be adjacent - only 1 cell away)
            const newPos = {
                x: head.x + dir.x,
                z: head.z + dir.z
            };

            // Check walls
            if (newPos.x < -this.maxCoord || newPos.x > this.maxCoord ||
                newPos.z < -this.maxCoord || newPos.z > this.maxCoord) {
                continue;
            }

            // Check self-collision (except tail which will move away)
            let hitsBody = false;
            for (let i = 0; i < snake.length - 1; i++) {
                if (snake[i].x === newPos.x && snake[i].z === newPos.z) {
                    hitsBody = true;
                    break;
                }
            }
            if (hitsBody) continue;

            // This move is valid
            validMoves.push({
                dir: { x: dir.x, z: dir.z },
                pos: newPos,
                name: dir.name
            });
        }

        // No valid moves = game over inevitable
        if (validMoves.length === 0) {
            this.inDanger = true;
            return currentDir;
        }

        // If only 1 valid move, take it
        if (validMoves.length === 1) {
            return validMoves[0].dir;
        }

        // Score each valid move
        for (const move of validMoves) {
            move.score = 0;

            // Count reachable space using flood fill
            move.space = this.countReachableSpace(move.pos, snake);

            // CRITICAL: Heavy penalty for moves with less space than snake length
            if (move.space < snakeLength + 2) {
                move.score -= 5000;
            } else {
                move.score += move.space * 2;
            }

            // Distance to food (closer is better)
            move.foodDist = Math.abs(move.pos.x - food.x) + Math.abs(move.pos.z - food.z);

            // Only consider food if the move is safe
            if (move.space >= snakeLength + 2) {
                move.score -= move.foodDist * 10;
            }

            // Prefer staying away from walls
            const wallDist = Math.min(
                move.pos.x - (-this.maxCoord),
                this.maxCoord - move.pos.x,
                move.pos.z - (-this.maxCoord),
                this.maxCoord - move.pos.z
            );
            move.score += wallDist * 5;

            // Slight preference for going straight
            if (dir.x === currentDir.x && dir.z === currentDir.z) {
                move.score += 3;
            }
        }

        // Sort by score (highest first)
        validMoves.sort((a, b) => b.score - a.score);

        // Return the best move
        const bestMove = validMoves[0];
        this.inDanger = bestMove.space < snakeLength * 1.5;

        return bestMove.dir;
    }

    // Simple flood fill to count reachable cells
    countReachableSpace(start, snake) {
        const visited = new Set();
        const queue = [start];
        let count = 0;
        const maxCount = 400; // Max possible cells

        // Create snake body lookup set (exclude tail)
        const blocked = new Set();
        for (let i = 0; i < snake.length - 1; i++) {
            blocked.add(`${snake[i].x},${snake[i].z}`);
        }

        while (queue.length > 0 && count < maxCount) {
            const current = queue.shift();
            const key = `${current.x},${current.z}`;

            if (visited.has(key)) continue;

            // Check if blocked
            if (blocked.has(key)) continue;

            // Check walls
            if (current.x < -this.maxCoord || current.x > this.maxCoord ||
                current.z < -this.maxCoord || current.z > this.maxCoord) {
                continue;
            }

            visited.add(key);
            count++;

            // Add all 4 neighbors to queue
            queue.push({ x: current.x + 1, z: current.z });
            queue.push({ x: current.x - 1, z: current.z });
            queue.push({ x: current.x, z: current.z + 1 });
            queue.push({ x: current.x, z: current.z - 1 });
        }

        return count;
    }

    isInDanger() {
        return this.inDanger;
    }
}
