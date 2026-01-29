/**
 * Snake - Slither.io Style Snake with Colorful Patterns
 */

import * as THREE from 'three';

export class Snake {
    constructor(scene, gridSize, cellSize) {
        this.scene = scene;
        this.gridSize = gridSize;
        this.cellSize = cellSize;
        this.halfSize = (gridSize * cellSize) / 2;

        this.segments = [];
        this.meshes = [];
        this.direction = { x: 1, z: 0 };
        this.length = 3;
        this.growPending = 0;

        // Visual settings - Slither.io style
        this.segmentSize = cellSize * 0.85;
        this.headSize = cellSize * 1.0;

        // Color themes like Slither.io
        this.colorThemes = [
            { primary: 0x7cb342, secondary: 0xff6f00, stripe: 0x33691e }, // Green/Orange
            { primary: 0xff7043, secondary: 0x29b6f6, stripe: 0xbf360c }, // Orange/Blue
            { primary: 0x29b6f6, secondary: 0x0d47a1, stripe: 0x01579b }, // Blue
            { primary: 0xec407a, secondary: 0xad1457, stripe: 0x880e4f }, // Pink
            { primary: 0x8d6e63, secondary: 0x5d4037, stripe: 0x3e2723 }, // Brown
            { primary: 0xef5350, secondary: 0xffee58, stripe: 0xc62828 }  // Red/Yellow
        ];

        this.currentTheme = this.colorThemes[Math.floor(Math.random() * this.colorThemes.length)];

        // Animation
        this.moveProgress = 0;
        this.previousPositions = [];

        this.createMaterials();
        this.reset();
    }

    createMaterials() {
        // Head material
        this.headMaterial = new THREE.MeshStandardMaterial({
            color: this.currentTheme.primary,
            metalness: 0.3,
            roughness: 0.7
        });

        // Eye white material
        this.eyeWhiteMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.3
        });

        // Eye pupil material
        this.pupilMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            metalness: 0.5,
            roughness: 0.2
        });

        // Tongue material
        this.tongueMaterial = new THREE.MeshStandardMaterial({
            color: 0xff1744,
            metalness: 0.2,
            roughness: 0.5
        });
    }

    reset() {
        // Clear existing meshes
        this.meshes.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.children) {
                mesh.children.forEach(child => {
                    if (child.geometry) child.geometry.dispose();
                });
            }
            if (mesh.geometry) mesh.geometry.dispose();
        });
        this.meshes = [];

        // Pick new random color theme
        this.currentTheme = this.colorThemes[Math.floor(Math.random() * this.colorThemes.length)];
        this.createMaterials();

        // Reset state
        this.length = 3;
        this.direction = { x: 1, z: 0 };
        this.growPending = 0;

        // Initialize segments at center
        this.segments = [];
        for (let i = 0; i < this.length; i++) {
            this.segments.push({
                x: -i,
                z: 0
            });
        }

        // Create meshes
        this.createMeshes();
    }

    createMeshes() {
        this.segments.forEach((seg, index) => {
            let mesh;

            if (index === 0) {
                mesh = this.createHead();
            } else {
                mesh = this.createBodySegment(index);
            }

            mesh.position.set(
                seg.x * this.cellSize,
                this.segmentSize / 2,
                seg.z * this.cellSize
            );

            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            this.meshes.push(mesh);
        });
    }

    createHead() {
        const headGroup = new THREE.Group();

        // Main head - slightly oval
        const headGeometry = new THREE.SphereGeometry(this.headSize / 2, 32, 32);
        headGeometry.scale(1.1, 0.9, 1.0);
        const head = new THREE.Mesh(headGeometry, this.headMaterial);
        headGroup.add(head);

        // Eyes - large and prominent like Slither.io
        const eyeSize = this.headSize * 0.22;
        const eyeGeometry = new THREE.SphereGeometry(eyeSize, 16, 16);

        // Left eye white
        const leftEyeWhite = new THREE.Mesh(eyeGeometry, this.eyeWhiteMaterial);
        leftEyeWhite.position.set(this.headSize * 0.22, this.headSize * 0.15, this.headSize * 0.32);
        leftEyeWhite.scale.set(1, 1.2, 0.8);
        headGroup.add(leftEyeWhite);

        // Left pupil
        const pupilGeometry = new THREE.SphereGeometry(eyeSize * 0.5, 16, 16);
        const leftPupil = new THREE.Mesh(pupilGeometry, this.pupilMaterial);
        leftPupil.position.set(this.headSize * 0.26, this.headSize * 0.15, this.headSize * 0.4);
        headGroup.add(leftPupil);

        // Right eye white
        const rightEyeWhite = new THREE.Mesh(eyeGeometry, this.eyeWhiteMaterial);
        rightEyeWhite.position.set(-this.headSize * 0.22, this.headSize * 0.15, this.headSize * 0.32);
        rightEyeWhite.scale.set(1, 1.2, 0.8);
        headGroup.add(rightEyeWhite);

        // Right pupil
        const rightPupil = new THREE.Mesh(pupilGeometry, this.pupilMaterial);
        rightPupil.position.set(-this.headSize * 0.26, this.headSize * 0.15, this.headSize * 0.4);
        headGroup.add(rightPupil);

        // Tongue (hidden by default)
        const tongueGeometry = new THREE.CylinderGeometry(0.03, 0.02, 0.4, 8);
        const tongue = new THREE.Mesh(tongueGeometry, this.tongueMaterial);
        tongue.rotation.x = Math.PI / 2;
        tongue.position.z = this.headSize * 0.6;
        tongue.visible = false;
        tongue.name = 'tongue';
        headGroup.add(tongue);

        return headGroup;
    }

    createBodySegment(index) {
        const group = new THREE.Group();

        // Determine if this segment should be striped
        const isStripe = index % 2 === 0;

        // Taper towards tail
        const t = index / Math.max(this.segments.length - 1, 1);
        const size = this.segmentSize * (1 - t * 0.35);

        // Main body sphere
        const geometry = new THREE.SphereGeometry(size / 2, 16, 16);

        const color = isStripe ? this.currentTheme.secondary : this.currentTheme.primary;

        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.2,
            roughness: 0.7
        });

        const segment = new THREE.Mesh(geometry, material);
        group.add(segment);

        // Add stripe ring for pattern
        if (isStripe && size > this.segmentSize * 0.4) {
            const ringGeometry = new THREE.TorusGeometry(size / 2 * 0.9, size * 0.08, 8, 16);
            const ringMaterial = new THREE.MeshStandardMaterial({
                color: this.currentTheme.stripe,
                metalness: 0.3,
                roughness: 0.6
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = Math.PI / 2;
            group.add(ring);
        }

        return group;
    }

    move(newDirection) {
        // VALIDATE: Direction must be exactly 1 cell movement
        if (!newDirection ||
            (newDirection.x !== -1 && newDirection.x !== 0 && newDirection.x !== 1) ||
            (newDirection.z !== -1 && newDirection.z !== 0 && newDirection.z !== 1) ||
            (newDirection.x === 0 && newDirection.z === 0)) {
            // Invalid direction, keep current
            newDirection = { ...this.direction };
        }

        // Ensure only one axis moves at a time (no diagonals)
        if (newDirection.x !== 0 && newDirection.z !== 0) {
            newDirection = { x: newDirection.x, z: 0 };
        }

        // Prevent 180-degree turns
        if (newDirection.x === -this.direction.x && newDirection.z === -this.direction.z &&
            (this.direction.x !== 0 || this.direction.z !== 0)) {
            newDirection = { ...this.direction };
        }

        this.direction = { ...newDirection };

        // Calculate new head position (always exactly 1 cell away)
        const head = this.segments[0];
        const newHead = {
            x: head.x + this.direction.x,
            z: head.z + this.direction.z
        };

        // Check wall collision (bounds are -9 to 9 for 20-grid)
        const maxCoord = Math.floor(this.gridSize / 2) - 1; // 9 for gridSize 20
        if (newHead.x < -maxCoord || newHead.x > maxCoord ||
            newHead.z < -maxCoord || newHead.z > maxCoord) {
            return { collision: true, type: 'wall' };
        }

        // Check self collision
        for (let i = 1; i < this.segments.length; i++) {
            if (this.segments[i].x === newHead.x && this.segments[i].z === newHead.z) {
                return { collision: true, type: 'self' };
            }
        }

        // Store previous positions for smooth animation
        this.previousPositions = this.segments.map(s => ({ ...s }));

        // Move segments
        this.segments.unshift(newHead);

        if (this.growPending > 0) {
            this.growPending--;
            // Add new mesh for grown segment
            const newMesh = this.createBodySegment(this.segments.length - 1);
            const lastSeg = this.segments[this.segments.length - 1];
            newMesh.position.set(
                lastSeg.x * this.cellSize,
                this.segmentSize / 2,
                lastSeg.z * this.cellSize
            );
            newMesh.castShadow = true;
            this.scene.add(newMesh);
            this.meshes.push(newMesh);
        } else {
            this.segments.pop();
        }

        this.moveProgress = 0;
        return { collision: false };
    }

    update(deltaTime) {
        this.moveProgress = Math.min(1, this.moveProgress + deltaTime * 10);

        // Update mesh positions with smooth interpolation
        this.segments.forEach((seg, i) => {
            if (this.meshes[i]) {
                const targetX = seg.x * this.cellSize;
                const targetZ = seg.z * this.cellSize;

                // Smooth lerp
                this.meshes[i].position.x += (targetX - this.meshes[i].position.x) * 0.35;
                this.meshes[i].position.z += (targetZ - this.meshes[i].position.z) * 0.35;

                // Gentle bobbing
                const bobOffset = Math.sin(Date.now() * 0.004 + i * 0.3) * 0.03;
                this.meshes[i].position.y = this.segmentSize / 2 + bobOffset;
            }
        });

        // Update head rotation to face direction
        if (this.meshes[0]) {
            const targetRotation = Math.atan2(this.direction.x, this.direction.z);
            const currentRotation = this.meshes[0].rotation.y;
            this.meshes[0].rotation.y += (targetRotation - currentRotation) * 0.25;
        }
    }

    grow() {
        this.growPending++;
        this.length++;

        // Flash tongue
        if (this.meshes[0]) {
            const tongue = this.meshes[0].getObjectByName('tongue');
            if (tongue) {
                tongue.visible = true;
                setTimeout(() => { tongue.visible = false; }, 200);
            }
        }
    }

    getHeadPosition() {
        const head = this.segments[0];
        return {
            gridX: head.x,
            gridZ: head.z,
            worldX: head.x * this.cellSize,
            worldZ: head.z * this.cellSize
        };
    }

    getDirection() {
        return { ...this.direction };
    }

    getOccupiedCells() {
        return this.segments.map(seg => ({ x: seg.x, z: seg.z }));
    }

    setGlowColor(color) {
        // Not used in Slither.io style
    }
}
