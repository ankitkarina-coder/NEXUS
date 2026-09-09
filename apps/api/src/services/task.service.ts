import { z } from "zod";
import { taskRepository } from "@nexus/database";
import type { TaskStatus } from "@prisma/client";
import { createTaskFromTemplate } from "./task.factory.js";

const statuses = ["BACKLOG", "PENDING", "IN_PROGRESS", "COMPLETE", "FAILED"] as const;
const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Task name is required"),
  description: z.string().trim().optional(),
  taskTemplateId: z.string().uuid("A valid task template is required"),
  organizationId: z.string().uuid().optional().nullable(),
  creatorId: z.string().uuid().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  workflowId: z.string().uuid().optional().nullable(),
  requiredData: z.array(z.object({ requiredFieldId: z.string().uuid(), observedValue: z.string().trim().optional().nullable(), satisfied: z.boolean().optional() })).optional(),
});
const updateSchema = taskInputSchema.partial().omit({ taskTemplateId: true });
const statusSchema = z.object({ status: z.enum(statuses), comment: z.string().trim().optional(), changedBy: z.string().uuid().optional(), outcomeKind: z.enum(["SUCCESS", "FAILURE"]).optional() });
const commentSchema = z.object({ comment: z.string().trim().min(1, "Comment is required"), authorId: z.string().uuid().optional() });

const transitions: Record<TaskStatus, TaskStatus[]> = { BACKLOG: ["PENDING", "IN_PROGRESS", "FAILED"], PENDING: ["IN_PROGRESS", "COMPLETE", "FAILED"], IN_PROGRESS: ["COMPLETE", "FAILED", "PENDING"], COMPLETE: [], FAILED: ["PENDING"] };

const validateAssignee = async (assigneeId?: string | null) => {
  if (!assigneeId) return;
  const users = await taskRepository.internalUsers();
  if (!users.some((user) => user.id === assigneeId)) throw new Error("The selected assignee is not available.");
};

const validateTemplate = async (id: string) => {
  const templates = await taskRepository.templates();
  const template = templates.find((item) => item.id === id);
  if (!template) throw new Error("The selected task template is unavailable.");
  return template;
};

export const taskService = {
  list: (organizationId?: string) => taskRepository.list(organizationId),
  get: (id: string, organizationId?: string) => taskRepository.get(id, organizationId),
  options: async () => ({ templates: await taskRepository.templates(), internalUsers: await taskRepository.internalUsers(), workflows: await taskRepository.workflows(), organizations: await taskRepository.organizations() }),
  create: async (raw: unknown) => {
    const input = taskInputSchema.parse(raw);
    const template = await validateTemplate(input.taskTemplateId);
    await validateAssignee(input.assigneeId);
    if (template.executionType === "BOT" && input.assigneeId) throw new Error("Bot tasks cannot have a human assignee.");
    if (template.executionType !== "BOT" && !template.selfAssigned && !input.assigneeId && !template.defaultAssigneeId) throw new Error("This task template requires an assignee.");
    const assigneeId = input.assigneeId || (template.selfAssigned ? undefined : template.defaultAssigneeId || undefined);
    return taskRepository.transaction(async (transaction) => {
      const { task } = await createTaskFromTemplate(transaction, { title: input.title, description: input.description, taskTemplateId: input.taskTemplateId, organizationId: input.organizationId, creatorId: input.creatorId, assigneeId, requiredData: input.requiredData });
      if (input.workflowId) {
        const workflow = await transaction.workflow.findUnique({ where: { id: input.workflowId }, include: { template: { include: { steps: { orderBy: { stepOrder: "asc" } } } } } });
        const firstStep = workflow?.template?.steps[0];
        if (!workflow || !firstStep) throw new Error("The selected workflow has no available first step.");
        await transaction.workflowStepInstance.create({ data: { workflow: { connect: { id: workflow.id } }, step: { connect: { id: firstStep.id } }, task: { connect: { id: task.id } } } });
      }
      return taskRepository.get(task.id);
    });
  },
  update: async (id: string, raw: unknown) => {
    const input = updateSchema.parse(raw);
    if (!(await taskRepository.get(id))) return null;
    await validateAssignee(input.assigneeId);
    return taskRepository.update(id, { title: input.title, description: input.description, dueAt: input.dueAt, assignee: input.assigneeId === null ? { disconnect: true } : input.assigneeId ? { connect: { id: input.assigneeId } } : undefined });
  },
  changeStatus: async (id: string, raw: unknown) => {
    const input = statusSchema.parse(raw);
    const existing = await taskRepository.get(id);
    if (!existing) return null;
    if (existing.status === input.status) return existing;
    if (!transitions[existing.status].includes(input.status)) throw new Error(`Task status cannot change from ${existing.status} to ${input.status}.`);
    if (input.status === "COMPLETE") {
      const condition = existing.taskTemplate.condition;
      const missingFields = existing.requiredData.filter((data) => data.requiredField.required && !data.satisfied);
      if (condition?.completionDescriptionRequired && !input.comment?.trim()) throw new Error("A completion comment is required.");
      if (missingFields.length > 0) throw new Error("Complete all required task data before completing this task.");
    }
    return taskRepository.transaction(async (transaction) => {
      await transaction.task.update({ where: { id }, data: { status: input.status, completedAt: input.status === "COMPLETE" ? new Date() : null, completionComment: input.status === "COMPLETE" ? input.comment || null : undefined } });
      await taskRepository.statusHistory(id, { previousStatus: existing.status, newStatus: input.status, comment: input.comment, changer: input.changedBy ? { connect: { id: input.changedBy } } : undefined }, transaction);
      if (existing.workflowStep && (input.status === "COMPLETE" || input.status === "FAILED")) {
        const { advanceWorkflowForTask } = await import("./workflow.service.js");
        await advanceWorkflowForTask(transaction, id, input.outcomeKind || (input.status === "COMPLETE" ? "SUCCESS" : "FAILURE"));
      }
      return taskRepository.get(id);
    });
  },
  addComment: async (id: string, raw: unknown) => { const input = commentSchema.parse(raw); if (!(await taskRepository.get(id))) return null; return taskRepository.addComment(id, input); },
};