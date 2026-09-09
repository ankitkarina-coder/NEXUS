import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { crmService } from "../services/crm.service.js";
import { requestOrganizationScope } from "../middleware/auth.js";

const route = (handler: RequestHandler): RequestHandler => async (request, response, next) => {
  try { await handler(request, response, next); } catch (error) { next(error); }
};

const createRouter = <T extends z.ZodTypeAny>(schema: T, list: (organizationId?: string) => Promise<unknown>, create: (data: z.infer<T>) => Promise<unknown>) => {
  const router = Router();
  router.get("/", route(async (request, response) => { response.json(await list(requestOrganizationScope(request))); }));
  router.post("/", route(async (request, response) => {
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }); return; }
    response.status(201).json(await create(parsed.data));
  }));
  return router;
};

export const organizationRouter = createRouter(z.object({ name: z.string().min(1), website: z.string().url().optional(), description: z.string().optional(), status: z.string().optional() }), crmService.organizations.list, crmService.organizations.create);
export const userRouter = createRouter(z.object({ firstName: z.string().min(1), lastName: z.string().min(1), email: z.string().email(), organizationId: z.string().uuid().optional(), phone: z.string().optional() }), crmService.users.list, crmService.users.create);
export const taskTemplateRouter = createRouter(z.object({ categoryName: z.string().min(1), description: z.string().optional(), executionType: z.enum(["BOT", "BOT_HUMAN_CONFIRMATION", "HUMAN"]) }), crmService.taskTemplates.list, crmService.taskTemplates.create);
export const taskRouter = createRouter(z.object({ taskTemplateId: z.string().uuid(), title: z.string().min(1), description: z.string().optional(), organizationId: z.string().uuid().optional(), creatorId: z.string().uuid().optional(), assigneeId: z.string().uuid().optional() }), crmService.tasks.list, crmService.tasks.create);
export const workflowTemplateRouter = createRouter(z.object({ name: z.string().min(1), description: z.string().optional(), active: z.boolean().optional(), customerVisible: z.boolean().optional(), progressBarEnabled: z.boolean().optional() }), crmService.workflowTemplates.list, crmService.workflowTemplates.create);
export const workflowRouter = createRouter(z.object({ name: z.string().min(1), description: z.string().optional(), organizationId: z.string().uuid().optional(), templateId: z.string().uuid().optional(), createdBy: z.string().uuid().optional() }), crmService.workflows.list, crmService.workflows.create);