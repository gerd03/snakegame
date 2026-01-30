/**
 * Arena - Google Snake Style Green Checkered Field
 * Fixed to match playable area exactly (19x19 grid, -9 to 9)
 */

import * as THREE from 'three';

export class Arena {
    constructor(scene, gridSize, cellSize) {
        this.scene = scene;
        this.gridSize = gridSize;
        this.cellSize = cellSize;

        // Playable area is -9 to 9 = 19 cells
        this.playableSize = (Math.floor(gridSize / 2) - 1) * 2 + 1; // 19
        this.totalSize = this.playableSize * cellSize; // 19
        this.halfSize = this.totalSize / 2; // 9.5

        this.floor = null;
        this.walls = [];

        this.create();
    }

    create() {
        this.createCheckeredFloor();
        this.createBorder();
    }

    createCheckeredFloor() {
        // Create checkered pattern like Google Snake
        const lightGreen = 0xAAD751;
        const darkGreen = 0xA2D149;

        // Canvas matches playable grid exactly
        const canvas = document.createElement('canvas');
        const size = this.playableSize; // 19
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Draw checkered pattern
        for (let x = 0; x < size; x++) {
            for (let z = 0; z < size; z++) {
                const isLight = (x + z) % 2 === 0;
                ctx.fillStyle = isLight ? '#AAD751' : '#A2D149';
                ctx.fillRect(x, z, 1, 1);
            }
        }

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;

        // Main floor - sized to playable area
        const floorGeometry = new THREE.PlaneGeometry(this.totalSize, this.totalSize);
        const floorMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.8,
            metalness: 0.0
        });

        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = 0;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);
    }

    createBorder() {
        // Dark green border around the field
        const borderColor = 0x578A34;
        const borderWidth = 0.6;
        const borderHeight = 0.4;

        const borderMaterial = new THREE.MeshStandardMaterial({
            color: borderColor,
            roughness: 0.6,
            metalness: 0.1
        });

        // Create 4 border walls - flush with playable area
        const borderConfigs = [
            // North border
            {
                pos: [0, borderHeight / 2, -this.halfSize - borderWidth / 2],
                size: [this.totalSize + borderWidth * 2, borderHeight, borderWidth]
            },
            // South border
            {
                pos: [0, borderHeight / 2, this.halfSize + borderWidth / 2],
                size: [this.totalSize + borderWidth * 2, borderHeight, borderWidth]
            },
            // West border
            {
                pos: [-this.halfSize - borderWidth / 2, borderHeight / 2, 0],
                size: [borderWidth, borderHeight, this.totalSize + borderWidth * 2]
            },
            // East border
            {
                pos: [this.halfSize + borderWidth / 2, borderHeight / 2, 0],
                size: [borderWidth, borderHeight, this.totalSize + borderWidth * 2]
            }
        ];

        borderConfigs.forEach(config => {
            const geometry = new THREE.BoxGeometry(...config.size);
            const wall = new THREE.Mesh(geometry, borderMaterial);
            wall.position.set(...config.pos);
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.walls.push(wall);
            this.scene.add(wall);
        });
    }

    update(time) {
        // Static field - no animation needed
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
