-- Add task-template activation and reusable message-template references.
ALTER TABLE "task_templates" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "message_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "task_template_messages" ADD COLUMN "message_template_id" UUID;
ALTER TABLE "task_template_messages" ADD CONSTRAINT "task_template_messages_message_template_id_fkey" FOREIGN KEY ("message_template_id") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
