/**
 * PowerUpManager - spawning and active power-up tracking.
 */

import * as THREE from 'three';
import { GridBounds } from '../core/GridBounds.js';

export class PowerUpManager {
    constructor(scene, gridConfig) {
        this.scene = scene;
        this.grid = GridBounds.from(gridConfig);
        this.cellSize = this.grid.cellSize;

        this.powerUps = [];
        this.activePowerUps = [];

        this.types = {
            timeSlow: {
                color: 0x00ffff,
                icon: 'time',
                duration: 5,
                spawnChance: 0.3
            },
            phase: {
                color: 0xff00ff,
                icon: 'phase',
                duration: 3,
                spawnChance: 0.2
            },
            magnet: {
                color: 0xffff00,
                icon: 'magnet',
                duration: 8,
                spawnChance: 0.3
            },
            turbo: {
                color: 0xff6600,
                icon: 'turbo',
                duration: 4,
                spawnChance: 0.2
            }
        };
    }

    spawnPowerUp(occupiedCells) {
        const typeKeys = Object.keys(this.types);
        const type = typeKeys[Math.floor(Math.random() * typeKeys.length)];
        const typeData = this.types[type];

        const occupiedSet = new Set(occupiedCells.map(c => `${c.x},${c.z}`));
        const position = this.grid.randomFreeCell(occupiedSet);
        if (!position) return;

        const group = new THREE.Group();

        const orbGeometry = new THREE.OctahedronGeometry(this.cellSize * 0.35, 0);
        const orbMaterial = new THREE.MeshStandardMaterial({
            color: typeData.color,
            emissive: typeData.color,
            emissiveIntensity: 0.5,
            metalness: 0.8,
            roughness: 0.2,
            transparent: true,
            opacity: 0.9
        });
        const orb = new THREE.Mesh(orbGeometry, orbMaterial);
        group.add(orb);

        const ringGeometry = new THREE.TorusGeometry(this.cellSize * 0.5, 0.03, 8, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: typeData.color,
            transparent: true,
            opacity: 0.5
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        const world = this.grid.gridToWorld(position.x, position.z);
        group.position.set(world.x, this.cellSize * 0.5, world.z);

        this.scene.add(group);

        this.powerUps.push({
            type,
            position,
            mesh: group,
            orb,
            ring,
            time: 0
        });
    }

    checkCollision(headPos) {
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];

            if (Math.abs(headPos.gridX - powerUp.position.x) < 1 &&
                Math.abs(headPos.gridZ - powerUp.position.z) < 1) {
                this.scene.remove(powerUp.mesh);
                this.powerUps.splice(i, 1);
                return powerUp.type;
            }
        }

        return null;
    }

    activate(type) {
        const typeData = this.types[type];
        if (!typeData) return;

        this.activePowerUps = this.activePowerUps.filter(powerUp => powerUp.type !== type);
        this.activePowerUps.push({
            type,
            remainingTime: typeData.duration,
            totalDuration: typeData.duration,
            remainingPercent: 100
        });
    }

    hasActivePowerUp(type) {
        return this.activePowerUps.some(powerUp => powerUp.type === type);
    }

    getActivePowerUps() {
        return this.activePowerUps.map(powerUp => ({
            type: powerUp.type,
            remainingPercent: (powerUp.remainingTime / powerUp.totalDuration) * 100
        }));
    }

    update(deltaTime) {
        for (const powerUp of this.powerUps) {
            powerUp.time += deltaTime;

            powerUp.mesh.position.y = this.cellSize * 0.5 + Math.sin(powerUp.time * 3) * 0.2;
            powerUp.orb.rotation.y = powerUp.time * 2;
            powerUp.orb.rotation.x = powerUp.time;
            powerUp.ring.rotation.z = powerUp.time * 1.5;

            powerUp.orb.material.emissiveIntensity = 0.4 + Math.sin(powerUp.time * 4) * 0.2;
        }

        for (let i = this.activePowerUps.length - 1; i >= 0; i--) {
            const powerUp = this.activePowerUps[i];
            powerUp.remainingTime -= deltaTime;
            powerUp.remainingPercent = (powerUp.remainingTime / powerUp.totalDuration) * 100;

            if (powerUp.remainingTime <= 0) {
                this.activePowerUps.splice(i, 1);
            }
        }
    }

    reset() {
        for (const powerUp of this.powerUps) {
            this.scene.remove(powerUp.mesh);
        }
        this.powerUps = [];
        this.activePowerUps = [];
    }
}
