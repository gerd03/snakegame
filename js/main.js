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
import { Bomb } from './Bomb.js';
import { supabase } from './supabase.js';

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
        this.difficulty = 'normal';
        this.spectatorMode = false;
        this.score = 0;
        this.survivalTime = 0;
        this.lastMoveTime = 0;
        this.moveInterval = CONFIG.initialSpeed;

        // Manual control
        this.manualDirection = null;
        this.aiEnabled = false; // AI starts OFF - manual mode by default
        this.cheatBuffer = ''; // Buffer for hidden CHEAT code

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
            auth: document.getElementById('auth-screen'),
            menu: document.getElementById('main-menu'),
            hud: document.getElementById('game-hud'),
            gameOver: document.getElementById('game-over'),
            pause: document.getElementById('pause-screen'),
            score: document.getElementById('score-value'),
            length: document.getElementById('length-value'),
            time: document.getElementById('time-value'),
            comboHud: document.getElementById('combo-hud'),
            comboText: document.getElementById('combo-text'),
            comboMultiplier: document.getElementById('combo-multiplier'),
            comboTimer: document.getElementById('combo-timer-bar'),
            aiMode: document.getElementById('ai-mode'),
            finalScore: document.getElementById('final-score'),
            finalLength: document.getElementById('final-length'),
            finalTime: document.getElementById('final-time'),
            leaderboard: document.getElementById('leaderboard-modal')
        };

        this.init();
    }

    async init() {
        await this.setupThreeJS();
        await this.setupPostProcessing();
        await this.createGameObjects();
        this.setupEventListeners();
        this.setupAuthListeners();
        this.setupLiveLeaderboard();
        this.setupChat();
        this.hideLoading();
        this.animate();
    }

    async setupThreeJS() {
        // Scene - bright sky background for Google Snake style
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);  // Light sky blue

        // Camera - centered top-down view
        this.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        // Position camera directly above center, looking down at arena
        // Since we use a fixed 1:1 aspect ratio canvas, camera height is constant
        const cameraHeight = 35;

        // Position camera directly above center
        this.camera.position.set(0, cameraHeight, 0.1);
        this.camera.lookAt(0, 0, 0);

        // Renderer - Fixed 1:1 aspect ratio for proper game board display
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance'
        });

        // Calculate available space for game canvas
        // Account for HUD (50px top) and controls (140px bottom on mobile)
        const isMobile = window.innerWidth <= 768;
        const hudHeight = 50;
        const controlsHeight = isMobile ? 140 : 0;
        const padding = 10;

        const availableWidth = window.innerWidth - (padding * 2);
        const availableHeight = window.innerHeight - hudHeight - controlsHeight - (padding * 2);

        // Use smaller dimension to maintain 1:1 square aspect ratio
        const gameSize = Math.min(availableWidth, availableHeight);

        this.renderer.setSize(gameSize, gameSize);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        // Shadows disabled for better performance
        this.renderer.shadowMap.enabled = false;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // Fixed 1:1 camera aspect for square canvas
        this.camera.aspect = 1;
        this.camera.updateProjectionMatrix();

        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Bright ambient lighting for Google Snake style
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
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

        // Soft fill light from opposite side
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
        fillLight.position.set(-10, 20, -10);
        this.scene.add(fillLight);
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

        // Bomb Hazard
        this.bomb = new Bomb(this.scene, CONFIG.gridSize, CONFIG.cellSize);
        this.bombSpawnTimer = 0;
        this.bombSpawnInterval = 8; // Spawn bomb every 8 seconds
    }

    hideLoading() {
        setTimeout(() => {
            this.ui.loading.classList.add('hidden');
            // Check if user is logged in
            if (supabase.isLoggedIn()) {
                this.ui.menu.classList.remove('hidden');
                this.state = GameState.MENU;
            } else {
                this.ui.auth.classList.remove('hidden');
            }
        }, 1500);
    }

    setupAuthListeners() {
        // Toggle between login and register forms
        document.getElementById('show-register')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('register-form').classList.remove('hidden');
        });

        document.getElementById('show-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
        });

        // Login button
        document.getElementById('login-btn')?.addEventListener('click', async () => {
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            const rememberMe = document.getElementById('remember-me')?.checked || false;
            const errorEl = document.getElementById('login-error');

            if (!username || !password) {
                errorEl.textContent = 'Please fill in all fields';
                errorEl.classList.remove('hidden');
                return;
            }

            try {
                await supabase.login(username, password, rememberMe);
                this.ui.auth.classList.add('hidden');
                this.ui.menu.classList.remove('hidden');
                this.state = GameState.MENU;
            } catch (err) {
                errorEl.textContent = err.message;
                errorEl.classList.remove('hidden');
            }
        });

        // Register button
        document.getElementById('register-btn')?.addEventListener('click', async () => {
            const displayName = document.getElementById('reg-displayname').value.trim();
            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value;
            const errorEl = document.getElementById('register-error');

            if (!displayName || !username || !password) {
                errorEl.textContent = 'Please fill in all fields';
                errorEl.classList.remove('hidden');
                return;
            }

            if (password.length < 4) {
                errorEl.textContent = 'Password must be at least 4 characters';
                errorEl.classList.remove('hidden');
                return;
            }

            try {
                await supabase.register(displayName, username, password);
                this.ui.auth.classList.add('hidden');
                this.ui.menu.classList.remove('hidden');
                this.state = GameState.MENU;
            } catch (err) {
                errorEl.textContent = err.message;
                errorEl.classList.remove('hidden');
            }
        });
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
                // Update leaderboard to show selected difficulty
                this.updateLiveLeaderboardTab(this.difficulty);
            });
        });

        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());
        document.getElementById('menu-btn').addEventListener('click', () => this.showMenu());
        document.getElementById('leaderboard-btn')?.addEventListener('click', () => this.showLeaderboard());
        document.getElementById('menu-skins-btn')?.addEventListener('click', () => {
            document.getElementById('skin-modal')?.classList.remove('hidden');
        });
        document.getElementById('menu-leaderboard-btn')?.addEventListener('click', () => this.showLeaderboard());

        const cameraBtn = document.getElementById('camera-btn');
        if (cameraBtn) cameraBtn.addEventListener('click', () => this.toggleCameraMode());

        document.getElementById('sound-btn').addEventListener('click', () => this.toggleSound());

        // Arrow button controls (mobile)
        document.getElementById('arrow-up').addEventListener('click', () => this.setDirection(0, -1));
        document.getElementById('arrow-down').addEventListener('click', () => this.setDirection(0, 1));
        document.getElementById('arrow-left').addEventListener('click', () => this.setDirection(-1, 0));
        document.getElementById('arrow-right').addEventListener('click', () => this.setDirection(1, 0));

        // Touch support for arrow buttons
        ['arrow-up', 'arrow-down', 'arrow-left', 'arrow-right'].forEach(id => {
            const btn = document.getElementById(id);
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                btn.click();
            });
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.togglePause();
            if (e.key === ' ' && this.state === GameState.MENU) this.startGame();

            // Arrow key controls
            if (this.state === GameState.PLAYING) {
                switch (e.key) {
                    case 'ArrowUp': this.setDirection(0, -1); break;
                    case 'ArrowDown': this.setDirection(0, 1); break;
                    case 'ArrowLeft': this.setDirection(-1, 0); break;
                    case 'ArrowRight': this.setDirection(1, 0); break;
                }
            }

            // Hidden CHEAT code detection
            if (e.key && e.key.length === 1) {
                this.cheatBuffer += e.key.toUpperCase();
                if (this.cheatBuffer.length > 5) {
                    this.cheatBuffer = this.cheatBuffer.slice(-5);
                }
                if (this.cheatBuffer === 'CHEAT') {
                    this.activateCheat();
                }
            }
        });

        // Mobile menu button
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => this.showMenu());
        }

        // Skin button and modal
        const skinBtn = document.getElementById('skin-btn');
        const skinModal = document.getElementById('skin-modal');
        const closeSkinModal = document.getElementById('close-skin-modal');

        if (skinBtn && skinModal) {
            skinBtn.addEventListener('click', () => {
                this.togglePause(); // Pause game while selecting skin
                skinModal.classList.remove('hidden');
            });
        }

        if (closeSkinModal && skinModal) {
            closeSkinModal.addEventListener('click', () => {
                skinModal.classList.add('hidden');
                if (this.state === GameState.PAUSED) this.togglePause();
            });
        }

        // Skin options
        document.querySelectorAll('.skin-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const skin = e.target.dataset.skin;
                this.changeSkin(skin);
                document.querySelectorAll('.skin-option').forEach(b => b.classList.remove('selected'));
                e.target.classList.add('selected');
            });
        });

        // Auth form event listeners
        this.setupAuthListeners();

        // Leaderboard event listeners
        this.setupLeaderboardListeners();
    }

    setupAuthListeners() {
        // Toggle between login and register forms
        document.getElementById('show-register')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('register-form').classList.remove('hidden');
        });

        document.getElementById('show-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
        });

        // Login button
        document.getElementById('login-btn')?.addEventListener('click', async () => {
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            const rememberMe = document.getElementById('remember-me').checked;
            const errorEl = document.getElementById('login-error');

            if (!username || !password) {
                errorEl.textContent = 'Please fill in all fields';
                errorEl.classList.remove('hidden');
                return;
            }

            try {
                await supabase.login(username, password, rememberMe);
                this.ui.auth.classList.add('hidden');
                this.ui.menu.classList.remove('hidden');
                this.state = GameState.MENU;
            } catch (err) {
                errorEl.textContent = err.message;
                errorEl.classList.remove('hidden');
            }
        });

        // Register button
        document.getElementById('register-btn')?.addEventListener('click', async () => {
            const displayName = document.getElementById('reg-display').value.trim();
            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value;
            const errorEl = document.getElementById('register-error');

            if (!displayName || !username || !password) {
                errorEl.textContent = 'Please fill in all fields';
                errorEl.classList.remove('hidden');
                return;
            }

            if (password.length < 4) {
                errorEl.textContent = 'Password must be at least 4 characters';
                errorEl.classList.remove('hidden');
                return;
            }

            try {
                await supabase.register(displayName, username, password);
                this.ui.auth.classList.add('hidden');
                this.ui.menu.classList.remove('hidden');
                this.state = GameState.MENU;
            } catch (err) {
                errorEl.textContent = err.message;
                errorEl.classList.remove('hidden');
            }
        });
    }

    setupLeaderboardListeners() {
        // Tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;

                // Update active tab
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // Show corresponding list
                document.querySelectorAll('.leaderboard-list').forEach(list => list.classList.add('hidden'));
                document.getElementById(`leaderboard-${tab}`).classList.remove('hidden');
            });
        });

        // Close leaderboard
        document.getElementById('close-leaderboard')?.addEventListener('click', () => {
            this.ui.leaderboard.classList.add('hidden');
        });
    }

    async showLeaderboard() {
        this.ui.leaderboard.classList.remove('hidden');

        try {
            const leaderboards = await supabase.getAllLeaderboards();

            ['easy', 'normal', 'hard'].forEach(difficulty => {
                const listEl = document.getElementById(`leaderboard-${difficulty}`);
                const scores = leaderboards[difficulty];

                if (scores.length === 0) {
                    listEl.innerHTML = '<div class="no-scores">No scores yet!</div>';
                } else {
                    listEl.innerHTML = scores.map((score, index) => `
                        <div class="leaderboard-item">
                            <span class="rank rank-${index + 1}">#${index + 1}</span>
                            <span class="player-name">${score.display_name}</span>
                            <span class="player-score">${score.score.toLocaleString()}</span>
                        </div>
                    `).join('');
                }
            });
        } catch (err) {
            console.error('Failed to load leaderboard:', err);
        }
    }

    setupLiveLeaderboard() {
        this.currentLbDifficulty = this.difficulty || 'normal';

        // Minimize button handler
        const minimizeBtn = document.getElementById('lb-minimize');
        const leaderboardEl = document.getElementById('live-leaderboard');

        if (minimizeBtn && leaderboardEl) {
            minimizeBtn.addEventListener('click', () => {
                leaderboardEl.classList.toggle('lb-minimized');
            });
        }

        // Tab click handlers
        document.querySelectorAll('.lb-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                // Update active tab
                document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');

                // Load leaderboard for this difficulty
                this.currentLbDifficulty = e.target.dataset.diff;
                this.loadLiveLeaderboard(this.currentLbDifficulty);
            });
        });

        // Initial load with current game difficulty
        this.updateLiveLeaderboardTab(this.difficulty || 'normal');
    }

    updateLiveLeaderboardTab(difficulty) {
        // Update tab visual state
        document.querySelectorAll('.lb-tab').forEach(t => {
            t.classList.remove('active');
            if (t.dataset.diff === difficulty) {
                t.classList.add('active');
            }
        });

        this.currentLbDifficulty = difficulty;
        this.loadLiveLeaderboard(difficulty);
    }

    async loadLiveLeaderboard(difficulty = 'easy') {
        const listEl = document.getElementById('lb-list');
        if (!listEl) return;

        listEl.innerHTML = '<div class="lb-loading">Loading...</div>';

        try {
            console.log('[DEBUG] Loading leaderboard for difficulty:', difficulty);
            const scores = await supabase.getLeaderboard(difficulty);
            console.log('[DEBUG] Scores fetched:', scores);

            if (scores.length === 0) {
                listEl.innerHTML = '<div class="lb-empty">No scores yet!</div>';
            } else {
                // Limit to top 3 for compact display
                listEl.innerHTML = scores.slice(0, 3).map((score, index) => `
                    <div class="lb-item">
                        <span class="lb-rank lb-rank-${index + 1}">${index + 1}</span>
                        <span class="lb-name">${score.display_name}</span>
                        <span class="lb-score">${score.score.toLocaleString()}</span>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.error('Failed to load live leaderboard:', err);
            listEl.innerHTML = '<div class="lb-empty">Error loading</div>';
        }
    }

    setupChat() {
        const chatPanel = document.getElementById('chat-panel');
        const chatInput = document.getElementById('chat-input');
        const chatSend = document.getElementById('chat-send');
        const chatClose = document.getElementById('chat-close');

        if (!chatInput || !chatSend) return;

        // Close button minimizes to chat head
        if (chatClose) {
            chatClose.addEventListener('click', (e) => {
                e.stopPropagation();
                chatPanel.classList.add('chat-minimized');
            });
        }

        // Clicking minimized chat expands it
        chatPanel.addEventListener('click', (e) => {
            if (chatPanel.classList.contains('chat-minimized')) {
                chatPanel.classList.remove('chat-minimized');
            }
        });


        // Send message
        const sendMessage = async () => {
            const message = chatInput.value.trim();
            console.log('[CHAT] Attempting to send:', message);
            console.log('[CHAT] Is logged in:', supabase.isLoggedIn());

            if (!message) {
                console.log('[CHAT] Message is empty');
                return;
            }

            if (!supabase.isLoggedIn()) {
                console.log('[CHAT] Not logged in - cannot send message');
                return;
            }

            try {
                console.log('[CHAT] Sending message...');
                await supabase.sendMessage(message);
                console.log('[CHAT] Message sent successfully!');
                chatInput.value = '';
                await this.loadChatMessages();
            } catch (err) {
                console.error('[CHAT] Failed to send message:', err);
            }
        };

        chatSend.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // Poll for new messages every 3 seconds (only when logged in)
        this.chatPollInterval = setInterval(() => {
            if (supabase.isLoggedIn()) {
                this.loadChatMessages();
            }
        }, 3000);

        // Update online count every 5 seconds (only when logged in)
        this.onlinePollInterval = setInterval(() => {
            if (supabase.isLoggedIn()) {
                this.updateOnlineCount();
            }
        }, 5000);

        // Send activity heartbeat every 30 seconds
        this.activityInterval = setInterval(() => {
            if (supabase.isLoggedIn()) {
                supabase.updateActivity();
            }
        }, 30000);

        // Initial updates (only if logged in)
        if (supabase.isLoggedIn()) {
            this.loadChatMessages();
            this.updateOnlineCount();
            supabase.updateActivity();
        }
    }

    async loadChatMessages() {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        try {
            const messages = await supabase.getMessages();

            chatMessages.innerHTML = messages.map(msg => `
                <div class="chat-message">
                    <span class="chat-user">${msg.display_name}:</span>
                    <span class="chat-text">${msg.message}</span>
                </div>
            `).join('');

            // Auto-scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } catch (err) {
            console.error('Failed to load messages:', err);
        }
    }

    async updateOnlineCount() {
        const onlineCountEl = document.getElementById('online-count');
        if (!onlineCountEl) return;

        try {
            const count = await supabase.getOnlineCount();
            onlineCountEl.textContent = `🟢 ${count} online`;
        } catch (err) {
            console.error('Failed to update online count:', err);
        }
    }

    setDirection(x, z) {
        if (this.state !== GameState.PLAYING) return;
        // Only set if not opposite direction
        const current = this.snake.direction;
        if (current.x === -x && current.z === -z) return;
        this.manualDirection = { x, z };
    }

    activateCheat() {
        this.aiEnabled = !this.aiEnabled;
        this.cheatBuffer = '';
        // Cheat is completely hidden - no indicator
    }

    changeSkin(skinName) {
        // Skin definitions with color and pattern
        const skins = {
            blue: { color: 0x4169E1, pattern: 'none' },
            green: { color: 0x32CD32, pattern: 'circle' },
            red: { color: 0xDC143C, pattern: 'heart' },
            gold: { color: 0xFFD700, pattern: 'star' },
            purple: { color: 0x9932CC, pattern: 'diamond' },
            diamond: { color: 0x00FFFF, pattern: 'diamond' }
        };

        const skin = skins[skinName] || skins.blue;
        if (this.snake) {
            this.snake.setSkin(skin.color, skin.pattern);
        }
    }

    hideLoading() {
        setTimeout(() => {
            this.ui.loading.classList.add('hidden');
            // Check if user is logged in
            if (supabase.isLoggedIn()) {
                this.ui.menu.classList.remove('hidden');
                this.state = GameState.MENU;
            } else {
                this.ui.auth.classList.remove('hidden');
            }
        }, 2500);
    }

    startGame(spectator = false) {
        this.spectatorMode = spectator;
        this.state = GameState.PLAYING;
        this.score = 0;
        this.survivalTime = 0;

        // Speed based on difficulty: Easy=slow, Normal=medium, Hard=insane
        const difficultySpeed = {
            beginner: 0.15,  // Slow - easier to control
            pro: 0.08,       // Normal - balanced gameplay
            godmode: 0.04    // Insane fast - challenging!
        };
        this.moveInterval = difficultySpeed[this.difficulty] || CONFIG.initialSpeed;
        this.lastMoveTime = 0;

        // Reset game objects
        this.snake.reset();
        this.food.spawn(this.snake.getOccupiedCells());
        this.powerUpManager.reset();
        this.scoreManager.reset();
        this.ai.setDifficulty(this.difficulty);

        // Reset bomb
        this.bomb.deactivate();
        this.bombSpawnTimer = 0;

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

        // Submit score to leaderboard
        this.submitScore();
    }

    async submitScore() {
        console.log('[DEBUG] submitScore called');
        console.log('[DEBUG] isLoggedIn:', supabase.isLoggedIn());
        console.log('[DEBUG] currentUser:', supabase.getUser());
        console.log('[DEBUG] score:', this.score, 'difficulty:', this.difficulty);

        if (!supabase.isLoggedIn()) {
            console.log('[DEBUG] Not logged in, skipping score submit');
            return;
        }

        try {
            console.log('[DEBUG] Submitting score to Supabase...');
            const isHighScore = await supabase.submitScore(this.score, this.difficulty);
            console.log('[DEBUG] Score submitted! isHighScore:', isHighScore);
            if (isHighScore) {
                console.log('New personal best!');
            }
            // Refresh the live leaderboard to show updated scores for this difficulty
            this.updateLiveLeaderboardTab(this.difficulty);
        } catch (err) {
            console.error('[DEBUG] Failed to submit score:', err);
        }
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

        // Update bomb timer
        this.bombSpawnTimer += deltaTime;

        // Spawn bomb periodically
        if (this.bombSpawnTimer >= this.bombSpawnInterval && !this.bomb.isActive()) {
            this.bomb.spawn(this.snake.getOccupiedCells(), this.food.getPosition());
            this.bombSpawnTimer = 0;
        }

        // Update bomb and check explosion
        if (this.bomb.isActive()) {
            const exploded = this.bomb.update(deltaTime);

            // Check if snake head is in blast radius when bomb explodes
            if (exploded) {
                // Play explosion sound
                this.audioManager.playSound('explosion');

                const headPos = this.snake.getHeadPosition();
                if (this.bomb.checkCollision(headPos)) {
                    this.gameOver();
                    return;
                }
            }

            // Tell AI about bomb danger zones
            this.ai.setBombDangerZones(this.bomb.getDangerZone());
        } else {
            this.ai.setBombDangerZones([]);
        }

        // Check if it's time to move
        if (elapsedTime - this.lastMoveTime >= this.moveInterval) {
            this.lastMoveTime = elapsedTime;

            // Check if snake is too close to active bomb
            if (this.bomb.isActive()) {
                const headPos = this.snake.getHeadPosition();
                const bombPos = this.bomb.getPosition();
                if (bombPos) {
                    const dist = Math.abs(headPos.gridX - bombPos.x) + Math.abs(headPos.gridZ - bombPos.z);
                    // If bomb is about to explode and snake is nearby, death
                    if (this.bomb.getTimeRemaining() < 0.1 && dist <= 1) {
                        this.gameOver();
                        return;
                    }
                }
            }

            // Get direction - manual or AI
            let direction;
            if (this.aiEnabled) {
                // AI autopilot (cheat mode)
                direction = this.ai.getNextDirection(
                    this.snake.getHeadPosition(),
                    this.snake.getDirection(),
                    this.snake.getOccupiedCells(),
                    this.food.getPosition(),
                    this.powerUpManager.getActivePowerUps()
                );
            } else if (this.manualDirection) {
                // Manual control
                direction = this.manualDirection;
            } else {
                // Keep current direction
                direction = this.snake.getDirection();
            }

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
        this.scoreManager.update(deltaTime);
        this.powerUpManager.update(deltaTime);
        this.particles.update(deltaTime);
        this.cameraController.update(deltaTime, this.snake.getHeadPosition());
        this.audioManager.updateIntensity(this.score);

        this.updateHUD();
    }

    addScore(points) {
        const multiplier = this.scoreManager.getMultiplier();
        this.score += Math.floor(points * multiplier);
        this.scoreManager.addCombo();

        // Visual feedback for point gain
        const comboData = this.scoreManager.getComboData();
        if (comboData) {
            this.ui.comboHud.classList.remove('hidden');
            this.ui.comboHud.classList.remove('combo-pop');
            void this.ui.comboHud.offsetWidth; // Trigger reflow
            this.ui.comboHud.classList.add('combo-pop');
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
        this.ui.score.textContent = this.score.toLocaleString();
        this.ui.length.textContent = this.snake.length;
        this.ui.time.textContent = this.formatTime(this.survivalTime);

        // Update Combo HUD
        const comboData = this.scoreManager.getComboData();
        if (comboData) {
            this.ui.comboHud.classList.remove('hidden');
            this.ui.comboText.textContent = comboData.label;
            this.ui.comboMultiplier.textContent = `x${comboData.multiplier}`;
            this.ui.comboTimer.style.width = `${comboData.progress * 100}%`;

            // Apply colors and extra effects
            this.ui.comboText.style.color = comboData.color;
            this.ui.comboMultiplier.style.color = comboData.color;
            this.ui.comboTimer.style.background = comboData.color;
            this.ui.comboTimer.style.boxShadow = `0 0 10px ${comboData.color}`;

            // Add shake for high combos
            if (comboData.multiplier >= 5) {
                this.ui.comboHud.classList.add('combo-shake');
                this.ui.comboHud.classList.add('combo-glow');
            } else {
                this.ui.comboHud.classList.remove('combo-shake');
                this.ui.comboHud.classList.remove('combo-glow');
            }
        } else {
            this.ui.comboHud.classList.add('hidden');
            this.ui.comboHud.classList.remove('combo-shake');
            this.ui.comboHud.classList.remove('combo-glow');
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
        if (!this.ui.aiMode) return; // Element was removed
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
        // Recalculate game size maintaining 1:1 aspect ratio
        const isMobile = window.innerWidth <= 768;
        const hudHeight = 50;
        const controlsHeight = isMobile ? 140 : 0;
        const padding = 10;

        const availableWidth = window.innerWidth - (padding * 2);
        const availableHeight = window.innerHeight - hudHeight - controlsHeight - (padding * 2);

        // Use smaller dimension for square aspect ratio
        const gameSize = Math.min(availableWidth, availableHeight);

        // Keep fixed 1:1 aspect
        this.camera.aspect = 1;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(gameSize, gameSize);
        this.composer.setSize(gameSize, gameSize);
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
