/**
 * Food - 3D Food Orbs with Particle Effects
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
        this.particles = null;
        this.magnetMode = false;
        this.magnetTarget = null;

        this.createMesh();
    }

    createMesh() {
        this.group = new THREE.Group();

        // Main orb
        const orbGeometry = new THREE.SphereGeometry(this.cellSize * 0.35, 32, 32);
        const orbMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6600,
            emissive: 0xff6600,
            emissiveIntensity: 0.6,
            metalness: 0.5,
            roughness: 0.2
        });
        this.mesh = new THREE.Mesh(orbGeometry, orbMaterial);
        this.mesh.castShadow = true;
        this.group.add(this.mesh);

        // Inner glow
        const glowGeometry = new THREE.SphereGeometry(this.cellSize * 0.25, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        const innerGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.group.add(innerGlow);

        // Outer ring
        const ringGeometry = new THREE.TorusGeometry(this.cellSize * 0.45, 0.02, 8, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.5
        });
        this.ring1 = new THREE.Mesh(ringGeometry, ringMaterial);
        this.group.add(this.ring1);

        this.ring2 = new THREE.Mesh(ringGeometry, ringMaterial.clone());
        this.ring2.rotation.x = Math.PI / 2;
        this.group.add(this.ring2);

        // Particle aura
        this.createParticleAura();

        this.group.position.y = this.cellSize * 0.5;
        this.scene.add(this.group);
    }

    createParticleAura() {
        const particleCount = 20;
        const particleGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const radius = this.cellSize * 0.5;
            positions[i * 3] = Math.cos(angle) * radius;
            positions[i * 3 + 1] = (Math.random() - 0.5) * this.cellSize * 0.3;
            positions[i * 3 + 2] = Math.sin(angle) * radius;
        }

        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const particleMaterial = new THREE.PointsMaterial({
            color: 0xff8800,
            size: 0.1,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        this.particles = new THREE.Points(particleGeometry, particleMaterial);
        this.group.add(this.particles);
    }

    spawn(occupiedCells) {
        // Grid boundaries: -9 to 9 for a 20-cell grid (inside the walls)
        const maxCoord = Math.floor(this.gridSize / 2) - 1; // 9 for gridSize 20
        let validPosition = false;
        let attempts = 0;

        while (!validPosition && attempts < 100) {
            // Generate position from -maxCoord to maxCoord (e.g., -9 to 9)
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
            this.spawnAnimation.progress += deltaTime * 3;
            const scale = Math.min(1, this.spawnAnimation.progress);
            const bounce = 1 + Math.sin(scale * Math.PI) * 0.2;
            this.group.scale.set(scale * bounce, scale * bounce, scale * bounce);

            if (this.spawnAnimation.progress >= 1) {
                this.group.scale.set(1, 1, 1);
                this.spawnAnimation = null;
            }
        }

        // Floating animation
        this.group.position.y = this.cellSize * 0.5 + Math.sin(time * 3) * 0.1;

        // Rotate rings
        this.ring1.rotation.z = time * 2;
        this.ring2.rotation.y = time * 2;

        // Pulse glow
        if (this.mesh && this.mesh.material) {
            this.mesh.material.emissiveIntensity = 0.5 + Math.sin(time * 4) * 0.2;
        }

        // Rotate particles
        if (this.particles) {
            this.particles.rotation.y = time;
            const positions = this.particles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] = (Math.sin(time * 2 + i) * 0.5) * this.cellSize * 0.2;
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
        }

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

        // Visual feedback
        if (enabled && this.mesh) {
            this.mesh.material.color.setHex(0x00ffff);
            this.mesh.material.emissive.setHex(0x00ffff);
        } else if (this.mesh) {
            this.mesh.material.color.setHex(0xff6600);
            this.mesh.material.emissive.setHex(0xff6600);
        }
    }
}
