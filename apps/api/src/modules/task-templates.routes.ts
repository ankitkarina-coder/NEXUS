import { Router } from "express";
import { taskTemplateService } from "../services/task-template.service.js";
import { requirePermission } from "../middleware/auth.js";

export const taskTemplateManagementRouter = Router();

const asyncRoute = (handler: (request: any, response: any, next: any) => Promise<void>) => async (request: any, response: any, next: any) => {
  try { await handler(request, response, next); } catch (error) { next(error); }
};

taskTemplateManagementRouter.get("/", asyncRoute(async (_request, response) => { response.json(await taskTemplateService.list()); }));
taskTemplateManagementRouter.get("/options", asyncRoute(async (_request, response) => { response.json({ internalUsers: await taskTemplateService.internalUsers(), messageTemplates: await taskTemplateService.messageTemplates() }); }));
taskTemplateManagementRouter.get("/:id", asyncRoute(async (request, response) => {
  const template = await taskTemplateService.get(request.params.id);
  if (!template) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Task template was not found." } }); return; }
  response.json(template);
}));
taskTemplateManagementRouter.post("/", requirePermission("task_templates.create"), asyncRoute(async (request, response) => { response.status(201).json(await taskTemplateService.create(request.body)); }));
taskTemplateManagementRouter.put("/:id", requirePermission("task_templates.update"), asyncRoute(async (request, response) => { response.json(await taskTemplateService.update(request.params.id, request.body)); }));
taskTemplateManagementRouter.patch("/:id", requirePermission("task_templates.update"), asyncRoute(async (request, response) => { response.json(await taskTemplateService.update(request.params.id, request.body)); }));
taskTemplateManagementRouter.delete("/:id", requirePermission("task_templates.deactivate"), asyncRoute(async (request, response) => { response.json(await taskTemplateService.deactivate(request.params.id)); }));