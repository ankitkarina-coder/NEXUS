import type { Prisma } from "@prisma/client";

export type TaskFactoryInput = {
  title: string;
  description?: string | null;
  taskTemplateId: string;
  organizationId?: string | null;
  creatorId?: string | null;
  assigneeId?: string | null;
  requiredData?: { requiredFieldId: string; observedValue?: string | null; satisfied?: boolean }[];
};

export const createTaskFromTemplate = async (transaction: Prisma.TransactionClient, input: TaskFactoryInput) => {
  const template = await transaction.taskTemplate.findUnique({ where: { id: input.taskTemplateId }, include: { condition: { include: { requiredFields: true } } } });
  if (!template) throw new Error("The selected task template was not found.");
  const resolvedAssignee = input.assigneeId || (template.selfAssigned ? undefined : template.defaultAssigneeId || undefined);
  const task = await transaction.task.create({ data: { title: input.title, description: input.description ?? template.description, taskTemplate: { connect: { id: template.id } }, organization: input.organizationId ? { connect: { id: input.organizationId } } : undefined, creator: input.creatorId ? { connect: { id: input.creatorId } } : undefined, assignee: resolvedAssignee ? { connect: { id: resolvedAssignee } } : undefined, requiredData: template.condition?.requiredFields.length ? { create: template.condition.requiredFields.map((field) => ({ requiredField: { connect: { id: field.id } }, observedValue: input.requiredData?.find((item) => item.requiredFieldId === field.id)?.observedValue || null, satisfied: input.requiredData?.find((item) => item.requiredFieldId === field.id)?.satisfied || false })) } : undefined } });
  await transaction.taskStatusHistory.create({ data: { taskId: task.id, previousStatus: null, newStatus: "BACKLOG", changedBy: input.creatorId || undefined } });
  return { task, template };
};
