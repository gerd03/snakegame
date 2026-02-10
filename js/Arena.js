/**
 * Arena - checkered playfield aligned with GridBounds.
 */

import * as THREE from 'three';
import { GridBounds } from './core/GridBounds.js';

export class Arena {
    constructor(scene, gridConfig) {
        this.scene = scene;
        this.grid = GridBounds.from(gridConfig);
        this.cellSize = this.grid.cellSize;

        this.totalWidth = this.grid.width * this.cellSize;
        this.totalDepth = this.grid.height * this.cellSize;
        this.halfWidth = this.totalWidth / 2;
        this.halfDepth = this.totalDepth / 2;

        this.floor = null;
        this.walls = [];

        this.create();
    }

    create() {
        this.createCheckeredFloor();
        this.createBorder();
    }

    createCheckeredFloor() {
        const canvas = document.createElement('canvas');
        canvas.width = this.grid.width;
        canvas.height = this.grid.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to create arena canvas context');
        }

        for (let localX = 0; localX < this.grid.width; localX++) {
            for (let localZ = 0; localZ < this.grid.height; localZ++) {
                const isLight = (localX + localZ) % 2 === 0;
                ctx.fillStyle = isLight ? '#AAD751' : '#A2D149';
                ctx.fillRect(localX, localZ, 1, 1);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;

        // Slight inset avoids edge seams/green line artifacts at the border.
        const floorInset = this.cellSize * 0.08;
        const floorGeometry = new THREE.PlaneGeometry(
            this.totalWidth - floorInset,
            this.totalDepth - floorInset
        );
        const floorMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.8,
            metalness: 0.0
        });

        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -0.01;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);
    }

    createBorder() {
        const borderColor = 0x4F8F2E;
        const borderWidth = 0.85;
        const borderHeight = 0.5;

        const borderMaterial = new THREE.MeshStandardMaterial({
            color: borderColor,
            roughness: 0.6,
            metalness: 0.1
        });

        const borderConfigs = [
            {
                pos: [0, borderHeight / 2, -this.halfDepth - borderWidth / 2],
                size: [this.totalWidth + borderWidth * 2, borderHeight, borderWidth]
            },
            {
                pos: [0, borderHeight / 2, this.halfDepth + borderWidth / 2],
                size: [this.totalWidth + borderWidth * 2, borderHeight, borderWidth]
            },
            {
                pos: [-this.halfWidth - borderWidth / 2, borderHeight / 2, 0],
                size: [borderWidth, borderHeight, this.totalDepth + borderWidth * 2]
            },
            {
                pos: [this.halfWidth + borderWidth / 2, borderHeight / 2, 0],
                size: [borderWidth, borderHeight, this.totalDepth + borderWidth * 2]
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

    update(_time) {
        // Static field.
    }

    getBounds() {
        const worldBounds = this.grid.getBoundsWorld();
        return {
            minX: worldBounds.minX,
            maxX: worldBounds.maxX,
            minZ: worldBounds.minZ,
            maxZ: worldBounds.maxZ
        };
    }
}
