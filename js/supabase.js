/**
 * Supabase Client Module
 * Handles authentication and leaderboard operations
 */

const SUPABASE_URL = 'https://ymyuebvnrqkmxbkzhmqj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteXVlYnZucnFrbXhia3pobXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NzY1ODYsImV4cCI6MjA4NTM1MjU4Nn0.DIjrzqdv3iewPPIXrkNDGyRWugLxdgvjFJBGpxYOdHM';

// Simple hash function for passwords (for demo - in production use proper auth)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'snake_game_salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

class SupabaseClient {
    constructor() {
        this.url = SUPABASE_URL;
        this.key = SUPABASE_ANON_KEY;
        this.currentUser = null;
        this.loadSavedUser();
    }

    // REST API helper
    async fetch(endpoint, options = {}) {
        const url = `${this.url}/rest/v1/${endpoint}`;
        const headers = {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation'
        };

        const response = await fetch(url, {
            method: options.method || 'GET',
            headers,
            body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('[SUPABASE ERROR]', error);
            console.error('[SUPABASE ERROR] Message:', error.message);
            console.error('[SUPABASE ERROR] Details:', error.details);
            console.error('[SUPABASE ERROR] Hint:', error.hint);
            throw new Error(error.message || error.hint || 'Request failed');
        }

        return response.json();
    }

    // Load saved user from localStorage
    loadSavedUser() {
        const saved = localStorage.getItem('snake_user');
        if (saved) {
            this.currentUser = JSON.parse(saved);
        }
    }

    // Save user to localStorage (remember me)
    saveUser(rememberMe = false) {
        if (rememberMe && this.currentUser) {
            localStorage.setItem('snake_user', JSON.stringify(this.currentUser));
        }
    }

    // Clear saved user
    logout() {
        this.currentUser = null;
        localStorage.removeItem('snake_user');
    }

    // Register new user
    async register(displayName, username, password) {
        // Check if username exists
        const existing = await this.fetch(`users?username=eq.${encodeURIComponent(username)}&select=id`);
        if (existing.length > 0) {
            throw new Error('Username already exists');
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Insert new user
        const result = await this.fetch('users', {
            method: 'POST',
            body: {
                username,
                display_name: displayName,
                password_hash: passwordHash
            }
        });

        this.currentUser = result[0];
        return this.currentUser;
    }

    // Login user
    async login(username, password, rememberMe = false) {
        const passwordHash = await hashPassword(password);

        const users = await this.fetch(
            `users?username=eq.${encodeURIComponent(username)}&password_hash=eq.${passwordHash}&select=*`
        );

        if (users.length === 0) {
            throw new Error('Invalid username or password');
        }

        this.currentUser = users[0];
        this.saveUser(rememberMe);
        return this.currentUser;
    }

    // Check if logged in
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // Get current user
    getUser() {
        return this.currentUser;
    }

    // Submit score to leaderboard
    async submitScore(score, difficulty) {
        if (!this.currentUser) {
            throw new Error('Must be logged in to submit score');
        }

        // Check if this is user's best score for this difficulty
        const existing = await this.fetch(
            `leaderboard?user_id=eq.${this.currentUser.id}&difficulty=eq.${difficulty}&select=id,score&order=score.desc&limit=1`
        );

        // Only insert if it's a new high score for this user
        if (existing.length === 0 || score > existing[0].score) {
            if (existing.length > 0) {
                // Update existing record
                await this.fetch(`leaderboard?id=eq.${existing[0].id}`, {
                    method: 'PATCH',
                    body: { score }
                });
            } else {
                // Insert new record
                await this.fetch('leaderboard', {
                    method: 'POST',
                    body: {
                        user_id: this.currentUser.id,
                        display_name: this.currentUser.display_name,
                        score,
                        difficulty
                    }
                });
            }
            return true; // New high score
        }
        return false; // Not a high score
    }

    // Get top 5 leaderboard for difficulty
    async getLeaderboard(difficulty) {
        const results = await this.fetch(
            `leaderboard?difficulty=eq.${difficulty}&select=display_name,score&order=score.desc&limit=5`
        );
        return results;
    }

    // Get all leaderboards (easy, normal, hard)
    async getAllLeaderboards() {
        const [easy, normal, hard] = await Promise.all([
            this.getLeaderboard('easy'),
            this.getLeaderboard('normal'),
            this.getLeaderboard('hard')
        ]);
        return { easy, normal, hard };
    }

    // ========== CHAT METHODS ==========

    // Send a chat message
    async sendMessage(message) {
        if (!this.currentUser) return null;

        const data = {
            user_id: this.currentUser.id,
            display_name: this.currentUser.display_name,
            message: message.trim().substring(0, 200) // Limit to 200 chars
        };

        const result = await this.fetch('chat_messages', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        return result;
    }

    // Get recent messages (last 50)
    async getMessages() {
        const results = await this.fetch(
            'chat_messages?select=id,display_name,message,created_at&order=created_at.desc&limit=50'
        );
        return results.reverse(); // Oldest first
    }

    // Update user activity (heartbeat)
    async updateActivity() {
        if (!this.currentUser) return;

        const data = {
            display_name: this.currentUser.display_name,
            last_active: new Date().toISOString()
        };

        try {
            // Try to update existing record first (PATCH)
            await this.fetch(`user_activity?user_id=eq.${this.currentUser.id}`, {
                method: 'PATCH',
                body: JSON.stringify(data)
            });
        } catch (err) {
            // If PATCH fails, try INSERT
            try {
                await this.fetch('user_activity', {
                    method: 'POST',
                    body: JSON.stringify({
                        user_id: this.currentUser.id,
                        ...data
                    })
                });
            } catch (insertErr) {
                // Silently ignore - non-critical
            }
        }
    }

    // Get online players count (active in last 2 minutes)
    async getOnlineCount() {
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const results = await this.fetch(
            `user_activity?last_active=gte.${twoMinutesAgo}&select=user_id`
        );
        return results.length;
    }
}

// Export singleton instance
export const supabase = new SupabaseClient();
