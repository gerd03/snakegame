/**
 * GridBounds - canonical playfield geometry and coordinate conversions.
 */

export class GridBounds {
    constructor(options = {}) {
        const {
            width,
            height = width,
            cellSize = 1,
            minX,
            minZ
        } = options;

        if (!Number.isInteger(width) || width < 2) {
            throw new Error('GridBounds requires an integer width >= 2');
        }
        if (!Number.isInteger(height) || height < 2) {
            throw new Error('GridBounds requires an integer height >= 2');
        }

        this.width = width;
        this.height = height;
        this.cellSize = cellSize;

        this.minX = Number.isInteger(minX) ? minX : -Math.floor(width / 2);
        this.minZ = Number.isInteger(minZ) ? minZ : -Math.floor(height / 2);

        this.maxX = this.minX + width - 1;
        this.maxZ = this.minZ + height - 1;

        this.centerOffsetX = (this.minX + this.maxX) / 2;
        this.centerOffsetZ = (this.minZ + this.maxZ) / 2;

        this.cellCount = this.width * this.height;
    }

    static from(config, fallbackCellSize = 1) {
        if (config instanceof GridBounds) {
            return config;
        }

        if (typeof config === 'number') {
            return new GridBounds({
                width: config,
                height: config,
                cellSize: fallbackCellSize
            });
        }

        if (config && typeof config === 'object') {
            if (config.gridBounds) {
                return GridBounds.from(config.gridBounds, config.cellSize ?? fallbackCellSize);
            }

            if (Number.isInteger(config.width)) {
                return new GridBounds({
                    width: config.width,
                    height: config.height ?? config.width,
                    cellSize: config.cellSize ?? fallbackCellSize,
                    minX: config.minX,
                    minZ: config.minZ
                });
            }

            if (Number.isInteger(config.gridSize)) {
                return new GridBounds({
                    width: config.gridSize,
                    height: config.gridSize,
                    cellSize: config.cellSize ?? fallbackCellSize
                });
            }
        }

        throw new Error('Unsupported grid configuration');
    }

    key(pos) {
        return `${pos.x},${pos.z}`;
    }

    inBounds(pos) {
        return pos.x >= this.minX && pos.x <= this.maxX &&
            pos.z >= this.minZ && pos.z <= this.maxZ;
    }

    forEachCell(visitor) {
        for (let x = this.minX; x <= this.maxX; x++) {
            for (let z = this.minZ; z <= this.maxZ; z++) {
                visitor({ x, z });
            }
        }
    }

    toLocal(pos) {
        return {
            x: pos.x - this.minX,
            z: pos.z - this.minZ
        };
    }

    fromLocal(localPos) {
        return {
            x: this.minX + localPos.x,
            z: this.minZ + localPos.z
        };
    }

    gridToWorld(gridX, gridZ) {
        return {
            x: (gridX - this.centerOffsetX) * this.cellSize,
            z: (gridZ - this.centerOffsetZ) * this.cellSize
        };
    }

    worldToGrid(worldX, worldZ) {
        return {
            x: Math.round(worldX / this.cellSize + this.centerOffsetX),
            z: Math.round(worldZ / this.cellSize + this.centerOffsetZ)
        };
    }

    getBoundsWorld() {
        const minWorld = this.gridToWorld(this.minX, this.minZ);
        const maxWorld = this.gridToWorld(this.maxX, this.maxZ);
        return {
            minX: minWorld.x,
            maxX: maxWorld.x,
            minZ: minWorld.z,
            maxZ: maxWorld.z
        };
    }

    randomFreeCell(occupied = [], rng = Math.random) {
        const occupiedSet = occupied instanceof Set
            ? occupied
            : new Set(occupied.map(pos => this.key(pos)));
        const free = [];

        this.forEachCell(cell => {
            if (!occupiedSet.has(this.key(cell))) {
                free.push(cell);
            }
        });

        if (free.length === 0) {
            return null;
        }

        const index = Math.floor(rng() * free.length);
        return free[index];
    }

    clone() {
        return new GridBounds({
            width: this.width,
            height: this.height,
            cellSize: this.cellSize,
            minX: this.minX,
            minZ: this.minZ
        });
    }
}

export function createGridConfig(options) {
    return new GridBounds(options);
}

export function toOccupiedSet(cells = []) {
    return new Set(cells.map(cell => `${cell.x},${cell.z}`));
}
