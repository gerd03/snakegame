/**
 * CameraController - Fixed Top-Down Camera for Stable View
 */

import * as THREE from 'three';

export class CameraController {
    constructor(camera, snake) {
        this.camera = camera;
        this.snake = snake;

        this.mode = 'topdown'; // 'topdown', 'follow', 'cinematic'

        // Fixed top-down camera settings
        this.height = 35;
        this.target = new THREE.Vector3(0, 0, 0);

        // Camera shake
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
    }

    update(deltaTime, headPosition) {
        // Update shake
        if (this.shakeDuration > 0) {
            this.shakeDuration -= deltaTime;
        }

        switch (this.mode) {
            case 'topdown':
                this.updateTopDownCamera(deltaTime);
                break;
            case 'follow':
                this.updateFollowCamera(deltaTime, headPosition);
                break;
            case 'cinematic':
                this.updateCinematicCamera(deltaTime, headPosition);
                break;
        }

        // Apply camera shake
        if (this.shakeDuration > 0) {
            const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            const shakeZ = (Math.random() - 0.5) * this.shakeIntensity;
            this.camera.position.x += shakeX;
            this.camera.position.z += shakeZ;
        }
    }

    updateTopDownCamera(deltaTime) {
        // Fixed centered top-down view - no movement
        this.camera.position.set(0, this.height, 0.1);
        this.camera.lookAt(0, 0, 0);
    }

    updateFollowCamera(deltaTime, headPosition) {
        if (!headPosition) return;

        // Gentle follow with offset
        const targetX = headPosition.worldX * 0.3;
        const targetZ = headPosition.worldZ * 0.3;

        this.camera.position.x += (targetX - this.camera.position.x) * 0.02;
        this.camera.position.z += (targetZ + 10 - this.camera.position.z) * 0.02;
        this.camera.position.y = 30;

        this.camera.lookAt(headPosition.worldX, 0, headPosition.worldZ);
    }

    updateCinematicCamera(deltaTime, headPosition) {
        if (!headPosition) return;

        const time = Date.now() * 0.0005;
        const radius = 25;

        // Slow orbit around center
        this.camera.position.x = Math.cos(time) * radius;
        this.camera.position.z = Math.sin(time) * radius;
        this.camera.position.y = 20;

        this.camera.lookAt(0, 0, 0);
    }

    shake(intensity = 0.3, duration = 0.2) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
    }

    toggleMode() {
        const modes = ['topdown', 'follow', 'cinematic'];
        const currentIndex = modes.indexOf(this.mode);
        this.mode = modes[(currentIndex + 1) % modes.length];
    }

    setMode(mode) {
        this.mode = mode;
    }
}
