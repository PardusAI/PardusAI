export interface User {
  id: string;
  username: string;
  email: string | undefined;
  passwordHash: string;
  createdAt: number;
  lastLoginAt: number | undefined;
  isActive: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  currentUser: User | null;
  sessionToken?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email?: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
  token?: string;
}

export interface AuthDatabaseState {
  users: User[];
  version: string;
}