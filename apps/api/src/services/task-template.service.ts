import { z } from "zod";
import { taskTemplateRepository } from "@nexus/database";
import type { Prisma } from "@prisma/client";

const executionTypes = ["BOT", "BOT_HUMAN_CONFIRMATION", "HUMAN"] as const;
const media = ["EMAIL", "WHATSAPP", "LINKEDIN"] as const;
const composeModes = ["MANUAL", "TEMPLATE"] as const;

export const taskTemplateInputSchema = z.object({
  categoryName: z.string().trim().min(1, "Category name is required"),
  description: z.string().trim().optional(),
  executionType: z.enum(executionTypes),
  selfAssigned: z.boolean().default(false),
  defaultAssigneeId: z.string().uuid().nullable().optional(),
  availableForTasks: z.boolean().default(true),
  availableForWorkflows: z.boolean().default(true),
  statusChangeByAssignee: z.boolean().default(true),
  statusChangeByAssigner: z.boolean().default(true),
  defaultSlaBusinessDays: z.number().int().positive().nullable().optional(),
  autoCompleteAfterBotAction: z.boolean().default(false),
  specificDataFieldsRequired: z.boolean().default(false),
  message: z.object({
    enabled: z.boolean(),
    medium: z.enum(media).optional(),
    recipientConfiguration: z.string().optional(),
    ccConfiguration: z.string().optional(),
    accountConfiguration: z.string().optional(),
    composeMode: z.enum(composeModes).optional(),
    messageTemplateId: z.string().uuid().nullable().optional(),
    messageTemplateName: z.string().trim().min(1).optional(),
    emailSubjectTitle: z.string().trim().optional(),
  }).optional(),
  conditions: z.object({
    completionDescriptionRequired: z.boolean().default(false),
    requiredFields: z.array(z.object({ entity: z.string().trim().min(1), fieldName: z.string().trim().min(1), required: z.boolean().default(true) })).default([]),
  }).default({ completionDescriptionRequired: false, requiredFields: [] }),
});

export type TaskTemplateInput = z.infer<typeof taskTemplateInputSchema>;

const validateInput = (input: TaskTemplateInput) => {
  if (input.executionType === "BOT" && input.defaultAssigneeId) throw new Error("Bot templates cannot have a human default assignee.");
  if (input.executionType !== "BOT" && !input.selfAssigned && !input.defaultAssigneeId) throw new Error("Select self assigned or an employee default assignee.");
  if (input.executionType !== "BOT" && input.autoCompleteAfterBotAction) throw new Error("Only bot templates can auto-complete after a bot action.");
  if (input.specificDataFieldsRequired && input.conditions.requiredFields.length === 0) throw new Error("Specific data fields are enabled but no fields were provided.");
  if (input.autoCompleteAfterBotAction && (input.conditions.completionDescriptionRequired || input.conditions.requiredFields.length > 0)) throw new Error("Auto-complete bot templates cannot have completion conditions.");
  if (!input.message?.enabled) return;
  if (!input.message.medium) throw new Error("Message medium is required.");
  if (!input.message.composeMode) throw new Error("Compose mode is required.");
  if (input.executionType === "BOT" && input.message.composeMode !== "TEMPLATE") throw new Error("Bot messages must use a message template.");
  if (input.message.medium === "EMAIL" && !input.message.emailSubjectTitle) throw new Error("Email subject is required for email messages.");
  if (input.message.composeMode === "TEMPLATE" && !input.message.messageTemplateId && !input.message.messageTemplateName) throw new Error("Select or create a message template.");
  if (input.message.medium !== "EMAIL" && input.message.ccConfiguration) throw new Error("CC is only available for email messages.");
};

const messageData = async (input: TaskTemplateInput): Promise<Prisma.TaskTemplateMessageCreateWithoutTaskTemplateInput | undefined> => {
  if (!input.message?.enabled) return undefined;
  const { messageTemplateId, messageTemplateName, enabled, ...message } = input.message;
  return {
    ...message,
    enabled,
    ...(messageTemplateId ? { messageTemplate: { connect: { id: messageTemplateId } } } : messageTemplateName ? { messageTemplate: { create: { name: messageTemplateName } } } : {}),
  } as Prisma.TaskTemplateMessageCreateWithoutTaskTemplateInput;
};

const buildCreateData = async (input: TaskTemplateInput): Promise<Prisma.TaskTemplateCreateInput> => {
  const message = await messageData(input);
  return {
  categoryName: input.categoryName,
  description: input.description || null,
  executionType: input.executionType,
  selfAssigned: input.executionType === "BOT" ? false : input.selfAssigned,
  defaultAssignee: input.executionType !== "BOT" && input.defaultAssigneeId ? { connect: { id: input.defaultAssigneeId } } : undefined,
  availableForTasks: input.availableForTasks,
  availableForWorkflows: input.availableForWorkflows,
  statusChangeByAssignee: input.statusChangeByAssignee,
  statusChangeByAssigner: input.statusChangeByAssigner,
  defaultSlaBusinessDays: input.defaultSlaBusinessDays ?? null,
  autoCompleteAfterBotAction: input.autoCompleteAfterBotAction,
  specificDataFieldsRequired: input.specificDataFieldsRequired,
  completionDescriptionRequired: input.conditions.completionDescriptionRequired,
  message: message ? { create: message } : undefined,
  condition: { create: { completionDescriptionRequired: input.conditions.completionDescriptionRequired, requiredFields: { create: input.conditions.requiredFields } } },
  };
};

export const taskTemplateService = {
  list: () => taskTemplateRepository.list(),
  get: (id: string) => taskTemplateRepository.get(id),
  internalUsers: () => taskTemplateRepository.internalUsers(),
  messageTemplates: () => taskTemplateRepository.messageTemplates(),
  create: async (raw: unknown) => { const input = taskTemplateInputSchema.parse(raw); validateInput(input); return taskTemplateRepository.create(await buildCreateData(input)); },
  update: async (id: string, raw: unknown) => {
    const input = taskTemplateInputSchema.parse(raw); validateInput(input);
    const data = await buildCreateData(input);
    const updateData: Prisma.TaskTemplateUpdateInput = { ...data, defaultAssignee: input.executionType !== "BOT" && input.defaultAssigneeId ? { connect: { id: input.defaultAssigneeId } } : { disconnect: true }, message: input.message?.enabled ? { upsert: { create: data.message?.create as Prisma.TaskTemplateMessageCreateWithoutTaskTemplateInput, update: data.message?.create as Prisma.TaskTemplateMessageUpdateWithoutTaskTemplateInput } } : undefined, condition: { upsert: { create: data.condition?.create as Prisma.TaskTemplateConditionCreateWithoutTaskTemplateInput, update: { completionDescriptionRequired: input.conditions.completionDescriptionRequired, requiredFields: { deleteMany: {}, create: input.conditions.requiredFields } } } } };
    await taskTemplateRepository.update(id, updateData);
    if (!input.message?.enabled) await taskTemplateRepository.deleteMessage(id);
    return taskTemplateRepository.get(id);
  },
  deactivate: (id: string) => taskTemplateRepository.deactivate(id),
};