import { Router } from "express";
import { requireAuth, requirePermission, requireRole, requestUser } from "../middleware/auth.js";
import { adminService } from "../services/admin.service.js";

export const adminRouter = Router();
const asyncRoute = (handler: (request: any, response: any, next: any) => Promise<void>) => async (request: any, response: any, next: any) => { try { await handler(request, response, next); } catch (error) { next(error); } };
adminRouter.use(requireAuth);

adminRouter.get("/overview", requirePermission("organizations.read"), asyncRoute(async (request, response) => { response.json(await adminService.overview(requestUser(request))); }));
adminRouter.get("/organizations", requirePermission("organizations.read"), asyncRoute(async (request, response) => { response.json(await adminService.organizations(requestUser(request), request.query)); }));
adminRouter.get("/organizations/:id", requirePermission("organizations.read"), asyncRoute(async (request, response) => { const value = await adminService.organization(requestUser(request), request.params.id); if (!value) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Organization was not found." } }); return; } response.json(value); }));
adminRouter.post("/organizations", requirePermission("organizations.create"), asyncRoute(async (request, response) => { response.status(201).json(await adminService.createOrganization(requestUser(request), request.body)); }));
adminRouter.put("/organizations/:id", requirePermission("organizations.update"), asyncRoute(async (request, response) => { response.json(await adminService.updateOrganization(requestUser(request), request.params.id, request.body)); }));

adminRouter.get("/users", requirePermission("users.read"), asyncRoute(async (request, response) => { response.json(await adminService.users(requestUser(request), request.query)); }));
adminRouter.post("/users/internal", requirePermission("users.create"), asyncRoute(async (request, response) => { response.status(201).json(await adminService.createInternalUser(requestUser(request), request.body)); }));
adminRouter.put("/users/internal/:id", requirePermission("users.update"), asyncRoute(async (request, response) => { const value = await adminService.updateInternalUser(requestUser(request), request.params.id, request.body); if (!value) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Internal user was not found." } }); return; } response.json(value); }));
adminRouter.post("/users/organization", requirePermission("users.create"), asyncRoute(async (request, response) => { response.status(201).json(await adminService.createOrganizationUser(requestUser(request), request.body)); }));
adminRouter.put("/users/organization/:id", requirePermission("users.update"), asyncRoute(async (request, response) => { const value = await adminService.updateOrganizationUser(requestUser(request), request.params.id, request.body); if (!value) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Organization user was not found." } }); return; } response.json(value); }));

adminRouter.get("/roles", requirePermission("settings.read"), asyncRoute(async (_request, response) => { response.json(await adminService.roles()); }));
adminRouter.get("/permissions", requirePermission("settings.read"), asyncRoute(async (_request, response) => { response.json(await adminService.permissions()); }));
adminRouter.put("/roles/:id/permissions", requireRole("SUPER_ADMIN"), asyncRoute(async (request, response) => { response.json(await adminService.updateRole(requestUser(request), request.params.id, request.body.permissionIds || [])); }));

adminRouter.get("/message-templates", requirePermission("message_templates.read"), asyncRoute(async (_request, response) => { response.json(await adminService.messageTemplates()); }));
adminRouter.post("/message-templates", requirePermission("message_templates.create"), asyncRoute(async (request, response) => { response.status(201).json(await adminService.createMessageTemplate(requestUser(request), request.body)); }));
adminRouter.put("/message-templates/:id", requirePermission("message_templates.update"), asyncRoute(async (request, response) => { response.json(await adminService.updateMessageTemplate(requestUser(request), request.params.id, request.body)); }));

adminRouter.get("/tasks", requirePermission("tasks.read"), asyncRoute(async (request, response) => { response.json(await adminService.tasks(requestUser(request), request.query)); }));
adminRouter.get("/workflows", requirePermission("workflows.read"), asyncRoute(async (request, response) => { response.json(await adminService.workflows(requestUser(request), request.query)); }));
adminRouter.get("/activity", requirePermission("audit_logs.read"), asyncRoute(async (request, response) => { response.json(await adminService.auditLogs(request.query)); }));
