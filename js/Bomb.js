/**
 * Bomb - timed hazard with GridBounds-based placement.
 */

import * as THREE from 'three';
import { GridBounds } from './core/GridBounds.js';

export class Bomb {
    constructor(scene, gridConfig) {
        this.scene = scene;
        this.grid = GridBounds.from(gridConfig);
        this.cellSize = this.grid.cellSize;

        this.position = { x: 0, z: 0 };
        this.active = false;
        this.timer = 0;
        this.maxTimer = 3.0;
        this.blastRadius = 1;
        this.group = null;
        this.exploded = false;

        this.createMesh();
    }

    createMesh() {
        this.group = new THREE.Group();

        const bombGeometry = new THREE.SphereGeometry(this.cellSize * 0.35, 16, 16);
        const bombMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.3,
            metalness: 0.6
        });
        this.bombMesh = new THREE.Mesh(bombGeometry, bombMaterial);
        this.group.add(this.bombMesh);

        const fuseGeometry = new THREE.CylinderGeometry(0.03, 0.03, this.cellSize * 0.2, 8);
        const fuseMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
        this.fuse = new THREE.Mesh(fuseGeometry, fuseMaterial);
        this.fuse.position.y = this.cellSize * 0.35;
        this.group.add(this.fuse);

        const sparkGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xFF6600 });
        this.spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
        this.spark.position.y = this.cellSize * 0.45;
        this.group.add(this.spark);

        const ringGeometry = new THREE.RingGeometry(
            this.cellSize * 0.5,
            this.cellSize * 0.6,
            32
        );
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF0000,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        this.warningRing = new THREE.Mesh(ringGeometry, ringMaterial);
        this.warningRing.rotation.x = -Math.PI / 2;
        this.warningRing.position.y = 0.01;
        this.group.add(this.warningRing);

        this.group.position.y = this.cellSize * 0.35;
        this.group.visible = false;
        this.scene.add(this.group);
    }

    spawn(occupiedCells, foodPos) {
        const occupiedSet = new Set(occupiedCells.map(cell => `${cell.x},${cell.z}`));

        if (Array.isArray(foodPos)) {
            for (const pos of foodPos) {
                occupiedSet.add(`${pos.x},${pos.z}`);
            }
        } else if (foodPos) {
            occupiedSet.add(`${foodPos.x},${foodPos.z}`);
        }

        const head = occupiedCells[0];
        let validPosition = null;

        for (let attempts = 0; attempts < 100; attempts++) {
            const candidate = this.grid.randomFreeCell(occupiedSet);
            if (!candidate) break;

            const distToHead = head
                ? Math.abs(candidate.x - head.x) + Math.abs(candidate.z - head.z)
                : 10;
            if (distToHead < 3) {
                occupiedSet.add(`${candidate.x},${candidate.z}`);
                continue;
            }

            validPosition = candidate;
            break;
        }

        if (!validPosition) {
            return false;
        }

        this.position = validPosition;
        this.active = true;
        this.exploded = false;
        this.timer = this.maxTimer;

        const world = this.grid.gridToWorld(this.position.x, this.position.z);
        this.group.position.x = world.x;
        this.group.position.z = world.z;
        this.group.visible = true;
        this.group.scale.set(1, 1, 1);

        return true;
    }

    update(deltaTime) {
        if (!this.active) return false;

        this.timer -= deltaTime;
        const urgency = 1 - (this.timer / this.maxTimer);

        const scale = 1 + urgency * 0.3;
        this.bombMesh.scale.set(scale, scale, scale);

        const pulse = Math.sin(Date.now() * (0.01 + urgency * 0.03)) * 0.5 + 0.5;
        this.warningRing.material.opacity = 0.3 + pulse * 0.5;

        const ringScale = 1 + urgency * 0.5;
        this.warningRing.scale.set(ringScale, ringScale, 1);

        this.spark.material.color.setHex(urgency > 0.7 ? 0xFF0000 : 0xFF6600);
        this.spark.visible = Math.random() > 0.2;

        const r = 0.2 + urgency * 0.8;
        this.bombMesh.material.color.setRGB(r, 0.2 * (1 - urgency), 0);

        if (this.timer <= 0) {
            this.explode();
            return true;
        }

        return false;
    }

    explode() {
        this.exploded = true;
        this.active = false;
        this.group.visible = false;
    }

    checkCollision(headPos) {
        if (!this.active && !this.exploded) return false;

        const dx = Math.abs(headPos.gridX - this.position.x);
        const dz = Math.abs(headPos.gridZ - this.position.z);
        return dx <= this.blastRadius && dz <= this.blastRadius;
    }

    checkDirectHit(headPos) {
        if (!this.active) return false;
        return headPos.gridX === this.position.x && headPos.gridZ === this.position.z;
    }

    getPosition() {
        if (!this.active) return null;
        return { ...this.position };
    }

    getDangerZone() {
        if (!this.active) return [];

        const dangerZone = [];
        for (let dx = -this.blastRadius; dx <= this.blastRadius; dx++) {
            for (let dz = -this.blastRadius; dz <= this.blastRadius; dz++) {
                const pos = { x: this.position.x + dx, z: this.position.z + dz };
                if (this.grid.inBounds(pos)) {
                    dangerZone.push(pos);
                }
            }
        }
        return dangerZone;
    }

    isActive() {
        return this.active;
    }

    getTimeRemaining() {
        return this.timer;
    }

    deactivate() {
        this.active = false;
        this.group.visible = false;
    }
}
