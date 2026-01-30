/**
 * AIController - Path Planning Snake AI
 * 
 * Plans path to food AND simulates eating to ensure escape
 * Only eats if safe path out exists after eating
 */

export class AIController {
    constructor(gridSize, difficulty = 'pro') {
        this.gridSize = gridSize;
        this.maxCoord = Math.floor(gridSize / 2) - 1; // 9
        this.difficulty = difficulty;
        this.bombPositions = [];
    }

    setDifficulty(d) { this.difficulty = d; }
    setBombDangerZones(zones) { this.bombPositions = zones || []; }

    getNextDirection(headPos, currentDir, occupiedCells, foodPos, activePowerUps) {
        const head = { x: headPos.gridX, z: headPos.gridZ };
        const food = { x: foodPos.x, z: foodPos.z };
        const snake = occupiedCells;
        const len = snake.length;
        const tail = snake[len - 1];

        // Get valid moves
        const moves = this.getValidMoves(head, currentDir, snake);
        if (moves.length === 0) return currentDir;
        if (moves.length === 1) return moves[0].dir;

        // Calculate safety for each move
        for (const move of moves) {
            move.inBomb = this.bombPositions.some(b => b.x === move.pos.x && b.z === move.pos.z);
            move.space = this.floodFill(move.pos, snake);
            move.foodDist = Math.abs(move.pos.x - food.x) + Math.abs(move.pos.z - food.z);
            move.isSafe = move.space >= len && !move.inBomb;

            // Is this move directly onto food?
            move.isFood = move.pos.x === food.x && move.pos.z === food.z;

            // If eating food, simulate and check if we can escape after
            if (move.isFood) {
                // After eating, snake grows (tail stays, head moves to food)
                const newSnake = [move.pos, ...snake]; // Simulate grown snake
                move.escapeAfterEating = this.canEscape(move.pos, newSnake);
            }
        }

        // PRIORITY 1: Safe move onto food IF we can escape after eating
        const safeFood = moves.find(m => m.isFood && m.isSafe && m.escapeAfterEating);
        if (safeFood) {
            return safeFood.dir;
        }

        // PRIORITY 2: Safe move getting closer to food
        const currentFoodDist = Math.abs(head.x - food.x) + Math.abs(head.z - food.z);
        const safeCloser = moves.filter(m => m.isSafe && m.foodDist < currentFoodDist);
        if (safeCloser.length > 0) {
            // Pick move with most space
            safeCloser.sort((a, b) => b.space - a.space);
            return safeCloser[0].dir;
        }

        // PRIORITY 3: Any safe move, closest to food
        const safeMoves = moves.filter(m => m.isSafe);
        if (safeMoves.length > 0) {
            safeMoves.sort((a, b) => {
                if (a.foodDist !== b.foodDist) return a.foodDist - b.foodDist;
                return b.space - a.space;
            });
            return safeMoves[0].dir;
        }

        // PRIORITY 4: Survival - most space
        moves.sort((a, b) => b.space - a.space);
        return moves[0].dir;
    }

    /**
     * Check if snake can escape (has room) after eating
     */
    canEscape(head, snake) {
        const len = snake.length;
        const tail = snake[len - 1];

        // Can we reach tail?
        if (this.canReach(head, tail, snake)) {
            return true;
        }

        // Check if we have enough space
        const space = this.floodFill(head, snake);
        return space >= len + 5; // Need buffer room
    }

    canReach(start, target, snake) {
        const blocked = new Set();
        for (let i = 0; i < snake.length - 1; i++) {
            blocked.add(`${snake[i].x},${snake[i].z}`);
        }

        const visited = new Set();
        const queue = [start];

        while (queue.length > 0) {
            const pos = queue.shift();
            if (pos.x === target.x && pos.z === target.z) return true;

            const key = `${pos.x},${pos.z}`;
            if (visited.has(key)) continue;
            if (blocked.has(key)) continue;
            if (!this.inBounds(pos)) continue;

            visited.add(key);
            queue.push(
                { x: pos.x + 1, z: pos.z },
                { x: pos.x - 1, z: pos.z },
                { x: pos.x, z: pos.z + 1 },
                { x: pos.x, z: pos.z - 1 }
            );
        }
        return false;
    }

    floodFill(start, snake) {
        const blocked = new Set();
        for (let i = 0; i < snake.length - 1; i++) {
            blocked.add(`${snake[i].x},${snake[i].z}`);
        }
        for (const b of this.bombPositions) {
            blocked.add(`${b.x},${b.z}`);
        }

        const visited = new Set();
        const queue = [start];
        let count = 0;

        while (queue.length > 0 && count < 400) {
            const pos = queue.shift();
            const key = `${pos.x},${pos.z}`;

            if (visited.has(key)) continue;
            if (blocked.has(key)) continue;
            if (!this.inBounds(pos)) continue;

            visited.add(key);
            count++;
            queue.push(
                { x: pos.x + 1, z: pos.z },
                { x: pos.x - 1, z: pos.z },
                { x: pos.x, z: pos.z + 1 },
                { x: pos.x, z: pos.z - 1 }
            );
        }
        return count;
    }

    getValidMoves(head, currentDir, snake) {
        const dirs = [
            { x: 0, z: -1 },
            { x: 0, z: 1 },
            { x: -1, z: 0 },
            { x: 1, z: 0 }
        ];

        const blocked = new Set();
        for (let i = 1; i < snake.length; i++) {
            blocked.add(`${snake[i].x},${snake[i].z}`);
        }

        const moves = [];
        for (const d of dirs) {
            if (currentDir.x === -d.x && currentDir.z === -d.z &&
                (currentDir.x !== 0 || currentDir.z !== 0)) continue;

            const pos = { x: head.x + d.x, z: head.z + d.z };
            if (!this.inBounds(pos)) continue;
            if (blocked.has(`${pos.x},${pos.z}`)) continue;

            moves.push({ dir: d, pos });
        }
        return moves;
    }

    inBounds(pos) {
        return pos.x >= -this.maxCoord && pos.x <= this.maxCoord &&
            pos.z >= -this.maxCoord && pos.z <= this.maxCoord;
    }

    isInDanger() { return false; }
}
