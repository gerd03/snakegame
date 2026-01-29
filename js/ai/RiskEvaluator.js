/**
 * RiskEvaluator - Danger Detection and Path Safety Analysis
 */

export class RiskEvaluator {
    constructor(gridSize) {
        this.gridSize = gridSize;
        this.halfGrid = Math.floor(gridSize / 2);
    }

    // Evaluate if current position is dangerous
    evaluateDanger(head, direction, snake) {
        const nextPos = {
            x: head.x + direction.x,
            z: head.z + direction.z
        };

        // Check immediate danger
        if (!this.inBounds(nextPos)) return true;

        // Check if we're boxing ourselves in
        const accessibleCells = this.countAccessible(nextPos, snake);
        if (accessibleCells < snake.length) {
            return true;
        }

        // Check if we're near edges with limited options
        const edgeDistance = Math.min(
            nextPos.x + this.halfGrid,
            this.halfGrid - nextPos.x - 1,
            nextPos.z + this.halfGrid,
            this.halfGrid - nextPos.z - 1
        );

        if (edgeDistance <= 1 && accessibleCells < snake.length * 2) {
            return true;
        }

        return false;
    }

    // Check if a planned path is safe
    isPathSafe(path, snake, lookAhead) {
        if (!path || path.length === 0) return false;

        // Simulate snake movement along path
        let simulatedSnake = [...snake];

        for (let i = 0; i < Math.min(path.length, lookAhead); i++) {
            const pos = path[i];

            // Check collision with simulated snake body
            for (let j = 0; j < simulatedSnake.length - 1; j++) {
                if (simulatedSnake[j].x === pos.x && simulatedSnake[j].z === pos.z) {
                    return false;
                }
            }

            // Update simulated snake (move forward)
            simulatedSnake.unshift(pos);
            simulatedSnake.pop();
        }

        // Check if we still have escape routes at the end
        const finalPos = path[Math.min(path.length - 1, lookAhead - 1)];
        const accessibleCells = this.countAccessible(finalPos, simulatedSnake);

        return accessibleCells >= snake.length;
    }

    // Detect if a move leads to a dead end (trap)
    isDeadEnd(pos, snake, depth = 5) {
        if (depth <= 0) return false;

        const validMoves = this.getValidMoves(pos, snake);

        if (validMoves.length === 0) return true;
        if (validMoves.length === 1) {
            // Only one way out - check if it leads to dead end
            return this.isDeadEnd(validMoves[0], snake, depth - 1);
        }

        return false;
    }

    // Check for potential future traps
    detectFutureTrap(head, path, snake, stepsAhead = 10) {
        let simulatedSnake = [...snake];
        let simulatedHead = head;

        for (let i = 0; i < Math.min(path.length, stepsAhead); i++) {
            simulatedHead = path[i];
            simulatedSnake.unshift(simulatedHead);
            simulatedSnake.pop();

            // Count escape routes
            const escapeRoutes = this.getValidMoves(simulatedHead, simulatedSnake);

            if (escapeRoutes.length === 0) {
                return { trapped: true, stepsTillTrap: i };
            }

            if (escapeRoutes.length === 1 && i < stepsAhead - 1) {
                // Getting cornered - risky
                return { trapped: false, risky: true, escapeRoutes: 1 };
            }
        }

        return { trapped: false, risky: false };
    }

    // Calculate long-term survival score
    calculateSurvivalScore(head, direction, snake, food) {
        const nextPos = {
            x: head.x + direction.x,
            z: head.z + direction.z
        };

        if (!this.inBounds(nextPos)) return -Infinity;

        let score = 0;

        // Factor 1: Accessible space
        const accessible = this.countAccessible(nextPos, snake);
        score += accessible * 10;

        // Factor 2: Distance to food
        const foodDist = Math.abs(nextPos.x - food.x) + Math.abs(nextPos.z - food.z);
        score -= foodDist * 2;

        // Factor 3: Edge avoidance
        const edgeDist = Math.min(
            nextPos.x + this.halfGrid,
            this.halfGrid - nextPos.x - 1,
            nextPos.z + this.halfGrid,
            this.halfGrid - nextPos.z - 1
        );
        score += edgeDist * 3;

        // Factor 4: Tail accessibility (can we reach our tail?)
        const tail = snake[snake.length - 1];
        const tailDist = Math.abs(nextPos.x - tail.x) + Math.abs(nextPos.z - tail.z);
        score -= tailDist;

        return score;
    }

    getValidMoves(pos, snake) {
        const moves = [
            { x: pos.x, z: pos.z - 1 },
            { x: pos.x, z: pos.z + 1 },
            { x: pos.x - 1, z: pos.z },
            { x: pos.x + 1, z: pos.z }
        ];

        return moves.filter(move => {
            if (!this.inBounds(move)) return false;

            // Check collision with snake (excluding tail)
            for (let i = 0; i < snake.length - 1; i++) {
                if (snake[i].x === move.x && snake[i].z === move.z) {
                    return false;
                }
            }

            return true;
        });
    }

    countAccessible(start, snake) {
        const visited = new Set();
        const obstacleSet = new Set(snake.slice(0, -1).map(s => `${s.x},${s.z}`));
        const queue = [start];
        let count = 0;

        while (queue.length > 0 && count < 400) {
            const pos = queue.shift();
            const key = `${pos.x},${pos.z}`;

            if (visited.has(key) || obstacleSet.has(key) || !this.inBounds(pos)) {
                continue;
            }

            visited.add(key);
            count++;

            queue.push(
                { x: pos.x, z: pos.z - 1 },
                { x: pos.x, z: pos.z + 1 },
                { x: pos.x - 1, z: pos.z },
                { x: pos.x + 1, z: pos.z }
            );
        }

        return count;
    }

    inBounds(pos) {
        return pos.x >= -this.halfGrid && pos.x < this.halfGrid &&
            pos.z >= -this.halfGrid && pos.z < this.halfGrid;
    }
}
