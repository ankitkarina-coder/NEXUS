import {
  organizationRepository,
  taskRepository,
  taskTemplateRepository,
  userRepository,
  workflowRepository,
  workflowTemplateRepository,
} from "@nexus/database";

export const crmService = {
  organizations: organizationRepository,
  users: userRepository,
  taskTemplates: taskTemplateRepository,
  tasks: {
    list: taskRepository.list,
    create: (data: { taskTemplateId: string; title: string; description?: string; organizationId?: string; creatorId?: string; assigneeId?: string }) => taskRepository.create({ title: data.title, description: data.description, taskTemplate: { connect: { id: data.taskTemplateId } }, organization: data.organizationId ? { connect: { id: data.organizationId } } : undefined, creator: data.creatorId ? { connect: { id: data.creatorId } } : undefined, assignee: data.assigneeId ? { connect: { id: data.assigneeId } } : undefined }),
  },
  workflowTemplates: workflowTemplateRepository,
  workflows: workflowRepository,
};