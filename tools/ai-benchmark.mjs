#!/usr/bin/env node

import { GridBounds } from '../js/core/GridBounds.js';
import { AIController } from '../js/ai/AIController.js';

function parseArgs(argv) {
    const out = {
        runs: 200,
        steps: 15000,
        threshold: 0.95,
        difficulty: 'normal',
        requireFill: false,
        seed: 123456789
    };

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        const next = argv[i + 1];

        if (token === '--runs' && next) {
            out.runs = Number.parseInt(next, 10);
            i++;
        } else if (token === '--steps' && next) {
            out.steps = Number.parseInt(next, 10);
            i++;
        } else if (token === '--threshold' && next) {
            out.threshold = Number.parseFloat(next);
            i++;
        } else if (token === '--difficulty' && next) {
            out.difficulty = next;
            i++;
        } else if (token === '--seed' && next) {
            out.seed = Number.parseInt(next, 10);
            i++;
        } else if (token === '--require-fill') {
            out.requireFill = true;
        }
    }

    return out;
}

function createRng(seed) {
    let state = seed >>> 0;
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 0x100000000;
    };
}

function key(pos) {
    return `${pos.x},${pos.z}`;
}

function spawnFruit(grid, segments, rng) {
    const occupied = new Set(segments.map(key));
    const free = [];

    grid.forEachCell(cell => {
        if (!occupied.has(key(cell))) {
            free.push(cell);
        }
    });

    if (free.length === 0) {
        return null;
    }

    const index = Math.floor(rng() * free.length);
    return free[index];
}

function simulateRun(options, seedOffset) {
    const rng = createRng(options.seed + seedOffset * 1013904223);
    const grid = new GridBounds({
        width: 20,
        height: 20,
        cellSize: 1,
        minX: -10,
        minZ: -10
    });

    const ai = new AIController(grid, options.difficulty);
    ai.resetState();

    let direction = { x: 1, z: 0 };
    let segments = [
        { x: -1, z: 0 },
        { x: -2, z: 0 },
        { x: -3, z: 0 }
    ];
    let growPending = 0;
    let fruits = 0;
    let fruit = spawnFruit(grid, segments, rng);

    if (!fruit) {
        return {
            success: true,
            filled: true,
            reason: 'filled',
            steps: 0,
            fruits: 0,
            survivedSteps: 0
        };
    }

    for (let step = 1; step <= options.steps; step++) {
        const head = segments[0];

        const nextDir = ai.getNextDirection(
            { gridX: head.x, gridZ: head.z },
            direction,
            segments.map(seg => ({ x: seg.x, z: seg.z })),
            [fruit],
            []
        );

        if (nextDir && !(nextDir.x === -direction.x && nextDir.z === -direction.z)) {
            direction = { x: nextDir.x, z: nextDir.z };
        }

        const newHead = { x: head.x + direction.x, z: head.z + direction.z };

        if (!grid.inBounds(newHead)) {
            return {
                success: false,
                filled: false,
                reason: 'wall',
                steps: step,
                fruits,
                survivedSteps: step
            };
        }

        const willGrow = growPending > 0;
        for (let i = 1; i < segments.length; i++) {
            const isTail = i === segments.length - 1;
            if (isTail && !willGrow) continue;
            if (segments[i].x === newHead.x && segments[i].z === newHead.z) {
                return {
                    success: false,
                    filled: false,
                    reason: 'self',
                    steps: step,
                    fruits,
                    survivedSteps: step
                };
            }
        }

        segments.unshift(newHead);

        let ateFruit = false;
        if (newHead.x === fruit.x && newHead.z === fruit.z) {
            ateFruit = true;
            growPending += 1;
            fruits += 1;
        }

        if (growPending > 0) {
            growPending -= 1;
        } else {
            segments.pop();
        }

        if (segments.length >= grid.cellCount) {
            return {
                success: true,
                filled: true,
                reason: 'filled',
                steps: step,
                fruits,
                survivedSteps: step
            };
        }

        if (ateFruit) {
            fruit = spawnFruit(grid, segments, rng);
            if (!fruit) {
                return {
                    success: true,
                    filled: true,
                    reason: 'filled',
                    steps: step,
                    fruits,
                    survivedSteps: step
                };
            }
        }
    }

    return {
        success: true,
        filled: false,
        reason: 'survived-limit',
        steps: options.steps,
        fruits,
        survivedSteps: options.steps
    };
}

function percentile(values, p) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
    return sorted[index];
}

function main() {
    const options = parseArgs(process.argv.slice(2));

    if (!Number.isFinite(options.runs) || options.runs <= 0) {
        throw new Error('runs must be > 0');
    }
    if (!Number.isFinite(options.steps) || options.steps <= 0) {
        throw new Error('steps must be > 0');
    }

    const runs = [];
    const reasons = new Map();

    for (let i = 0; i < options.runs; i++) {
        const result = simulateRun(options, i + 1);
        runs.push(result);
        reasons.set(result.reason, (reasons.get(result.reason) || 0) + 1);
    }

    const passingRuns = options.requireFill
        ? runs.filter(run => run.filled).length
        : runs.filter(run => run.success).length;

    const passRate = passingRuns / options.runs;
    const fullWinRate = runs.filter(run => run.filled).length / options.runs;
    const avgFruits = runs.reduce((sum, run) => sum + run.fruits, 0) / options.runs;
    const avgSteps = runs.reduce((sum, run) => sum + run.steps, 0) / options.runs;
    const p95Survival = percentile(runs.map(run => run.survivedSteps), 95);

    const summary = {
        config: {
            runs: options.runs,
            steps: options.steps,
            threshold: options.threshold,
            difficulty: options.difficulty,
            requireFill: options.requireFill,
            seed: options.seed
        },
        results: {
            passRate,
            fullWinRate,
            avgFruits,
            avgSteps,
            p95Survival,
            reasons: Object.fromEntries(reasons)
        }
    };

    console.log(JSON.stringify(summary, null, 2));

    if (passRate < options.threshold) {
        process.exitCode = 1;
    }
}

main();
