/**
 * SpectatorMode - Cinematic Spectator Camera
 */

import * as THREE from 'three';

export class SpectatorMode {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.active = false;

        this.time = 0;
        this.currentShot = 0;
        this.shotDuration = 8; // seconds per shot

        // Camera shots
        this.shots = [
            { type: 'wide', duration: 10 },
            { type: 'follow', duration: 8 },
            { type: 'top', duration: 6 },
            { type: 'dramatic', duration: 8 },
            { type: 'sweep', duration: 12 }
        ];
    }

    enable() {
        this.active = true;
        this.time = 0;
        this.currentShot = 0;
    }

    disable() {
        this.active = false;
    }

    update(deltaTime, snakeHead) {
        if (!this.active) return;

        this.time += deltaTime;

        // Check for shot change
        const currentShotData = this.shots[this.currentShot];
        if (this.time > currentShotData.duration) {
            this.time = 0;
            this.currentShot = (this.currentShot + 1) % this.shots.length;
        }

        // Apply current shot
        const shot = this.shots[this.currentShot];
        const progress = this.time / shot.duration;

        let targetPos;
        let lookAt = new THREE.Vector3(snakeHead?.worldX || 0, 0, snakeHead?.worldZ || 0);

        switch (shot.type) {
            case 'wide':
                const angle = progress * Math.PI * 0.5;
                targetPos = new THREE.Vector3(
                    Math.cos(angle) * 35,
                    25 + Math.sin(progress * Math.PI) * 5,
                    Math.sin(angle) * 35
                );
                break;

            case 'follow':
                targetPos = new THREE.Vector3(
                    snakeHead.worldX + 10,
                    8,
                    snakeHead.worldZ + 10
                );
                break;

            case 'top':
                targetPos = new THREE.Vector3(
                    snakeHead.worldX,
                    50 - progress * 10,
                    snakeHead.worldZ + 0.1
                );
                break;

            case 'dramatic':
                targetPos = new THREE.Vector3(
                    snakeHead.worldX - 5,
                    3 + Math.sin(progress * Math.PI * 2) * 2,
                    snakeHead.worldZ - 5
                );
                break;

            case 'sweep':
                const sweepAngle = progress * Math.PI * 2;
                targetPos = new THREE.Vector3(
                    Math.cos(sweepAngle) * 25,
                    15 + Math.sin(sweepAngle * 2) * 5,
                    Math.sin(sweepAngle) * 25
                );
                break;

            default:
                targetPos = new THREE.Vector3(0, 25, 20);
        }

        // Smooth camera movement
        this.camera.position.lerp(targetPos, 0.02);
        this.camera.lookAt(lookAt);
    }

    isActive() {
        return this.active;
    }
}
