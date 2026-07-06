/**
 * Authentication middleware
 * Validates JWT tokens and attaches user context to requests
 */

import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    workspace_id: string;
    role: string;
  };
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // In development, allow anonymous access with default user
    if (process.env.NODE_ENV === 'development') {
      req.user = {
        id: 'dev-user-001',
        email: 'developer@eadpa.dev',
        workspace_id: 'dev-workspace-001',
        role: 'admin',
      };
      return next();
    }

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header',
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // TODO: Implement proper JWT verification with AWS Cognito/custom auth
    // For now, decode a simple token structure
    const payload = decodeToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}

function decodeToken(token: string): AuthenticatedRequest['user'] {
  // Placeholder - will be replaced with proper JWT verification
  try {
    const decoded = JSON.parse(
      Buffer.from(token.split('.')[1] || '', 'base64').toString()
    );
    return {
      id: decoded.sub || decoded.user_id,
      email: decoded.email,
      workspace_id: decoded.workspace_id,
      role: decoded.role || 'engineer',
    };
  } catch {
    throw new Error('Invalid token format');
  }
}
