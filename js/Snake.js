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
        this.currentSkinTier = 'common';
        this.patternTextures = new Map();
        this.currentSkinProfile = null;

        this.effectTime = 0;
        this.patternScrollSpeed = 0;
        this.patternPulseStrength = 0;
        this.skinPulseSpeed = 0;
        this.baseEmissiveIntensity = 0;

        this.trailEnabled = false;
        this.afterimages = [];
        this.afterimageLifetime = 0.3;
        this.afterimageOpacity = 0.35;
        this.afterimageColor = this.snakeColor;

        this.auraEnabled = false;
        this.auraStyle = 'none';
        this.auraPoints = null;
        this.auraOffsets = [];
        this.auraVelocities = [];
        this.auraRadius = this.cellSize * 0.9;
        this.auraParticleCount = 0;
        this.auraParticleSize = this.cellSize * 0.11;
        this.auraOpacity = 0.5;
        this.auraDriftSpeed = 0.6;
        this.auraColor = this.snakeColor;
        this.auraSecondaryColor = this.snakeColor;

        this.headCoreMesh = null;
        this.coreBaseOpacity = 0;
        this.corePulseStrength = 0;
        this.corePulseSpeed = 0;

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

        this.coreMaterial = new THREE.MeshBasicMaterial({
            color: this.snakeColor,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.eyeWhiteMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        this.pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        this.afterimageGeometry = new THREE.SphereGeometry(this.bodyRadius * 0.96, 10, 10);

        this.connectorGeometry = new THREE.CylinderGeometry(
            this.bodyRadius,
            this.bodyRadius,
            this.cellSize,
            8
        );

        this.applySkinMaterial({
            color: this.currentSkinColor,
            pattern: this.currentPattern,
            tier: 'common'
        });
    }

    getTierDefaults(tier = 'common') {
        const base = {
            tier,
            emissiveColor: this.currentSkinColor,
            emissiveIntensity: 0,
            transparent: false,
            opacity: 1,
            roughness: 0.45,
            metalness: 0.06,
            patternScrollSpeed: 0,
            patternPulseStrength: 0,
            skinPulseSpeed: 0,
            aura: false,
            auraStyle: 'none',
            auraParticleCount: 0,
            auraParticleSize: this.cellSize * 0.11,
            auraOpacity: 0.5,
            auraDriftSpeed: 0.6,
            trail: false,
            trailLifetime: 0.3,
            trailOpacity: 0.35,
            trailColor: this.currentSkinColor,
            coreColor: this.currentSkinColor,
            coreIntensity: 0,
            corePulseStrength: 0,
            corePulseSpeed: 0
        };

        if (tier === 'rare') {
            return {
                ...base,
                emissiveIntensity: 0.14,
                coreIntensity: 0.2
            };
        }

        if (tier === 'epic') {
            return {
                ...base,
                emissiveIntensity: 0.28,
                aura: true,
                auraStyle: 'spark',
                auraParticleCount: 12,
                auraParticleSize: this.cellSize * 0.1,
                auraOpacity: 0.42,
                coreIntensity: 0.36,
                corePulseStrength: 0.1,
                corePulseSpeed: 1.8
            };
        }

        if (tier === 'legendary') {
            return {
                ...base,
                emissiveIntensity: 0.52,
                aura: true,
                auraStyle: 'arcane',
                auraParticleCount: 22,
                auraParticleSize: this.cellSize * 0.11,
                auraOpacity: 0.54,
                auraDriftSpeed: 0.7,
                trail: true,
                trailLifetime: 0.3,
                trailOpacity: 0.36,
                patternScrollSpeed: 0.35,
                patternPulseStrength: 0.1,
                skinPulseSpeed: 2.2,
                coreIntensity: 0.65,
                corePulseStrength: 0.24,
                corePulseSpeed: 2.8
            };
        }

        return base;
    }

    normalizeSkinProfile(profileOrColor, pattern = 'none') {
        if (typeof profileOrColor === 'object' && profileOrColor !== null) {
            const profile = { ...profileOrColor };
            if (typeof profile.color !== 'number') {
                profile.color = this.currentSkinColor;
            }
            profile.pattern = profile.pattern || 'none';
            profile.tier = profile.tier || 'common';
            return profile;
        }

        return {
            color: typeof profileOrColor === 'number' ? profileOrColor : this.currentSkinColor,
            pattern: pattern || 'none',
            tier: 'common'
        };
    }

    applySkinMaterial(profileOrColor, pattern = 'none') {
        const profile = this.normalizeSkinProfile(profileOrColor, pattern);
        const tierDefaults = this.getTierDefaults(profile.tier);
        const merged = { ...tierDefaults, ...profile };

        this.currentSkinProfile = merged;
        this.currentSkinColor = merged.color;
        this.currentPattern = merged.pattern || 'none';
        this.currentSkinTier = merged.tier || 'common';

        this.patternScrollSpeed = Number(merged.patternScrollSpeed) || 0;
        this.patternPulseStrength = Number(merged.patternPulseStrength) || 0;
        this.skinPulseSpeed = Number(merged.skinPulseSpeed) || 0;
        this.baseEmissiveIntensity = Number(merged.emissiveIntensity) || 0;

        this.bodyMaterial.roughness = merged.roughness;
        this.bodyMaterial.metalness = merged.metalness;
        this.bodyMaterial.transparent = !!merged.transparent;
        this.bodyMaterial.opacity = THREE.MathUtils.clamp(merged.opacity, 0.1, 1);
        this.bodyMaterial.depthWrite = !this.bodyMaterial.transparent || this.bodyMaterial.opacity > 0.92;
        this.bodyMaterial.emissive.setHex(merged.emissiveColor || merged.color);
        this.bodyMaterial.emissiveIntensity = this.baseEmissiveIntensity;
        this.bodyMaterial.blending = THREE.NormalBlending;

        const baseColor = new THREE.Color(merged.color);

        if (!merged.pattern || merged.pattern === 'none') {
            this.bodyMaterial.map = null;
            this.bodyMaterial.color.copy(baseColor);
            this.bodyMaterial.needsUpdate = true;
        } else {
            const texture = this.getPatternTexture(merged.pattern, merged.color);
            if (!texture) {
                this.bodyMaterial.map = null;
                this.bodyMaterial.color.copy(baseColor);
                this.bodyMaterial.needsUpdate = true;
            } else {
                this.bodyMaterial.color.setHex(0xffffff);
                this.bodyMaterial.map = texture;
                this.bodyMaterial.needsUpdate = true;
            }
        }

        this.trailEnabled = !!merged.trail;
        this.afterimageLifetime = Number(merged.trailLifetime) || 0.3;
        this.afterimageOpacity = Number(merged.trailOpacity) || 0.35;
        this.afterimageColor = merged.trailColor || merged.emissiveColor || merged.color;

        this.auraEnabled = !!merged.aura;
        this.auraStyle = merged.auraStyle || 'none';
        this.auraParticleCount = Number(merged.auraParticleCount) || 0;
        this.auraParticleSize = Number(merged.auraParticleSize) || this.cellSize * 0.11;
        this.auraOpacity = Number(merged.auraOpacity) || 0.5;
        this.auraDriftSpeed = Number(merged.auraDriftSpeed) || 0.6;
        this.auraColor = merged.auraColor || merged.emissiveColor || merged.color;
        this.auraSecondaryColor = merged.auraSecondaryColor || this.auraColor;

        this.coreBaseOpacity = THREE.MathUtils.clamp(Number(merged.coreIntensity) || 0, 0, 1);
        this.corePulseStrength = Number(merged.corePulseStrength) || 0;
        this.corePulseSpeed = Number(merged.corePulseSpeed) || 0;
        this.coreMaterial.color.setHex(merged.coreColor || merged.emissiveColor || merged.color);
        this.coreMaterial.opacity = this.coreBaseOpacity * 0.65;
        this.coreMaterial.needsUpdate = true;

        this.rebuildAuraParticles();
        if (!this.trailEnabled) {
            this.clearAfterimages();
        }

        if (this.headCoreMesh) {
            this.headCoreMesh.visible = this.coreBaseOpacity > 0.01;
            this.headCoreMesh.scale.setScalar(1);
        }
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
        const repeatMap = {
            arcana: 1.32,
            cyber: 1.4,
            immortal: 1.18,
            premium: 1.2,
            epic: 1.22,
            mythic: 1.24,
            legend: 1.2
        };
        const repeat = repeatMap[pattern] || 1.1;
        texture.repeat.set(repeat, repeat);
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

        const drawSpark = (x, y, outer, inner, fill) => {
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI / 4) * i - Math.PI / 2;
                const radius = i % 2 === 0 ? outer : inner;
                const px = x + Math.cos(angle) * radius;
                const py = y + Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
        };

        const drawHex = (x, y, r, fill, stroke = 'rgba(0, 0, 0, 0.25)') => {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i + Math.PI / 6;
                const px = x + Math.cos(angle) * r;
                const py = y + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = stroke;
            ctx.stroke();
        };

        const drawBolt = (x, y, s, fill) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(s, s);
            ctx.beginPath();
            ctx.moveTo(-5, -12);
            ctx.lineTo(2, -12);
            ctx.lineTo(-1, -2);
            ctx.lineTo(6, -2);
            ctx.lineTo(-5, 12);
            ctx.lineTo(-2, 2);
            ctx.lineTo(-8, 2);
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.restore();
        };

        const drawCrown = (x, y, s, fill) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(s, s);
            ctx.beginPath();
            ctx.moveTo(-16, 9);
            ctx.lineTo(-16, 13);
            ctx.lineTo(16, 13);
            ctx.lineTo(16, 9);
            ctx.lineTo(11, -8);
            ctx.lineTo(4, 2);
            ctx.lineTo(0, -11);
            ctx.lineTo(-4, 2);
            ctx.lineTo(-11, -8);
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.24)';
            ctx.stroke();
            ctx.restore();
        };

        const drawFlame = (x, y, s, fillOuter, fillInner) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(s, s);

            ctx.beginPath();
            ctx.moveTo(0, -14);
            ctx.bezierCurveTo(8, -8, 10, -2, 8, 6);
            ctx.bezierCurveTo(7, 12, 3, 16, 0, 18);
            ctx.bezierCurveTo(-3, 16, -7, 12, -8, 6);
            ctx.bezierCurveTo(-10, -2, -8, -8, 0, -14);
            ctx.closePath();
            ctx.fillStyle = fillOuter;
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(0, -7);
            ctx.bezierCurveTo(4, -4, 5, 1, 4, 5);
            ctx.bezierCurveTo(3, 9, 1, 11, 0, 12);
            ctx.bezierCurveTo(-1, 11, -3, 9, -4, 5);
            ctx.bezierCurveTo(-5, 1, -4, -4, 0, -7);
            ctx.closePath();
            ctx.fillStyle = fillInner;
            ctx.fill();
            ctx.restore();
        };

        const drawRune = (x, y, s, stroke) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.62, 0, Math.PI * 2);
            ctx.moveTo(-s * 0.5, 0);
            ctx.lineTo(s * 0.5, 0);
            ctx.moveTo(0, -s * 0.5);
            ctx.lineTo(0, s * 0.5);
            ctx.moveTo(-s * 0.35, -s * 0.35);
            ctx.lineTo(s * 0.35, s * 0.35);
            ctx.moveTo(-s * 0.35, s * 0.35);
            ctx.lineTo(s * 0.35, -s * 0.35);
            ctx.stroke();
            ctx.restore();
        };

        const drawScale = (x, y, radius, fill) => {
            ctx.beginPath();
            ctx.arc(x, y + radius * 0.18, radius, Math.PI, 0, false);
            ctx.lineTo(x + radius, y + radius * 0.38);
            ctx.lineTo(x - radius, y + radius * 0.38);
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
        };

        const stepMap = {
            arcana: 88,
            cyber: 84,
            immortal: 94,
            premium: 92,
            epic: 90,
            mythic: 96,
            legend: 96
        };
        const step = stepMap[pattern] || 112;

        if (pattern === 'arcana') {
            const arcanaGlow = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.05, size * 0.5, size * 0.5, size * 0.8);
            arcanaGlow.addColorStop(0, 'rgba(214, 248, 255, 0.28)');
            arcanaGlow.addColorStop(0.45, 'rgba(146, 209, 255, 0.14)');
            arcanaGlow.addColorStop(1, 'rgba(90, 38, 170, 0.08)');
            ctx.fillStyle = arcanaGlow;
            ctx.fillRect(0, 0, size, size);
        }

        if (pattern === 'cyber') {
            ctx.globalAlpha = 0.18;
            ctx.strokeStyle = '#9ef8ff';
            ctx.lineWidth = 1.5;
            for (let i = 0; i <= size; i += 20) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, size);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(size, i);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        if (pattern === 'immortal') {
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = '#fff1cf';
            ctx.lineWidth = 2;
            for (let i = -size; i < size * 2; i += 26) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i + size * 0.4, size);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        if (pattern === 'premium') {
            ctx.globalAlpha = 0.18;
            ctx.fillStyle = '#d9f9ff';
            for (let x = -size; x < size * 2; x += 24) {
                ctx.fillRect(x, 0, 10, size);
            }
            ctx.globalAlpha = 1;
        }

        if (pattern === 'epic') {
            ctx.globalAlpha = 0.2;
            ctx.strokeStyle = '#f2d9ff';
            ctx.lineWidth = 3;
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(0, size * 0.22 * i + size * 0.12);
                ctx.lineTo(size, size * 0.22 * i + size * 0.02);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

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
                    case 'premium':
                        drawHex(px, py, 24, '#9ff7ff');
                        drawSpark(px, py, 12, 5, '#ffffff');
                        break;
                    case 'epic':
                        drawBolt(px, py, 1.5, '#ffe0ff');
                        drawSpark(px + 14, py - 12, 8, 3, '#f4b8ff');
                        break;
                    case 'mythic':
                        ctx.beginPath();
                        ctx.arc(px, py, 24, 0, Math.PI * 2);
                        ctx.strokeStyle = 'rgba(255, 220, 240, 0.95)';
                        ctx.lineWidth = 3;
                        ctx.stroke();
                        drawCrown(px, py - 2, 0.75, '#ffd3e8');
                        drawSpark(px, py + 12, 7, 3, '#fff0f7');
                        break;
                    case 'legend':
                        drawFlame(px, py, 1.25, '#ffd26a', '#fff2b0');
                        drawSpark(px + 14, py - 14, 8, 3, '#fff2bf');
                        break;
                    case 'arcana':
                        ctx.beginPath();
                        ctx.arc(px, py, 24, 0, Math.PI * 2);
                        ctx.strokeStyle = 'rgba(220, 255, 255, 0.86)';
                        ctx.lineWidth = 2.5;
                        ctx.stroke();
                        drawRune(px, py, 20, 'rgba(193, 245, 255, 0.95)');
                        drawSpark(px + 14, py - 12, 7, 3, '#b8f8ff');
                        break;
                    case 'cyber':
                        drawHex(px, py, 22, 'rgba(98, 245, 255, 0.42)', 'rgba(8, 34, 44, 0.8)');
                        ctx.strokeStyle = 'rgba(177, 255, 255, 0.95)';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(px - 14, py + 8);
                        ctx.lineTo(px, py - 3);
                        ctx.lineTo(px + 13, py - 15);
                        ctx.stroke();
                        ctx.fillStyle = '#d6ffff';
                        ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
                        break;
                    case 'immortal':
                        drawScale(px, py - 3, 24, 'rgba(255, 238, 196, 0.9)');
                        drawScale(px + 14, py + 14, 14, 'rgba(255, 224, 162, 0.8)');
                        drawSpark(px - 12, py - 10, 8, 3, '#ffeec0');
                        break;
                    default:
                        break;
                }
            }
        }

        return new THREE.CanvasTexture(canvas);
    }

    reset() {
        this.clearAfterimages();

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
        this.effectTime = 0;

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

        const core = new THREE.Mesh(
            new THREE.SphereGeometry(this.headRadius * 0.55, 14, 14),
            this.coreMaterial
        );
        core.visible = this.coreBaseOpacity > 0.01;
        group.add(core);
        this.headCoreMesh = core;

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

    clearAfterimages() {
        if (!this.afterimages || this.afterimages.length === 0) return;
        this.afterimages.forEach((entry) => {
            if (!entry?.mesh) return;
            this.scene.remove(entry.mesh);
            if (entry.mesh.material) entry.mesh.material.dispose();
        });
        this.afterimages = [];
    }

    spawnAfterimage(worldX, worldZ) {
        if (!this.trailEnabled) return;

        const material = new THREE.MeshBasicMaterial({
            color: this.afterimageColor,
            transparent: true,
            opacity: this.afterimageOpacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const ghost = new THREE.Mesh(this.afterimageGeometry, material);
        ghost.position.set(worldX, this.cellSize * 0.35, worldZ);
        this.scene.add(ghost);

        this.afterimages.push({
            mesh: ghost,
            life: this.afterimageLifetime,
            maxLife: this.afterimageLifetime
        });

        const maxTrail = 28;
        while (this.afterimages.length > maxTrail) {
            const old = this.afterimages.shift();
            if (!old?.mesh) continue;
            this.scene.remove(old.mesh);
            old.mesh.material?.dispose();
        }
    }

    updateAfterimages(deltaTime) {
        if (!this.afterimages || this.afterimages.length === 0) return;

        for (let i = this.afterimages.length - 1; i >= 0; i--) {
            const entry = this.afterimages[i];
            entry.life -= deltaTime;
            if (entry.life <= 0) {
                this.scene.remove(entry.mesh);
                entry.mesh.material?.dispose();
                this.afterimages.splice(i, 1);
                continue;
            }

            const t = entry.life / Math.max(0.001, entry.maxLife);
            if (entry.mesh.material) {
                entry.mesh.material.opacity = this.afterimageOpacity * t * t;
            }
            const scale = 1 + (1 - t) * 0.26;
            entry.mesh.scale.setScalar(scale);
        }
    }

    rebuildAuraParticles() {
        if (this.auraPoints) {
            this.scene.remove(this.auraPoints);
            this.auraPoints.geometry?.dispose();
            this.auraPoints.material?.dispose();
            this.auraPoints = null;
        }

        this.auraOffsets = [];
        this.auraVelocities = [];

        if (!this.auraEnabled || this.auraParticleCount <= 0) return;

        const positions = new Float32Array(this.auraParticleCount * 3);
        const colors = new Float32Array(this.auraParticleCount * 3);
        const colA = new THREE.Color(this.auraColor);
        const colB = new THREE.Color(this.auraSecondaryColor || this.auraColor);

        const styleSpeedScale = this.auraStyle === 'spark'
            ? 1.5
            : this.auraStyle === 'leaf'
                ? 0.7
                : 1;

        for (let i = 0; i < this.auraParticleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = this.auraRadius * (0.3 + Math.random() * 0.85);
            const height = (Math.random() - 0.5) * this.cellSize * 0.3;
            const swirl = (Math.random() * 2 - 1) * (this.auraDriftSpeed || 0.6) * styleSpeedScale;

            this.auraOffsets.push({
                angle,
                radius,
                height,
                phase: Math.random() * Math.PI * 2
            });
            this.auraVelocities.push(swirl);

            const p = i * 3;
            positions[p] = 0;
            positions[p + 1] = 0;
            positions[p + 2] = 0;

            const c = colA.clone().lerp(colB, Math.random());
            colors[p] = c.r;
            colors[p + 1] = c.g;
            colors[p + 2] = c.b;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: this.auraParticleSize,
            transparent: true,
            opacity: this.auraOpacity,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.auraPoints = new THREE.Points(geometry, material);
        this.scene.add(this.auraPoints);
    }

    updateAuraParticles(deltaTime) {
        if (!this.auraPoints || !this.meshes[0]) return;

        const head = this.meshes[0].position;
        const positions = this.auraPoints.geometry?.attributes?.position;
        if (!positions) return;

        const styleLift = this.auraStyle === 'leaf'
            ? 0.13
            : this.auraStyle === 'spark'
                ? 0.08
                : 0.1;
        const styleSpin = this.auraStyle === 'spark'
            ? 1.5
            : this.auraStyle === 'leaf'
                ? 0.8
                : 1;

        for (let i = 0; i < this.auraOffsets.length; i++) {
            const offset = this.auraOffsets[i];
            const vel = this.auraVelocities[i] || 0;
            offset.angle += vel * deltaTime * styleSpin;
            offset.phase += deltaTime * (1.2 + i * 0.015) * styleSpin;

            const wobble = Math.sin(offset.phase) * this.cellSize * 0.08;
            const radius = offset.radius + wobble;
            const px = head.x + Math.cos(offset.angle) * radius;
            const pz = head.z + Math.sin(offset.angle) * radius;
            const py = head.y + offset.height + Math.sin(offset.phase * 0.7) * this.cellSize * styleLift;

            positions.setXYZ(i, px, py, pz);
        }

        positions.needsUpdate = true;
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

        if (this.trailEnabled) {
            const prevHeadWorld = this.grid.gridToWorld(head.x, head.z);
            this.spawnAfterimage(prevHeadWorld.x, prevHeadWorld.z);
        }

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

    update(deltaTime) {
        this.effectTime += deltaTime;

        if (this.bodyMaterial?.map && this.patternScrollSpeed > 0) {
            this.bodyMaterial.map.offset.x = (this.bodyMaterial.map.offset.x + this.patternScrollSpeed * deltaTime) % 1;
        }

        if (this.baseEmissiveIntensity > 0) {
            const pulse = this.patternPulseStrength > 0
                ? Math.sin(this.effectTime * Math.max(0.1, this.skinPulseSpeed)) * this.patternPulseStrength
                : 0;
            this.bodyMaterial.emissiveIntensity = Math.max(0, this.baseEmissiveIntensity + pulse);
        } else {
            this.bodyMaterial.emissiveIntensity = 0;
        }

        if (this.headCoreMesh) {
            const corePulse = this.corePulseStrength > 0
                ? Math.sin(this.effectTime * Math.max(0.1, this.corePulseSpeed)) * this.corePulseStrength
                : 0;
            const opacity = Math.max(0, this.coreBaseOpacity + corePulse);
            this.headCoreMesh.visible = opacity > 0.01;
            this.coreMaterial.opacity = opacity * 0.65;
            this.headCoreMesh.scale.setScalar(1 + corePulse * 0.18);
        }

        this.updateAfterimages(deltaTime);
        this.updateAuraParticles(deltaTime);
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
        const profile = {
            ...(this.currentSkinProfile || {}),
            color
        };
        this.currentSkinColor = color;
        this.applySkinMaterial(profile);

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

    setSkin(colorOrProfile, pattern = 'none', tier = 'common') {
        if (typeof colorOrProfile === 'object' && colorOrProfile !== null) {
            this.applySkinMaterial(colorOrProfile);
            return;
        }

        this.currentSkinColor = colorOrProfile;
        this.currentPattern = pattern || 'none';
        this.currentSkinTier = tier || 'common';
        this.applySkinMaterial({
            color: this.currentSkinColor,
            pattern: this.currentPattern,
            tier: this.currentSkinTier
        });
    }
}
