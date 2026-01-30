/**
 * Snake - Google Snake Style with Smooth Connected Body
 * Slim, smooth tube-like body without bloating
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
        this.connectors = [];
        this.direction = { x: 1, z: 0 };
        this.length = 3;
        this.growPending = 0;

        // Visual settings - slim smooth body
        this.bodyRadius = cellSize * 0.32;  // Slimmer
        this.headRadius = cellSize * 0.38;

        // Blue snake color
        this.snakeColor = 0x4285F4;

        this.createMaterials();
        this.reset();
    }

    createMaterials() {
        // Body material - no shadows for performance
        this.bodyMaterial = new THREE.MeshStandardMaterial({
            color: this.snakeColor,
            roughness: 0.5,
            metalness: 0.0
        });

        // Eye materials
        this.eyeWhiteMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF
        });

        this.pupilMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000
        });
    }

    reset() {
        // Clear meshes
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

        this.connectors.forEach(conn => {
            this.scene.remove(conn);
            if (conn.geometry) conn.geometry.dispose();
        });
        this.connectors = [];

        this.length = 3;
        this.direction = { x: 1, z: 0 };
        this.growPending = 0;

        this.segments = [];
        for (let i = 0; i < this.length; i++) {
            this.segments.push({ x: -i, z: 0 });
        }

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
                this.cellSize * 0.35,
                seg.z * this.cellSize
            );

            this.meshes.push(mesh);
            this.scene.add(mesh);
        });

        this.updateConnectors();
    }

    createHead() {
        const group = new THREE.Group();

        // Smooth head sphere
        const headGeometry = new THREE.SphereGeometry(this.headRadius, 24, 24);
        const head = new THREE.Mesh(headGeometry, this.bodyMaterial);
        group.add(head);

        // Eyes
        const eyeSize = this.headRadius * 0.4;
        const eyeOffset = this.headRadius * 0.45;
        const eyeHeight = this.headRadius * 0.25;
        const eyeForward = this.headRadius * 0.7;

        // Left eye
        const leftEyeWhite = new THREE.Mesh(
            new THREE.SphereGeometry(eyeSize, 12, 12),
            this.eyeWhiteMaterial
        );
        leftEyeWhite.position.set(-eyeOffset, eyeHeight, eyeForward);
        group.add(leftEyeWhite);

        const leftPupil = new THREE.Mesh(
            new THREE.SphereGeometry(eyeSize * 0.5, 8, 8),
            this.pupilMaterial
        );
        leftPupil.position.set(-eyeOffset, eyeHeight, eyeForward + eyeSize * 0.6);
        group.add(leftPupil);

        // Right eye
        const rightEyeWhite = new THREE.Mesh(
            new THREE.SphereGeometry(eyeSize, 12, 12),
            this.eyeWhiteMaterial
        );
        rightEyeWhite.position.set(eyeOffset, eyeHeight, eyeForward);
        group.add(rightEyeWhite);

        const rightPupil = new THREE.Mesh(
            new THREE.SphereGeometry(eyeSize * 0.5, 8, 8),
            this.pupilMaterial
        );
        rightPupil.position.set(eyeOffset, eyeHeight, eyeForward + eyeSize * 0.6);
        group.add(rightPupil);

        return group;
    }

    createBodySegment(index) {
        // Simple sphere for body - connectors create the tube effect
        const geometry = new THREE.SphereGeometry(this.bodyRadius, 16, 16);
        return new THREE.Mesh(geometry, this.bodyMaterial);
    }

    updateConnectors() {
        // Remove old connectors
        this.connectors.forEach(conn => {
            this.scene.remove(conn);
            if (conn.geometry) conn.geometry.dispose();
        });
        this.connectors = [];

        // Create smooth tube connectors
        for (let i = 0; i < this.segments.length - 1; i++) {
            const seg1 = this.segments[i];
            const seg2 = this.segments[i + 1];

            const pos1 = new THREE.Vector3(
                seg1.x * this.cellSize,
                this.cellSize * 0.35,
                seg1.z * this.cellSize
            );
            const pos2 = new THREE.Vector3(
                seg2.x * this.cellSize,
                this.cellSize * 0.35,
                seg2.z * this.cellSize
            );

            const connector = this.createConnector(pos1, pos2);
            this.connectors.push(connector);
            this.scene.add(connector);
        }
    }

    createConnector(pos1, pos2) {
        const direction = new THREE.Vector3().subVectors(pos2, pos1);
        const length = direction.length();

        // Slim cylinder connector
        const geometry = new THREE.CylinderGeometry(
            this.bodyRadius,
            this.bodyRadius,
            length,
            12
        );

        const connector = new THREE.Mesh(geometry, this.bodyMaterial);
        connector.position.copy(pos1).add(pos2).multiplyScalar(0.5);
        connector.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.clone().normalize()
        );

        return connector;
    }

    move(newDirection) {
        if (newDirection) {
            const isOpposite =
                newDirection.x === -this.direction.x && this.direction.x !== 0 ||
                newDirection.z === -this.direction.z && this.direction.z !== 0;

            if (!isOpposite) {
                this.direction = { ...newDirection };
            }
        }

        const head = this.segments[0];
        const newHead = {
            x: head.x + this.direction.x,
            z: head.z + this.direction.z
        };

        // Grid boundaries: -9 to 9 (19x19 playable area)
        const maxCoord = Math.floor(this.gridSize / 2) - 1;  // 9
        if (newHead.x < -maxCoord || newHead.x > maxCoord ||
            newHead.z < -maxCoord || newHead.z > maxCoord) {
            return { collision: true, type: 'wall' };
        }

        for (let i = 1; i < this.segments.length; i++) {
            if (this.segments[i].x === newHead.x && this.segments[i].z === newHead.z) {
                return { collision: true, type: 'self' };
            }
        }

        this.segments.unshift(newHead);

        if (this.growPending > 0) {
            this.growPending--;
            this.length++;
            const newMesh = this.createBodySegment(this.segments.length - 1);
            newMesh.position.set(
                this.segments[this.segments.length - 1].x * this.cellSize,
                this.cellSize * 0.35,
                this.segments[this.segments.length - 1].z * this.cellSize
            );
            this.meshes.push(newMesh);
            this.scene.add(newMesh);
        } else {
            this.segments.pop();
        }

        this.updateMeshPositions();
        this.updateConnectors();

        return { collision: false };
    }

    updateMeshPositions() {
        this.segments.forEach((seg, i) => {
            if (this.meshes[i]) {
                this.meshes[i].position.x = seg.x * this.cellSize;
                this.meshes[i].position.z = seg.z * this.cellSize;

                if (i === 0) {
                    const angle = Math.atan2(this.direction.x, this.direction.z);
                    this.meshes[i].rotation.y = angle;
                }
            }
        });
    }

    grow(amount = 1) {
        this.growPending += amount;
    }

    update(deltaTime) {
        // Minimal animation for performance
    }

    getLength() {
        return this.length;
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

    setGlowColor(color) { }

    setColor(color) {
        // Update body material color
        if (this.bodyMaterial) {
            this.bodyMaterial.color.setHex(color);
        }
        // Update all body meshes (use 'meshes' not 'bodyMeshes')
        if (this.meshes && this.meshes.length > 0) {
            this.meshes.forEach(mesh => {
                if (mesh && mesh.material) {
                    mesh.material.color.setHex(color);
                }
            });
        }
        // Update connectors
        if (this.connectors && this.connectors.length > 0) {
            this.connectors.forEach(conn => {
                if (conn && conn.material) {
                    conn.material.color.setHex(color);
                }
            });
        }
        // Update head
        if (this.headMesh) {
            if (this.headMesh.material) {
                this.headMesh.material.color.setHex(color);
            }
        }
    }

    setSkin(color, pattern) {
        // Store current skin settings
        this.currentSkinColor = color;
        this.currentPattern = pattern;

        // First set the base color
        this.setColor(color);

        // If pattern is 'none', just use solid color
        if (pattern === 'none') {
            this.bodyMaterial.map = null;
            this.bodyMaterial.needsUpdate = true;
            return;
        }

        // Create patterned texture
        const texture = this.createPatternTexture(color, pattern);

        // Update the body material with texture (so new segments get it)
        this.bodyMaterial.map = texture;
        this.bodyMaterial.needsUpdate = true;

        // Apply to ALL existing meshes including connectors
        if (this.meshes && this.meshes.length > 0) {
            this.meshes.forEach((mesh, i) => {
                if (mesh && mesh.material) {
                    mesh.material.map = texture;
                    mesh.material.needsUpdate = true;
                }
            });
        }

        // Apply to connectors
        if (this.connectors && this.connectors.length > 0) {
            this.connectors.forEach(conn => {
                if (conn && conn.material) {
                    conn.material.map = texture;
                    conn.material.needsUpdate = true;
                }
            });
        }
    }

    createPatternTexture(baseColor, pattern) {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Convert hex color to CSS
        const r = (baseColor >> 16) & 255;
        const g = (baseColor >> 8) & 255;
        const b = baseColor & 255;
        const colorStr = `rgb(${r}, ${g}, ${b})`;
        const lightColor = `rgb(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)})`;

        // Fill background
        ctx.fillStyle = colorStr;
        ctx.fillRect(0, 0, size, size);

        // Draw pattern
        ctx.fillStyle = lightColor;
        ctx.strokeStyle = lightColor;
        ctx.lineWidth = 2;

        const cx = size / 2;
        const cy = size / 2;
        const patternSize = size * 0.35;

        switch (pattern) {
            case 'heart':
                ctx.beginPath();
                ctx.moveTo(cx, cy + patternSize * 0.3);
                ctx.bezierCurveTo(cx - patternSize, cy - patternSize * 0.3, cx - patternSize, cy - patternSize, cx, cy - patternSize * 0.5);
                ctx.bezierCurveTo(cx + patternSize, cy - patternSize, cx + patternSize, cy - patternSize * 0.3, cx, cy + patternSize * 0.3);
                ctx.fill();
                break;

            case 'diamond':
                ctx.beginPath();
                ctx.moveTo(cx, cy - patternSize);
                ctx.lineTo(cx + patternSize * 0.7, cy);
                ctx.lineTo(cx, cy + patternSize);
                ctx.lineTo(cx - patternSize * 0.7, cy);
                ctx.closePath();
                ctx.fill();
                break;

            case 'star':
                const spikes = 5;
                const outerRadius = patternSize;
                const innerRadius = patternSize * 0.4;
                ctx.beginPath();
                for (let i = 0; i < spikes * 2; i++) {
                    const radius = i % 2 === 0 ? outerRadius : innerRadius;
                    const angle = (Math.PI / spikes) * i - Math.PI / 2;
                    const x = cx + Math.cos(angle) * radius;
                    const y = cy + Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                break;

            case 'circle':
                ctx.beginPath();
                ctx.arc(cx, cy, patternSize * 0.6, 0, Math.PI * 2);
                ctx.fill();
                break;
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        return texture;
    }
}
