/**
 * HamiltonianCycle - deterministic full-cycle traversal for rectangular grids.
 * Supports grids where at least one dimension is even.
 */

import { GridBounds } from '../core/GridBounds.js';

export class HamiltonianCycle {
    constructor(gridConfig) {
        this.grid = GridBounds.from(gridConfig);
        this.order = [];
        this.indexByKey = new Map();

        this.valid = this.buildCycle();
    }

    isValid() {
        return this.valid;
    }

    key(pos) {
        return `${pos.x},${pos.z}`;
    }

    indexOf(pos) {
        const index = this.indexByKey.get(this.key(pos));
        return Number.isInteger(index) ? index : -1;
    }

    getCell(index) {
        if (!this.valid || this.order.length === 0) return null;
        const wrapped = ((index % this.order.length) + this.order.length) % this.order.length;
        return this.order[wrapped];
    }

    getNextCell(pos) {
        const index = this.indexOf(pos);
        if (index < 0) return null;
        return this.getCell(index + 1);
    }

    distanceForward(fromIndex, toIndex) {
        if (!this.valid || this.order.length === 0) return Infinity;
        return (toIndex - fromIndex + this.order.length) % this.order.length;
    }

    buildCycle() {
        const width = this.grid.width;
        const height = this.grid.height;

        if (width < 2 || height < 2) {
            return false;
        }

        if (width % 2 !== 0 && height % 2 !== 0) {
            return false;
        }

        const localOrder = width % 2 === 0
            ? this.buildCycleEvenWidth(width, height)
            : this.buildCycleEvenHeight(width, height);

        if (!localOrder || localOrder.length !== width * height) {
            return false;
        }

        const seen = new Set();
        this.order = localOrder.map(local => this.grid.fromLocal(local));

        for (let i = 0; i < this.order.length; i++) {
            const cell = this.order[i];
            const key = this.key(cell);
            if (seen.has(key)) {
                this.order = [];
                this.indexByKey.clear();
                return false;
            }
            seen.add(key);
            this.indexByKey.set(key, i);
        }

        for (let i = 0; i < this.order.length; i++) {
            const current = this.order[i];
            const next = this.order[(i + 1) % this.order.length];
            const manhattan = Math.abs(current.x - next.x) + Math.abs(current.z - next.z);
            if (manhattan !== 1) {
                this.order = [];
                this.indexByKey.clear();
                return false;
            }
        }

        return true;
    }

    buildCycleEvenWidth(width, height) {
        const cells = [];

        cells.push({ x: 0, z: 0 });

        for (let x = 1; x < width; x++) {
            cells.push({ x, z: 0 });
        }

        for (let z = 1; z < height; z++) {
            if (z % 2 === 1) {
                cells.push({ x: width - 1, z });
                for (let x = width - 2; x >= 1; x--) {
                    cells.push({ x, z });
                }
            } else {
                cells.push({ x: 1, z });
                for (let x = 2; x < width; x++) {
                    cells.push({ x, z });
                }
            }
        }

        for (let z = height - 1; z >= 1; z--) {
            cells.push({ x: 0, z });
        }

        return cells;
    }

    buildCycleEvenHeight(width, height) {
        const cells = [];

        cells.push({ x: 0, z: 0 });

        for (let z = 1; z < height; z++) {
            cells.push({ x: 0, z });
        }

        for (let x = 1; x < width; x++) {
            if (x % 2 === 1) {
                cells.push({ x, z: height - 1 });
                for (let z = height - 2; z >= 1; z--) {
                    cells.push({ x, z });
                }
            } else {
                cells.push({ x, z: 1 });
                for (let z = 2; z < height; z++) {
                    cells.push({ x, z });
                }
            }
        }

        for (let x = width - 1; x >= 1; x--) {
            cells.push({ x, z: 0 });
        }

        return cells;
    }
}
