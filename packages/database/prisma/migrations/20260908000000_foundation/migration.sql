-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ExecutionType" AS ENUM ('BOT', 'BOT_HUMAN_CONFIRMATION', 'HUMAN');

-- CreateEnum
CREATE TYPE "MessageMedium" AS ENUM ('EMAIL', 'WHATSAPP', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "ComposeMode" AS ENUM ('MANUAL', 'TEMPLATE');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('BACKLOG', 'PENDING', 'IN_PROGRESS', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "ParticipantType" AS ENUM ('INTERNAL_USER', 'ORGANIZATION_USER');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('ASSIGNEE', 'CREATOR', 'CUSTOMER_PARTICIPANT', 'RECIPIENT', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkflowStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "OutcomeKind" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "OutcomeAction" AS ENUM ('GOTO_STEP', 'COMPLETE_WORKFLOW', 'FAIL_WORKFLOW', 'TRIGGER_WORKFLOW', 'CHANGE_TASK_STATUS');

-- CreateEnum
CREATE TYPE "WorkflowTriggerType" AS ENUM ('ORGANIZATION_STATUS_CHANGED', 'CONTRACT_EVENT', 'PORTAL_ACCESS_EVENT', 'EVENT_PARTICIPATION');

-- CreateEnum
CREATE TYPE "PortalAccessStatus" AS ENUM ('NOT_INVITED', 'INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROSPECT',
    "address" TEXT,
    "countryOfIncorporation" TEXT,
    "yearIncorporated" INTEGER,
    "registrationNumber" TEXT,
    "nessCustomerId" TEXT,
    "folderUrl" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "photoUrl" TEXT,
    "role" TEXT,
    "comments" TEXT,
    "portalAccessStatus" "PortalAccessStatus" NOT NULL DEFAULT 'NOT_INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_users" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" UUID NOT NULL,
    "categoryName" TEXT NOT NULL,
    "description" TEXT,
    "executionType" "ExecutionType" NOT NULL,
    "defaultAssigneeType" TEXT,
    "defaultAssigneeId" UUID,
    "selfAssigned" BOOLEAN NOT NULL DEFAULT false,
    "availableForTasks" BOOLEAN NOT NULL DEFAULT true,
    "availableForWorkflows" BOOLEAN NOT NULL DEFAULT false,
    "defaultSlaBusinessDays" INTEGER,
    "statusChangeByAssignee" BOOLEAN NOT NULL DEFAULT false,
    "statusChangeByAssigner" BOOLEAN NOT NULL DEFAULT false,
    "completionDescriptionRequired" BOOLEAN NOT NULL DEFAULT false,
    "specificDataFieldsRequired" BOOLEAN NOT NULL DEFAULT false,
    "autoCompleteAfterBotAction" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_template_messages" (
    "id" UUID NOT NULL,
    "taskTemplateId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "medium" "MessageMedium" NOT NULL,
    "recipientConfiguration" TEXT,
    "ccConfiguration" TEXT,
    "accountConfiguration" TEXT,
    "composeMode" "ComposeMode" NOT NULL,
    "messageTemplateReference" TEXT,
    "emailSubjectTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_template_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_template_conditions" (
    "id" UUID NOT NULL,
    "taskTemplateId" UUID NOT NULL,
    "completionDescriptionRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_template_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_template_required_fields" (
    "id" UUID NOT NULL,
    "conditionId" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_template_required_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "taskTemplateId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" UUID,
    "creatorId" UUID,
    "assigneeId" UUID,
    "status" "TaskStatus" NOT NULL DEFAULT 'BACKLOG',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "reminderAt" TIMESTAMP(3),
    "executionAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionComment" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_participants" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "participantType" "ParticipantType" NOT NULL,
    "role" "ParticipantRole" NOT NULL,
    "internalUserId" UUID,
    "organizationUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "authorId" UUID,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_required_data" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "requiredFieldId" UUID NOT NULL,
    "satisfied" BOOLEAN NOT NULL DEFAULT false,
    "observedValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_required_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "customerVisible" BOOLEAN NOT NULL DEFAULT false,
    "progressBarEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_template_steps" (
    "id" UUID NOT NULL,
    "workflowTemplateId" UUID NOT NULL,
    "taskTemplateId" UUID NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "friendlyName" TEXT NOT NULL,
    "progressBarDisplay" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_template_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_outcomes" (
    "id" UUID NOT NULL,
    "sourceStepId" UUID NOT NULL,
    "kind" "OutcomeKind" NOT NULL,
    "action" "OutcomeAction" NOT NULL,
    "targetStepId" UUID,
    "targetWorkflowTemplateId" UUID,
    "targetTaskId" UUID,
    "targetTaskStatus" "TaskStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_step_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" UUID,
    "templateId" UUID,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentStepId" UUID,
    "createdBy" UUID,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_instances" (
    "id" UUID NOT NULL,
    "workflowId" UUID NOT NULL,
    "stepId" UUID NOT NULL,
    "taskId" UUID,
    "status" "WorkflowStepStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_step_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_triggers" (
    "id" UUID NOT NULL,
    "workflowTemplateId" UUID NOT NULL,
    "type" "WorkflowTriggerType" NOT NULL,
    "organizationId" UUID,
    "organizationStatus" TEXT,
    "configuration" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_status_history" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "changedBy" UUID,
    "comment" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_status_history" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "previousStatus" "TaskStatus",
    "newStatus" "TaskStatus" NOT NULL,
    "changedBy" UUID,
    "comment" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_status_history" (
    "id" UUID NOT NULL,
    "workflowId" UUID NOT NULL,
    "previousStatus" "WorkflowStatus",
    "newStatus" "WorkflowStatus" NOT NULL,
    "changedBy" UUID,
    "comment" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "internal_users_email_key" ON "internal_users"("email");

-- CreateIndex
CREATE INDEX "task_templates_executionType_idx" ON "task_templates"("executionType");

-- CreateIndex
CREATE UNIQUE INDEX "task_template_messages_taskTemplateId_key" ON "task_template_messages"("taskTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "task_template_conditions_taskTemplateId_key" ON "task_template_conditions"("taskTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "task_template_required_fields_conditionId_entity_fieldName_key" ON "task_template_required_fields"("conditionId", "entity", "fieldName");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_organizationId_idx" ON "tasks"("organizationId");

-- CreateIndex
CREATE INDEX "task_participants_taskId_idx" ON "task_participants"("taskId");

-- CreateIndex
CREATE INDEX "task_comments_taskId_idx" ON "task_comments"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_required_data_taskId_requiredFieldId_key" ON "task_required_data"("taskId", "requiredFieldId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_template_steps_workflowTemplateId_stepOrder_key" ON "workflow_template_steps"("workflowTemplateId", "stepOrder");

-- CreateIndex
CREATE INDEX "workflow_step_outcomes_sourceStepId_kind_idx" ON "workflow_step_outcomes"("sourceStepId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_currentStepId_key" ON "workflows"("currentStepId");

-- CreateIndex
CREATE INDEX "workflows_status_idx" ON "workflows"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_step_instances_taskId_key" ON "workflow_step_instances"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_step_instances_workflowId_stepId_key" ON "workflow_step_instances"("workflowId", "stepId");

-- CreateIndex
CREATE INDEX "workflow_triggers_type_active_idx" ON "workflow_triggers"("type", "active");

-- CreateIndex
CREATE INDEX "organization_status_history_organizationId_changedAt_idx" ON "organization_status_history"("organizationId", "changedAt");

-- CreateIndex
CREATE INDEX "task_status_history_taskId_changedAt_idx" ON "task_status_history"("taskId", "changedAt");

-- CreateIndex
CREATE INDEX "workflow_status_history_workflowId_changedAt_idx" ON "workflow_status_history"("workflowId", "changedAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_template_messages" ADD CONSTRAINT "task_template_messages_taskTemplateId_fkey" FOREIGN KEY ("taskTemplateId") REFERENCES "task_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_template_conditions" ADD CONSTRAINT "task_template_conditions_taskTemplateId_fkey" FOREIGN KEY ("taskTemplateId") REFERENCES "task_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_template_required_fields" ADD CONSTRAINT "task_template_required_fields_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "task_template_conditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_taskTemplateId_fkey" FOREIGN KEY ("taskTemplateId") REFERENCES "task_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "internal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "internal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_participants" ADD CONSTRAINT "task_participants_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_participants" ADD CONSTRAINT "task_participants_internalUserId_fkey" FOREIGN KEY ("internalUserId") REFERENCES "internal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_participants" ADD CONSTRAINT "task_participants_organizationUserId_fkey" FOREIGN KEY ("organizationUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "internal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_required_data" ADD CONSTRAINT "task_required_data_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_required_data" ADD CONSTRAINT "task_required_data_requiredFieldId_fkey" FOREIGN KEY ("requiredFieldId") REFERENCES "task_template_required_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "internal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_template_steps" ADD CONSTRAINT "workflow_template_steps_workflowTemplateId_fkey" FOREIGN KEY ("workflowTemplateId") REFERENCES "workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_template_steps" ADD CONSTRAINT "workflow_template_steps_taskTemplateId_fkey" FOREIGN KEY ("taskTemplateId") REFERENCES "task_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_outcomes" ADD CONSTRAINT "workflow_step_outcomes_sourceStepId_fkey" FOREIGN KEY ("sourceStepId") REFERENCES "workflow_template_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_outcomes" ADD CONSTRAINT "workflow_step_outcomes_targetStepId_fkey" FOREIGN KEY ("targetStepId") REFERENCES "workflow_template_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_outcomes" ADD CONSTRAINT "workflow_step_outcomes_targetWorkflowTemplateId_fkey" FOREIGN KEY ("targetWorkflowTemplateId") REFERENCES "workflow_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "workflow_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_currentStepId_fkey" FOREIGN KEY ("currentStepId") REFERENCES "workflow_step_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "internal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_instances" ADD CONSTRAINT "workflow_step_instances_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_instances" ADD CONSTRAINT "workflow_step_instances_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "workflow_template_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_instances" ADD CONSTRAINT "workflow_step_instances_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_workflowTemplateId_fkey" FOREIGN KEY ("workflowTemplateId") REFERENCES "workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_status_history" ADD CONSTRAINT "organization_status_history_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_status_history" ADD CONSTRAINT "organization_status_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "internal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "internal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_status_history" ADD CONSTRAINT "workflow_status_history_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_status_history" ADD CONSTRAINT "workflow_status_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "internal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

