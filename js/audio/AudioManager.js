/**
 * AudioManager - Custom MP3 Audio System
 * Uses user-provided MP3 files for all game sounds
 */

export class AudioManager {
    constructor() {
        this.muted = false;
        this.volume = 0.5;
        this.initialized = false;

        // Audio elements
        this.menuMusic = null;
        this.gameplayTracks = [];
        this.currentTrackIndex = 0;

        // Sound effects
        this.sounds = {};

        // Combo sounds
        this.comboSounds = {};

        // State tracking
        this.bgmPlaying = false;
        this.menuMusicPlaying = false;
        this.lastMilestone = 0;
        this.lastComboLevel = 0;
        this.webAudioContext = null;
        this.webAudioDisabled = false;
        this.webAudioErrorReported = false;

        // Add interaction listener to initialize audio on first click
        this.addInteractionListeners();
    }

    addInteractionListeners() {
        const initAudio = () => {
            console.log('[AUDIO] User interaction detected, initializing...');
            this.init();
            this.getWebAudioContext();

            // Warm up tracks with a tiny slice of playback to unlock them
            if (this.menuMusic) {
                this.menuMusic.play().then(() => this.menuMusic.pause()).catch(() => { });
            }
            this.gameplayTracks.forEach(track => {
                track.play().then(() => track.pause()).catch(() => { });
            });

            window.removeEventListener('click', initAudio);
            window.removeEventListener('keydown', initAudio);
            window.removeEventListener('touchstart', initAudio);
        };
        window.addEventListener('click', initAudio, { passive: true });
        window.addEventListener('keydown', initAudio, { passive: true });
        window.addEventListener('touchstart', initAudio, { passive: true });
    }

    init() {
        if (this.initialized) return;

        try {
            console.log('[AUDIO] Initializing AudioManager...');
            // Menu music (for dashboard, menu, game over)
            this.menuMusic = new Audio('menu.mp3');
            this.menuMusic.loop = true;
            this.menuMusic.volume = this.volume;
            console.log('[AUDIO] Menu music created');

            // Gameplay tracks (loop between them)
            this.gameplayTracks = [
                new Audio('gameplay.mp3'),
                new Audio('gameplay2.mp3')
            ];
            console.log('[AUDIO] Gameplay tracks created:', this.gameplayTracks.length);

            // Set up track switching when one ends
            this.gameplayTracks.forEach((track, index) => {
                track.volume = this.volume;
                track.addEventListener('ended', () => {
                    console.log(`[AUDIO] Track ${index} ended. bgmPlaying:`, this.bgmPlaying);
                    if (this.bgmPlaying) {
                        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.gameplayTracks.length;
                        console.log(`[AUDIO] Switching to track ${this.currentTrackIndex}`);
                        this.gameplayTracks[this.currentTrackIndex].currentTime = 0;
                        this.gameplayTracks[this.currentTrackIndex].play().catch(e => console.error('[AUDIO] Switch failed:', e));
                    }
                });
                track.addEventListener('error', (e) => {
                    console.error(`[AUDIO] Error on track ${index}:`, track.error);
                });
            });

            // Sound effects
            this.sounds = {
                explosion: new Audio('boom.mp3'),
                collect: this.createCollectSound(),
                powerup: this.createPowerupSound(),
                death: this.createDeathSound(),
                milestone: new Audio('1kscore.mp3')
            };

            // Set volume for all sound effects
            Object.values(this.sounds).forEach(sound => {
                if (sound) sound.volume = this.volume;
            });

            // Combo sounds
            this.comboSounds = {
                'COMBOWHORE!': new Audio('combowhore.mp3'),
                'HOLY SHIT!': new Audio('holyshit.mp3'),
                'UNSTOPPABLE!': new Audio('unstoppable.mp3'),
                'GODLIKE!': new Audio('godlike.mp3')
            };

            // Set volume for combo sounds
            Object.values(this.comboSounds).forEach(sound => {
                if (sound) sound.volume = this.volume;
            });

            this.initialized = true;
            console.log('[AUDIO] AudioManager initialized successfully');
        } catch (e) {
            console.error('[AUDIO] Failed to initialize audio:', e);
        }
    }

    // Create synthetic collect sound (backup if no file)
    createCollectSound() {
        // We'll use Web Audio API for quick collect sound
        return null; // Will use synthetic sound
    }

    createPowerupSound() {
        return null; // Will use synthetic sound
    }

    createDeathSound() {
        return null; // Will use synthetic sound
    }

    reportWebAudioError(error) {
        if (!this.webAudioErrorReported) {
            console.warn('[AUDIO] WebAudio disabled due to device/renderer error.');
            if (error) {
                console.warn(error);
            }
            this.webAudioErrorReported = true;
        }
        this.webAudioDisabled = true;
    }

    getWebAudioContext() {
        if (this.webAudioDisabled || typeof window === 'undefined') return null;

        const ContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!ContextCtor) {
            this.webAudioDisabled = true;
            return null;
        }

        if (!this.webAudioContext) {
            try {
                this.webAudioContext = new ContextCtor();
                this.webAudioContext.onstatechange = () => {
                    if (!this.webAudioContext) return;
                    const state = this.webAudioContext.state;
                    if (state === 'closed' || state === 'interrupted') {
                        this.reportWebAudioError();
                    }
                };
            } catch (error) {
                this.reportWebAudioError(error);
                return null;
            }
        }

        if (this.webAudioContext.state === 'suspended') {
            this.webAudioContext.resume().catch(() => { });
        }

        if (this.webAudioContext.state === 'closed' || this.webAudioContext.state === 'interrupted') {
            this.reportWebAudioError();
            return null;
        }

        return this.webAudioContext;
    }

    playMenuMusic() {
        this.init();
        if (!this.menuMusic || this.muted) return;

        // Stop gameplay music if playing
        this.stopBGM();

        if (!this.menuMusicPlaying) {
            this.menuMusic.currentTime = 0;
            this.menuMusic.play().catch(() => { });
            this.menuMusicPlaying = true;
        }
    }

    stopMenuMusic() {
        if (this.menuMusic) {
            this.menuMusic.pause();
            this.menuMusic.currentTime = 0;
            this.menuMusicPlaying = false;
        }
    }

    playBGM() {
        console.log('[AUDIO] playBGM called. Muted:', this.muted, 'Initialized:', this.initialized);
        this.init();

        // Force stop menu music
        this.stopMenuMusic();

        this.bgmPlaying = true;
        this.currentTrackIndex = 0;
        this.lastMilestone = 0;
        this.lastComboLevel = 0;

        if (this.gameplayTracks.length > 0) {
            console.log('[AUDIO] Starting gameplay track 0');
            const track = this.gameplayTracks[0];
            track.currentTime = 0;
            track.play()
                .then(() => console.log('[AUDIO] Gameplay track 0 playing successfully'))
                .catch(err => {
                    console.error('[AUDIO] Failed to play gameplay track 0:', err);
                    // Retry once if failed
                    setTimeout(() => track.play().catch(() => { }), 100);
                });
        } else {
            console.error('[AUDIO] No gameplay tracks available!');
        }
    }

    stopBGM() {
        this.bgmPlaying = false;
        this.gameplayTracks.forEach(track => {
            track.pause();
            track.currentTime = 0;
        });
    }

    pause() {
        this.gameplayTracks.forEach(track => {
            if (!track.paused) track.pause();
        });
        if (this.menuMusic && !this.menuMusic.paused) {
            this.menuMusic.pause();
        }
    }

    resume() {
        if (this.bgmPlaying) {
            this.gameplayTracks[this.currentTrackIndex].play().catch(() => { });
        }
        if (this.menuMusicPlaying && this.menuMusic) {
            this.menuMusic.play().catch(() => { });
        }
    }

    playSound(type) {
        this.init();
        if (this.muted) return;

        const sound = this.sounds[type];

        if (type === 'explosion' && sound) {
            // Use custom boom.mp3 for explosions
            sound.currentTime = 0;
            sound.play().catch(() => { });
        } else if (type === 'collect') {
            this.playCollectSound();
        } else if (type === 'powerup') {
            this.playPowerUpSound();
        } else if (type === 'death') {
            this.playDeathSound();
        }
    }

    // Check and play 1k milestone sound
    checkMilestone(score) {
        if (this.muted) return;

        const currentMilestone = Math.floor(score / 1000);
        if (currentMilestone > this.lastMilestone && score > 0) {
            this.lastMilestone = currentMilestone;
            if (this.sounds.milestone) {
                this.sounds.milestone.currentTime = 0;
                this.sounds.milestone.play().catch(() => { });
            }
        }
    }

    // Play combo sound based on combo label - plays EVERY time food is eaten
    // Uses cloneNode() to allow overlapping sounds without delay
    playComboSound(comboLabel) {
        if (this.muted || !comboLabel) return;

        const sound = this.comboSounds[comboLabel];
        if (sound) {
            // Clone the audio to allow overlapping playback
            const clone = sound.cloneNode();
            clone.volume = this.muted ? 0 : this.volume;
            clone.play().catch(() => { });
        }
    }

    // Reset combo level tracking (call when combo breaks)
    resetComboLevel() {
        this.lastComboLevel = 0;
    }

    // Synthetic sounds (fallback)
    playCollectSound() {
        try {
            const context = this.getWebAudioContext();
            if (!context) return;
            const now = context.currentTime;

            const osc = context.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);

            const gain = context.createGain();
            gain.gain.setValueAtTime(this.muted ? 0 : 0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

            osc.connect(gain);
            gain.connect(context.destination);

            osc.start(now);
            osc.stop(now + 0.15);
        } catch (error) {
            this.reportWebAudioError(error);
        }
    }

    playPowerUpSound() {
        try {
            const context = this.getWebAudioContext();
            if (!context) return;
            const frequencies = [523.25, 659.25, 783.99, 1046.5];
            const now = context.currentTime;

            frequencies.forEach((freq, i) => {
                const startTime = now + i * 0.05;
                const osc = context.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);

                const gain = context.createGain();
                gain.gain.setValueAtTime(this.muted ? 0 : 0.15, startTime);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.12);

                osc.connect(gain);
                gain.connect(context.destination);

                osc.start(startTime);
                osc.stop(startTime + 0.15);
            });
        } catch (error) {
            this.reportWebAudioError(error);
        }
    }

    playDeathSound() {
        try {
            const context = this.getWebAudioContext();
            if (!context) return;
            const now = context.currentTime;

            const osc = context.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);

            const gain = context.createGain();
            gain.gain.setValueAtTime(this.muted ? 0 : 0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

            osc.connect(gain);
            gain.connect(context.destination);

            osc.start(now);
            osc.stop(now + 0.6);
        } catch (error) {
            this.reportWebAudioError(error);
        }
    }

    updateIntensity(score) {
        // Check for score milestones
        this.checkMilestone(score);
    }

    toggleMute() {
        this.muted = !this.muted;

        // Update all audio volumes
        if (this.menuMusic) {
            this.menuMusic.volume = this.muted ? 0 : this.volume;
        }
        this.gameplayTracks.forEach(track => {
            track.volume = this.muted ? 0 : this.volume;
        });
        Object.values(this.sounds).forEach(sound => {
            if (sound) sound.volume = this.muted ? 0 : this.volume;
        });
        Object.values(this.comboSounds).forEach(sound => {
            if (sound) sound.volume = this.muted ? 0 : this.volume;
        });

        return this.muted;
    }

    setVolume(vol) {
        this.volume = vol;
        if (!this.muted) {
            if (this.menuMusic) this.menuMusic.volume = vol;
            this.gameplayTracks.forEach(track => track.volume = vol);
            Object.values(this.sounds).forEach(sound => {
                if (sound) sound.volume = vol;
            });
            Object.values(this.comboSounds).forEach(sound => {
                if (sound) sound.volume = vol;
            });
        }
    }
}
