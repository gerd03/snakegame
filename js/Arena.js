/**
 * Arena - Futuristic Cyber Arena with Neon Grid
 */

import * as THREE from 'three';

export class Arena {
    constructor(scene, gridSize, cellSize) {
        this.scene = scene;
        this.gridSize = gridSize;
        this.cellSize = cellSize;
        this.totalSize = gridSize * cellSize;
        this.halfSize = this.totalSize / 2;

        this.gridLines = null;
        this.floor = null;
        this.walls = [];
        this.pulseTime = 0;

        this.create();
    }

    create() {
        this.createFloor();
        this.createGrid();
        this.createWalls();
        this.createAmbience();
    }

    createFloor() {
        // Glass floor with reflection
        const floorGeometry = new THREE.PlaneGeometry(this.totalSize, this.totalSize);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x0a0a15,
            metalness: 0.9,
            roughness: 0.1,
            transparent: true,
            opacity: 0.8
        });

        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -0.1;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);

        // Subtle glow under floor
        const glowGeometry = new THREE.PlaneGeometry(this.totalSize * 1.2, this.totalSize * 1.2);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.05
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = -0.2;
        this.scene.add(glow);
    }

    createGrid() {
        const gridGroup = new THREE.Group();

        // Main grid lines
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.3
        });

        // Vertical lines
        for (let i = 0; i <= this.gridSize; i++) {
            const x = i * this.cellSize - this.halfSize;
            const points = [
                new THREE.Vector3(x, 0, -this.halfSize),
                new THREE.Vector3(x, 0, this.halfSize)
            ];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            gridGroup.add(line);
        }

        // Horizontal lines
        for (let i = 0; i <= this.gridSize; i++) {
            const z = i * this.cellSize - this.halfSize;
            const points = [
                new THREE.Vector3(-this.halfSize, 0, z),
                new THREE.Vector3(this.halfSize, 0, z)
            ];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            gridGroup.add(line);
        }

        this.gridLines = gridGroup;
        this.scene.add(gridGroup);

        // Outer border (brighter)
        const borderMaterial = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.8
        });

        const borderPoints = [
            new THREE.Vector3(-this.halfSize, 0.01, -this.halfSize),
            new THREE.Vector3(this.halfSize, 0.01, -this.halfSize),
            new THREE.Vector3(this.halfSize, 0.01, this.halfSize),
            new THREE.Vector3(-this.halfSize, 0.01, this.halfSize),
            new THREE.Vector3(-this.halfSize, 0.01, -this.halfSize)
        ];
        const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints);
        const border = new THREE.Line(borderGeometry, borderMaterial);
        this.scene.add(border);
    }

    createWalls() {
        const wallHeight = 2;
        const wallThickness = 0.2;

        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            emissive: 0x00f0ff,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.3,
            metalness: 0.9,
            roughness: 0.1
        });

        // Create 4 walls
        const wallConfigs = [
            { pos: [0, wallHeight / 2, -this.halfSize - wallThickness / 2], size: [this.totalSize + wallThickness * 2, wallHeight, wallThickness] },
            { pos: [0, wallHeight / 2, this.halfSize + wallThickness / 2], size: [this.totalSize + wallThickness * 2, wallHeight, wallThickness] },
            { pos: [-this.halfSize - wallThickness / 2, wallHeight / 2, 0], size: [wallThickness, wallHeight, this.totalSize] },
            { pos: [this.halfSize + wallThickness / 2, wallHeight / 2, 0], size: [wallThickness, wallHeight, this.totalSize] }
        ];

        wallConfigs.forEach(config => {
            const geometry = new THREE.BoxGeometry(...config.size);
            const wall = new THREE.Mesh(geometry, wallMaterial);
            wall.position.set(...config.pos);
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.walls.push(wall);
            this.scene.add(wall);
        });

        // Corner pillars with glow
        const pillarMaterial = new THREE.MeshStandardMaterial({
            color: 0xff00ff,
            emissive: 0xff00ff,
            emissiveIntensity: 0.5,
            metalness: 0.8,
            roughness: 0.2
        });

        const corners = [
            [-this.halfSize, 0, -this.halfSize],
            [this.halfSize, 0, -this.halfSize],
            [-this.halfSize, 0, this.halfSize],
            [this.halfSize, 0, this.halfSize]
        ];

        corners.forEach(pos => {
            const pillarGeometry = new THREE.CylinderGeometry(0.3, 0.3, wallHeight * 1.5, 8);
            const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
            pillar.position.set(pos[0], wallHeight * 0.75, pos[2]);
            pillar.castShadow = true;
            this.scene.add(pillar);

            // Top orb
            const orbGeometry = new THREE.SphereGeometry(0.4, 16, 16);
            const orb = new THREE.Mesh(orbGeometry, pillarMaterial);
            orb.position.set(pos[0], wallHeight * 1.5 + 0.4, pos[2]);
            this.scene.add(orb);
        });
    }

    createAmbience() {
        // Minimal ambient particles - static, no animation to prevent flicker
        // Particles removed to prevent visual distraction
    }

    update(time) {
        this.pulseTime = time;

        // Subtle grid pulse only - reduced animation
        if (this.gridLines) {
            this.gridLines.children.forEach((line, i) => {
                const material = line.material;
                // Very subtle opacity change
                material.opacity = 0.3;
            });
        }

        // Static walls - no animation
        this.walls.forEach((wall, i) => {
            wall.material.emissiveIntensity = 0.3;
        });
    }

    getBounds() {
        return {
            minX: -this.halfSize + this.cellSize / 2,
            maxX: this.halfSize - this.cellSize / 2,
            minZ: -this.halfSize + this.cellSize / 2,
            maxZ: this.halfSize - this.cellSize / 2
        };
    }
}
