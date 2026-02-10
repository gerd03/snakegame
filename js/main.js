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
import { GridBounds } from './core/GridBounds.js';

// Game Configuration
const CONFIG = {
    gridWidth: 20,
    gridHeight: 20,
    cellSize: 1,
    initialSpeed: 0.08, // Fast snake for high scores
    minSpeed: 0.03,     // Even faster at max speed
    speedIncrement: 0.001,
    pointsPerFood: 100, // Higher points to reach 100,000+
    fruitBurst: {
        fiveFruitChance: 0.2,
        tenFruitChance: 0.08,
        maxFruitsPerBatch: 20
    },
    hudUpdateInterval: 0.1,
    aiNoPathAssistThreshold: 20,
    aiStallGrowthInterval: 16
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
        this.gridBounds = new GridBounds({
            width: CONFIG.gridWidth,
            height: CONFIG.gridHeight,
            cellSize: CONFIG.cellSize,
            minX: -10,
            minZ: -10
        });

        // Load difficulty-specific highscores
        this.highscores = JSON.parse(localStorage.getItem('snakeHighscores') || '{}');
        this.highscore = this.highscores[this.difficulty] || 0;

        this.survivalTime = 0;
        this.lastMoveTime = 0;
        this.moveInterval = CONFIG.initialSpeed;
        this.hudRefreshTimer = 0;
        this.lastComboBurstLabel = null;
        this.manualBombQueue = 0;
        this.forcedBombMode = false;
        this.aiNoFoodPathTicks = 0;
        this.aiStepsWithoutFood = 0;

        // Manual control
        this.manualDirection = null;
        this.aiEnabled = false; // AI starts OFF - manual mode by default
        this.cheatBuffer = ''; // Buffer for hidden CHEAT code
        this.mobileDifficultyTapCount = 0;
        this.mobileDifficultyTapLastAt = 0;
        this.mobileDifficultyTapWindowMs = 1600;

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
            gameOverTitle: document.querySelector('#game-over .game-over-title'),
            pause: document.getElementById('pause-screen'),
            score: document.getElementById('score-value'),
            length: document.getElementById('length-value'),
            time: document.getElementById('time-value'),
            comboHud: document.getElementById('combo-hud'),
            comboText: document.getElementById('combo-text'),
            comboMultiplier: document.getElementById('combo-multiplier'),
            comboTimer: document.getElementById('combo-timer-bar'),
            highscore: document.getElementById('highscore-value'),
            profileBtn: document.getElementById('logout-profile-btn'),
            profileInitial: document.getElementById('profile-initial'),
            aiMode: document.getElementById('ai-mode'),
            finalScore: document.getElementById('final-score'),
            finalLength: document.getElementById('final-length'),
            finalTime: document.getElementById('final-time'),
            leaderboard: document.getElementById('leaderboard-modal')
        };

        this.directionButtons = {
            up: document.getElementById('arrow-up'),
            down: document.getElementById('arrow-down'),
            left: document.getElementById('arrow-left'),
            right: document.getElementById('arrow-right')
        };

        this.lastChatCount = 0; // Track message count for auto-open
        this.chatUnreadCount = 0;
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
        // Scene - truly transparent to show CSS image
        this.scene = new THREE.Scene();
        this.scene.background = null;
        const isMobile = window.innerWidth <= 768;

        // Camera - centered top-down view
        this.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        // Position camera directly above center, looking down at arena
        // Since we use a fixed 1:1 aspect ratio canvas, camera height is constant
        const cameraHeight = this.getTopDownCameraHeight(isMobile);

        // Position camera directly above center
        this.camera.position.set(0, cameraHeight, 0.1);
        this.camera.lookAt(0, 0, 0);

        // Renderer - transparent to show body background
        this.renderer = new THREE.WebGLRenderer({
            antialias: !isMobile,
            alpha: true, // Enable transparency
            powerPreference: 'high-performance',
            premultipliedAlpha: false
        });
        this.renderer.setClearColor(0x000000, 0); // Fully transparent black
        this.renderer.setClearAlpha(0); // Explicitly set alpha to 0

        // Calculate available space for game canvas
        const { hudHeight, controlsHeight, padding } = this.getViewportLayout(isMobile);

        const availableWidth = window.innerWidth - (padding * 2);
        const availableHeight = window.innerHeight - hudHeight - controlsHeight - (padding * 2);

        // Use smaller dimension to maintain 1:1 square aspect ratio
        const gameSize = Math.min(availableWidth, availableHeight);

        this.renderer.setSize(gameSize, gameSize);
        this.renderer.setPixelRatio(this.getTargetPixelRatio(isMobile));
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
        // Create a render target with alpha support
        const renderTarget = new THREE.WebGLRenderTarget(
            this.renderer.domElement.width,
            this.renderer.domElement.height,
            {
                format: THREE.RGBAFormat
            }
        );
        this.composer = new EffectComposer(this.renderer, renderTarget);

        const renderPass = new RenderPass(this.scene, this.camera);
        // Ensure RenderPass doesn't clear to an opaque color
        renderPass.clearAlpha = 0;
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
        this.arena = new Arena(this.scene, this.gridBounds);

        // Snake
        this.snake = new Snake(this.scene, this.gridBounds);

        // Food
        this.food = new Food(this.scene, this.gridBounds, CONFIG.fruitBurst);
        this.food.spawn(this.snake.getOccupiedCells());

        // Particle System
        this.particles = new ParticleSystem(this.scene);

        // AI Controller
        this.ai = new AIController(this.gridBounds, this.difficulty);

        // Camera Controller
        this.cameraController = new CameraController(this.camera, this.snake);
        this.applyCameraFraming(window.innerWidth <= 768);

        // Power-up Manager
        this.powerUpManager = new PowerUpManager(this.scene, this.gridBounds);

        // Score Manager
        this.scoreManager = new ScoreManager();

        // Audio Manager
        this.audioManager = new AudioManager();

        // Bomb Hazard
        this.bomb = new Bomb(this.scene, this.gridBounds);
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
                this.updatePromoVisibility();
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
                this.updatePromoVisibility();
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
                // Sync local highscore for selected difficulty
                this.highscore = this.highscores[this.difficulty] || 0;
                this.updateAIModeDisplay();
                // Update leaderboard to show selected difficulty
                this.updateLiveLeaderboardTab(this.difficulty);
                this.handleMobileDifficultyTap();
            });
        });

        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());
        document.getElementById('menu-btn').addEventListener('click', () => this.showMenu());
        document.getElementById('leaderboard-btn')?.addEventListener('click', () => this.showLeaderboard());
        document.getElementById('logout-profile-btn')?.addEventListener('click', () => this.logoutProfile());
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
            if (this.handleHiddenHotkeys(e)) return;

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
                const button = e.currentTarget;
                const skin = button?.dataset?.skin;
                this.changeSkin(skin);
                document.querySelectorAll('.skin-option').forEach(b => b.classList.remove('selected'));
                button.classList.add('selected');
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
                this.updatePromoVisibility();
                this.updateProfileButton();
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
                this.updatePromoVisibility();
                this.updateProfileButton();
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
        this.updateLiveLeaderboardTab(this.difficulty);
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
                // Expanded to Top 25
                const topScores = scores.slice(0, 25);
                listEl.innerHTML = topScores.map((score, index) => `
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
        const chatDock = document.getElementById('hud-header-right');

        if (!chatPanel || !chatInput || !chatSend) return;

        if (chatDock && chatPanel.parentElement !== chatDock) {
            chatDock.appendChild(chatPanel);
        }

        let unreadBadge = document.getElementById('chat-unread-badge');
        if (!unreadBadge) {
            unreadBadge = document.createElement('span');
            unreadBadge.id = 'chat-unread-badge';
            unreadBadge.className = 'chat-unread-badge hidden';
            chatPanel.appendChild(unreadBadge);
        }

        this.updateChatUnreadBadge = () => {
            if (!unreadBadge) return;
            if (this.chatUnreadCount > 0) {
                unreadBadge.textContent = this.chatUnreadCount > 99 ? '99+' : `${this.chatUnreadCount}`;
                unreadBadge.classList.remove('hidden');
            } else {
                unreadBadge.classList.add('hidden');
            }
        };
        this.updateChatUnreadBadge();

        // Close button minimizes to chat head
        if (chatClose) {
            chatClose.addEventListener('click', (e) => {
                e.stopPropagation();
                chatPanel.classList.add('chat-minimized');
                this.applyOverlayUX({ forceChatMinimized: true });
            });
        }

        // Clicking minimized chat expands it
        chatPanel.addEventListener('click', () => {
            if (chatPanel.classList.contains('chat-minimized')) {
                chatPanel.classList.remove('chat-minimized');
                this.chatUnreadCount = 0;
                this.updateChatUnreadBadge();
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
                this.chatUnreadCount = 0;
                this.updateChatUnreadBadge();
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

        // Auto-refresh leaderboard every 20 seconds
        this.lbRefreshInterval = setInterval(() => {
            this.loadLiveLeaderboard(this.currentLbDifficulty || this.difficulty);
        }, 20000);

        // Initial updates (only if logged in)
        if (supabase.isLoggedIn()) {
            this.loadChatMessages();
            this.updateOnlineCount();
            supabase.updateActivity();
        }
    }

    async loadChatMessages() {
        const chatMessages = document.getElementById('chat-messages');
        const chatPanel = document.getElementById('chat-panel');
        if (!chatMessages) return;

        try {
            const messages = await supabase.getMessages();

            const incomingCount = Math.max(0, messages.length - this.lastChatCount);

            if (incomingCount > 0 && chatPanel) {
                const isGameplay = this.state === GameState.PLAYING;
                const isMobile = window.innerWidth <= 768;

                chatPanel.classList.remove('hidden');

                if (isGameplay || isMobile) {
                    this.chatUnreadCount += incomingCount;
                } else {
                    chatPanel.classList.remove('chat-minimized');
                    this.chatUnreadCount = 0;
                }
            }
            this.lastChatCount = messages.length;
            if (typeof this.updateChatUnreadBadge === 'function') {
                this.updateChatUnreadBadge();
            }

            chatMessages.innerHTML = messages.map(msg => `
                <div class="chat-message">
                    <span class="chat-user">${msg.display_name}:</span>
                    <span class="chat-text">${msg.message}</span>
                </div>
            `).join('');

            if (chatPanel && !chatPanel.classList.contains('chat-minimized')) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
                this.chatUnreadCount = 0;
                if (typeof this.updateChatUnreadBadge === 'function') {
                    this.updateChatUnreadBadge();
                }
            }
        } catch (err) {
            console.error('Failed to load messages:', err);
        }
    }

    async updateOnlineCount() {
        const onlineCountEl = document.getElementById('online-count');
        if (!onlineCountEl) return;

        try {
            const count = await supabase.getOnlineCount();
            onlineCountEl.textContent = `${count} online`;
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
        this.setDirectionIndicator(this.manualDirection);
    }

    handleHiddenHotkeys(e) {
        if (this.state !== GameState.PLAYING || e.repeat) return false;

        switch (e.key) {
            case '1':
                e.preventDefault();
                this.forceFruitBatch(5);
                return true;
            case '2':
                e.preventDefault();
                this.forceFruitBatch(10);
                return true;
            case '3':
                e.preventDefault();
                this.forceFruitBatch(20);
                return true;
            case '4':
                e.preventDefault();
                this.manualBombQueue += 5;
                this.forcedBombMode = true;
                return true;
            case '5':
                e.preventDefault();
                this.restartGame();
                return true;
            default:
                return false;
        }
    }

    getComboBurstFruitCount(label) {
        const burstByCombo = {
            'COMBOWHORE!': 5,
            'UNSTOPPABLE!': 10,
            'GODLIKE!': 20
        };
        return burstByCombo[label] || 0;
    }

    forceFruitBatch(count) {
        if (this.state !== GameState.PLAYING) return false;
        const spawned = this.food.spawn(this.snake.getOccupiedCells(), count);
        if (!spawned) {
            this.winGame();
            return false;
        }
        return true;
    }

    activateCheat() {
        this.cheatBuffer = '';
        this.toggleAutopilot('CHEAT');
    }

    toggleAutopilot(source = 'CHEAT') {
        this.aiEnabled = !this.aiEnabled;
        if (this.ai && typeof this.ai.resetState === 'function') {
            this.ai.resetState();
        }
        console.log(`[${source}] AI Autopilot:`, this.aiEnabled ? 'ENABLED' : 'DISABLED');
        this.updateAIModeDisplay();
    }

    handleMobileDifficultyTap() {
        if (window.innerWidth > 768) return;

        const now = performance.now();
        if (now - this.mobileDifficultyTapLastAt > this.mobileDifficultyTapWindowMs) {
            this.mobileDifficultyTapCount = 0;
        }

        this.mobileDifficultyTapLastAt = now;
        this.mobileDifficultyTapCount += 1;

        if (this.mobileDifficultyTapCount < 5) return;

        this.mobileDifficultyTapCount = 0;
        this.toggleAutopilot('MOBILE-5-TAP');
    }

    changeSkin(skinName) {
        // Skin definitions with color and pattern
        const skins = {
            blue: { color: 0x4169E1, pattern: 'none' },
            green: { color: 0x32CD32, pattern: 'circle' },
            red: { color: 0xDC143C, pattern: 'heart' },
            gold: { color: 0xFFD700, pattern: 'star' },
            purple: { color: 0x9932CC, pattern: 'diamond' },
            diamond: { color: 0x00FFFF, pattern: 'prisma' }
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
            this.updatePromoVisibility();
            this.updateProfileButton();

            const chatPanel = document.getElementById('chat-panel');
            if (chatPanel) {
                chatPanel.classList.remove('hidden');
                chatPanel.classList.add('chat-minimized');
            }

            this.applyOverlayUX({ forceChatMinimized: true });

            // Start playing menu music
            this.audioManager.playMenuMusic();
        }, 2500);
    }

    updatePromoVisibility() {
        const promoPanel = document.getElementById('promo-panel');
        if (!promoPanel) return;

        const isDesktop = window.innerWidth > 768;
        const isMenuState = this.state === GameState.MENU;
        const loadingDone = this.ui.loading?.classList.contains('hidden');
        const authHidden = this.ui.auth?.classList.contains('hidden');
        const shouldShow = isDesktop && isMenuState && loadingDone && authHidden;

        promoPanel.classList.toggle('hidden', !shouldShow);
    }

    updateProfileButton() {
        const profileBtn = this.ui.profileBtn;
        if (!profileBtn) return;

        const user = supabase.getUser();
        const isVisible = !!user && this.ui.auth?.classList.contains('hidden');
        profileBtn.classList.toggle('hidden', !isVisible);

        if (!isVisible) return;

        const name = (user.display_name || user.username || 'USER').trim();
        if (this.ui.profileInitial) {
            this.ui.profileInitial.textContent = name.charAt(0).toUpperCase();
        }
        profileBtn.title = `Log out (${name})`;
        profileBtn.setAttribute('aria-label', `Log out ${name}`);
    }

    logoutProfile() {
        supabase.logout();
        this.aiEnabled = false;
        this.cheatBuffer = '';
        this.manualDirection = null;
        this.clearDirectionIndicator();

        document.body.classList.remove('spectator-mode');
        this.ui.menu.classList.add('hidden');
        this.ui.hud.classList.add('hidden');
        this.ui.gameOver.classList.add('hidden');
        this.ui.pause.classList.add('hidden');
        this.ui.leaderboard?.classList.add('hidden');
        this.ui.auth.classList.remove('hidden');
        this.state = GameState.LOADING;

        const chatPanel = document.getElementById('chat-panel');
        if (chatPanel) {
            chatPanel.classList.add('hidden');
            chatPanel.classList.add('chat-minimized');
        }

        this.audioManager.stopBGM();
        this.audioManager.stopMenuMusic();
        this.updatePromoVisibility();
        this.updateProfileButton();
    }

    getDirectionButtonKey(direction) {
        if (!direction) return null;
        if (direction.x === 0 && direction.z === -1) return 'up';
        if (direction.x === 0 && direction.z === 1) return 'down';
        if (direction.x === -1 && direction.z === 0) return 'left';
        if (direction.x === 1 && direction.z === 0) return 'right';
        return null;
    }

    clearDirectionIndicator() {
        Object.values(this.directionButtons).forEach(btn => {
            if (btn) btn.classList.remove('direction-active');
        });
    }

    setDirectionIndicator(direction) {
        this.clearDirectionIndicator();
        const key = this.getDirectionButtonKey(direction);
        if (!key) return;

        const button = this.directionButtons[key];
        if (button) button.classList.add('direction-active');
    }

    applyOverlayUX(options = {}) {
        const { forceChatMinimized = false } = options;
        const chatPanel = document.getElementById('chat-panel');
        if (!chatPanel) return;

        const isMobile = window.innerWidth <= 768;
        const isGameState = this.state === GameState.PLAYING || this.state === GameState.PAUSED;
        const shouldMinimizeChat = forceChatMinimized || isMobile || isGameState;

        chatPanel.classList.toggle('chat-in-game', isMobile && isGameState);
        chatPanel.classList.toggle('chat-in-menu', isMobile && this.state === GameState.MENU);
        chatPanel.classList.add('chat-docked');

        if (shouldMinimizeChat) {
            chatPanel.classList.add('chat-minimized');
        }
    }

    startGame(spectator = false) {
        this.spectatorMode = spectator;
        this.state = GameState.PLAYING;
        this.score = 0;
        this.survivalTime = 0;
        if (this.ui.gameOverTitle) {
            this.ui.gameOverTitle.textContent = 'GAME OVER';
        }

        // Stop menu music and start gameplay music
        this.audioManager.stopMenuMusic();

        // Speed based on difficulty: Easy=slow, Normal=medium, Hard=insane
        const difficultySpeed = {
            easy: 0.15,
            normal: 0.08,
            hard: 0.04,
            beginner: 0.15,  // Legacy alias
            pro: 0.08,       // Legacy alias
            godmode: 0.04    // Legacy alias
        };
        this.moveInterval = difficultySpeed[this.difficulty] || CONFIG.initialSpeed;
        this.lastMoveTime = 0;
        this.hudRefreshTimer = CONFIG.hudUpdateInterval;
        this.lastComboBurstLabel = null;
        this.manualBombQueue = 0;
        this.forcedBombMode = false;
        this.aiNoFoodPathTicks = 0;
        this.aiStepsWithoutFood = 0;

        // Reset game objects
        this.snake.reset();
        this.food.spawn(this.snake.getOccupiedCells());
        this.powerUpManager.reset();
        this.scoreManager.reset();
        this.ai.setDifficulty(this.difficulty);
        if (this.ai && typeof this.ai.resetState === 'function') {
            this.ai.resetState();
        }

        // Reset bomb
        this.bomb.deactivate();
        this.bombSpawnTimer = 0;

        // Update UI
        this.ui.menu.classList.add('hidden');
        this.ui.gameOver.classList.add('hidden');
        this.ui.hud.classList.remove('hidden');
        this.updateHUD();
        this.applyOverlayUX({ forceChatMinimized: true });
        this.updatePromoVisibility();
        this.updateProfileButton();
        this.setDirectionIndicator(this.snake.getDirection());
        this.updateComboLayout();

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
            this.applyOverlayUX();
        } else if (this.state === GameState.PAUSED) {
            this.state = GameState.PLAYING;
            this.ui.pause.classList.add('hidden');
            this.audioManager.resume();
            this.applyOverlayUX({ forceChatMinimized: true });
        }
    }

    gameOver() {
        this.state = GameState.GAME_OVER;
        if (this.ui.gameOverTitle) {
            this.ui.gameOverTitle.textContent = 'GAME OVER';
        }

        // Update final stats
        this.ui.finalScore.textContent = this.score;
        this.ui.finalLength.textContent = this.snake.length;
        this.ui.finalTime.textContent = this.formatTime(this.survivalTime);

        // Show game over screen
        this.ui.hud.classList.add('hidden');
        this.ui.gameOver.classList.remove('hidden');
        document.body.classList.remove('spectator-mode');
        this.applyOverlayUX({ forceChatMinimized: true });
        this.updatePromoVisibility();
        this.updateProfileButton();
        this.clearDirectionIndicator();
        this.updateComboLayout();

        // Effects
        this.particles.createDeathExplosion(this.snake.getHeadPosition());
        this.cameraController.shake(0.5);
        this.audioManager.playSound('death');
        this.audioManager.stopBGM();
        this.audioManager.playMenuMusic(); // Play menu music on game over

        // Submit score to leaderboard
        this.submitScore();

        // Auto-restart if AI is enabled (Continuous Loop)
        if (this.aiEnabled) {
            console.log('[CHEAT] AI active, auto-restarting in 2s...');
            setTimeout(() => {
                if (this.state === GameState.GAME_OVER) {
                    this.restartGame();
                }
            }, 2000);
        }
    }

    winGame() {
        this.state = GameState.GAME_OVER;
        if (this.ui.gameOverTitle) {
            this.ui.gameOverTitle.textContent = 'YOU WIN';
        }

        this.ui.finalScore.textContent = this.score;
        this.ui.finalLength.textContent = this.snake.length;
        this.ui.finalTime.textContent = this.formatTime(this.survivalTime);

        this.ui.hud.classList.add('hidden');
        this.ui.gameOver.classList.remove('hidden');
        document.body.classList.remove('spectator-mode');
        this.applyOverlayUX({ forceChatMinimized: true });
        this.updatePromoVisibility();
        this.updateProfileButton();
        this.clearDirectionIndicator();
        this.updateComboLayout();

        this.audioManager.stopBGM();
        this.audioManager.playSound('collect');
        this.audioManager.playMenuMusic();

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
        this.applyOverlayUX({ forceChatMinimized: true });
        this.updatePromoVisibility();
        this.updateProfileButton();
        this.clearDirectionIndicator();
        this.updateComboLayout();
        this.audioManager.stopBGM();
        this.audioManager.playMenuMusic(); // Play menu music
    }

    toggleCameraMode() {
        this.cameraController.toggleMode();
    }
    toggleSound() {
        const btn = document.getElementById('sound-btn');
        const muted = this.audioManager.toggleMute();
        if (btn) {
            btn.classList.toggle('is-muted', muted);
            btn.title = muted ? 'Sound Off' : 'Sound On';
            btn.setAttribute('aria-label', muted ? 'Sound muted' : 'Sound on');
        }
    }

    update(deltaTime, elapsedTime) {
        if (this.state !== GameState.PLAYING) return;

        this.survivalTime += deltaTime;

        // Safety net: never allow a fruit-less board during active play.
        if (!this.food.hasFood()) {
            const head = this.snake.getHeadPosition();
            const recovered = this.food.spawnNear(this.snake.getOccupiedCells(), head, 1);
            if (!recovered) {
                this.winGame();
                return;
            }
        }

        if (this.aiEnabled) {
            const forcedBombsActive = this.forcedBombMode;

            // In autopilot mode, disable random hazards unless player explicitly spawned bombs.
            if (!forcedBombsActive) {
                if (this.bomb.isActive()) this.bomb.deactivate();
                this.ai.setBombDangerZones([]);
            } else {
                if (!this.bomb.isActive() && this.manualBombQueue > 0) {
                    this.bomb.spawn(this.snake.getOccupiedCells(), this.food.getPositions());
                    this.manualBombQueue--;
                }

                if (this.bomb.isActive()) {
                    const exploded = this.bomb.update(deltaTime);
                    if (exploded) {
                        this.audioManager.playSound('explosion');
                        const headPos = this.snake.getHeadPosition();
                        if (this.bomb.checkCollision(headPos)) {
                            this.gameOver();
                            return;
                        }
                    }
                    this.ai.setBombDangerZones(this.bomb.getDangerZone());
                } else {
                    this.ai.setBombDangerZones([]);
                }

                if (this.manualBombQueue <= 0 && !this.bomb.isActive()) {
                    this.forcedBombMode = false;
                }
            }
        } else {
            // Update bomb timer
            this.bombSpawnTimer += deltaTime;

            // Spawn bomb periodically
            if (this.bombSpawnTimer >= this.bombSpawnInterval && !this.bomb.isActive()) {
                this.bomb.spawn(this.snake.getOccupiedCells(), this.food.getPositions());
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

            // Hidden hotkey bomb wave: spawn queued bombs one-by-one as each bomb expires.
            if (!this.bomb.isActive() && this.manualBombQueue > 0) {
                this.bomb.spawn(this.snake.getOccupiedCells(), this.food.getPositions());
                this.manualBombQueue--;
            }

            if (this.manualBombQueue <= 0 && !this.bomb.isActive()) {
                this.forcedBombMode = false;
            }
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
                const headPos = this.snake.getHeadPosition();
                const aiFoodTargets = this.food.getPositions();

                 // Anti-stuck recovery: if no reachable food for too long, respawn a single reachable food.
                if (!this.ai.hasReachableFood(headPos, this.snake.getOccupiedCells(), aiFoodTargets)) {
                    this.aiNoFoodPathTicks++;
                    if (this.aiNoFoodPathTicks > CONFIG.aiNoPathAssistThreshold) {
                        const recovered = this.food.spawnNear(this.snake.getOccupiedCells(), headPos, 1);
                        if (!recovered) {
                            this.forceFruitBatch(1);
                        }
                        this.aiNoFoodPathTicks = 0;
                    }
                } else {
                    this.aiNoFoodPathTicks = 0;
                }

                // AI autopilot (cheat mode)
                direction = this.ai.getNextDirection(
                    headPos,
                    this.snake.getDirection(),
                    this.snake.getOccupiedCells(),
                    aiFoodTargets,
                    this.powerUpManager.getActivePowerUps()
                );
            } else if (this.manualDirection) {
                // Manual control
                direction = this.manualDirection;
            } else {
                // Keep current direction
                direction = this.snake.getDirection();
            }

            this.setDirectionIndicator(direction);

            // Move snake
            let moveResult = this.snake.move(direction);

            if (moveResult.collision && this.aiEnabled) {
                const emergency = this.ai.getEmergencyDirection(
                    this.snake.getHeadPosition(),
                    this.snake.getDirection(),
                    this.snake.getOccupiedCells(),
                    this.food.getPositions()
                );
                if (emergency) {
                    moveResult = this.snake.move(emergency);
                }
            }
            this.setDirectionIndicator(this.snake.getDirection());

            // Check collision
            if (moveResult.collision) {
                if (!this.powerUpManager.hasActivePowerUp('phase')) {
                    this.gameOver();
                    return;
                }
            }

            if (this.snake.length >= this.getPlayableCellCount()) {
                this.winGame();
                return;
            }

            // Check food collection
            const headPos = this.snake.getHeadPosition();

            // Direct contact with active bomb is instant death in manual play.
            if (!this.aiEnabled && this.bomb.isActive() && this.bomb.checkDirectHit(headPos)) {
                this.gameOver();
                return;
            }

            let foodCollectedThisTick = false;
            if (this.food.checkCollision(headPos)) {
                foodCollectedThisTick = true;
                this.snake.grow();
                this.addScore(CONFIG.pointsPerFood); // 100 points per food
                this.particles.createCollectionEffect(headPos);
                this.audioManager.playSound('collect');

                // Only spawn a new batch after the current one is fully consumed.
                if (!this.food.hasFood()) {
                    const spawned = this.food.spawn(this.snake.getOccupiedCells());
                    if (!spawned) {
                        this.winGame();
                        return;
                    }
                }

                // Speed up slightly
                this.moveInterval = Math.max(CONFIG.minSpeed, this.moveInterval - CONFIG.speedIncrement);
            }

            if (this.aiEnabled) {
                this.aiStepsWithoutFood = foodCollectedThisTick ? 0 : this.aiStepsWithoutFood + 1;
                if (this.aiStepsWithoutFood >= CONFIG.aiStallGrowthInterval && !this.food.hasFood()) {
                    this.food.spawnNear(this.snake.getOccupiedCells(), headPos, 1);
                    this.aiStepsWithoutFood = 0;
                }
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

        this.hudRefreshTimer += deltaTime;
        if (this.hudRefreshTimer >= CONFIG.hudUpdateInterval) {
            this.updateHUD();
            this.hudRefreshTimer = 0;
        }
    }

    addScore(points, options = {}) {
        const { triggerComboEffects = true } = options;
        const multiplier = this.scoreManager.getMultiplier();
        this.score += Math.floor(points * multiplier);
        this.scoreManager.addCombo();

        // Visual feedback for point gain
        const comboData = this.scoreManager.getComboData();
        if (comboData && triggerComboEffects) {
            this.ui.comboHud.classList.remove('hidden');
            this.ui.comboHud.classList.remove('combo-pop');
            void this.ui.comboHud.offsetWidth; // Trigger reflow
            this.ui.comboHud.classList.add('combo-pop');

            // Play combo sound every time food is eaten
            this.audioManager.playComboSound(comboData.label);

            // Combo-based fruit bursts (requested custom behavior).
            const burstCount = this.getComboBurstFruitCount(comboData.label);
            if (burstCount > 0 && this.lastComboBurstLabel !== comboData.label) {
                this.forceFruitBatch(burstCount);
                this.lastComboBurstLabel = comboData.label;
            }
        }
    }

    activatePowerUp(type) {
        this.powerUpManager.activate(type);
        this.addScore(25, { triggerComboEffects: false });
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

        // Update highscore for current difficulty
        if (this.score > this.highscore) {
            this.highscore = this.score;
            this.highscores[this.difficulty] = this.highscore;
            localStorage.setItem('snakeHighscores', JSON.stringify(this.highscores));
        }
        if (this.ui.highscore) {
            this.ui.highscore.textContent = this.highscore.toLocaleString();
        }

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
            // Reset combo level tracking when combo breaks
            this.audioManager.resetComboLevel();
            this.lastComboBurstLabel = null;
        }

        this.updateComboLayout();
    }

    updateComboLayout() {
        const combo = this.ui.comboHud;
        if (!combo) return;

        const isMobile = window.innerWidth <= 768;
        if (!isMobile) {
            combo.style.removeProperty('top');
            combo.style.setProperty('bottom', '20px', 'important');
            return;
        }

        const canvas = this.renderer?.domElement;
        const controls = document.getElementById('mobile-controls');
        if (!canvas || !controls) return;

        const boardRect = canvas.getBoundingClientRect();
        const controlsRect = controls.getBoundingClientRect();
        const comboRect = combo.getBoundingClientRect();
        const comboHeight = Math.max(52, Math.round(comboRect.height || 64));

        const desiredTop = Math.round(boardRect.bottom - comboHeight - 6);
        const maxTop = Math.round(controlsRect.top - comboHeight - 8);
        const minTop = Math.round(boardRect.top + 8);
        const safeTop = Math.max(minTop, Math.min(desiredTop, maxTop));

        combo.style.setProperty('top', `${safeTop}px`, 'important');
        combo.style.setProperty('bottom', 'auto', 'important');
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
            timeSlow: '\u23F1',
            phase: '\u25C6',
            magnet: '\u25C9',
            turbo: '\u26A1'
        };
        return icons[type] || '\u2736';
    }

    updateAIModeDisplay() {
        if (!this.ui.aiMode) return;
        const modeNames = {
            easy: 'EASY AI',
            normal: 'NORMAL AI',
            hard: 'HARD AI',
            beginner: 'BEGINNER AI',
            pro: 'PRO AI',
            godmode: 'GOD MODE AI'
        };
        this.ui.aiMode.textContent = modeNames[this.difficulty] || 'AI';
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    getPlayableCellCount() {
        return this.gridBounds.cellCount;
    }

    getTopDownCameraHeight(isMobile = window.innerWidth <= 768) {
        return isMobile ? 23.6 : 24.4;
    }

    applyCameraFraming(isMobile = window.innerWidth <= 768) {
        const cameraHeight = this.getTopDownCameraHeight(isMobile);

        if (this.cameraController) {
            this.cameraController.height = cameraHeight;
        }

        if (!this.cameraController || this.cameraController.mode === 'topdown') {
            this.camera.position.set(0, cameraHeight, 0.1);
            this.camera.lookAt(0, 0, 0);
        }
    }

    getTargetPixelRatio(isMobile = window.innerWidth <= 768) {
        const cap = isMobile ? 1.15 : 1.5;
        return Math.min(window.devicePixelRatio || 1, cap);
    }

    getMobileControlsHeight() {
        const controls = document.getElementById('mobile-controls');
        if (!controls) return 122;

        const rect = controls.getBoundingClientRect();
        if (!rect || rect.height <= 0) return 122;
        return Math.max(96, Math.round(rect.height));
    }

    getViewportLayout(isMobile = window.innerWidth <= 768) {
        if (!isMobile) {
            return {
                hudHeight: 82,
                controlsHeight: 0,
                padding: 4
            };
        }

        return {
            hudHeight: 66,
            controlsHeight: Math.max(104, this.getMobileControlsHeight() - 2),
            padding: 0
        };
    }

    onResize() {
        // Recalculate game size maintaining 1:1 aspect ratio
        const isMobile = window.innerWidth <= 768;
        const { hudHeight, controlsHeight, padding } = this.getViewportLayout(isMobile);

        const availableWidth = window.innerWidth - (padding * 2);
        const availableHeight = window.innerHeight - hudHeight - controlsHeight - (padding * 2);

        // Use smaller dimension for square aspect ratio
        const gameSize = Math.min(availableWidth, availableHeight);

        // Keep fixed 1:1 aspect
        this.camera.aspect = 1;
        this.camera.updateProjectionMatrix();
        this.applyCameraFraming(isMobile);

        this.renderer.setSize(gameSize, gameSize);
        this.renderer.setPixelRatio(this.getTargetPixelRatio(isMobile));
        this.composer.setSize(gameSize, gameSize);
        this.applyOverlayUX();
        this.updatePromoVisibility();
        this.updateComboLayout();
    }

    animate() {
        const clock = new THREE.Clock();

        const loop = () => {
            requestAnimationFrame(loop);

            const deltaTime = clock.getDelta();
            const elapsedTime = clock.getElapsedTime();

            this.update(deltaTime, elapsedTime);

            // Render (Bypassing composer to fix transparency)
            this.renderer.render(this.scene, this.camera);
            // this.composer.render();
        };

        loop();
    }
}

// Start the game
window.addEventListener('DOMContentLoaded', () => {
    new SnakeArcade();
});

