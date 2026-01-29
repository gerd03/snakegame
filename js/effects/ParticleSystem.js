/**
 * ParticleSystem - Visual Effects for Collections, Trails, Death
 */

import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particleSystems = [];
    }

    createCollectionEffect(position) {
        const particleCount = 30;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];
        const colors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = position.gridX || position.worldX || 0;
            positions[i * 3 + 1] = 0.5;
            positions[i * 3 + 2] = position.gridZ || position.worldZ || 0;

            // Random velocities
            velocities.push({
                x: (Math.random() - 0.5) * 10,
                y: Math.random() * 10 + 5,
                z: (Math.random() - 0.5) * 10
            });

            // Orange to yellow colors
            const t = Math.random();
            colors[i * 3] = 1;
            colors[i * 3 + 1] = 0.5 + t * 0.5;
            colors[i * 3 + 2] = 0;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.2,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending
        });

        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);

        this.particleSystems.push({
            particles,
            velocities,
            life: 1,
            type: 'burst'
        });
    }

    createDeathExplosion(position) {
        const particleCount = 100;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];
        const colors = new Float32Array(particleCount * 3);

        const x = position.worldX || 0;
        const z = position.worldZ || 0;

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = x;
            positions[i * 3 + 1] = 0.5;
            positions[i * 3 + 2] = z;

            // Spherical explosion
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const speed = 5 + Math.random() * 10;

            velocities.push({
                x: Math.sin(phi) * Math.cos(theta) * speed,
                y: Math.cos(phi) * speed * 0.5 + 5,
                z: Math.sin(phi) * Math.sin(theta) * speed
            });

            // Red to magenta
            colors[i * 3] = 1;
            colors[i * 3 + 1] = Math.random() * 0.3;
            colors[i * 3 + 2] = Math.random() * 0.5 + 0.5;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.3,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending
        });

        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);

        this.particleSystems.push({
            particles,
            velocities,
            life: 2,
            type: 'explosion'
        });
    }

    createPowerUpEffect(position, color = 0x00ffff) {
        const particleCount = 50;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        const x = position.worldX || position.gridX || 0;
        const z = position.worldZ || position.gridZ || 0;

        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const radius = 0.5;

            positions[i * 3] = x + Math.cos(angle) * radius;
            positions[i * 3 + 1] = 0.5;
            positions[i * 3 + 2] = z + Math.sin(angle) * radius;

            // Spiral upward
            velocities.push({
                x: Math.cos(angle) * 2,
                y: 5 + Math.random() * 5,
                z: Math.sin(angle) * 2,
                angle: angle
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            size: 0.15,
            color: color,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending
        });

        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);

        this.particleSystems.push({
            particles,
            velocities,
            life: 1.5,
            type: 'spiral'
        });
    }

    createTrailEffect(position) {
        const particleCount = 5;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        const x = position.worldX || 0;
        const z = position.worldZ || 0;

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = x + (Math.random() - 0.5) * 0.3;
            positions[i * 3 + 1] = 0.3 + Math.random() * 0.2;
            positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3;

            velocities.push({
                x: (Math.random() - 0.5) * 0.5,
                y: 1 + Math.random(),
                z: (Math.random() - 0.5) * 0.5
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            size: 0.1,
            color: 0x00ff88,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);

        this.particleSystems.push({
            particles,
            velocities,
            life: 0.5,
            type: 'trail'
        });
    }

    update(deltaTime) {
        for (let i = this.particleSystems.length - 1; i >= 0; i--) {
            const system = this.particleSystems[i];
            system.life -= deltaTime;

            if (system.life <= 0) {
                this.scene.remove(system.particles);
                system.particles.geometry.dispose();
                system.particles.material.dispose();
                this.particleSystems.splice(i, 1);
                continue;
            }

            // Update particle positions
            const positions = system.particles.geometry.attributes.position.array;
            const gravity = -15;

            for (let j = 0; j < system.velocities.length; j++) {
                const vel = system.velocities[j];

                // Apply gravity
                vel.y += gravity * deltaTime;

                // Update position
                positions[j * 3] += vel.x * deltaTime;
                positions[j * 3 + 1] += vel.y * deltaTime;
                positions[j * 3 + 2] += vel.z * deltaTime;

                // Spiral motion for power-up effect
                if (system.type === 'spiral' && vel.angle !== undefined) {
                    vel.angle += deltaTime * 5;
                    positions[j * 3] += Math.cos(vel.angle) * deltaTime;
                    positions[j * 3 + 2] += Math.sin(vel.angle) * deltaTime;
                }

                // Floor collision
                if (positions[j * 3 + 1] < 0) {
                    positions[j * 3 + 1] = 0;
                    vel.y *= -0.3;
                }
            }

            system.particles.geometry.attributes.position.needsUpdate = true;

            // Fade out
            system.particles.material.opacity = Math.max(0, system.life);
        }
    }

    clear() {
        for (const system of this.particleSystems) {
            this.scene.remove(system.particles);
            system.particles.geometry.dispose();
            system.particles.material.dispose();
        }
        this.particleSystems = [];
    }
}
