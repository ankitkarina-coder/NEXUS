import { Router } from "express";
import { authService } from "../services/auth.service.js";
import { requireAuth, requestUser } from "../middleware/auth.js";

export const authRouter = Router();
const asyncRoute = (handler: (request: any, response: any, next: any) => Promise<void>) => async (request: any, response: any, next: any) => { try { await handler(request, response, next); } catch (error) { next(error); } };
const tokenFrom = (request: any) => request.header("authorization")?.startsWith("Bearer ") ? request.header("authorization").slice(7) : undefined;

authRouter.post("/login", asyncRoute(async (request, response) => { response.json(await authService.login(request.body)); }));
authRouter.get("/me", requireAuth, (request, response) => { response.json({ user: authService.publicUser(requestUser(request)) }); });
authRouter.post("/logout", requireAuth, asyncRoute(async (request, response) => { await authService.logout(tokenFrom(request), requestUser(request).id); response.status(204).send(); }));
