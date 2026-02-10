/**
 * AIController - survival-first autopilot.
 *
 * Decision layers:
 * 1) Hamiltonian cycle baseline (never-trap traversal on even boards)
 * 2) Safe shortcut to fruit (validated by simulation)
 * 3) Emergency fallback (max space + escape route)
 */

import { GridBounds } from '../core/GridBounds.js';
import { Pathfinding } from './Pathfinding.js';
import { HamiltonianCycle } from './HamiltonianCycle.js';

export class AIController {
    constructor(gridConfig, difficulty = 'normal') {
        this.grid = GridBounds.from(gridConfig);
        this.difficulty = difficulty;

        this.pathfinding = new Pathfinding(this.grid);
        this.cycle = new HamiltonianCycle(this.grid);

        this.bombPositions = [];
        this.stepCounter = 0;

        this.debugStats = {
            mode: 'cycle',
            cycleAvailable: this.cycle.isValid(),
            shortcutsAccepted: 0,
            shortcutsRejected: 0,
            emergencyCount: 0,
            fallbackCount: 0,
            lastDecision: 'init',
            lastSurvivalBuffer: 0,
            step: 0
        };
    }

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
    }

    setBombDangerZones(zones) {
        this.bombPositions = zones || [];
    }

    resetState() {
        this.stepCounter = 0;
        this.debugStats.shortcutsAccepted = 0;
        this.debugStats.shortcutsRejected = 0;
        this.debugStats.emergencyCount = 0;
        this.debugStats.fallbackCount = 0;
        this.debugStats.lastDecision = 'reset';
        this.debugStats.lastSurvivalBuffer = 0;
        this.debugStats.step = 0;
    }

    getDebugStats() {
        return {
            ...this.debugStats,
            cycleAvailable: this.cycle.isValid()
        };
    }

    getNextDirection(headPos, currentDir, occupiedCells, foodPos, _activePowerUps) {
        try {
            this.stepCounter++;
            this.debugStats.step = this.stepCounter;

            const head = { x: headPos.gridX, z: headPos.gridZ };
            const snake = occupiedCells.map(cell => ({ x: cell.x, z: cell.z }));
            const foods = this.normalizeFoodTargets(foodPos);

            if (snake.length === 0) {
                return currentDir;
            }

            const moves = this.getValidMoves(head, currentDir, snake);
            if (moves.length === 0) {
                this.debugStats.lastDecision = 'no-legal-move';
                return currentDir;
            }

            const directFoodMove = this.getDirectSafeFoodMove(moves, snake, foods);
            if (directFoodMove) {
                this.debugStats.mode = 'shortcut';
                this.debugStats.lastDecision = `direct-food:${directFoodMove.reason}`;
                this.debugStats.shortcutsAccepted += 1;
                this.debugStats.lastSurvivalBuffer = directFoodMove.survivalBuffer ?? 0;
                return directFoodMove.dir;
            }

            const earlyGameMove = this.getEarlyGameFoodChaseMove(head, moves, snake, foods);
            if (earlyGameMove) {
                this.debugStats.mode = 'shortcut';
                this.debugStats.lastDecision = `early-chase:${earlyGameMove.reason}`;
                this.debugStats.shortcutsAccepted += 1;
                this.debugStats.lastSurvivalBuffer = earlyGameMove.survivalBuffer ?? 0;
                return earlyGameMove.dir;
            }

            const cycleMove = this.cycle.isValid()
                ? this.getCycleBaselineMove(head, moves, snake, foods)
                : null;
            const shortcutMove = this.cycle.isValid()
                ? this.getBestShortcutMove(head, moves, snake, foods)
                : null;

            let selected = null;

            const shouldTakeShortcut =
                !!shortcutMove &&
                this.shouldPrioritizeShortcut(shortcutMove, cycleMove, snake.length);

            if (shouldTakeShortcut && (!cycleMove || shortcutMove.score >= cycleMove.score - this.getShortcutTolerance(snake.length))) {
                selected = shortcutMove;
                this.debugStats.mode = 'shortcut';
                this.debugStats.lastDecision = `shortcut:${shortcutMove.reason}`;
                this.debugStats.shortcutsAccepted += 1;
            } else if (cycleMove) {
                selected = cycleMove;
                this.debugStats.mode = 'cycle';
                this.debugStats.lastDecision = `cycle:${cycleMove.reason}`;
            } else {
                const fallbackMove = this.getBestFallbackMove(moves, snake, foods);
                if (fallbackMove) {
                    selected = fallbackMove;
                    this.debugStats.mode = 'fallback';
                    this.debugStats.lastDecision = `fallback:${fallbackMove.reason}`;
                    this.debugStats.fallbackCount += 1;
                }
            }

            if (!selected) {
                this.debugStats.lastDecision = 'default-first-move';
                return moves[0].dir;
            }

            this.debugStats.lastSurvivalBuffer = selected.survivalBuffer ?? 0;
            return selected.dir;
        } catch (error) {
            console.error('AI Logic Error:', error);
            const head = { x: headPos.gridX, z: headPos.gridZ };
            const fallbackObstacles = occupiedCells.map(c => ({ x: c.x, z: c.z })).slice(0, -1);
            return this.getSafestMove(head, currentDir, fallbackObstacles);
        }
    }

    getCycleBaselineMove(head, moves, snake, foods) {
        const nextCycleCell = this.cycle.getNextCell(head);
        if (!nextCycleCell) {
            return null;
        }

        const candidate = moves.find(move => move.pos.x === nextCycleCell.x && move.pos.z === nextCycleCell.z);
        if (!candidate) {
            return null;
        }

        const result = this.simulateMove(snake, candidate.pos, this.isFoodCell(candidate.pos, foods));
        if (!result) {
            return null;
        }

        const score = 380 + this.getCycleTailBuffer(result.snake) * 1.2;
        return {
            ...candidate,
            score,
            reason: 'successor',
            survivalBuffer: this.getCycleTailBuffer(result.snake)
        };
    }

    getDirectSafeFoodMove(moves, snake, foods) {
        if (!foods || foods.length === 0) return null;

        let best = null;
        for (const move of moves) {
            if (!this.isFoodCell(move.pos, foods)) continue;

            const result = this.simulateMove(snake, move.pos, true);
            if (!result) continue;
            if (!this.validateCycleOrder(result.snake, true)) continue;
            if (!this.hasEscapeRoute(result.snake)) continue;

            const score = this.scoreSurvivalState(result.snake, foods) + 420;
            if (!best || score > best.score) {
                best = {
                    ...move,
                    score,
                    reason: `${move.pos.x},${move.pos.z}`,
                    survivalBuffer: this.getCycleTailBuffer(result.snake),
                    foodGain: 99
                };
            }
        }

        return best;
    }

    getEarlyGameFoodChaseMove(head, moves, snake, foods) {
        if (!foods || foods.length === 0) return null;
        if (snake.length > 18) return null;

        const staticObstacles = snake.slice(0, -1);
        if (this.bombPositions.length > 0) {
            staticObstacles.push(...this.bombPositions);
        }

        const candidates = [...foods]
            .sort((a, b) => this.manhattan(head, a) - this.manhattan(head, b))
            .slice(0, 4);

        let best = null;
        for (const target of candidates) {
            const path = this.pathfinding.findPath(head, target, staticObstacles);
            if (!path || path.length === 0) continue;

            const firstStep = path[0];
            const move = moves.find(item => item.pos.x === firstStep.x && item.pos.z === firstStep.z);
            if (!move) continue;

            const grows = this.isFoodCell(move.pos, foods);
            const result = this.simulateMove(snake, move.pos, grows);
            if (!result) continue;
            if (!this.hasEscapeRoute(result.snake)) continue;

            const pathBonus = Math.max(0, 14 - path.length) * 22;
            const score = this.scoreSurvivalState(result.snake, foods) + 300 + pathBonus;
            if (!best || score > best.score) {
                best = {
                    ...move,
                    score,
                    reason: `${target.x},${target.z}`,
                    survivalBuffer: this.getCycleTailBuffer(result.snake),
                    foodGain: Math.max(1, 18 - path.length),
                    pathLength: path.length
                };
            }
        }

        return best;
    }

    shouldPrioritizeShortcut(shortcutMove, cycleMove, snakeLength) {
        if (!shortcutMove) return false;

        const minimumBuffer = Math.max(3, Math.floor(snakeLength * 0.05));
        if ((shortcutMove.survivalBuffer ?? 0) <= minimumBuffer) {
            return false;
        }

        if (!cycleMove) return true;

        const shortPath = (shortcutMove.pathLength ?? 99) <= (snakeLength < 70 ? 8 : 6);
        const cycleStall = (shortcutMove.foodGain ?? 0) >= 1;
        const proactiveInterval = snakeLength < 60 ? 1 : (snakeLength < 140 ? 2 : 3);

        if (shortPath || cycleStall) return true;
        return this.stepCounter % proactiveInterval === 0;
    }

    getShortcutTolerance(snakeLength) {
        if (snakeLength < 60) return 18;
        if (snakeLength < 140) return 12;
        return 8;
    }

    getBestShortcutMove(head, moves, snake, foods) {
        if (foods.length === 0) {
            return null;
        }

        const interval = snake.length < 90 ? 1 : (snake.length < 180 ? 2 : 3);
        if (this.stepCounter % interval !== 0) {
            return null;
        }

        const staticObstacles = snake.slice(0, -1);
        if (this.bombPositions.length > 0) {
            staticObstacles.push(...this.bombPositions);
        }

        const maxTargets = foods.length > 8 ? 4 : 3;
        const candidates = [...foods]
            .sort((a, b) => this.manhattan(head, a) - this.manhattan(head, b))
            .slice(0, maxTargets);

        let best = null;
        const headIndex = this.cycle.indexOf(head);

        for (const target of candidates) {
            const path = this.pathfinding.findPath(head, target, staticObstacles);
            if (!path || path.length === 0) {
                continue;
            }

            const dynamicPathLimit =
                snake.length < 80 ? 34 :
                    snake.length < 180 ? 28 : 22;
            if (path.length > dynamicPathLimit) {
                continue;
            }

            const firstStep = path[0];
            const move = moves.find(item => item.pos.x === firstStep.x && item.pos.z === firstStep.z);
            if (!move) {
                continue;
            }

            const validation = this.validateShortcutPath(path, snake, target, foods);
            if (!validation.safe) {
                this.debugStats.shortcutsRejected += 1;
                continue;
            }

            const targetIndex = this.cycle.indexOf(target);
            const cycleDistance = (headIndex >= 0 && targetIndex >= 0)
                ? this.cycle.distanceForward(headIndex, targetIndex)
                : path.length;
            const foodGain = Math.max(0, cycleDistance - path.length);
            const score = validation.score + foodGain * 34 + Math.max(0, 220 - path.length * 7);
            if (!best || score > best.score) {
                best = {
                    ...move,
                    score,
                    reason: `to-food-${target.x},${target.z}`,
                    survivalBuffer: validation.survivalBuffer,
                    foodGain,
                    pathLength: path.length
                };
            }
        }

        return best;
    }

    validateShortcutPath(path, snake, target, foods) {
        let simulatedSnake = snake.map(seg => ({ x: seg.x, z: seg.z }));
        let latestBuffer = 0;

        for (let i = 0; i < path.length; i++) {
            const step = path[i];
            const isLastStep = i === path.length - 1;
            const grows = isLastStep && step.x === target.x && step.z === target.z;

            if (this.cycle.isValid()) {
                const currentHead = simulatedSnake[0];
                const currentTail = simulatedSnake[simulatedSnake.length - 1];
                const headIndex = this.cycle.indexOf(currentHead);
                const tailIndex = this.cycle.indexOf(currentTail);
                const nextIndex = this.cycle.indexOf(step);

                if (headIndex < 0 || tailIndex < 0 || nextIndex < 0) {
                    return { safe: false, score: -Infinity, survivalBuffer: 0 };
                }

                const tailWindow = this.cycle.distanceForward(headIndex, tailIndex);
                const forwardAdvance = this.cycle.distanceForward(headIndex, nextIndex);
                const allowance = Math.max(1, tailWindow - (grows ? 3 : 2));

                if (forwardAdvance <= 0 || forwardAdvance > allowance) {
                    return { safe: false, score: -Infinity, survivalBuffer: 0 };
                }
            }

            const result = this.simulateMove(simulatedSnake, step, grows);
            if (!result) {
                return { safe: false, score: -Infinity, survivalBuffer: 0 };
            }

            simulatedSnake = result.snake;

            if (!this.validateCycleOrder(simulatedSnake, result.grows)) {
                return { safe: false, score: -Infinity, survivalBuffer: 0 };
            }

            latestBuffer = this.getCycleTailBuffer(simulatedSnake);
            if (latestBuffer <= Math.max(1, Math.floor(simulatedSnake.length * 0.035))) {
                return { safe: false, score: -Infinity, survivalBuffer: latestBuffer };
            }
        }

        if (!this.hasEscapeRoute(simulatedSnake)) {
            return { safe: false, score: -Infinity, survivalBuffer: latestBuffer };
        }

        const score = this.scoreSurvivalState(simulatedSnake, foods);
        return {
            safe: true,
            score,
            survivalBuffer: latestBuffer
        };
    }

    validateCycleOrder(snakeState, growsThisStep) {
        if (!this.cycle.isValid()) {
            return true;
        }

        const head = snakeState[0];
        const tail = snakeState[snakeState.length - 1];
        const headIndex = this.cycle.indexOf(head);
        const tailIndex = this.cycle.indexOf(tail);

        if (headIndex < 0 || tailIndex < 0) {
            return false;
        }

        const forwardGap = this.cycle.distanceForward(headIndex, tailIndex);
        const baseGap = growsThisStep ? 2 : 1;
        const dynamicGap = Math.max(baseGap, Math.floor(snakeState.length * 0.08));

        return forwardGap > dynamicGap;
    }

    getCycleTailBuffer(snakeState) {
        if (!this.cycle.isValid() || !snakeState || snakeState.length < 2) {
            return 0;
        }

        const headIndex = this.cycle.indexOf(snakeState[0]);
        const tailIndex = this.cycle.indexOf(snakeState[snakeState.length - 1]);
        if (headIndex < 0 || tailIndex < 0) {
            return 0;
        }

        return this.cycle.distanceForward(headIndex, tailIndex);
    }

    scoreSurvivalState(snakeState, foods) {
        const head = snakeState[0];
        const obstacles = snakeState.slice(1, -1);
        if (this.bombPositions.length > 0) {
            obstacles.push(...this.bombPositions);
        }

        const openSpace = this.pathfinding.floodFill(head, obstacles);
        const openNeighbors = this.getOpenNeighborCount(head, obstacles);
        const cycleBuffer = this.getCycleTailBuffer(snakeState);
        const nearestFood = this.getClosestFoodDistance(head, foods);

        return openSpace * 6 + openNeighbors * 55 + cycleBuffer * 4 - nearestFood * 3;
    }

    hasEscapeRoute(snakeState) {
        if (!snakeState || snakeState.length < 2) return true;

        const head = snakeState[0];
        const tail = snakeState[snakeState.length - 1];
        const obstacles = snakeState.slice(1, -1);
        if (this.bombPositions.length > 0) {
            obstacles.push(...this.bombPositions);
        }

        return !!this.pathfinding.findPath(head, tail, obstacles);
    }

    hasReachableFood(headPos, occupiedCells, foodPos) {
        const foods = this.normalizeFoodTargets(foodPos);
        if (foods.length === 0) return false;

        const head = { x: headPos.gridX, z: headPos.gridZ };
        const snake = occupiedCells.map(c => ({ x: c.x, z: c.z }));
        const staticObstacles = snake.slice(0, -1);
        if (this.bombPositions.length > 0) {
            staticObstacles.push(...this.bombPositions);
        }

        const maxTargets = 6;
        const candidates = [...foods]
            .sort((a, b) => this.manhattan(head, a) - this.manhattan(head, b))
            .slice(0, maxTargets);

        for (const food of candidates) {
            const path = this.pathfinding.findPath(head, food, staticObstacles);
            if (path && path.length > 0) return true;
        }

        return false;
    }

    getEmergencyDirection(headPos, currentDir, occupiedCells, foodPos) {
        const head = { x: headPos.gridX, z: headPos.gridZ };
        const snake = occupiedCells.map(c => ({ x: c.x, z: c.z }));
        const foods = this.normalizeFoodTargets(foodPos);

        if (snake.length === 0) return null;

        const moves = this.getValidMoves(head, currentDir, snake);
        if (moves.length === 0) return null;

        const fallback = this.getBestFallbackMove(moves, snake, foods);
        if (fallback) {
            this.debugStats.emergencyCount += 1;
            this.debugStats.lastDecision = `emergency:${fallback.reason}`;
            return fallback.dir;
        }

        return moves[0].dir;
    }

    getBestFallbackMove(moves, snake, foods) {
        let best = null;

        for (const move of moves) {
            const result = this.simulateMove(snake, move.pos, this.isFoodCell(move.pos, foods));
            if (!result) continue;

            const score = this.scoreSurvivalState(result.snake, foods);
            if (!best || score > best.score) {
                best = {
                    ...move,
                    score,
                    reason: 'max-space',
                    survivalBuffer: this.getCycleTailBuffer(result.snake)
                };
            }
        }

        return best;
    }

    simulateMove(snake, nextPos, grows = false) {
        if (!this.grid.inBounds(nextPos)) {
            return null;
        }

        const willGrow = !!grows;

        for (let i = 1; i < snake.length; i++) {
            const isTail = i === snake.length - 1;
            if (isTail && !willGrow) continue;

            if (snake[i].x === nextPos.x && snake[i].z === nextPos.z) {
                return null;
            }
        }

        if (this.isOccupied(nextPos, this.bombPositions)) {
            return null;
        }

        const nextSnake = [{ x: nextPos.x, z: nextPos.z }, ...snake.map(seg => ({ x: seg.x, z: seg.z }))];
        if (!willGrow) {
            nextSnake.pop();
        }

        return {
            snake: nextSnake,
            grows: willGrow
        };
    }

    normalizeFoodTargets(foodPos) {
        if (!foodPos) return [];
        const list = Array.isArray(foodPos) ? foodPos : [foodPos];
        return list.filter(item => item && Number.isFinite(item.x) && Number.isFinite(item.z));
    }

    getClosestFoodDistance(pos, foods) {
        const normalized = this.normalizeFoodTargets(foods);
        if (normalized.length === 0) {
            return 0;
        }

        let best = Infinity;
        for (const food of normalized) {
            const distance = this.manhattan(pos, food);
            if (distance < best) {
                best = distance;
            }
        }

        return best;
    }

    getOpenNeighborCount(pos, obstacles) {
        const obstacleSet = new Set((obstacles || []).map(obstacle => `${obstacle.x},${obstacle.z}`));
        let open = 0;

        for (const neighbor of this.pathfinding.getNeighbors(pos)) {
            if (!this.grid.inBounds(neighbor)) continue;
            if (obstacleSet.has(`${neighbor.x},${neighbor.z}`)) continue;
            open++;
        }

        return open;
    }

    isFoodCell(pos, foods) {
        const normalized = this.normalizeFoodTargets(foods);
        return normalized.some(food => food.x === pos.x && food.z === pos.z);
    }

    manhattan(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
    }

    getValidMoves(head, currentDir, snake) {
        const dirs = [
            { x: 0, z: -1 },
            { x: 0, z: 1 },
            { x: -1, z: 0 },
            { x: 1, z: 0 }
        ];

        const blocked = new Set();
        for (let i = 1; i < snake.length - 1; i++) {
            blocked.add(`${snake[i].x},${snake[i].z}`);
        }
        for (const bombPos of this.bombPositions) {
            blocked.add(`${bombPos.x},${bombPos.z}`);
        }

        const moves = [];

        for (const dir of dirs) {
            if (currentDir.x === -dir.x && currentDir.z === -dir.z &&
                (currentDir.x !== 0 || currentDir.z !== 0)) {
                continue;
            }

            const pos = { x: head.x + dir.x, z: head.z + dir.z };
            if (!this.grid.inBounds(pos)) continue;
            if (blocked.has(`${pos.x},${pos.z}`)) continue;

            moves.push({ dir, pos });
        }

        return moves;
    }

    getSafestMove(head, currentDir, obstacles) {
        const moves = [
            { x: 0, z: -1 },
            { x: 0, z: 1 },
            { x: -1, z: 0 },
            { x: 1, z: 0 }
        ];

        let bestMove = currentDir;
        let maxSpace = -1;

        for (const move of moves) {
            if (move.x === -currentDir.x && move.z === -currentDir.z) continue;

            const nextPos = { x: head.x + move.x, z: head.z + move.z };
            if (!this.grid.inBounds(nextPos)) continue;
            if (this.isOccupied(nextPos, obstacles)) continue;

            const space = this.pathfinding.floodFill(nextPos, obstacles);
            if (space > maxSpace) {
                maxSpace = space;
                bestMove = move;
            }
        }

        return bestMove;
    }

    getDirectionFromMove(from, to) {
        return {
            x: to.x - from.x,
            z: to.z - from.z
        };
    }

    isOccupied(pos, obstacles) {
        return (obstacles || []).some(obstacle => obstacle.x === pos.x && obstacle.z === pos.z);
    }
}
