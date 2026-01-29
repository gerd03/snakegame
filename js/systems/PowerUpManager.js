/**
 * PowerUpManager - Power-up Spawning and Management
 */

import * as THREE from 'three';

export class PowerUpManager {
    constructor(scene, gridSize, cellSize) {
        this.scene = scene;
        this.gridSize = gridSize;
        this.cellSize = cellSize;
        this.halfSize = (gridSize * cellSize) / 2;

        this.powerUps = []; // Spawned power-ups
        this.activePowerUps = []; // Currently active effects

        // Power-up definitions
        this.types = {
            timeSlow: {
                color: 0x00ffff,
                icon: '⏱️',
                duration: 5,
                spawnChance: 0.3
            },
            phase: {
                color: 0xff00ff,
                icon: '👻',
                duration: 3,
                spawnChance: 0.2
            },
            magnet: {
                color: 0xffff00,
                icon: '🧲',
                duration: 8,
                spawnChance: 0.3
            },
            turbo: {
                color: 0xff6600,
                icon: '⚡',
                duration: 4,
                spawnChance: 0.2
            }
        };
    }

    spawnPowerUp(occupiedCells) {
        // Random type
        const typeKeys = Object.keys(this.types);
        const type = typeKeys[Math.floor(Math.random() * typeKeys.length)];
        const typeData = this.types[type];

        // Find valid position
        const halfGrid = Math.floor(this.gridSize / 2);
        let position;
        let attempts = 0;

        do {
            position = {
                x: Math.floor(Math.random() * this.gridSize) - halfGrid,
                z: Math.floor(Math.random() * this.gridSize) - halfGrid
            };
            attempts++;
        } while (
            occupiedCells.some(c => c.x === position.x && c.z === position.z) &&
            attempts < 50
        );

        if (attempts >= 50) return;

        // Create 3D object
        const group = new THREE.Group();

        // Main orb
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

        // Outer ring
        const ringGeometry = new THREE.TorusGeometry(this.cellSize * 0.5, 0.03, 8, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: typeData.color,
            transparent: true,
            opacity: 0.5
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        group.position.set(
            position.x * this.cellSize,
            this.cellSize * 0.5,
            position.z * this.cellSize
        );

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
            const pu = this.powerUps[i];

            if (Math.abs(headPos.gridX - pu.position.x) < 1 &&
                Math.abs(headPos.gridZ - pu.position.z) < 1) {
                // Collected
                this.scene.remove(pu.mesh);
                this.powerUps.splice(i, 1);
                return pu.type;
            }
        }
        return null;
    }

    activate(type) {
        const typeData = this.types[type];
        if (!typeData) return;

        // Remove existing of same type
        this.activePowerUps = this.activePowerUps.filter(p => p.type !== type);

        // Add new active power-up
        this.activePowerUps.push({
            type,
            remainingTime: typeData.duration,
            totalDuration: typeData.duration,
            remainingPercent: 100
        });
    }

    hasActivePowerUp(type) {
        return this.activePowerUps.some(p => p.type === type);
    }

    getActivePowerUps() {
        return this.activePowerUps.map(p => ({
            type: p.type,
            remainingPercent: (p.remainingTime / p.totalDuration) * 100
        }));
    }

    update(deltaTime) {
        // Update spawned power-ups (animation)
        for (const pu of this.powerUps) {
            pu.time += deltaTime;

            // Float and rotate
            pu.mesh.position.y = this.cellSize * 0.5 + Math.sin(pu.time * 3) * 0.2;
            pu.orb.rotation.y = pu.time * 2;
            pu.orb.rotation.x = pu.time;
            pu.ring.rotation.z = pu.time * 1.5;

            // Pulse glow
            pu.orb.material.emissiveIntensity = 0.4 + Math.sin(pu.time * 4) * 0.2;
        }

        // Update active power-ups
        for (let i = this.activePowerUps.length - 1; i >= 0; i--) {
            const pu = this.activePowerUps[i];
            pu.remainingTime -= deltaTime;
            pu.remainingPercent = (pu.remainingTime / pu.totalDuration) * 100;

            if (pu.remainingTime <= 0) {
                this.activePowerUps.splice(i, 1);
            }
        }
    }

    reset() {
        // Clear all spawned power-ups
        for (const pu of this.powerUps) {
            this.scene.remove(pu.mesh);
        }
        this.powerUps = [];
        this.activePowerUps = [];
    }
}
