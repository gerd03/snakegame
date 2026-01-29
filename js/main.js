/**
 * SNAKE ARCADE - Main Game Entry Point
 * AAA-Quality 3D Snake with AI Autopilot
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Arena } from './Arena.js';
import { Snake } from './Snake.js';
import { Food } from './Food.js';
import { AIController } from './ai/AIController.js';
import { CameraController } from './camera/CameraController.js';
import { PowerUpManager } from './systems/PowerUpManager.js';
import { ScoreManager } from './systems/ScoreManager.js';
import { AudioManager } from './audio/AudioManager.js';
import { ParticleSystem } from './effects/ParticleSystem.js';

// Game Configuration
const CONFIG = {
    gridSize: 20,
    cellSize: 1,
    initialSpeed: 0.08, // Fast snake for high scores
    minSpeed: 0.03,     // Even faster at max speed
    speedIncrement: 0.001,
    pointsPerFood: 100  // Higher points to reach 100,000+
};

// Game State
const GameState = {
    LOADING: 'loading',
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameOver'
};

class SnakeArcade {
    constructor() {
        this.state = GameState.LOADING;
        this.difficulty = 'pro';
        this.spectatorMode = false;
        this.score = 0;
        this.survivalTime = 0;
        this.lastMoveTime = 0;
        this.moveInterval = CONFIG.initialSpeed;

        // Three.js
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;

        // Game objects
        this.arena = null;
        this.snake = null;
        this.food = null;
        this.ai = null;
        this.cameraController = null;
        this.powerUpManager = null;
        this.scoreManager = null;
        this.audioManager = null;
        this.particles = null;

        // UI Elements
        this.ui = {
            loading: document.getElementById('loading-screen'),
            menu: document.getElementById('main-menu'),
            hud: document.getElementById('game-hud'),
            gameOver: document.getElementById('game-over'),
            pause: document.getElementById('pause-screen'),
            score: document.getElementById('score-value'),
            length: document.getElementById('length-value'),
            time: document.getElementById('time-value'),
            combo: document.getElementById('combo-value'),
            aiMode: document.getElementById('ai-mode'),
            finalScore: document.getElementById('final-score'),
            finalLength: document.getElementById('final-length'),
            finalTime: document.getElementById('final-time')
        };

        this.init();
    }

    async init() {
        await this.setupThreeJS();
        await this.setupPostProcessing();
        await this.createGameObjects();
        this.setupEventListeners();
        this.hideLoading();
        this.animate();
    }

    async setupThreeJS() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x0a0a0f, 0.015);

        // Camera - centered top-down view
        this.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        // Position camera directly above center, looking down
        this.camera.position.set(0, 35, 0.1);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.5);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1);
        mainLight.position.set(10, 20, 10);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 50;
        mainLight.shadow.camera.left = -20;
        mainLight.shadow.camera.right = 20;
        mainLight.shadow.camera.top = 20;
        mainLight.shadow.camera.bottom = -20;
        this.scene.add(mainLight);

        // Cyan rim light
        const rimLight1 = new THREE.PointLight(0x00f0ff, 2, 50);
        rimLight1.position.set(-15, 10, -15);
        this.scene.add(rimLight1);

        // Magenta rim light
        const rimLight2 = new THREE.PointLight(0xff00ff, 2, 50);
        rimLight2.position.set(15, 10, 15);
        this.scene.add(rimLight2);
    }

    async setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);

        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.8,  // strength
            0.4,  // radius
            0.85  // threshold
        );
        this.composer.addPass(bloomPass);
    }

    async createGameObjects() {
        // Arena
        this.arena = new Arena(this.scene, CONFIG.gridSize, CONFIG.cellSize);

        // Snake
        this.snake = new Snake(this.scene, CONFIG.gridSize, CONFIG.cellSize);

        // Food
        this.food = new Food(this.scene, CONFIG.gridSize, CONFIG.cellSize);
        this.food.spawn(this.snake.getOccupiedCells());

        // Particle System
        this.particles = new ParticleSystem(this.scene);

        // AI Controller
        this.ai = new AIController(CONFIG.gridSize, this.difficulty);

        // Camera Controller
        this.cameraController = new CameraController(this.camera, this.snake);

        // Power-up Manager
        this.powerUpManager = new PowerUpManager(this.scene, CONFIG.gridSize, CONFIG.cellSize);

        // Score Manager
        this.scoreManager = new ScoreManager();

        // Audio Manager
        this.audioManager = new AudioManager();
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onResize());

        // Menu buttons
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.difficulty = e.target.dataset.level;
                this.updateAIModeDisplay();
            });
        });

        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('spectator-btn').addEventListener('click', () => this.startSpectatorMode());
        document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());
        document.getElementById('menu-btn').addEventListener('click', () => this.showMenu());
        document.getElementById('camera-btn').addEventListener('click', () => this.toggleCameraMode());
        document.getElementById('sound-btn').addEventListener('click', () => this.toggleSound());

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.togglePause();
            if (e.key === ' ' && this.state === GameState.MENU) this.startGame();
        });
    }

    hideLoading() {
        setTimeout(() => {
            this.ui.loading.classList.add('hidden');
            this.ui.menu.classList.remove('hidden');
            this.state = GameState.MENU;
        }, 2500);
    }

    startGame(spectator = false) {
        this.spectatorMode = spectator;
        this.state = GameState.PLAYING;
        this.score = 0;
        this.survivalTime = 0;
        this.moveInterval = CONFIG.initialSpeed;
        this.lastMoveTime = 0;

        // Reset game objects
        this.snake.reset();
        this.food.spawn(this.snake.getOccupiedCells());
        this.powerUpManager.reset();
        this.scoreManager.reset();
        this.ai.setDifficulty(this.difficulty);

        // Update UI
        this.ui.menu.classList.add('hidden');
        this.ui.gameOver.classList.add('hidden');
        this.ui.hud.classList.remove('hidden');
        this.updateHUD();

        if (spectator) {
            document.body.classList.add('spectator-mode');
        }

        this.audioManager.playBGM();
    }

    startSpectatorMode() {
        this.startGame(true);
    }

    togglePause() {
        if (this.state === GameState.PLAYING) {
            this.state = GameState.PAUSED;
            this.ui.pause.classList.remove('hidden');
            this.audioManager.pause();
        } else if (this.state === GameState.PAUSED) {
            this.state = GameState.PLAYING;
            this.ui.pause.classList.add('hidden');
            this.audioManager.resume();
        }
    }

    gameOver() {
        this.state = GameState.GAME_OVER;

        // Update final stats
        this.ui.finalScore.textContent = this.score;
        this.ui.finalLength.textContent = this.snake.length;
        this.ui.finalTime.textContent = this.formatTime(this.survivalTime);

        // Show game over screen
        this.ui.hud.classList.add('hidden');
        this.ui.gameOver.classList.remove('hidden');
        document.body.classList.remove('spectator-mode');

        // Effects
        this.particles.createDeathExplosion(this.snake.getHeadPosition());
        this.cameraController.shake(0.5);
        this.audioManager.playSound('death');
        this.audioManager.stopBGM();
    }

    restartGame() {
        this.startGame(this.spectatorMode);
    }

    showMenu() {
        this.state = GameState.MENU;
        this.ui.gameOver.classList.add('hidden');
        this.ui.hud.classList.add('hidden');
        this.ui.menu.classList.remove('hidden');
        document.body.classList.remove('spectator-mode');
    }

    toggleCameraMode() {
        this.cameraController.toggleMode();
    }

    toggleSound() {
        const btn = document.getElementById('sound-btn');
        const muted = this.audioManager.toggleMute();
        btn.textContent = muted ? '🔇' : '🔊';
    }

    update(deltaTime, elapsedTime) {
        if (this.state !== GameState.PLAYING) return;

        this.survivalTime += deltaTime;

        // Check if it's time to move
        if (elapsedTime - this.lastMoveTime >= this.moveInterval) {
            this.lastMoveTime = elapsedTime;

            // Get AI decision
            const direction = this.ai.getNextDirection(
                this.snake.getHeadPosition(),
                this.snake.getDirection(),
                this.snake.getOccupiedCells(),
                this.food.getPosition(),
                this.powerUpManager.getActivePowerUps()
            );

            // Move snake
            const moveResult = this.snake.move(direction);

            // Check collision
            if (moveResult.collision) {
                if (!this.powerUpManager.hasActivePowerUp('phase')) {
                    this.gameOver();
                    return;
                }
            }

            // Check food collection
            const headPos = this.snake.getHeadPosition();
            if (this.food.checkCollision(headPos)) {
                this.snake.grow();
                this.addScore(CONFIG.pointsPerFood); // 100 points per food
                this.particles.createCollectionEffect(headPos);
                this.audioManager.playSound('collect');

                // Spawn new food
                this.food.spawn(this.snake.getOccupiedCells());

                // Speed up slightly
                this.moveInterval = Math.max(CONFIG.minSpeed, this.moveInterval - CONFIG.speedIncrement);

                // Power-ups disabled for cleaner gameplay
                // if (Math.random() < 0.15) {
                //     this.powerUpManager.spawnPowerUp(this.snake.getOccupiedCells());
                // }
            }

            // Check power-up collection
            const collectedPowerUp = this.powerUpManager.checkCollision(headPos);
            if (collectedPowerUp) {
                this.activatePowerUp(collectedPowerUp);
            }
        }

        // Update systems
        this.snake.update(deltaTime);
        this.food.update(deltaTime);
        this.powerUpManager.update(deltaTime);
        this.particles.update(deltaTime);
        this.cameraController.update(deltaTime, this.snake.getHeadPosition());
        this.audioManager.updateIntensity(this.score);

        // Note: Removed slow-mo effect as it caused accumulating slowdown

        this.updateHUD();
    }

    addScore(points) {
        const multiplier = this.scoreManager.getMultiplier();
        this.score += Math.floor(points * multiplier);
        this.scoreManager.addCombo();

        // Update combo display
        if (multiplier > 1) {
            this.ui.combo.textContent = `x${multiplier}`;
            this.ui.combo.classList.remove('hidden');
        }
    }

    activatePowerUp(type) {
        this.powerUpManager.activate(type);
        this.addScore(25);
        this.audioManager.playSound('powerup');

        // Apply effects based on type
        switch (type) {
            case 'timeSlow':
                this.moveInterval *= 2;
                break;
            case 'turbo':
                this.moveInterval *= 0.5;
                break;
            case 'magnet':
                this.food.setMagnetMode(true, this.snake.getHeadPosition());
                break;
        }

        this.updatePowerUpUI();
    }

    updateHUD() {
        this.ui.score.textContent = this.score;
        this.ui.length.textContent = this.snake.length;
        this.ui.time.textContent = this.formatTime(this.survivalTime);

        // Update combo visibility
        if (this.scoreManager.getMultiplier() <= 1) {
            this.ui.combo.classList.add('hidden');
        }
    }

    updatePowerUpUI() {
        const container = document.getElementById('powerup-container');
        container.innerHTML = '';

        const activePowerUps = this.powerUpManager.getActivePowerUps();
        activePowerUps.forEach(pu => {
            const item = document.createElement('div');
            item.className = 'powerup-item';
            item.innerHTML = `
                <span class="powerup-icon">${this.getPowerUpIcon(pu.type)}</span>
                <div class="powerup-bar">
                    <div class="powerup-fill" style="width: ${pu.remainingPercent}%"></div>
                </div>
            `;
            container.appendChild(item);
        });
    }

    getPowerUpIcon(type) {
        const icons = {
            timeSlow: '⏱️',
            phase: '👻',
            magnet: '🧲',
            turbo: '⚡'
        };
        return icons[type] || '✨';
    }

    updateAIModeDisplay() {
        const modeNames = {
            beginner: 'BEGINNER AI',
            pro: 'PRO AI',
            godmode: 'GOD MODE AI'
        };
        this.ui.aiMode.textContent = modeNames[this.difficulty];
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
    }

    animate() {
        const clock = new THREE.Clock();

        const loop = () => {
            requestAnimationFrame(loop);

            const deltaTime = clock.getDelta();
            const elapsedTime = clock.getElapsedTime();

            this.update(deltaTime, elapsedTime);

            // Render
            this.arena.update(elapsedTime);
            this.composer.render();
        };

        loop();
    }
}

// Start the game
window.addEventListener('DOMContentLoaded', () => {
    new SnakeArcade();
});
