/**
 * Pathfinding - A* and BFS Implementation
 */

export class Pathfinding {
    constructor(gridSize) {
        this.gridSize = gridSize;
        this.halfGrid = Math.floor(gridSize / 2);
    }

    // A* Pathfinding
    findPath(start, end, obstacles) {
        const openSet = [start];
        const cameFrom = new Map();

        const gScore = new Map();
        gScore.set(this.key(start), 0);

        const fScore = new Map();
        fScore.set(this.key(start), this.heuristic(start, end));

        const obstacleSet = new Set(obstacles.map(o => this.key(o)));
        // Remove tail from obstacles (it will move when we move)
        if (obstacles.length > 0) {
            obstacleSet.delete(this.key(obstacles[obstacles.length - 1]));
        }

        while (openSet.length > 0) {
            // Get node with lowest fScore
            openSet.sort((a, b) =>
                (fScore.get(this.key(a)) || Infinity) - (fScore.get(this.key(b)) || Infinity)
            );
            const current = openSet.shift();

            // Reached goal
            if (current.x === end.x && current.z === end.z) {
                return this.reconstructPath(cameFrom, current);
            }

            // Check neighbors
            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                const neighborKey = this.key(neighbor);

                // Skip if obstacle or out of bounds
                if (obstacleSet.has(neighborKey) || !this.inBounds(neighbor)) {
                    continue;
                }

                const tentativeG = (gScore.get(this.key(current)) || Infinity) + 1;

                if (tentativeG < (gScore.get(neighborKey) || Infinity)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeG);
                    fScore.set(neighborKey, tentativeG + this.heuristic(neighbor, end));

                    if (!openSet.some(n => n.x === neighbor.x && n.z === neighbor.z)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }

        return null; // No path found
    }

    // BFS for finding any reachable cell
    bfs(start, target, obstacles) {
        const queue = [{ pos: start, path: [] }];
        const visited = new Set([this.key(start)]);
        const obstacleSet = new Set(obstacles.map(o => this.key(o)));

        while (queue.length > 0) {
            const { pos, path } = queue.shift();

            if (pos.x === target.x && pos.z === target.z) {
                return path;
            }

            const neighbors = this.getNeighbors(pos);
            for (const neighbor of neighbors) {
                const key = this.key(neighbor);

                if (!visited.has(key) && !obstacleSet.has(key) && this.inBounds(neighbor)) {
                    visited.add(key);
                    queue.push({
                        pos: neighbor,
                        path: [...path, neighbor]
                    });
                }
            }
        }

        return null;
    }

    // Flood fill to count accessible cells
    floodFill(start, obstacles) {
        const visited = new Set();
        const obstacleSet = new Set(obstacles.slice(0, -1).map(o => this.key(o))); // Exclude tail
        const queue = [start];
        let count = 0;

        while (queue.length > 0 && count < 500) { // Limit for performance
            const pos = queue.shift();
            const key = this.key(pos);

            if (visited.has(key) || obstacleSet.has(key) || !this.inBounds(pos)) {
                continue;
            }

            visited.add(key);
            count++;

            const neighbors = this.getNeighbors(pos);
            for (const neighbor of neighbors) {
                if (!visited.has(this.key(neighbor))) {
                    queue.push(neighbor);
                }
            }
        }

        return count;
    }

    getNeighbors(pos) {
        return [
            { x: pos.x, z: pos.z - 1 },
            { x: pos.x, z: pos.z + 1 },
            { x: pos.x - 1, z: pos.z },
            { x: pos.x + 1, z: pos.z }
        ];
    }

    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
    }

    inBounds(pos) {
        const maxCoord = this.halfGrid - 1; // 9 for gridSize 20
        return pos.x >= -maxCoord && pos.x <= maxCoord &&
            pos.z >= -maxCoord && pos.z <= maxCoord;
    }

    key(pos) {
        return `${pos.x},${pos.z}`;
    }

    reconstructPath(cameFrom, current) {
        const path = [current];
        let currentKey = this.key(current);

        while (cameFrom.has(currentKey)) {
            const prev = cameFrom.get(currentKey);
            path.unshift(prev);
            currentKey = this.key(prev);
        }

        return path.slice(1); // Remove start position
    }
}
