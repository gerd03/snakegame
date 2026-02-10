/**
 * Food - apple batches with GridBounds-based placement.
 */

import * as THREE from 'three';
import { GridBounds } from './core/GridBounds.js';

export class Food {
    constructor(scene, gridConfig, options = {}) {
        this.scene = scene;
        this.grid = GridBounds.from(gridConfig);
        this.cellSize = this.grid.cellSize;

        this.fruits = [];
        this.magnetMode = false;
        this.magnetTarget = null;

        this.fiveFruitChance = options.fiveFruitChance ?? 0.2;
        this.tenFruitChance = options.tenFruitChance ?? 0.08;
        this.maxFruitsPerBatch = options.maxFruitsPerBatch ?? 10;

        this.createSharedAssets();
    }

    createSharedAssets() {
        this.shared = {
            appleGeometry: new THREE.SphereGeometry(this.cellSize * 0.35, 20, 20),
            appleMaterial: new THREE.MeshStandardMaterial({
                color: 0xE53935,
                roughness: 0.3,
                metalness: 0.1
            }),
            stemGeometry: new THREE.CylinderGeometry(
                this.cellSize * 0.03,
                this.cellSize * 0.04,
                this.cellSize * 0.12,
                8
            ),
            stemMaterial: new THREE.MeshStandardMaterial({
                color: 0x5D4037,
                roughness: 0.8,
                metalness: 0.0
            }),
            leafGeometry: new THREE.SphereGeometry(this.cellSize * 0.08, 8, 8),
            leafMaterial: new THREE.MeshStandardMaterial({
                color: 0x4CAF50,
                roughness: 0.5,
                metalness: 0.0
            }),
            highlightGeometry: new THREE.SphereGeometry(this.cellSize * 0.08, 8, 8),
            highlightMaterial: new THREE.MeshBasicMaterial({
                color: 0xFFFFFF,
                transparent: true,
                opacity: 0.4
            })
        };
    }

    createFruitMesh() {
        const group = new THREE.Group();

        const appleBody = new THREE.Mesh(this.shared.appleGeometry, this.shared.appleMaterial);
        appleBody.scale.set(1, 0.9, 1);
        appleBody.castShadow = true;
        group.add(appleBody);

        const stem = new THREE.Mesh(this.shared.stemGeometry, this.shared.stemMaterial);
        stem.position.y = this.cellSize * 0.35;
        group.add(stem);

        const leaf = new THREE.Mesh(this.shared.leafGeometry, this.shared.leafMaterial);
        leaf.scale.set(1.5, 0.3, 1);
        leaf.position.set(this.cellSize * 0.08, this.cellSize * 0.35, 0);
        leaf.rotation.z = -0.3;
        group.add(leaf);

        const highlight = new THREE.Mesh(this.shared.highlightGeometry, this.shared.highlightMaterial);
        highlight.position.set(-this.cellSize * 0.15, this.cellSize * 0.1, this.cellSize * 0.2);
        group.add(highlight);

        group.position.y = this.cellSize * 0.35;
        this.scene.add(group);

        return group;
    }

    clearFruits() {
        for (const fruit of this.fruits) {
            this.scene.remove(fruit.group);
        }
        this.fruits = [];
    }

    getSpawnCount() {
        const roll = Math.random();
        if (roll < this.tenFruitChance) return 10;
        if (roll < this.tenFruitChance + this.fiveFruitChance) return 5;
        return 1;
    }

    getFreeCells(occupiedCells) {
        const occupiedSet = new Set(occupiedCells.map(cell => `${cell.x},${cell.z}`));
        const freeCells = [];

        this.grid.forEachCell(cell => {
            if (!occupiedSet.has(`${cell.x},${cell.z}`)) {
                freeCells.push(cell);
            }
        });

        return freeCells;
    }

    createBatchFromCells(cells, count) {
        this.clearFruits();

        for (let i = 0; i < count; i++) {
            const cell = cells[i];
            const group = this.createFruitMesh();
            const world = this.grid.gridToWorld(cell.x, cell.z);

            group.position.x = world.x;
            group.position.z = world.z;
            group.scale.set(0, 0, 0);

            this.fruits.push({
                group,
                position: { x: cell.x, z: cell.z },
                phase: Math.random() * Math.PI * 2,
                spawnProgress: 0
            });
        }
    }

    spawn(occupiedCells, forcedCount = null) {
        const freeCells = this.getFreeCells(occupiedCells);
        if (freeCells.length === 0) {
            return false;
        }

        const desiredCount = forcedCount ?? this.getSpawnCount();
        const batchCount = Math.max(1, Math.min(desiredCount, this.maxFruitsPerBatch, freeCells.length));

        for (let i = freeCells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [freeCells[i], freeCells[j]] = [freeCells[j], freeCells[i]];
        }

        this.createBatchFromCells(freeCells, batchCount);
        return true;
    }

    spawnNear(occupiedCells, referencePos, forcedCount = 1) {
        const freeCells = this.getFreeCells(occupiedCells);
        if (freeCells.length === 0) return false;

        const originX = referencePos?.gridX ?? referencePos?.x ?? 0;
        const originZ = referencePos?.gridZ ?? referencePos?.z ?? 0;

        freeCells.sort((a, b) =>
            (Math.abs(a.x - originX) + Math.abs(a.z - originZ)) -
            (Math.abs(b.x - originX) + Math.abs(b.z - originZ))
        );

        const candidateWindow = Math.min(freeCells.length, 48);
        const candidateCells = freeCells.slice(0, candidateWindow);
        for (let i = candidateCells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidateCells[i], candidateCells[j]] = [candidateCells[j], candidateCells[i]];
        }

        const batchCount = Math.max(1, Math.min(forcedCount, this.maxFruitsPerBatch, candidateCells.length));
        this.createBatchFromCells(candidateCells, batchCount);
        return true;
    }

    update(deltaTime) {
        const time = performance.now() * 0.001;

        for (const fruit of this.fruits) {
            if (fruit.spawnProgress < 1) {
                fruit.spawnProgress += deltaTime * 4;
                const scale = Math.min(1, fruit.spawnProgress);
                const bounce = 1 + Math.sin(scale * Math.PI) * 0.2;
                fruit.group.scale.set(scale * bounce, scale * bounce, scale * bounce);

                if (fruit.spawnProgress >= 1) {
                    fruit.group.scale.set(1, 1, 1);
                }
            }

            fruit.group.position.y = this.cellSize * 0.35 + Math.sin(time * 2 + fruit.phase) * 0.05;
            fruit.group.rotation.y = time * 0.5 + fruit.phase;

            if (this.magnetMode && this.magnetTarget) {
                const dx = this.magnetTarget.gridX - fruit.position.x;
                const dz = this.magnetTarget.gridZ - fruit.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist > 0.5) {
                    fruit.group.position.x += (dx / dist) * deltaTime * 5;
                    fruit.group.position.z += (dz / dist) * deltaTime * 5;
                }
            }
        }
    }

    checkCollision(headPos) {
        for (let i = this.fruits.length - 1; i >= 0; i--) {
            const fruit = this.fruits[i];
            const dx = Math.abs(headPos.gridX - fruit.position.x);
            const dz = Math.abs(headPos.gridZ - fruit.position.z);
            if (dx < 1 && dz < 1) {
                this.scene.remove(fruit.group);
                this.fruits.splice(i, 1);
                return true;
            }
        }
        return false;
    }

    hasFood() {
        return this.fruits.length > 0;
    }

    getPositions() {
        return this.fruits.map(fruit => ({ x: fruit.position.x, z: fruit.position.z }));
    }

    getPosition(referencePos = null) {
        if (this.fruits.length === 0) return null;

        if (!referencePos) {
            const first = this.fruits[0];
            return { x: first.position.x, z: first.position.z };
        }

        const originX = referencePos.gridX ?? referencePos.x ?? 0;
        const originZ = referencePos.gridZ ?? referencePos.z ?? 0;

        let best = this.fruits[0];
        let bestDist = Math.abs(originX - best.position.x) + Math.abs(originZ - best.position.z);

        for (let i = 1; i < this.fruits.length; i++) {
            const fruit = this.fruits[i];
            const dist = Math.abs(originX - fruit.position.x) + Math.abs(originZ - fruit.position.z);
            if (dist < bestDist) {
                best = fruit;
                bestDist = dist;
            }
        }

        return { x: best.position.x, z: best.position.z };
    }

    setMagnetMode(active, targetPos = null) {
        this.magnetMode = active;
        this.magnetTarget = targetPos;
    }
}
