import { Router } from "express";
import { taskService } from "../services/task.service.js";
import { requirePermission, requestOrganizationScope } from "../middleware/auth.js";

export const taskManagementRouter = Router();
const asyncRoute = (handler: (request: any, response: any, next: any) => Promise<void>) => async (request: any, response: any, next: any) => { try { await handler(request, response, next); } catch (error) { next(error); } };

taskManagementRouter.get("/options", asyncRoute(async (_request, response) => { response.json(await taskService.options()); }));
taskManagementRouter.get("/", asyncRoute(async (request, response) => { response.json(await taskService.list(requestOrganizationScope(request))); }));
taskManagementRouter.get("/:id", asyncRoute(async (request, response) => { const task = await taskService.get(request.params.id, requestOrganizationScope(request)); if (!task) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Task was not found." } }); return; } response.json(task); }));
taskManagementRouter.post("/", requirePermission("tasks.create"), asyncRoute(async (request, response) => { response.status(201).json(await taskService.create(request.body)); }));
taskManagementRouter.put("/:id", requirePermission("tasks.update"), asyncRoute(async (request, response) => { const task = await taskService.update(request.params.id, request.body); if (!task) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Task was not found." } }); return; } response.json(task); }));
taskManagementRouter.patch("/:id/status", requirePermission("tasks.complete"), asyncRoute(async (request, response) => { const task = await taskService.changeStatus(request.params.id, request.body); if (!task) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Task was not found." } }); return; } response.json(task); }));
taskManagementRouter.post("/:id/comments", asyncRoute(async (request, response) => { const comment = await taskService.addComment(request.params.id, request.body); if (!comment) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Task was not found." } }); return; } response.status(201).json(comment); }));