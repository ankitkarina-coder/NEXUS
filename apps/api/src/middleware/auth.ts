import type { NextFunction, Request, Response } from "express";
import { authService, type RequestUser } from "../services/auth.service.js";

const bearer = (request: Request) => { const value = request.header("authorization"); return value?.startsWith("Bearer ") ? value.slice(7) : undefined; };
const deny = (response: Response, message: string) => response.status(401).json({ error: { code: "UNAUTHORIZED", message } });

export const requireAuth = async (request: Request, response: Response, next: NextFunction) => {
  try {
    const user = await authService.authenticate(bearer(request));
    if (!user) { deny(response, "Authentication is required."); return; }
    (request as Request & { user: RequestUser }).user = user;
    next();
  } catch (error) { next(error); }
};

export const requirePermission = (permission: string) => (request: Request, response: Response, next: NextFunction) => {
  const user = (request as Request & { user?: RequestUser }).user;
  if (!user) { deny(response, "Authentication is required."); return; }
  if (!user.permissions.includes(permission) && !user.roles.includes("SUPER_ADMIN")) { response.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." } }); return; }
  next();
};

export const requireRole = (...roles: string[]) => (request: Request, response: Response, next: NextFunction) => {
  const user = (request as Request & { user?: RequestUser }).user;
  if (!user) { deny(response, "Authentication is required."); return; }
  if (!roles.some((role) => user.roles.includes(role))) { response.status(403).json({ error: { code: "FORBIDDEN", message: "Your role cannot perform this action." } }); return; }
  next();
};

export const requestUser = (request: Request) => (request as Request & { user: RequestUser }).user;
export const requestOrganizationScope = (request: Request) => { const user = requestUser(request); return user.roles.includes("SUPER_ADMIN") ? undefined : user.organizationId || "__none__"; };
