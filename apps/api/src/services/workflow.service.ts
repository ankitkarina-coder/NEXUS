import { z } from "zod";
import { taskRepository, workflowRepository, workflowTemplateRepository } from "@nexus/database";
import type { Prisma, WorkflowStatus } from "@prisma/client";
import { createTaskFromTemplate } from "./task.factory.js";

const outcomeSchema = z.object({ kind: z.enum(["SUCCESS", "FAILURE"]), action: z.enum(["GOTO_STEP", "COMPLETE_WORKFLOW", "FAIL_WORKFLOW"]), targetStepIndex: z.number().int().min(0).nullable().optional() });
const stepSchema = z.object({ friendlyName: z.string().trim().min(1, "Step name is required"), taskTemplateId: z.string().uuid(), progressBarDisplay: z.boolean().default(true), outcomes: z.array(outcomeSchema).max(2).default([]) });
const templateSchema = z.object({ name: z.string().trim().min(1, "Workflow name is required"), description: z.string().trim().optional(), active: z.boolean().default(false), customerVisible: z.boolean().default(false), progressBarEnabled: z.boolean().default(false), createdBy: z.string().uuid().optional().nullable(), steps: z.array(stepSchema).min(1, "At least one workflow step is required") });
const startSchema = z.object({ templateId: z.string().uuid(), organizationId: z.string().uuid(), createdBy: z.string().uuid().optional(), assigneeId: z.string().uuid().optional() });
const workflowStatuses = ["NOT_STARTED", "IN_PROGRESS", "COMPLETE", "FAILED", "CANCELLED"] as const;

const validateDefinition = async (raw: unknown) => {
  const input = templateSchema.parse(raw);
  const taskTemplates = await workflowTemplateRepository.taskTemplates();
  const ids = new Set(taskTemplates.map((item) => item.id));
  if (input.steps.some((step) => !ids.has(step.taskTemplateId))) throw new Error("Every workflow step must use an active task template available for workflows.");
  for (const step of input.steps) {
    const kinds = step.outcomes.map((outcome) => outcome.kind);
    if (new Set(kinds).size !== kinds.length) throw new Error("Each workflow step can have only one outcome of each kind.");
    for (const outcome of step.outcomes) if (outcome.action === "GOTO_STEP" && (outcome.targetStepIndex === null || outcome.targetStepIndex === undefined || outcome.targetStepIndex >= input.steps.length)) throw new Error("Outcome targets must reference a valid workflow step.");
  }
  return input;
};

const buildSteps = (input: z.infer<typeof templateSchema>): Prisma.WorkflowTemplateStepCreateWithoutWorkflowTemplateInput[] => input.steps.map((step, index) => ({ friendlyName: step.friendlyName, taskTemplate: { connect: { id: step.taskTemplateId } }, stepOrder: index + 1, progressBarDisplay: step.progressBarDisplay }));

export const workflowTemplateService = {
  list: () => workflowTemplateRepository.list(),
  get: (id: string) => workflowTemplateRepository.get(id),
  options: async () => ({ taskTemplates: await workflowTemplateRepository.taskTemplates(), internalUsers: await workflowTemplateRepository.internalUsers() }),
  create: async (raw: unknown) => {
    const input = await validateDefinition(raw);
    const id = await workflowRepository.transaction(async (transaction) => {
      const template = await transaction.workflowTemplate.create({ data: { name: input.name, description: input.description || null, active: input.active, customerVisible: input.customerVisible, progressBarEnabled: input.progressBarEnabled, creator: input.createdBy ? { connect: { id: input.createdBy } } : undefined, steps: { create: buildSteps(input) } } });
      const steps = await transaction.workflowTemplateStep.findMany({ where: { workflowTemplateId: template.id }, orderBy: { stepOrder: "asc" } });
      for (const [index, step] of input.steps.entries()) for (const outcome of step.outcomes) { const sourceStep = steps[index]; if (sourceStep) await transaction.workflowStepOutcome.create({ data: { sourceStepId: sourceStep.id, kind: outcome.kind, action: outcome.action, targetStepId: outcome.action === "GOTO_STEP" && outcome.targetStepIndex !== null && outcome.targetStepIndex !== undefined ? steps[outcome.targetStepIndex]?.id : undefined } }); }
      return template.id;
    });
    return workflowTemplateRepository.get(id);
  },
  update: async (id: string, raw: unknown) => {
    const input = await validateDefinition(raw);
    if (!(await workflowTemplateRepository.get(id))) return null;
    const updatedId = await workflowRepository.transaction(async (transaction) => {
      const existingSteps = await transaction.workflowTemplateStep.findMany({ where: { workflowTemplateId: id }, orderBy: { stepOrder: "asc" } });
      if (input.steps.length < existingSteps.length) {
        for (const step of existingSteps.slice(input.steps.length)) if (await transaction.workflowStepInstance.count({ where: { stepId: step.id } })) throw new Error("Workflow steps used by existing instances cannot be removed.");
      }
      await transaction.workflowTemplate.update({ where: { id }, data: { name: input.name, description: input.description || null, active: input.active, customerVisible: input.customerVisible, progressBarEnabled: input.progressBarEnabled } });
      await transaction.workflowTemplateStep.updateMany({ where: { workflowTemplateId: id }, data: { stepOrder: { increment: 1000 } } });
      const steps: { id: string }[] = [];
      for (const [index, step] of input.steps.entries()) {
        const existingStep = existingSteps[index];
        steps.push(existingStep ? await transaction.workflowTemplateStep.update({ where: { id: existingStep.id }, data: { friendlyName: step.friendlyName, taskTemplateId: step.taskTemplateId, stepOrder: index + 1, progressBarDisplay: step.progressBarDisplay } }) : await transaction.workflowTemplateStep.create({ data: { workflowTemplateId: id, friendlyName: step.friendlyName, taskTemplateId: step.taskTemplateId, stepOrder: index + 1, progressBarDisplay: step.progressBarDisplay } }));
      }
      for (const step of existingSteps.slice(input.steps.length)) await transaction.workflowTemplateStep.delete({ where: { id: step.id } });
      await transaction.workflowStepOutcome.deleteMany({ where: { sourceStep: { workflowTemplateId: id } } });
      for (const [index, step] of input.steps.entries()) {
        const sourceStep = steps[index];
        if (!sourceStep) throw new Error("Workflow step ordering could not be persisted.");
        for (const outcome of step.outcomes) {
          const targetStep = outcome.targetStepIndex === null || outcome.targetStepIndex === undefined ? undefined : steps[outcome.targetStepIndex];
          if (outcome.action === "GOTO_STEP" && !targetStep) throw new Error("Outcome target could not be persisted.");
          await transaction.workflowStepOutcome.create({ data: { sourceStepId: sourceStep.id, kind: outcome.kind, action: outcome.action, targetStepId: targetStep?.id } });
        }
      }
      return id;
    });
    return workflowTemplateRepository.get(updatedId);
  },
};

export const workflowService = {
  list: (organizationId?: string) => workflowRepository.list(organizationId),
  get: (id: string, organizationId?: string) => workflowRepository.get(id, organizationId),
  options: async () => ({ organizations: await workflowRepository.organizations(), templates: await workflowTemplateRepository.list(), internalUsers: await workflowTemplateRepository.internalUsers() }),
  start: async (raw: unknown) => {
    const input = startSchema.parse(raw);
    const template = await workflowTemplateRepository.get(input.templateId);
    if (!template || !template.active || template.steps.length === 0) throw new Error("The selected workflow template is unavailable.");
    const organizations = await workflowRepository.organizations();
    if (!organizations.some((organization) => organization.id === input.organizationId)) throw new Error("The selected organization was not found.");
    const workflowId = await workflowRepository.transaction(async (transaction) => {
      const workflow = await transaction.workflow.create({ data: { name: template.name, description: template.description, organization: { connect: { id: input.organizationId } }, template: { connect: { id: template.id } }, creator: input.createdBy ? { connect: { id: input.createdBy } } : undefined, status: "IN_PROGRESS", startedAt: new Date() } });
      await transaction.workflowStatusHistory.create({ data: { workflowId: workflow.id, previousStatus: null, newStatus: "IN_PROGRESS", changedBy: input.createdBy } });
      const firstStep = template.steps[0];
      if (!firstStep) throw new Error("The selected workflow template has no first step.");
      const task = await createWorkflowTask(transaction, workflow.id, firstStep, input.organizationId, input.createdBy, input.assigneeId);
      await transaction.workflow.update({ where: { id: workflow.id }, data: { currentStepId: task.stepInstanceId } });
      return workflow.id;
    });
    return workflowRepository.get(workflowId);
  },
  cancel: async (id: string, changedBy?: string) => { const workflowId = await workflowRepository.transaction(async (transaction) => { const workflow = await transaction.workflow.findUnique({ where: { id } }); if (!workflow) return null; if (workflow.status !== "IN_PROGRESS" && workflow.status !== "NOT_STARTED") throw new Error("Only active workflows can be cancelled."); await transaction.workflow.update({ where: { id }, data: { status: "CANCELLED" } }); await transaction.workflowStatusHistory.create({ data: { workflowId: id, previousStatus: workflow.status, newStatus: "CANCELLED", changedBy } }); return id; }); return workflowId ? workflowRepository.get(workflowId) : null; },
};

const createWorkflowTask = async (transaction: Prisma.TransactionClient, workflowId: string, step: { id: string; friendlyName: string; taskTemplateId: string }, organizationId: string, creatorId?: string, assigneeId?: string) => {
  const { task } = await createTaskFromTemplate(transaction, { title: step.friendlyName, taskTemplateId: step.taskTemplateId, organizationId, creatorId, assigneeId });
  const stepInstance = await transaction.workflowStepInstance.upsert({ where: { workflowId_stepId: { workflowId, stepId: step.id } }, update: { taskId: task.id, status: "IN_PROGRESS", startedAt: new Date(), completedAt: null, failedAt: null }, create: { workflowId, stepId: step.id, taskId: task.id, status: "IN_PROGRESS", startedAt: new Date() } });
  return { taskId: task.id, stepInstanceId: stepInstance.id };
};

export const advanceWorkflowForTask = async (transaction: Prisma.TransactionClient, taskId: string, outcomeKind: "SUCCESS" | "FAILURE" = "SUCCESS") => {
  const current = await transaction.workflowStepInstance.findUnique({
    where: { taskId },
    include: {
      workflow: true,
      step: { include: { outcomes: true, workflowTemplate: { include: { steps: { orderBy: { stepOrder: "asc" } } } } } },
    },
  });
  if (!current || current.workflow.status !== "IN_PROGRESS") return;
  const outcome = current.step.outcomes.find((item) => item.kind === outcomeKind);
  const nextStep = outcome?.action === "GOTO_STEP" && outcome.targetStepId ? current.step.workflowTemplate.steps.find((step) => step.id === outcome.targetStepId) : undefined;
  await transaction.workflowStepInstance.update({ where: { id: current.id }, data: { status: outcomeKind === "SUCCESS" ? "COMPLETE" : "FAILED", completedAt: new Date(), failedAt: outcomeKind === "FAILURE" ? new Date() : undefined } });
  if (!nextStep || outcome?.action === "COMPLETE_WORKFLOW" || !outcome) {
    const status: WorkflowStatus = outcomeKind === "SUCCESS" && outcome?.action !== "FAIL_WORKFLOW" ? "COMPLETE" : "FAILED";
    await transaction.workflow.update({ where: { id: current.workflowId }, data: { status, completedAt: status === "COMPLETE" ? new Date() : undefined, failedAt: status === "FAILED" ? new Date() : undefined, currentStepId: null } });
    await transaction.workflowStatusHistory.create({ data: { workflowId: current.workflowId, previousStatus: "IN_PROGRESS", newStatus: status, comment: outcomeKind } });
    return;
  }
  const next = await createWorkflowTask(transaction, current.workflowId, nextStep, current.workflow.organizationId!, current.workflow.createdBy || undefined);
  await transaction.workflow.update({ where: { id: current.workflowId }, data: { currentStepId: next.stepInstanceId } });
};