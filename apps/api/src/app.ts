import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { healthRouter } from "./modules/health/health.routes.js";
import { organizationRouter, taskRouter, taskTemplateRouter, userRouter, workflowRouter, workflowTemplateRouter } from "./modules/crm.routes.js";
import { taskTemplateManagementRouter } from "./modules/task-templates.routes.js";
import { taskManagementRouter } from "./modules/tasks.routes.js";
import { workflowManagementRouter, workflowTemplateManagementRouter } from "./modules/workflows.routes.js";
import { authRouter } from "./modules/auth.routes.js";
import { adminRouter } from "./modules/admin.routes.js";
import { requireAuth, requirePermission } from "./middleware/auth.js";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/organizations", requireAuth, requirePermission("organizations.read"), organizationRouter);
  app.use("/api/users", requireAuth, requirePermission("users.read"), userRouter);
  app.use("/api/task-templates", requireAuth, requirePermission("task_templates.read"), taskTemplateManagementRouter);
  app.use("/api/tasks", requireAuth, requirePermission("tasks.read"), taskManagementRouter);
  app.use("/api/workflow-templates", requireAuth, requirePermission("workflow_templates.read"), workflowTemplateManagementRouter);
  app.use("/api/workflows", requireAuth, requirePermission("workflows.read"), workflowManagementRouter);
  app.use("/api/admin/task-templates", requireAuth, requirePermission("task_templates.read"), taskTemplateManagementRouter);
  app.use("/api/admin/workflow-templates", requireAuth, requirePermission("workflow_templates.read"), workflowTemplateManagementRouter);

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({ error: { code: "VALIDATION_ERROR", message: error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") } });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const status = error.code === "P2002" ? 409 : error.code === "P2025" ? 404 : 503;
      response.status(status).json({ error: { code: error.code, message: status === 409 ? "A conflicting record already exists." : status === 404 ? "The requested record was not found." : "The database is unavailable." } });
      return;
    }
    if (error instanceof Error && error.message === "This record is outside your organization scope.") {
      response.status(403).json({ error: { code: "FORBIDDEN", message: error.message } });
      return;
    }
    if (error instanceof Error && error.message) {
      response.status(400).json({ error: { code: "VALIDATION_ERROR", message: error.message } });
      return;
    }
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
  };
  app.use(errorHandler);

  return app;
};