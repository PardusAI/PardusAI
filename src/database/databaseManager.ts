import fs from 'fs/promises';
import path from 'path';
import { MemoryDatabase } from './database.js';

export interface DatabaseMetadata {
  id: string;
  name: string;
  filePath: string;
  createdAt: number;
  lastAccessedAt: number;
}

export interface DatabaseManagerState {
  databases: DatabaseMetadata[];
  activeDatabase: string | null;
  version: string;
}

export class DatabaseManager {
  private configPath: string;
  private state: DatabaseManagerState;
  private loadedDatabases: Map<string, MemoryDatabase> = new Map();
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.configPath = path.join(dataDir, 'databases.json');
    this.state = {
      databases: [],
      activeDatabase: null,
      version: '1.0.0'
    };
  }

  /**
   * Initialize the database manager
   */
  async initialize(): Promise<void> {
    // Ensure data directory exists
    await fs.mkdir(this.dataDir, { recursive: true });

    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.state = JSON.parse(data);
    } catch (error: any) {
      // If file doesn't exist, create default database
      if (error.code === 'ENOENT') {
        await this.createDatabase('default');
        await this.save();
      } else {
        throw error;
      }
    }

    // Validate that all database files exist
    for (const dbMeta of this.state.databases) {
      try {
        await fs.access(dbMeta.filePath);
      } catch {
        // File doesn't exist, remove from list
        this.state.databases = this.state.databases.filter(d => d.id !== dbMeta.id);
      }
    }

    // If no active database, set the first one as active
    if (!this.state.activeDatabase && this.state.databases.length > 0) {
      const firstDb = this.state.databases[0];
      if (firstDb) {
        this.state.activeDatabase = firstDb.id;
        await this.save();
      }
    }
  }

  /**
   * Save the database manager state
   */
  private async save(): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  /**
   * Create a new database
   */
  async createDatabase(name: string): Promise<string> {
    const id = `db_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const filePath = path.join(this.dataDir, `${id}.json`);

    const metadata: DatabaseMetadata = {
      id,
      name,
      filePath,
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    this.state.databases.push(metadata);

    // Create the database file
    const db = new MemoryDatabase(filePath);
    await db.initialize();
    this.loadedDatabases.set(id, db);

    // If this is the first database, make it active
    if (!this.state.activeDatabase) {
      this.state.activeDatabase = id;
    }

    await this.save();
    return id;
  }

  /**
   * Get active database
   */
  async getActiveDatabase(): Promise<MemoryDatabase | null> {
    if (!this.state.activeDatabase) {
      return null;
    }

    return await this.getDatabase(this.state.activeDatabase);
  }

  /**
   * Get database by ID
   */
  async getDatabase(id: string): Promise<MemoryDatabase | null> {
    const metadata = this.state.databases.find(d => d.id === id);
    if (!metadata) {
      return null;
    }

    // Check if already loaded
    if (this.loadedDatabases.has(id)) {
      return this.loadedDatabases.get(id)!;
    }

    // Load database
    const db = new MemoryDatabase(metadata.filePath);
    await db.initialize();
    this.loadedDatabases.set(id, db);

    // Update last accessed time
    metadata.lastAccessedAt = Date.now();
    await this.save();

    return db;
  }

  /**
   * Switch active database
   */
  async switchDatabase(id: string): Promise<boolean> {
    const metadata = this.state.databases.find(d => d.id === id);
    if (!metadata) {
      return false;
    }

    this.state.activeDatabase = id;
    metadata.lastAccessedAt = Date.now();
    await this.save();

    return true;
  }

  /**
   * Rename a database
   */
  async renameDatabase(id: string, newName: string): Promise<boolean> {
    const metadata = this.state.databases.find(d => d.id === id);
    if (!metadata) {
      return false;
    }

    metadata.name = newName;
    await this.save();
    return true;
  }

  /**
   * Delete a database
   */
  async deleteDatabase(id: string): Promise<boolean> {
    const metadata = this.state.databases.find(d => d.id === id);
    if (!metadata) {
      return false;
    }

    // Don't allow deleting the last database
    if (this.state.databases.length === 1) {
      return false;
    }

    // Remove from list
    this.state.databases = this.state.databases.filter(d => d.id !== id);

    // If this was the active database, switch to another
    if (this.state.activeDatabase === id) {
      this.state.activeDatabase = this.state.databases[0]?.id || null;
    }

    // Remove from loaded databases
    this.loadedDatabases.delete(id);

    // Delete the file
    try {
      await fs.unlink(metadata.filePath);
    } catch {
      // Ignore errors if file doesn't exist
    }

    await this.save();
    return true;
  }

  /**
   * List all databases
   */
  listDatabases(): DatabaseMetadata[] {
    return [...this.state.databases];
  }

  /**
   * Get active database ID
   */
  getActiveDatabaseId(): string | null {
    return this.state.activeDatabase;
  }

  /**
   * Get active database metadata
   */
  getActiveDatabaseMetadata(): DatabaseMetadata | null {
    if (!this.state.activeDatabase) {
      return null;
    }
    return this.state.databases.find(d => d.id === this.state.activeDatabase) || null;
  }
}

