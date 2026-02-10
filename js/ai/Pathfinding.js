/**
 * Pathfinding - A* and BFS on GridBounds.
 */

import { GridBounds } from '../core/GridBounds.js';

export class Pathfinding {
    constructor(gridConfig) {
        this.grid = GridBounds.from(gridConfig);
    }

    findPath(start, end, obstacles) {
        if (start.x === end.x && start.z === end.z) return [];

        const openSet = [start];
        const openSetKeys = new Set([this.key(start)]);
        const closedSet = new Set();
        const cameFrom = new Map();

        const gScore = new Map();
        gScore.set(this.key(start), 0);

        const fScore = new Map();
        fScore.set(this.key(start), this.heuristic(start, end));

        const obstacleSet = new Set((obstacles || []).map(o => this.key(o)));

        while (openSet.length > 0) {
            let bestIndex = 0;
            let current = openSet[0];
            let currentKey = this.key(current);
            let bestScore = fScore.get(currentKey) ?? Infinity;

            for (let i = 1; i < openSet.length; i++) {
                const node = openSet[i];
                const nodeKey = this.key(node);
                const nodeScore = fScore.get(nodeKey) ?? Infinity;
                if (nodeScore < bestScore) {
                    bestIndex = i;
                    current = node;
                    currentKey = nodeKey;
                    bestScore = nodeScore;
                }
            }

            const tail = openSet.pop();
            if (bestIndex < openSet.length) {
                openSet[bestIndex] = tail;
            }

            openSetKeys.delete(currentKey);
            if (closedSet.has(currentKey)) continue;
            closedSet.add(currentKey);

            if (current.x === end.x && current.z === end.z) {
                return this.reconstructPath(cameFrom, current);
            }

            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                const neighborKey = this.key(neighbor);

                if (obstacleSet.has(neighborKey) || !this.inBounds(neighbor) || closedSet.has(neighborKey)) {
                    continue;
                }

                const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;
                if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeG);
                    fScore.set(neighborKey, tentativeG + this.heuristic(neighbor, end));

                    if (!openSetKeys.has(neighborKey)) {
                        openSet.push(neighbor);
                        openSetKeys.add(neighborKey);
                    }
                }
            }
        }

        return null;
    }

    bfs(start, target, obstacles) {
        const queue = [{ pos: start, path: [] }];
        let queueIndex = 0;
        const visited = new Set([this.key(start)]);
        const obstacleSet = new Set((obstacles || []).map(o => this.key(o)));

        while (queueIndex < queue.length) {
            const { pos, path } = queue[queueIndex++];

            if (pos.x === target.x && pos.z === target.z) {
                return path;
            }

            for (const neighbor of this.getNeighbors(pos)) {
                const neighborKey = this.key(neighbor);
                if (visited.has(neighborKey) || obstacleSet.has(neighborKey) || !this.inBounds(neighbor)) {
                    continue;
                }

                visited.add(neighborKey);
                queue.push({
                    pos: neighbor,
                    path: [...path, neighbor]
                });
            }
        }

        return null;
    }

    floodFill(start, obstacles) {
        const visited = new Set();
        const obstacleSet = new Set((obstacles || []).map(o => this.key(o)));
        const queue = [start];
        let queueIndex = 0;
        let count = 0;

        const maxCells = this.grid.cellCount;

        while (queueIndex < queue.length && count < maxCells) {
            const pos = queue[queueIndex++];
            const posKey = this.key(pos);

            if (visited.has(posKey) || obstacleSet.has(posKey) || !this.inBounds(pos)) {
                continue;
            }

            visited.add(posKey);
            count++;

            for (const neighbor of this.getNeighbors(pos)) {
                const neighborKey = this.key(neighbor);
                if (!visited.has(neighborKey)) {
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
        return this.grid.inBounds(pos);
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

        return path.slice(1);
    }
}
