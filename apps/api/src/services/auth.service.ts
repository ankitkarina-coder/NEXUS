import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { authRepository } from "@nexus/database";

type AuthUser = NonNullable<Awaited<ReturnType<typeof authRepository.userById>>>;
export type RequestUser = AuthUser & { roles: string[]; permissions: string[] };

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const sessionDays = 7;

const publicUser = (user: RequestUser) => ({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, active: user.active, organizationId: user.organizationId, organization: user.organization, roles: user.roles, permissions: user.permissions });
const withAccess = (user: AuthUser): RequestUser => ({ ...user, roles: user.roleAssignments.map((assignment) => assignment.role.name), permissions: Array.from(new Set(user.roleAssignments.flatMap((assignment) => assignment.role.permissions.map((permission) => permission.permission.key)))) });
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const hashPassword = (password: string) => { const salt = randomBytes(16).toString("hex"); const hash = scryptSync(password, salt, 64).toString("hex"); return `scrypt$${salt}$${hash}`; };
export const verifyPassword = (password: string, encoded: string | null) => { if (!encoded) return false; const [, salt, expected] = encoded.split("$"); if (!salt || !expected) return false; const actual = scryptSync(password, salt, 64); const expectedBuffer = Buffer.from(expected, "hex"); return expectedBuffer.length === actual.length && timingSafeEqual(actual, expectedBuffer); };

export const authService = {
  login: async (raw: unknown) => {
    const input = loginSchema.parse(raw);
    const record = await authRepository.userByEmail(input.email);
    if (!record || !record.active || !verifyPassword(input.password, record.passwordHash)) throw new Error("Invalid email or password.");
    const user = withAccess(record);
    const token = randomBytes(32).toString("base64url");
    await authRepository.createSession({ tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000) });
    await authRepository.updateLogin(user.id);
    await authRepository.audit({ actorId: user.id, action: "USER_LOGIN", entityType: "InternalUser", entityId: user.id });
    return { token, user: publicUser(user) };
  },
  authenticate: async (token: string | undefined) => {
    if (!token) return null;
    const session = await authRepository.session(hashToken(token));
    if (!session || session.expiresAt <= new Date() || !session.user.active) return null;
    await authRepository.touchSession(session.id);
    return withAccess(session.user);
  },
  logout: async (token: string | undefined, actorId?: string) => { if (token) await authRepository.deleteSession(hashToken(token)); if (actorId) await authRepository.audit({ actorId, action: "USER_LOGOUT", entityType: "InternalUser", entityId: actorId }); },
  publicUser,
};

export const permissionNames = [
  "organizations.read", "organizations.create", "organizations.update", "organizations.delete",
  "users.read", "users.create", "users.update", "users.disable",
  "task_templates.read", "task_templates.create", "task_templates.update", "task_templates.deactivate",
  "tasks.read", "tasks.create", "tasks.update", "tasks.complete",
  "workflow_templates.read", "workflow_templates.create", "workflow_templates.update", "workflow_templates.execute",
  "workflows.read", "workflows.cancel", "message_templates.read", "message_templates.create", "message_templates.update",
  "settings.read", "settings.update", "audit_logs.read",
] as const;
