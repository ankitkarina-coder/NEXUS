import { Router } from "express";
import { workflowService, workflowTemplateService } from "../services/workflow.service.js";
import { requirePermission, requestOrganizationScope } from "../middleware/auth.js";

export const workflowTemplateManagementRouter = Router();
export const workflowManagementRouter = Router();
const asyncRoute = (handler: (request: any, response: any, next: any) => Promise<void>) => async (request: any, response: any, next: any) => { try { await handler(request, response, next); } catch (error) { next(error); } };

workflowTemplateManagementRouter.get("/options", asyncRoute(async (_request, response) => { response.json(await workflowTemplateService.options()); }));
workflowTemplateManagementRouter.get("/", asyncRoute(async (_request, response) => { response.json(await workflowTemplateService.list()); }));
workflowTemplateManagementRouter.get("/:id", asyncRoute(async (request, response) => { const template = await workflowTemplateService.get(request.params.id); if (!template) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow template was not found." } }); return; } response.json(template); }));
workflowTemplateManagementRouter.post("/", requirePermission("workflow_templates.create"), asyncRoute(async (request, response) => { response.status(201).json(await workflowTemplateService.create(request.body)); }));
workflowTemplateManagementRouter.put("/:id", requirePermission("workflow_templates.update"), asyncRoute(async (request, response) => { const template = await workflowTemplateService.update(request.params.id, request.body); if (!template) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow template was not found." } }); return; } response.json(template); }));
workflowTemplateManagementRouter.patch("/:id", requirePermission("workflow_templates.update"), asyncRoute(async (request, response) => { const template = await workflowTemplateService.update(request.params.id, request.body); if (!template) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow template was not found." } }); return; } response.json(template); }));

workflowManagementRouter.get("/options", asyncRoute(async (_request, response) => { response.json(await workflowService.options()); }));
workflowManagementRouter.get("/", asyncRoute(async (request, response) => { response.json(await workflowService.list(requestOrganizationScope(request))); }));
workflowManagementRouter.get("/:id", asyncRoute(async (request, response) => { const workflow = await workflowService.get(request.params.id, requestOrganizationScope(request)); if (!workflow) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow was not found." } }); return; } response.json(workflow); }));
workflowManagementRouter.post("/", requirePermission("workflow_templates.execute"), asyncRoute(async (request, response) => { response.status(201).json(await workflowService.start(request.body)); }));
workflowManagementRouter.patch("/:id/cancel", requirePermission("workflows.cancel"), asyncRoute(async (request, response) => { const workflow = await workflowService.cancel(request.params.id, request.body.changedBy); if (!workflow) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow was not found." } }); return; } response.json(workflow); }));