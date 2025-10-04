import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import type { User, AuthDatabaseState, LoginCredentials, RegisterCredentials, AuthResponse } from '../types/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root directory (two levels up from dist/core)
const projectRoot = path.join(__dirname, '..', '..');
const authDbPath = path.join(projectRoot, 'data', 'auth.json');

export class AuthManager {
  private state: AuthDatabaseState;
  private saveScheduled: boolean = false;

  constructor() {
    this.state = {
      users: [],
      version: '1.0.0'
    };
  }

  /**
   * Initialize authentication database
   */
  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(authDbPath, 'utf-8');
      this.state = JSON.parse(data);
    } catch (error: any) {
      // If file doesn't exist, create new auth database
      if (error.code === 'ENOENT') {
        await this.save();
      } else {
        throw error;
      }
    }
  }

  /**
   * Save authentication database to disk (debounced)
   */
  private async save(): Promise<void> {
    if (this.saveScheduled) return;
    
    this.saveScheduled = true;
    
    // Debounce: wait 100ms before actually saving
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      // Ensure directory exists
      const dir = path.dirname(authDbPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write to temp file first, then rename (atomic operation)
      const tempPath = `${authDbPath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(this.state, null, 2), 'utf-8');
      await fs.rename(tempPath, authDbPath);
    } finally {
      this.saveScheduled = false;
    }
  }

  /**
   * Hash password using SHA-256
   */
  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Verify password against hash
   */
  private verifyPassword(password: string, hash: string): boolean {
    const passwordHash = this.hashPassword(password);
    return passwordHash === hash;
  }

  /**
   * Generate session token
   */
  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Register a new user
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const { username, email, password, confirmPassword } = credentials;

    // Validate input
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }

    if (password !== confirmPassword) {
      return { success: false, error: 'Passwords do not match' };
    }

    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long' };
    }

    // Check if username already exists
    const existingUser = this.state.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existingUser) {
      return { success: false, error: 'Username already exists' };
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = this.state.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (existingEmail) {
        return { success: false, error: 'Email already exists' };
      }
    }

    // Create new user
    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      username,
      email: email || undefined,
      passwordHash: this.hashPassword(password),
      createdAt: Date.now(),
      lastLoginAt: undefined,
      isActive: true
    };

    this.state.users.push(user);
    await this.save();

    const token = this.generateSessionToken();

    return {
      success: true,
      user: {
        ...user,
        passwordHash: '' // Don't send password hash to client
      },
      token
    };
  }

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { username, password } = credentials;

    // Validate input
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }

    // Find user by username
    const user = this.state.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      return { success: false, error: 'Invalid username or password' };
    }

    // Check if user is active
    if (!user.isActive) {
      return { success: false, error: 'Account is deactivated' };
    }

    // Verify password
    if (!this.verifyPassword(password, user.passwordHash)) {
      return { success: false, error: 'Invalid username or password' };
    }

    // Update last login
    user.lastLoginAt = Date.now();
    await this.save();

    const token = this.generateSessionToken();

    return {
      success: true,
      user: {
        ...user,
        passwordHash: '' // Don't send password hash to client
      },
      token
    };
  }

  /**
   * Get user by ID
   */
  getUserById(id: string): User | undefined {
    return this.state.users.find(u => u.id === id);
  }

  /**
   * Check if any users exist (for first-time setup)
   */
  hasUsers(): boolean {
    return this.state.users.length > 0;
  }

  /**
   * Get all users (for admin purposes)
   */
  getAllUsers(): User[] {
    return this.state.users.map(u => ({ ...u, passwordHash: '' }));
  }

  /**
   * Create default admin user if no users exist
   */
  async createDefaultAdminIfNeeded(): Promise<void> {
    if (this.hasUsers()) {
      return;
    }

    const adminUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      username: 'admin',
      email: undefined,
      passwordHash: this.hashPassword('admin'),
      createdAt: Date.now(),
      lastLoginAt: undefined,
      isActive: true
    };

    this.state.users.push(adminUser);
    await this.save();
  }
}

// Singleton instance
export const authManager = new AuthManager();