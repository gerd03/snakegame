/**
 * Bomb - Hazard that explodes after 3 seconds
 * Snake must avoid or die!
 */

import * as THREE from 'three';

export class Bomb {
    constructor(scene, gridSize, cellSize) {
        this.scene = scene;
        this.gridSize = gridSize;
        this.cellSize = cellSize;
        this.maxCoord = Math.floor(gridSize / 2) - 1; // -9 to 9

        this.position = { x: 0, z: 0 };
        this.active = false;
        this.timer = 0;
        this.maxTimer = 3.0; // 3 seconds
        this.blastRadius = 1; // 1 cell radius
        this.group = null;
        this.exploded = false;

        this.createMesh();
    }

    createMesh() {
        this.group = new THREE.Group();

        // Bomb body - dark sphere
        const bombGeometry = new THREE.SphereGeometry(this.cellSize * 0.35, 16, 16);
        const bombMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.3,
            metalness: 0.6
        });
        this.bombMesh = new THREE.Mesh(bombGeometry, bombMaterial);
        this.group.add(this.bombMesh);

        // Fuse on top
        const fuseGeometry = new THREE.CylinderGeometry(0.03, 0.03, this.cellSize * 0.2, 8);
        const fuseMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
        this.fuse = new THREE.Mesh(fuseGeometry, fuseMaterial);
        this.fuse.position.y = this.cellSize * 0.35;
        this.group.add(this.fuse);

        // Spark at top of fuse
        const sparkGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xFF6600 });
        this.spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
        this.spark.position.y = this.cellSize * 0.45;
        this.group.add(this.spark);

        // Warning ring (pulses as timer counts down)
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

        // Timer text (will be updated)
        this.group.position.y = this.cellSize * 0.35;
        this.group.visible = false;
        this.scene.add(this.group);
    }

    /**
     * Spawn bomb at a safe position
     */
    spawn(occupiedCells, foodPos) {
        let validPosition = false;
        let attempts = 0;

        while (!validPosition && attempts < 100) {
            // Random position in full grid
            this.position.x = Math.floor(Math.random() * (this.maxCoord * 2 + 1)) - this.maxCoord;
            this.position.z = Math.floor(Math.random() * (this.maxCoord * 2 + 1)) - this.maxCoord;

            // Check not on snake
            const onSnake = occupiedCells.some(
                cell => cell.x === this.position.x && cell.z === this.position.z
            );

            // Check not on food
            const onFood = foodPos &&
                foodPos.x === this.position.x &&
                foodPos.z === this.position.z;

            // Check not too close to snake head (give player reaction time)
            const head = occupiedCells[0];
            const distToHead = Math.abs(this.position.x - head.x) + Math.abs(this.position.z - head.z);
            const tooCloseToHead = distToHead < 3;

            validPosition = !onSnake && !onFood && !tooCloseToHead;
            attempts++;
        }

        // Activate bomb
        this.active = true;
        this.exploded = false;
        this.timer = this.maxTimer;

        // Position mesh
        this.group.position.x = this.position.x * this.cellSize;
        this.group.position.z = this.position.z * this.cellSize;
        this.group.visible = true;
        this.group.scale.set(1, 1, 1);

        return true;
    }

    /**
     * Update bomb timer
     * Returns true if exploded
     */
    update(deltaTime) {
        if (!this.active) return false;

        this.timer -= deltaTime;

        // Update visuals based on remaining time
        const urgency = 1 - (this.timer / this.maxTimer);

        // Bomb grows slightly as timer decreases
        const scale = 1 + urgency * 0.3;
        this.bombMesh.scale.set(scale, scale, scale);

        // Warning ring pulses faster as time runs out
        const pulse = Math.sin(Date.now() * (0.01 + urgency * 0.03)) * 0.5 + 0.5;
        this.warningRing.material.opacity = 0.3 + pulse * 0.5;

        // Ring expands
        const ringScale = 1 + urgency * 0.5;
        this.warningRing.scale.set(ringScale, ringScale, 1);

        // Spark flickers
        this.spark.material.color.setHex(
            urgency > 0.7 ? 0xFF0000 : 0xFF6600
        );
        this.spark.visible = Math.random() > 0.2;

        // Color changes to red as danger increases
        const r = 0.2 + urgency * 0.8;
        this.bombMesh.material.color.setRGB(r, 0.2 * (1 - urgency), 0);

        // Check if exploded
        if (this.timer <= 0) {
            this.explode();
            return true;
        }

        return false;
    }

    /**
     * Explode the bomb
     */
    explode() {
        this.exploded = true;
        this.active = false;
        this.group.visible = false;
    }

    /**
     * Check if snake head is in blast radius
     */
    checkCollision(headPos) {
        if (!this.active) return false;

        const dx = Math.abs(headPos.gridX - this.position.x);
        const dz = Math.abs(headPos.gridZ - this.position.z);

        // Collision if within blast radius
        return dx <= this.blastRadius && dz <= this.blastRadius;
    }

    /**
     * Get position for AI to avoid
     */
    getPosition() {
        if (!this.active) return null;
        return { ...this.position };
    }

    /**
     * Get danger zone positions (for AI to avoid)
     */
    getDangerZone() {
        if (!this.active) return [];

        const dangerZone = [];
        for (let dx = -this.blastRadius; dx <= this.blastRadius; dx++) {
            for (let dz = -this.blastRadius; dz <= this.blastRadius; dz++) {
                const pos = {
                    x: this.position.x + dx,
                    z: this.position.z + dz
                };
                if (pos.x >= -this.maxCoord && pos.x <= this.maxCoord &&
                    pos.z >= -this.maxCoord && pos.z <= this.maxCoord) {
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
