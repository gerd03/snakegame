/**
 * Snake - smooth connected body with GridBounds-based coordinates.
 */

import * as THREE from 'three';
import { GridBounds } from './core/GridBounds.js';

export class Snake {
    constructor(scene, gridConfig) {
        this.scene = scene;
        this.grid = GridBounds.from(gridConfig);
        this.cellSize = this.grid.cellSize;

        this.segments = [];
        this.meshes = [];
        this.connectors = [];
        this.direction = { x: 1, z: 0 };
        this.length = 3;
        this.growPending = 0;

        this.bodyRadius = this.cellSize * 0.32;
        this.headRadius = this.cellSize * 0.38;
        this.snakeColor = 0x4285F4;
        this.currentSkinColor = this.snakeColor;
        this.currentPattern = 'none';
        this.patternTextures = new Map();

        this.upVector = new THREE.Vector3(0, 1, 0);
        this.connectorDirection = new THREE.Vector3();
        this.headMesh = null;

        this.createMaterials();
        this.reset();
    }

    createMaterials() {
        this.bodyMaterial = new THREE.MeshStandardMaterial({
            color: this.snakeColor,
            roughness: 0.5,
            metalness: 0.0
        });

        this.eyeWhiteMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        this.pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

        this.connectorGeometry = new THREE.CylinderGeometry(
            this.bodyRadius,
            this.bodyRadius,
            this.cellSize,
            8
        );

        this.applySkinMaterial(this.currentSkinColor, this.currentPattern);
    }

    applySkinMaterial(color, pattern = 'none') {
        const baseColor = new THREE.Color(color);

        if (!pattern || pattern === 'none') {
            this.bodyMaterial.map = null;
            this.bodyMaterial.color.copy(baseColor);
            this.bodyMaterial.emissive.setHex(0x000000);
            this.bodyMaterial.needsUpdate = true;
            return;
        }

        const texture = this.getPatternTexture(pattern, color);
        if (!texture) {
            this.bodyMaterial.map = null;
            this.bodyMaterial.color.copy(baseColor);
            this.bodyMaterial.needsUpdate = true;
            return;
        }

        this.bodyMaterial.color.setHex(0xffffff);
        this.bodyMaterial.map = texture;
        this.bodyMaterial.emissive.setHex(0x000000);
        this.bodyMaterial.needsUpdate = true;
    }

    getPatternTexture(pattern, color) {
        const key = `${pattern}:${color}`;
        if (this.patternTextures.has(key)) {
            return this.patternTextures.get(key);
        }

        const texture = this.createPatternTexture(pattern, color);
        if (!texture) return null;

        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1.1, 1.1);
        texture.offset.set(0.02, 0.02);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        this.patternTextures.set(key, texture);
        return texture;
    }

    createPatternTexture(pattern, color) {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const base = new THREE.Color(color);
        const baseHex = `#${base.getHexString()}`;
        const bright = base.clone().lerp(new THREE.Color(0xffffff), 0.74);
        const dark = base.clone().lerp(new THREE.Color(0x000000), 0.44);
        const brightHex = `#${bright.getHexString()}`;
        const darkHex = `#${dark.getHexString()}`;

        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, baseHex);
        gradient.addColorStop(0.56, brightHex);
        gradient.addColorStop(1, darkHex);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#ffffff';
        for (let y = 0; y < size; y += 18) {
            ctx.fillRect(0, y, size, 2);
        }
        ctx.globalAlpha = 1;

        const drawHeart = (x, y, s, fill) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(s, s);
            ctx.beginPath();
            ctx.moveTo(0, 2);
            ctx.bezierCurveTo(0, -3, -8, -3, -8, 3);
            ctx.bezierCurveTo(-8, 8, -2, 11, 0, 14);
            ctx.bezierCurveTo(2, 11, 8, 8, 8, 3);
            ctx.bezierCurveTo(8, -3, 0, -3, 0, 2);
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.restore();
        };

        const drawStar = (x, y, r, fill) => {
            const inner = r * 0.44;
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const angle = (Math.PI / 5) * i - Math.PI / 2;
                const radius = i % 2 === 0 ? r : inner;
                const px = x + Math.cos(angle) * radius;
                const py = y + Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.stroke();
        };

        const drawDiamond = (x, y, w, h, fill) => {
            ctx.beginPath();
            ctx.moveTo(x, y - h);
            ctx.lineTo(x + w, y);
            ctx.lineTo(x, y + h);
            ctx.lineTo(x - w, y);
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.stroke();
        };

        const step = 112;
        for (let y = step / 2; y < size; y += step) {
            for (let x = step / 2; x < size; x += step) {
                const offset = ((x + y) / step) % 2 === 0;
                const px = offset ? x : x - 14;
                const py = y;

                switch (pattern) {
                    case 'circle':
                        ctx.beginPath();
                        ctx.arc(px, py, 24, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                        ctx.fill();
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                        ctx.stroke();
                        break;
                    case 'heart':
                        drawHeart(px, py - 10, 1.6, '#ffd0db');
                        break;
                    case 'star':
                        drawStar(px, py, 24, '#ffe480');
                        break;
                    case 'diamond':
                        drawDiamond(px, py, 22, 28, '#8cf2ff');
                        break;
                    case 'prisma':
                        drawDiamond(px - 12, py + 4, 15, 22, '#9af9ff');
                        drawStar(px + 16, py - 12, 12, '#ffd980');
                        break;
                    default:
                        break;
                }
            }
        }

        return new THREE.CanvasTexture(canvas);
    }

    reset() {
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

        this.connectors.forEach(connector => {
            this.scene.remove(connector);
        });
        this.connectors = [];

        this.length = 3;
        this.direction = { x: 1, z: 0 };
        this.growPending = 0;
        this.segments = [];

        const startX = Math.max(this.grid.minX + 2, -1);
        const startZ = Math.max(this.grid.minZ + 1, 0);
        for (let i = 0; i < this.length; i++) {
            this.segments.push({ x: startX - i, z: startZ });
        }

        this.createMeshes();
    }

    createMeshes() {
        this.segments.forEach((seg, index) => {
            let mesh;
            if (index === 0) {
                mesh = this.createHead();
                this.headMesh = mesh;
            } else {
                mesh = this.createBodySegment();
            }

            const world = this.grid.gridToWorld(seg.x, seg.z);
            mesh.position.set(world.x, this.cellSize * 0.35, world.z);

            this.meshes.push(mesh);
            this.scene.add(mesh);
        });

        this.updateConnectors();
    }

    createHead() {
        const group = new THREE.Group();

        const headGeometry = new THREE.SphereGeometry(this.headRadius, 20, 20);
        const head = new THREE.Mesh(headGeometry, this.bodyMaterial);
        group.add(head);

        const eyeSize = this.headRadius * 0.4;
        const eyeOffset = this.headRadius * 0.45;
        const eyeHeight = this.headRadius * 0.25;
        const eyeForward = this.headRadius * 0.7;

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

    createBodySegment() {
        const geometry = new THREE.SphereGeometry(this.bodyRadius, 12, 12);
        return new THREE.Mesh(geometry, this.bodyMaterial);
    }

    createConnector() {
        return new THREE.Mesh(this.connectorGeometry, this.bodyMaterial);
    }

    updateConnectors() {
        const requiredConnectors = Math.max(0, this.segments.length - 1);

        while (this.connectors.length < requiredConnectors) {
            const connector = this.createConnector();
            this.connectors.push(connector);
            this.scene.add(connector);
        }

        while (this.connectors.length > requiredConnectors) {
            const connector = this.connectors.pop();
            this.scene.remove(connector);
        }

        const y = this.cellSize * 0.35;
        for (let i = 0; i < requiredConnectors; i++) {
            const seg1 = this.segments[i];
            const seg2 = this.segments[i + 1];
            const p1 = this.grid.gridToWorld(seg1.x, seg1.z);
            const p2 = this.grid.gridToWorld(seg2.x, seg2.z);

            const connector = this.connectors[i];
            connector.position.set((p1.x + p2.x) * 0.5, y, (p1.z + p2.z) * 0.5);

            this.connectorDirection.set(p2.x - p1.x, 0, p2.z - p1.z);
            this.connectorDirection.normalize();
            connector.quaternion.setFromUnitVectors(this.upVector, this.connectorDirection);
        }
    }

    move(newDirection) {
        if (newDirection) {
            const isOpposite =
                (newDirection.x === -this.direction.x && this.direction.x !== 0) ||
                (newDirection.z === -this.direction.z && this.direction.z !== 0);
            if (!isOpposite) {
                this.direction = { ...newDirection };
            }
        }

        const head = this.segments[0];
        const newHead = {
            x: head.x + this.direction.x,
            z: head.z + this.direction.z
        };

        if (!this.grid.inBounds(newHead)) {
            return { collision: true, type: 'wall' };
        }

        const willGrow = this.growPending > 0;
        for (let i = 1; i < this.segments.length; i++) {
            const isTail = i === this.segments.length - 1;
            if (isTail && !willGrow) continue;

            if (this.segments[i].x === newHead.x && this.segments[i].z === newHead.z) {
                return { collision: true, type: 'self' };
            }
        }

        this.segments.unshift(newHead);

        if (this.growPending > 0) {
            this.growPending--;
            this.length++;

            const newMesh = this.createBodySegment();
            const tail = this.segments[this.segments.length - 1];
            const world = this.grid.gridToWorld(tail.x, tail.z);
            newMesh.position.set(world.x, this.cellSize * 0.35, world.z);
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
        this.segments.forEach((seg, index) => {
            if (!this.meshes[index]) return;

            const world = this.grid.gridToWorld(seg.x, seg.z);
            this.meshes[index].position.x = world.x;
            this.meshes[index].position.z = world.z;

            if (index === 0) {
                const angle = Math.atan2(this.direction.x, this.direction.z);
                this.meshes[index].rotation.y = angle;
            }
        });
    }

    grow(amount = 1) {
        this.growPending += amount;
    }

    update(_deltaTime) {
        // No per-frame motion interpolation.
    }

    getLength() {
        return this.length;
    }

    getHeadPosition() {
        const head = this.segments[0];
        const world = this.grid.gridToWorld(head.x, head.z);
        return {
            gridX: head.x,
            gridZ: head.z,
            worldX: world.x,
            worldZ: world.z
        };
    }

    getDirection() {
        return { ...this.direction };
    }

    getOccupiedCells() {
        return this.segments.map(seg => ({ x: seg.x, z: seg.z }));
    }

    setGlowColor(_color) {
        // Reserved.
    }

    setColor(color) {
        this.currentSkinColor = color;
        this.applySkinMaterial(color, this.currentPattern);

        if (this.meshes && this.meshes.length > 0) {
            this.meshes.forEach(mesh => {
                if (mesh && mesh.material) {
                    mesh.material.needsUpdate = true;
                }
            });
        }

        if (this.connectors && this.connectors.length > 0) {
            this.connectors.forEach(conn => {
                if (conn && conn.material) {
                    conn.material.needsUpdate = true;
                }
            });
        }

        if (this.headMesh && this.headMesh.material) {
            this.headMesh.material.needsUpdate = true;
        }
    }

    setSkin(color, pattern) {
        this.currentSkinColor = color;
        this.currentPattern = pattern || 'none';
        this.applySkinMaterial(this.currentSkinColor, this.currentPattern);
    }
}
