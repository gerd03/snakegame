/**
 * Food - Google Snake Style Red Apple
 */

import * as THREE from 'three';

export class Food {
    constructor(scene, gridSize, cellSize) {
        this.scene = scene;
        this.gridSize = gridSize;
        this.cellSize = cellSize;
        this.halfSize = (gridSize * cellSize) / 2;

        this.position = { x: 0, z: 0 };
        this.mesh = null;
        this.magnetMode = false;
        this.magnetTarget = null;

        this.createMesh();
    }

    createMesh() {
        this.group = new THREE.Group();

        // Apple body - red sphere
        const appleGeometry = new THREE.SphereGeometry(this.cellSize * 0.35, 32, 32);
        const appleMaterial = new THREE.MeshStandardMaterial({
            color: 0xE53935,  // Nice red
            roughness: 0.3,
            metalness: 0.1
        });
        this.mesh = new THREE.Mesh(appleGeometry, appleMaterial);
        this.mesh.scale.set(1, 0.9, 1);  // Slightly flattened like an apple
        this.mesh.castShadow = true;
        this.group.add(this.mesh);

        // Apple stem - small brown cylinder
        const stemGeometry = new THREE.CylinderGeometry(
            this.cellSize * 0.03,  // top radius
            this.cellSize * 0.04,  // bottom radius
            this.cellSize * 0.12,  // height
            8
        );
        const stemMaterial = new THREE.MeshStandardMaterial({
            color: 0x5D4037,  // Brown
            roughness: 0.8,
            metalness: 0.0
        });
        const stem = new THREE.Mesh(stemGeometry, stemMaterial);
        stem.position.y = this.cellSize * 0.35;
        this.group.add(stem);

        // Apple leaf - small green shape
        const leafGeometry = new THREE.SphereGeometry(this.cellSize * 0.08, 8, 8);
        const leafMaterial = new THREE.MeshStandardMaterial({
            color: 0x4CAF50,  // Green
            roughness: 0.5,
            metalness: 0.0
        });
        const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
        leaf.scale.set(1.5, 0.3, 1);
        leaf.position.set(this.cellSize * 0.08, this.cellSize * 0.35, 0);
        leaf.rotation.z = -0.3;
        this.group.add(leaf);

        // Highlight spot on apple (shine)
        const highlightGeometry = new THREE.SphereGeometry(this.cellSize * 0.08, 8, 8);
        const highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.4
        });
        const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
        highlight.position.set(-this.cellSize * 0.15, this.cellSize * 0.1, this.cellSize * 0.2);
        this.group.add(highlight);

        this.group.position.y = this.cellSize * 0.35;
        this.scene.add(this.group);
    }

    spawn(occupiedCells) {
        // Grid boundaries: -9 to 9 for a 20-cell grid (inside the walls)
        const maxCoord = Math.floor(this.gridSize / 2) - 1;
        let validPosition = false;
        let attempts = 0;

        while (!validPosition && attempts < 100) {
            // Generate position from -maxCoord to maxCoord
            this.position.x = Math.floor(Math.random() * (maxCoord * 2 + 1)) - maxCoord;
            this.position.z = Math.floor(Math.random() * (maxCoord * 2 + 1)) - maxCoord;

            // Check if position is occupied by snake
            validPosition = !occupiedCells.some(
                cell => cell.x === this.position.x && cell.z === this.position.z
            );

            attempts++;
        }

        // Update mesh position
        this.group.position.x = this.position.x * this.cellSize;
        this.group.position.z = this.position.z * this.cellSize;

        // Spawn animation
        this.group.scale.set(0, 0, 0);
        this.spawnAnimation = { progress: 0 };
    }

    update(deltaTime) {
        const time = Date.now() * 0.001;

        // Spawn animation
        if (this.spawnAnimation) {
            this.spawnAnimation.progress += deltaTime * 4;
            const scale = Math.min(1, this.spawnAnimation.progress);
            const bounce = 1 + Math.sin(scale * Math.PI) * 0.2;
            this.group.scale.set(scale * bounce, scale * bounce, scale * bounce);

            if (this.spawnAnimation.progress >= 1) {
                this.group.scale.set(1, 1, 1);
                this.spawnAnimation = null;
            }
        }

        // Gentle bobbing animation
        this.group.position.y = this.cellSize * 0.35 + Math.sin(time * 2) * 0.05;

        // Slow rotation
        this.group.rotation.y = time * 0.5;

        // Magnet mode - move towards snake
        if (this.magnetMode && this.magnetTarget) {
            const dx = this.magnetTarget.gridX - this.position.x;
            const dz = this.magnetTarget.gridZ - this.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > 0.5) {
                this.group.position.x += (dx / dist) * deltaTime * 5;
                this.group.position.z += (dz / dist) * deltaTime * 5;
            }
        }
    }

    checkCollision(headPos) {
        const dx = Math.abs(headPos.gridX - this.position.x);
        const dz = Math.abs(headPos.gridZ - this.position.z);
        return dx < 1 && dz < 1;
    }

    getPosition() {
        return { ...this.position };
    }

    setMagnetMode(enabled, targetPos) {
        this.magnetMode = enabled;
        this.magnetTarget = targetPos;
    }
}
