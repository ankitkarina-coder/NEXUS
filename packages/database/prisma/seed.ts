import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient, ExecutionType, MessageMedium, ComposeMode, TaskStatus } from "@prisma/client";

const prisma = new PrismaClient();
const passwordHash = (password: string) => { const salt = randomBytes(16).toString("hex"); return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`; };
const permissionKeys = ["organizations.read", "organizations.create", "organizations.update", "organizations.delete", "users.read", "users.create", "users.update", "users.disable", "task_templates.read", "task_templates.create", "task_templates.update", "task_templates.deactivate", "tasks.read", "tasks.create", "tasks.update", "tasks.complete", "workflow_templates.read", "workflow_templates.create", "workflow_templates.update", "workflow_templates.execute", "workflows.read", "workflows.cancel", "message_templates.read", "message_templates.create", "message_templates.update", "settings.read", "settings.update", "audit_logs.read"];

async function main() {
  const employee = await prisma.internalUser.upsert({ where: { email: "alex.rivera@ness.com" }, update: {}, create: { firstName: "Alex", lastName: "Rivera", email: "alex.rivera@ness.com" } });
  const organizations = await Promise.all([
    prisma.organization.upsert({ where: { id: "00000000-0000-0000-0000-000000000001" }, update: {}, create: { id: "00000000-0000-0000-0000-000000000001", name: "Northstar Labs", status: "CONFIRMED_OPPORTUNITY", website: "https://northstar.example", countryOfIncorporation: "United Kingdom" } }),
    prisma.organization.upsert({ where: { id: "00000000-0000-0000-0000-000000000002" }, update: {}, create: { id: "00000000-0000-0000-0000-000000000002", name: "Juniper & Co", status: "PROSPECT", website: "https://juniper.example", countryOfIncorporation: "United States" } }),
  ]);
  const permissions = await Promise.all(permissionKeys.map((key) => prisma.permission.upsert({ where: { key }, update: {}, create: { key } })));
  const roleDefinitions = [
    { name: "SUPER_ADMIN", description: "Full system access", keys: permissionKeys },
    { name: "ADMIN", description: "System administration", keys: permissionKeys.filter((key) => key !== "organizations.delete") },
    { name: "MANAGER", description: "Organization operations", keys: permissionKeys.filter((key) => key.endsWith(".read") || key.startsWith("tasks.") || key.startsWith("workflows.")) },
    { name: "USER", description: "Internal application user", keys: ["tasks.read", "tasks.create", "tasks.update", "tasks.complete", "workflows.read"] },
    { name: "ORG_USER", description: "Restricted organization user", keys: ["tasks.read", "workflows.read"] },
  ];
  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({ where: { name: definition.name }, update: { description: definition.description, protected: definition.name === "SUPER_ADMIN" }, create: { name: definition.name, description: definition.description, protected: definition.name === "SUPER_ADMIN" } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({ data: permissions.filter((permission) => definition.keys.includes(permission.key)).map((permission) => ({ roleId: role.id, permissionId: permission.id })) });
  }
  const developmentUsers = [
    { firstName: "Alex", lastName: "Rivera", email: "superadmin@nexus.local", role: "SUPER_ADMIN", organizationId: null, password: "NexusDev123!" },
    { firstName: "Ada", lastName: "Admin", email: "admin@nexus.local", role: "ADMIN", organizationId: null, password: "NexusDev123!" },
    { firstName: "Morgan", lastName: "Manager", email: "manager@nexus.local", role: "MANAGER", organizationId: organizations[0].id, password: "NexusDev123!" },
    { firstName: "Uma", lastName: "User", email: "user@nexus.local", role: "USER", organizationId: organizations[0].id, password: "NexusDev123!" },
    { firstName: "Olivia", lastName: "Org", email: "orguser@nexus.local", role: "ORG_USER", organizationId: organizations[0].id, password: "NexusDev123!" },
  ];
  for (const definition of developmentUsers) {
    const role = roleDefinitions.find((item) => item.name === definition.role)!;
    const roleRecord = await prisma.role.findUnique({ where: { name: role.name } });
    const user = await prisma.internalUser.upsert({ where: { email: definition.email }, update: { firstName: definition.firstName, lastName: definition.lastName, passwordHash: passwordHash(definition.password), active: true, organizationId: definition.organizationId }, create: { firstName: definition.firstName, lastName: definition.lastName, email: definition.email, passwordHash: passwordHash(definition.password), organizationId: definition.organizationId } });
    if (roleRecord) await prisma.internalUserRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: roleRecord.id } }, update: {}, create: { userId: user.id, roleId: roleRecord.id } });
  }
  await prisma.internalUserRole.upsert({ where: { userId_roleId: { userId: employee.id, roleId: (await prisma.role.findUniqueOrThrow({ where: { name: "SUPER_ADMIN" } })).id } }, update: {}, create: { userId: employee.id, roleId: (await prisma.role.findUniqueOrThrow({ where: { name: "SUPER_ADMIN" } })).id } });
  await Promise.all([
    prisma.user.upsert({ where: { email: "maya.chen@northstar.example" }, update: {}, create: { firstName: "Maya", lastName: "Chen", email: "maya.chen@northstar.example", organizationId: organizations[0].id, role: "Operations Lead" } }),
    prisma.user.upsert({ where: { email: "sam.taylor@juniper.example" }, update: {}, create: { firstName: "Sam", lastName: "Taylor", email: "sam.taylor@juniper.example", organizationId: organizations[1].id, role: "Founder" } }),
  ]);

  const templateDefinitions = [
    { name: "First Email", description: "Initial customer outreach", executionType: ExecutionType.BOT, message: { medium: MessageMedium.EMAIL, composeMode: ComposeMode.TEMPLATE, subject: "A quick introduction" }, requiredFields: [] },
    { name: "Second Nudge Email", description: "Second follow-up touchpoint", executionType: ExecutionType.HUMAN, message: { medium: MessageMedium.EMAIL, composeMode: ComposeMode.MANUAL, subject: "Following up" }, requiredFields: [] },
    { name: "Third Nudge Email", description: "Third follow-up touchpoint", executionType: ExecutionType.HUMAN, message: null, requiredFields: [] },
    { name: "Customer Setup", description: "Prepare a new customer workspace", executionType: ExecutionType.HUMAN, message: null, requiredFields: [{ entity: "Organization", fieldName: "ness_customer_id" }] },
    { name: "Follow Up", description: "General customer follow-up", executionType: ExecutionType.BOT_HUMAN_CONFIRMATION, message: null, requiredFields: [] },
  ] as const;
  const templates = new Map<string, string>();
  for (const definition of templateDefinitions) {
    const existing = await prisma.taskTemplate.findFirst({ where: { categoryName: definition.name } });
    const messageTemplate = definition.message?.composeMode === ComposeMode.TEMPLATE ? await prisma.messageTemplate.upsert({ where: { id: "00000000-0000-0000-0000-000000000101" }, update: { name: "First Email Template" }, create: { id: "00000000-0000-0000-0000-000000000101", name: "First Email Template", content: "Hello {{organization.name}}" } }) : undefined;
    const data = { categoryName: definition.name, description: definition.description, executionType: definition.executionType, availableForTasks: true, availableForWorkflows: true, selfAssigned: definition.executionType !== ExecutionType.BOT, message: definition.message ? { create: { enabled: true, medium: definition.message.medium, composeMode: definition.message.composeMode, emailSubjectTitle: definition.message.subject, messageTemplate: messageTemplate ? { connect: { id: messageTemplate.id } } : undefined } } : undefined, condition: { create: { completionDescriptionRequired: false, requiredFields: { create: definition.requiredFields } } } };
    let template;
    if (existing) {
      template = await prisma.taskTemplate.update({ where: { id: existing.id }, data: { ...data, message: undefined, condition: undefined } });
      if (definition.message) {
        await prisma.taskTemplateMessage.upsert({ where: { taskTemplateId: existing.id }, update: data.message.create, create: { ...data.message.create, taskTemplate: { connect: { id: existing.id } } } });
      } else {
        await prisma.taskTemplateMessage.deleteMany({ where: { taskTemplateId: existing.id } });
      }
      await prisma.taskTemplateCondition.upsert({ where: { taskTemplateId: existing.id }, update: { completionDescriptionRequired: false }, create: { taskTemplate: { connect: { id: existing.id } }, completionDescriptionRequired: false, requiredFields: { create: definition.requiredFields } } });
    } else {
      template = await prisma.taskTemplate.create({ data });
    }
    templates.set(definition.name, template.id);
  }
  const workflow = await prisma.workflowTemplate.findFirst({ where: { name: "Marketing Follow-up Sequence" } }) ?? await prisma.workflowTemplate.create({
    data: {
      name: "Marketing Follow-up Sequence",
      description: "Three-step follow-up sequence",
      active: true,
      createdBy: employee.id,
      progressBarEnabled: true,
      steps: {
        create: [["First Email", 1], ["Second Nudge Email", 2], ["Third Nudge Email", 3]].map(([name, stepOrder]) => ({
          taskTemplateId: templates.get(name as string)!,
          stepOrder: stepOrder as number,
          friendlyName: name as string,
        })),
      },
    },
  });
  const workflowTemplateSteps = await prisma.workflowTemplateStep.findMany({ where: { workflowTemplateId: workflow.id }, orderBy: { stepOrder: "asc" } });
  if (workflowTemplateSteps.length && (await prisma.workflowStepOutcome.count({ where: { sourceStepId: workflowTemplateSteps[0].id } })) === 0) {
    for (const [index, step] of workflowTemplateSteps.entries()) {
      await prisma.workflowStepOutcome.create({ data: { sourceStepId: step.id, kind: "SUCCESS", action: index === workflowTemplateSteps.length - 1 ? "COMPLETE_WORKFLOW" : "GOTO_STEP", targetStepId: index === workflowTemplateSteps.length - 1 ? undefined : workflowTemplateSteps[index + 1].id } });
      await prisma.workflowStepOutcome.create({ data: { sourceStepId: step.id, kind: "FAILURE", action: "FAIL_WORKFLOW" } });
    }
  }
  const demoWorkflow = await prisma.workflow.findFirst({ where: { name: "Northstar onboarding" } }) ?? await prisma.workflow.create({ data: { name: "Northstar onboarding", description: "Demo customer onboarding workflow", organizationId: organizations[0].id, templateId: workflow.id, createdBy: employee.id, status: "IN_PROGRESS" } });
  const workflowSteps = await prisma.workflowTemplateStep.findMany({ where: { workflowTemplateId: workflow.id }, orderBy: { stepOrder: "asc" } });
  for (const step of workflowSteps) {
    await prisma.workflowStepInstance.upsert({ where: { workflowId_stepId: { workflowId: demoWorkflow.id, stepId: step.id } }, update: {}, create: { workflowId: demoWorkflow.id, stepId: step.id, status: step.stepOrder === 1 ? "IN_PROGRESS" : "PENDING", startedAt: step.stepOrder === 1 ? new Date() : undefined } });
  }
  const demoTasks = [
    { id: "00000000-0000-0000-0000-000000000201", title: "Send first introduction", template: "First Email", organizationId: organizations[0].id, assigneeId: employee.id, status: TaskStatus.IN_PROGRESS, dueAt: new Date("2026-09-10T12:00:00Z") },
    { id: "00000000-0000-0000-0000-000000000202", title: "Prepare customer workspace", template: "Customer Setup", organizationId: organizations[0].id, assigneeId: employee.id, status: TaskStatus.PENDING, dueAt: new Date("2026-09-12T12:00:00Z") },
    { id: "00000000-0000-0000-0000-000000000203", title: "Review follow-up sequence", template: "Follow Up", organizationId: organizations[1].id, assigneeId: employee.id, status: TaskStatus.BACKLOG, dueAt: null },
  ] as const;
  for (const definition of demoTasks) {
    const templateId = templates.get(definition.template)!;
    const task = await prisma.task.upsert({ where: { id: definition.id }, update: { title: definition.title, status: definition.status, dueAt: definition.dueAt }, create: { id: definition.id, title: definition.title, taskTemplateId: templateId, organizationId: definition.organizationId, creatorId: employee.id, assigneeId: definition.assigneeId, status: definition.status, dueAt: definition.dueAt } });
    await prisma.taskStatusHistory.deleteMany({ where: { taskId: task.id } });
    await prisma.taskStatusHistory.create({ data: { taskId: task.id, previousStatus: null, newStatus: definition.status, changedBy: employee.id } });
    const condition = await prisma.taskTemplateCondition.findUnique({ where: { taskTemplateId: templateId }, include: { requiredFields: true } });
    if (condition?.requiredFields.length) await prisma.taskRequiredData.createMany({ data: condition.requiredFields.map((field) => ({ taskId: task.id, requiredFieldId: field.id, satisfied: false })), skipDuplicates: true });
  }
  const runningStep = await prisma.workflowStepInstance.findFirst({ where: { workflowId: demoWorkflow.id }, orderBy: { createdAt: "asc" } });
  const runningTask = await prisma.task.findUnique({ where: { id: demoTasks[0].id } });
  if (runningStep && runningTask) {
    await prisma.workflowStepInstance.update({ where: { id: runningStep.id }, data: { taskId: runningTask.id, status: "IN_PROGRESS", startedAt: new Date() } });
    await prisma.workflow.update({ where: { id: demoWorkflow.id }, data: { currentStepId: runningStep.id, status: "IN_PROGRESS", startedAt: new Date() } });
  }
  const completedWorkflow = await prisma.workflow.findFirst({ where: { name: "Juniper completed onboarding" } }) ?? await prisma.workflow.create({ data: { name: "Juniper completed onboarding", description: "Completed demo workflow", organizationId: organizations[1].id, templateId: workflow.id, createdBy: employee.id, status: "COMPLETE", startedAt: new Date("2026-09-01T10:00:00Z"), completedAt: new Date("2026-09-02T16:00:00Z") } });
  const completedSteps = await prisma.workflowStepInstance.findMany({ where: { workflowId: completedWorkflow.id } });
  if (completedSteps.length === 0) {
    for (const step of workflowTemplateSteps) await prisma.workflowStepInstance.create({ data: { workflowId: completedWorkflow.id, stepId: step.id, status: "COMPLETE", startedAt: new Date("2026-09-01T10:00:00Z"), completedAt: new Date("2026-09-02T16:00:00Z") } });
  }
  if (await prisma.workflowStatusHistory.count({ where: { workflowId: completedWorkflow.id } }) === 0) await prisma.workflowStatusHistory.createMany({ data: [{ workflowId: completedWorkflow.id, previousStatus: null, newStatus: "IN_PROGRESS", changedAt: new Date("2026-09-01T10:00:00Z") }, { workflowId: completedWorkflow.id, previousStatus: "IN_PROGRESS", newStatus: "COMPLETE", changedAt: new Date("2026-09-02T16:00:00Z") }] });
  console.log(`Seeded employee ${employee.email}, ${organizations.length} organizations, ${templates.size} task templates, ${demoTasks.length} tasks, workflow ${workflow.name}.`);
}

main().finally(() => prisma.$disconnect());