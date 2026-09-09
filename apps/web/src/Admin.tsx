import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "./api";

type View =
  | "overview"
  | "organizations"
  | "users"
  | "tasks"
  | "workflows"
  | "roles"
  | "messages"
  | "activity"
  | "settings";

type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Organization = {
  id: string;
  name: string;
  status: string;
  website?: string | null;
  description?: string | null;
  _count?: {
    users?: number;
    tasks?: number;
    workflows?: number;
  };
};

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  active?: boolean;
  organizationId?: string | null;
  organization?: {
    name: string;
  } | null;
  roleAssignments?: {
    role: {
      name: string;
    };
  }[];
  lastLoginAt?: string | null;
};

type Task = {
  id: string;
  title: string;
  status: string;
  dueAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  organization?: {
    name: string;
  } | null;
  assignee?: {
    firstName: string;
    lastName: string;
  } | null;
  taskTemplate?: {
    categoryName: string;
  } | null;
  workflowStep?: {
    workflow: {
      name: string;
    };
  } | null;
};

type Workflow = {
  id: string;
  name: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  organization?: {
    name: string;
  } | null;
  template?: {
    name: string;
  } | null;
  currentStep?: {
    step: {
      friendlyName: string;
    };
    task?: {
      title: string;
    } | null;
  } | null;
};

type Role = {
  id: string;
  name: string;
  description?: string | null;
  protected: boolean;
  permissions: {
    permission: {
      id: string;
      key: string;
    };
  }[];
  _count: {
    assignments: number;
  };
};

type Permission = {
  id: string;
  key: string;
};

type Message = {
  id: string;
  name: string;
  active: boolean;
  content?: string | null;
  updatedAt: string;
};

type Activity = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
  actor?: {
    firstName: string;
    lastName: string;
  } | null;
};

type ApiPageResponse<T> = Page<T> | { internal?: Page<T>; organization?: Page<T> };

const API_ERROR = async (response: Response): Promise<string> => {
  try {
    const body = await response.json();

    if (typeof body?.error === "string") {
      return body.error;
    }

    if (body?.error?.message) {
      return body.error.message;
    }

    if (body?.message) {
      return body.message;
    }
  } catch {
    // Ignore invalid JSON.
  }

  return "The request could not be completed.";
};

const text = (value: string): string =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const date = (value?: string | null): string => {
  if (!value) return "-";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(parsed);
};

const query = (values: Record<string, string>): string =>
  new URLSearchParams(
    Object.entries(values).filter(([, value]) => value !== "")
  ).toString();

const emptyPage = <T,>(pageSize = 10): Page<T> => ({
  items: [],
  page: 1,
  pageSize,
  total: 0,
  totalPages: 0,
});

function isPage<T>(value: unknown): value is Page<T> {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;

  return (
    Array.isArray(candidate.items) &&
    typeof candidate.page === "number" &&
    typeof candidate.pageSize === "number" &&
    typeof candidate.total === "number" &&
    typeof candidate.totalPages === "number"
  );
}

function usePage<T>(
  path: string,
  params: Record<string, string>
): {
  result: Page<T>;
  loading: boolean;
  error: string;
} {
  const [result, setResult] = useState<Page<T>>(emptyPage<T>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const serializedParams = JSON.stringify(params);

  useEffect(() => {
    const controller = new AbortController();

    let mounted = true;

    setLoading(true);
    setError("");

    apiFetch(`${path}?${query(params)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await API_ERROR(response));
        }

        return response.json();
      })
      .then((payload: unknown) => {
        if (!mounted) return;

        if (isPage<T>(payload)) {
          setResult(payload);
          return;
        }

        const object = payload as ApiPageResponse<T>;

if (isPage<T>(object)) {
  setResult(object);
  return;
}

if ("internal" in object && isPage<T>(object.internal)) {
  setResult(object.internal);
  return;
}

if ("organization" in object && isPage<T>(object.organization)) {
  setResult(object.organization);
  return;
}

        setResult(emptyPage<T>());
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || !mounted) return;

        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load data."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted && mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [path, serializedParams]);

  return {
    result,
    loading,
    error,
  };
}

function Pager({
  page,
  pageSize,
  total,
  totalPages,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const safeTotalPages = Math.max(totalPages, 1);

  return (
    <div className="admin-pager">
      <span>{total} records</span>

      <select
        value={pageSize}
        onChange={(event) =>
          onPageSize(Number(event.target.value))
        }
      >
        <option value={10}>10</option>
        <option value={25}>25</option>
        <option value={50}>50</option>
      </select>

      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>

      <strong>
        Page {Math.min(page, safeTotalPages)} of {safeTotalPages}
      </strong>

      <button
        type="button"
        disabled={totalPages === 0 || page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

function State({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error: string;
  empty: boolean;
  children: ReactNode;
}) {
  if (loading) {
    return <div className="loading-state">Loading...</div>;
  }

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  if (empty) {
    return (
      <div className="table-empty">
        No records match these filters.
      </div>
    );
  }

  return <>{children}</>;
}

function Heading({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="admin-section-heading">
      <div>
        <p className="section-kicker">{label}</p>
        <h2>{children}</h2>
      </div>
    </div>
  );
}

function getErrorMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }

  return "Unable to complete the request.";
}

export function AdminPage({
  onNavigate,
}: {
  onNavigate: (page: string) => void;
}) {
  const [view, setView] = useState<View>("overview");
  const [notice, setNotice] = useState("");

  const views: View[] = [
    "overview",
    "organizations",
    "users",
    "tasks",
    "workflows",
    "roles",
    "messages",
    "activity",
    "settings",
  ];

  const showNotice = (message: string) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 3500);
  };

  return (
    <section className="content admin-page">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">SYSTEM ADMINISTRATION</p>
          <h1>Admin</h1>
          <p className="muted">
            Server-driven administration for NEXUS operations and
            access.
          </p>
        </div>
      </div>

      {notice && (
        <div className="success-banner">
          OK {notice}
        </div>
      )}

      <div className="admin-layout">
        <nav className="admin-nav">
          <p className="section-kicker">ADMIN</p>

          {views.map((item) => (
            <button
              type="button"
              key={item}
              className={view === item ? "selected" : ""}
              onClick={() => setView(item)}
            >
              {item === "messages"
                ? "Message Templates"
                : item === "activity"
                  ? "Activity Logs"
                  : text(item)}
            </button>
          ))}

          <p className="section-kicker admin-nav-label">
            PRODUCT
          </p>

          <button
            type="button"
            onClick={() => onNavigate("Task Templates")}
          >
            Task Templates
          </button>

          <button
            type="button"
            onClick={() => onNavigate("Workflows")}
          >
            Workflow Templates
          </button>
        </nav>

        <div className="admin-body">
          {view === "overview" && <Overview />}

          {view === "organizations" && (
            <Organizations onSaved={showNotice} />
          )}

          {view === "users" && (
            <Users onSaved={showNotice} />
          )}

          {view === "tasks" && <Tasks />}

          {view === "workflows" && (
            <Workflows onSaved={showNotice} />
          )}

          {view === "roles" && (
            <Roles onSaved={showNotice} />
          )}

          {view === "messages" && (
            <Messages onSaved={showNotice} />
          )}

          {view === "activity" && <Activity />}

          {view === "settings" && <Settings />}
        </div>
      </div>
    </section>
  );
}

function Overview() {
  const [data, setData] = useState<Record<string, any> | null>(
    null
  );
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    apiFetch("/admin/overview")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await API_ERROR(response));
        }

        return response.json();
      })
      .then((payload) => {
        if (mounted) {
          setData(payload);
        }
      })
      .catch((reason: unknown) => {
        if (mounted) {
          setError(getErrorMessage(reason));
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  if (!data) {
    return (
      <div className="loading-state">
        Loading metrics...
      </div>
    );
  }

  const cards: [string, number][] = [
    ["Organizations", Number(data.organizations || 0)],
    [
      "Active organizations",
      Number(data.activeOrganizations || 0),
    ],
    ["Internal users", Number(data.internalUsers || 0)],
    [
      "Organization users",
      Number(data.organizationUsers || 0),
    ],
    ["Active users", Number(data.activeUsers || 0)],
    [
      "Tasks",
      Number(data.activeTasks || 0) +
        Number(data.completedTasks || 0),
    ],
    ["Overdue tasks", Number(data.overdueTasks || 0)],
    [
      "Running workflows",
      Number(data.runningWorkflows || 0),
    ],
    [
      "Completed workflows",
      Number(data.completedWorkflows || 0),
    ],
    [
      "Failed workflows",
      Number(data.failedWorkflows || 0),
    ],
    ["Task templates", Number(data.taskTemplates || 0)],
    [
      "Workflow templates",
      Number(data.workflowTemplates || 0),
    ],
    [
      "Message templates",
      Number(data.messageTemplates || 0),
    ],
  ];

  return (
    <>
      <div className="admin-metrics">
        {cards.map(([name, value]) => (
          <div className="metric-card" key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="admin-columns">
        <div className="admin-panel">
          <p className="section-kicker">
            RECENT ACTIVITY
          </p>

          {Array.isArray(data.recentActivity) &&
            data.recentActivity.map((item: Activity) => (
              <div
                className="admin-list-row"
                key={item.id}
              >
                <strong>{text(item.action)}</strong>

                <span>
                  {item.actor?.firstName || "System"} /{" "}
                  {date(item.createdAt)}
                </span>
              </div>
            ))}
        </div>

        <div className="admin-panel">
          <p className="section-kicker">
            RECENT TASKS
          </p>

          {Array.isArray(data.recentTasks) &&
            data.recentTasks.map((item: Task) => (
              <div
                className="admin-list-row"
                key={item.id}
              >
                <strong>{item.title}</strong>
                <span>{text(item.status)}</span>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}

function Organizations({
  onSaved,
}: {
  onSaved: (message: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] =
    useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState("");

  const data = usePage<Organization>(
    "/admin/organizations",
    {
      page: String(page),
      pageSize: String(pageSize),
      search,
      status,
    }
  );

  const create = async (event: FormEvent) => {
    event.preventDefault();

    setBusy(true);
    setCreateError("");

    try {
      const response = await apiFetch(
        "/admin/organizations",
        {
          method: "POST",
          body: JSON.stringify({ name }),
        }
      );

      if (!response.ok) {
        throw new Error(await API_ERROR(response));
      }

      setName("");
      setPage(1);
      onSaved("Organization created.");
    } catch (reason: unknown) {
      setCreateError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (
    organization: Organization
  ) => {
    if (!window.confirm("Change organization status?")) {
      return;
    }

    const nextStatus =
      organization.status === "INACTIVE"
        ? "PROSPECT"
        : "INACTIVE";

    try {
      const response = await apiFetch(
        `/admin/organizations/${organization.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await API_ERROR(response));
      }

      onSaved("Organization status updated.");
      setPage((current) => current);
    } catch (reason: unknown) {
      setCreateError(getErrorMessage(reason));
    }
  };

  return (
    <>
      <Heading label="ORGANIZATION MANAGEMENT">
        Organizations
      </Heading>

      <form
        className="inline-create"
        onSubmit={create}
      >
        <input
          required
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
          placeholder="New organization"
        />

        <button
          type="submit"
          className="primary-button"
          disabled={busy}
        >
          {busy ? "Creating..." : "Create"}
        </button>
      </form>

      {createError && (
        <div className="error-banner">
          {createError}
        </div>
      )}

      <div className="template-toolbar">
        <div className="search-box">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search organizations"
          />
        </div>

        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="PROSPECT">Prospect</option>
          <option value="CONFIRMED_OPPORTUNITY">
            Confirmed opportunity
          </option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <State
        loading={data.loading}
        error={data.error}
        empty={!data.result.items.length}
      >
        <div className="admin-panel admin-table">
          <div className="admin-table-head">
            <span>Organization</span>
            <span>Status</span>
            <span>Users</span>
            <span>Tasks</span>
            <span>Workflows</span>
            <span>Actions</span>
          </div>

          {data.result.items.map((item) => (
            <div
              className="admin-table-row"
              key={item.id}
            >
              <button
                type="button"
                className="table-link"
                onClick={() => setSelected(item)}
              >
                {item.name}
              </button>

              <span>{text(item.status)}</span>

              <span>{item._count?.users || 0}</span>

              <span>{item._count?.tasks || 0}</span>

              <span>
                {item._count?.workflows || 0}
              </span>

              <button
                type="button"
                className="text-button"
                onClick={() =>
                  void toggleStatus(item)
                }
              >
                {item.status === "INACTIVE"
                  ? "Activate"
                  : "Deactivate"}
              </button>
            </div>
          ))}
        </div>

        <Pager
          {...data.result}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </State>

      {selected && (
        <OrganizationDetail
          organization={selected}
          onClose={() => setSelected(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

function OrganizationDetail({
  organization,
  onClose,
  onSaved,
}: {
  organization: Organization;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [tab, setTab] = useState<
    "overview" | "users" | "tasks" | "workflows" | "activity"
  >("overview");

  const [name, setName] = useState(organization.name);
  const [website, setWebsite] = useState(
    organization.website || ""
  );
  const [description, setDescription] =
    useState(organization.description || "");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (event: FormEvent) => {
    event.preventDefault();

    setBusy(true);
    setError("");

    try {
      const response = await apiFetch(
        `/admin/organizations/${organization.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name,
            website: website || null,
            description: description || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await API_ERROR(response));
      }

      onSaved("Organization updated.");
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="detail-panel admin-detail">
      <button
        type="button"
        className="back-link"
        onClick={onClose}
      >
        &lt; Organizations
      </button>

      <h2>{organization.name}</h2>

      <div className="view-tabs">
        {[
          "overview",
          "users",
          "tasks",
          "workflows",
          "activity",
        ].map((item) => (
          <button
            type="button"
            className={tab === item ? "selected" : ""}
            key={item}
            onClick={() =>
              setTab(
                item as
                  | "overview"
                  | "users"
                  | "tasks"
                  | "workflows"
                  | "activity"
              )
            }
          >
            {text(item)}
          </button>
        ))}
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {tab === "overview" && (
        <form
          className="form-stack"
          onSubmit={save}
        >
          <label>
            Name
            <input
              required
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
            />
          </label>

          <label>
            Website
            <input
              value={website}
              onChange={(event) =>
                setWebsite(event.target.value)
              }
              placeholder="https://example.com"
            />
          </label>

          <label>
            Description
            <textarea
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              rows={4}
            />
          </label>

          <button
            type="submit"
            className="primary-button"
            disabled={busy}
          >
            {busy ? "Saving..." : "Save changes"}
          </button>

          <p className="muted">
            Status: {text(organization.status)}
          </p>

          <p className="muted">
            Users: {organization._count?.users || 0}
            {" / "}
            Tasks: {organization._count?.tasks || 0}
            {" / "}
            Workflows:{" "}
            {organization._count?.workflows || 0}
          </p>
        </form>
      )}

      {tab === "users" && (
        <OrganizationUsers organizationId={organization.id} />
      )}

      {tab === "tasks" && (
        <OrganizationTasks organizationId={organization.id} />
      )}

      {tab === "workflows" && (
        <OrganizationWorkflows
          organizationId={organization.id}
        />
      )}

      {tab === "activity" && (
        <OrganizationActivity
          organizationId={organization.id}
        />
      )}
    </div>
  );
}

function OrganizationUsers({
  organizationId,
}: {
  organizationId: string;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const data = usePage<User>("/admin/users", {
    page: String(page),
    pageSize: String(pageSize),
    organizationId,
  });

  return (
    <State
      loading={data.loading}
      error={data.error}
      empty={!data.result.items.length}
    >
      <div className="admin-panel admin-table">
        <div className="admin-table-head">
          <span>Name</span>
          <span>Email</span>
          <span>Status</span>
          <span>Last login</span>
        </div>

        {data.result.items.map((user) => (
          <div
            className="admin-table-row"
            key={user.id}
          >
            <strong>
              {user.firstName} {user.lastName}
            </strong>

            <span>{user.email}</span>

            <span>
              {user.active === false
                ? "Inactive"
                : "Active"}
            </span>

            <span>{date(user.lastLoginAt)}</span>
          </div>
        ))}
      </div>

      <Pager
        {...data.result}
        onPage={setPage}
        onPageSize={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </State>
  );
}

function OrganizationTasks({
  organizationId,
}: {
  organizationId: string;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const data = usePage<Task>("/admin/tasks", {
    page: String(page),
    pageSize: String(pageSize),
    organizationId,
  });

  return (
    <State
      loading={data.loading}
      error={data.error}
      empty={!data.result.items.length}
    >
      <div className="admin-panel admin-table">
        <div className="admin-table-head">
          <span>Task</span>
          <span>Status</span>
          <span>Assignee</span>
          <span>Due</span>
        </div>

        {data.result.items.map((task) => (
          <div
            className="admin-table-row"
            key={task.id}
          >
            <strong>{task.title}</strong>

            <span>{text(task.status)}</span>

            <span>
              {task.assignee
                ? `${task.assignee.firstName} ${task.assignee.lastName}`
                : "-"}
            </span>

            <span>{date(task.dueAt)}</span>
          </div>
        ))}
      </div>

      <Pager
        {...data.result}
        onPage={setPage}
        onPageSize={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </State>
  );
}

function OrganizationWorkflows({
  organizationId,
}: {
  organizationId: string;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const data = usePage<Workflow>("/admin/workflows", {
    page: String(page),
    pageSize: String(pageSize),
    organizationId,
  });

  return (
    <State
      loading={data.loading}
      error={data.error}
      empty={!data.result.items.length}
    >
      <div className="admin-panel admin-table">
        <div className="admin-table-head">
          <span>Workflow</span>
          <span>Template</span>
          <span>Status</span>
          <span>Current step</span>
        </div>

        {data.result.items.map((workflow) => (
          <div
            className="admin-table-row"
            key={workflow.id}
          >
            <strong>{workflow.name}</strong>

            <span>
              {workflow.template?.name || "-"}
            </span>

            <span>{text(workflow.status)}</span>

            <span>
              {workflow.currentStep?.step
                .friendlyName || "Complete"}
            </span>
          </div>
        ))}
      </div>

      <Pager
        {...data.result}
        onPage={setPage}
        onPageSize={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </State>
  );
}

function OrganizationActivity({
  organizationId,
}: {
  organizationId: string;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const data = usePage<Activity>("/admin/activity", {
    page: String(page),
    pageSize: String(pageSize),
    organizationId,
  });

  return (
    <State
      loading={data.loading}
      error={data.error}
      empty={!data.result.items.length}
    >
      <div className="admin-panel activity-table">
        {data.result.items.map((item) => (
          <div
            className="activity-row"
            key={item.id}
          >
            <strong>{text(item.action)}</strong>

            <span>
              {item.actor
                ? `${item.actor.firstName} ${item.actor.lastName}`
                : "System"}
            </span>

            <span>
              {item.entityType}{" "}
              {item.entityId || ""}
            </span>

            <time>{date(item.createdAt)}</time>
          </div>
        ))}
      </div>

      <Pager
        {...data.result}
        onPage={setPage}
        onPageSize={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </State>
  );
}

function Users({
  onSaved,
}: {
  onSaved: (message: string) => void;
}) {
  const [kind, setKind] = useState<
    "internal" | "organization"
  >("internal");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<User | null>(
    null
  );

  const [resetting, setResetting] =
    useState<User | null>(null);

  const [error, setError] = useState("");

  const data = usePage<User>("/admin/users", {
    page: String(page),
    pageSize: String(pageSize),
    search,
  });

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    organizationId: "",
    roleIds: [] as string[],
  });

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const body =
      kind === "internal"
        ? {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            password: form.password,
            organizationId:
              form.organizationId || null,
            roleIds: form.roleIds,
          }
        : {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            organizationId:
              form.organizationId || null,
          };

    try {
      const response = await apiFetch(
        kind === "internal"
          ? "/admin/users/internal"
          : "/admin/users/organization",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error(await API_ERROR(response));
      }

      setForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        organizationId: "",
        roleIds: [],
      });

      setPage(1);
      onSaved("User created.");
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    }
  };

  const startEdit = (user: User) => {
    setResetting(null);

    setEditing({
      ...user,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      organizationId: user.organizationId || null,
    });
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();

    if (!editing) return;

    setError("");

    try {
      const response = await apiFetch(
        `/admin/users/${editing.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            firstName: editing.firstName,
            lastName: editing.lastName,
            email: editing.email,
            organizationId:
              editing.organizationId || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await API_ERROR(response));
      }

      setEditing(null);
      setPage(1);
      onSaved("User updated.");
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    }
  };

  const toggleActive = async (user: User) => {
    const activate = user.active === false;

    if (
      !window.confirm(
        `Are you sure you want to ${
          activate ? "activate" : "deactivate"
        } this user?`
      )
    ) {
      return;
    }

    setError("");

    try {
      const response = await apiFetch(
        `/admin/users/${user.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            active: activate,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await API_ERROR(response));
      }

      setPage(1);

      onSaved(
        activate
          ? "User activated."
          : "User deactivated."
      );
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    }
  };

  const resetPassword = async (
  event: FormEvent<HTMLFormElement>
) => {
    event.preventDefault();

    if (!resetting) return;

    const formElement = event.currentTarget;
    const input = formElement.elements.namedItem(
      "password"
    ) as HTMLInputElement | null;

    const password = input?.value || "";

    if (password.length < 8) {
      setError(
        "Password must contain at least 8 characters."
      );
      return;
    }

    setError("");

    try {
      const response = await apiFetch(
        `/admin/users/${resetting.id}/password`,
        {
          method: "POST",
          body: JSON.stringify({
            password,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await API_ERROR(response));
      }

      setResetting(null);
      onSaved("Password reset successfully.");
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    }
  };

  const closePanels = () => {
    setEditing(null);
    setResetting(null);
    setError("");
  };

  return (
    <>
      <Heading label="ACCESS MANAGEMENT">
        Users
      </Heading>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <select
        value={kind}
        onChange={(event) => {
          setKind(
            event.target.value as
              | "internal"
              | "organization"
          );
          setPage(1);
          closePanels();
        }}
      >
        <option value="internal">
          Internal users
        </option>

        <option value="organization">
          Organization users
        </option>
      </select>

      <div className="template-toolbar">
        <div className="search-box">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search users"
          />
        </div>
      </div>

      <form
        className="admin-panel form-stack"
        onSubmit={create}
      >
        <p className="section-kicker">
          CREATE USER
        </p>

        <input
          required
          placeholder="First name"
          value={form.firstName}
          onChange={(event) =>
            setForm({
              ...form,
              firstName: event.target.value,
            })
          }
        />

        <input
          required
          placeholder="Last name"
          value={form.lastName}
          onChange={(event) =>
            setForm({
              ...form,
              lastName: event.target.value,
            })
          }
        />

        <input
          required
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(event) =>
            setForm({
              ...form,
              email: event.target.value,
            })
          }
        />

        {kind === "internal" && (
          <input
            required
            type="password"
            minLength={8}
            placeholder="Temporary password"
            value={form.password}
            onChange={(event) =>
              setForm({
                ...form,
                password: event.target.value,
              })
            }
          />
        )}

        <button
          type="submit"
          className="primary-button"
        >
          Create user
        </button>
      </form>

      <State
        loading={data.loading}
        error={data.error}
        empty={!data.result.items.length}
      >
        <div className="admin-panel admin-table">
          <div className="admin-table-head">
            <span>Name</span>
            <span>Email</span>
            <span>Organization</span>
            <span>Status</span>
            <span>Last login</span>
            <span>Actions</span>
          </div>

          {data.result.items.map((item) => (
            <div
              className="admin-table-row"
              key={item.id}
            >
              <strong>
                {item.firstName} {item.lastName}
              </strong>

              <span>{item.email}</span>

              <span>
                {item.organization?.name || "-"}
              </span>

              <span>
                {item.active === false
                  ? "Inactive"
                  : "Active"}
              </span>

              <span>
                {date(item.lastLoginAt)}
              </span>

              <span className="admin-row-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    startEdit(item)
                  }
                >
                  Edit
                </button>

                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setEditing(null);
                    setResetting(item);
                    setError("");
                  }}
                >
                  Reset password
                </button>

                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    void toggleActive(item)
                  }
                >
                  {item.active === false
                    ? "Activate"
                    : "Deactivate"}
                </button>
              </span>
            </div>
          ))}
        </div>

        <Pager
          {...data.result}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </State>

      {editing && (
        <div className="detail-panel admin-detail">
          <button
            type="button"
            className="back-link"
            onClick={() => setEditing(null)}
          >
            &lt; Users
          </button>

          <Heading label="USER MANAGEMENT">
            Edit User
          </Heading>

          <form
            className="form-stack"
            onSubmit={saveEdit}
          >
            <input
              required
              value={editing.firstName}
              placeholder="First name"
              onChange={(event) =>
                setEditing({
                  ...editing,
                  firstName:
                    event.target.value,
                })
              }
            />

            <input
              required
              value={editing.lastName}
              placeholder="Last name"
              onChange={(event) =>
                setEditing({
                  ...editing,
                  lastName:
                    event.target.value,
                })
              }
            />

            <input
              required
              type="email"
              value={editing.email}
              placeholder="Email"
              onChange={(event) =>
                setEditing({
                  ...editing,
                  email: event.target.value,
                })
              }
            />

            <input
              value={editing.organizationId || ""}
              placeholder="Organization ID"
              onChange={(event) =>
                setEditing({
                  ...editing,
                  organizationId:
                    event.target.value || null,
                })
              }
            />

            <button
              type="submit"
              className="primary-button"
            >
              Save changes
            </button>
          </form>
        </div>
      )}

      {resetting && (
        <div className="detail-panel admin-detail">
          <button
            type="button"
            className="back-link"
            onClick={() => setResetting(null)}
          >
            &lt; Users
          </button>

          <Heading label="SECURITY">
            Reset Password
          </Heading>

          <p className="muted">
            Reset password for{" "}
            <strong>
              {resetting.firstName}{" "}
              {resetting.lastName}
            </strong>
            .
          </p>

          <form
            className="form-stack"
            onSubmit={resetPassword}
          >
            <input
              name="password"
              required
              minLength={8}
              type="password"
              placeholder="New password"
              autoComplete="new-password"
            />

            <button
              type="submit"
              className="primary-button"
            >
              Reset password
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function Tasks() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const data = usePage<Task>("/admin/tasks", {
    page: String(page),
    pageSize: String(pageSize),
    search,
    status,
  });

  return (
    <>
      <Heading label="OPERATIONS">
        Task Monitoring
      </Heading>

      <div className="template-toolbar">
        <div className="search-box">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search tasks"
          />
        </div>

        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>

          {[
            "BACKLOG",
            "PENDING",
            "IN_PROGRESS",
            "COMPLETE",
            "FAILED",
          ].map((item) => (
            <option
              key={item}
              value={item}
            >
              {text(item)}
            </option>
          ))}
        </select>
      </div>

      <State
        loading={data.loading}
        error={data.error}
        empty={!data.result.items.length}
      >
        <div className="admin-panel admin-table monitoring-table">
          <div className="admin-table-head">
            <span>Task</span>
            <span>Organization</span>
            <span>Template</span>
            <span>Assignee</span>
            <span>Status</span>
            <span>Due</span>
            <span>Workflow</span>
          </div>

          {data.result.items.map((item) => (
            <div
              className="admin-table-row"
              key={item.id}
            >
              <strong>{item.title}</strong>

              <span>
                {item.organization?.name || "-"}
              </span>

              <span>
                {item.taskTemplate?.categoryName ||
                  "-"}
              </span>

              <span>
                {item.assignee
                  ? `${item.assignee.firstName} ${item.assignee.lastName}`
                  : "-"}
              </span>

              <span>{text(item.status)}</span>

              <span>{date(item.dueAt)}</span>

              <span>
                {item.workflowStep?.workflow.name ||
                  "-"}
              </span>
            </div>
          ))}
        </div>

        <Pager
          {...data.result}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </State>
    </>
  );
}

function Workflows({
  onSaved,
}: {
  onSaved: (message: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const [error, setError] = useState("");

  const data = usePage<Workflow>(
    "/admin/workflows",
    {
      page: String(page),
      pageSize: String(pageSize),
      search,
      status,
    }
  );

  const cancelWorkflow = async (
    workflow: Workflow
  ) => {
    if (
      !window.confirm(
        "Cancel this workflow?"
      )
    ) {
      return;
    }

    setError("");

    try {
      const response = await apiFetch(
        `/workflows/${workflow.id}/cancel`,
        {
          method: "PATCH",
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        throw new Error(await API_ERROR(response));
      }

      setPage((current) => current);
      onSaved("Workflow cancelled.");
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    }
  };

  return (
    <>
      <Heading label="OPERATIONS">
        Workflow Monitoring
      </Heading>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="template-toolbar">
        <div className="search-box">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search workflows"
          />
        </div>

        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>

          {[
            "IN_PROGRESS",
            "COMPLETE",
            "FAILED",
            "CANCELLED",
          ].map((item) => (
            <option
              key={item}
              value={item}
            >
              {text(item)}
            </option>
          ))}
        </select>
      </div>

      <State
        loading={data.loading}
        error={data.error}
        empty={!data.result.items.length}
      >
        <div className="admin-panel admin-table monitoring-table">
          <div className="admin-table-head">
            <span>Workflow</span>
            <span>Organization</span>
            <span>Template</span>
            <span>Status</span>
            <span>Current step</span>
            <span>Current task</span>
            <span>Action</span>
          </div>

          {data.result.items.map((item) => (
            <div
              className="admin-table-row"
              key={item.id}
            >
              <strong>{item.name}</strong>

              <span>
                {item.organization?.name || "-"}
              </span>

              <span>
                {item.template?.name || "-"}
              </span>

              <span>{text(item.status)}</span>

              <span>
                {item.currentStep?.step
                  .friendlyName || "Complete"}
              </span>

              <span>
                {item.currentStep?.task?.title ||
                  "-"}
              </span>

              <button
                type="button"
                className="text-button"
                disabled={
                  item.status !== "IN_PROGRESS"
                }
                onClick={() =>
                  void cancelWorkflow(item)
                }
              >
                Cancel
              </button>
            </div>
          ))}
        </div>

        <Pager
          {...data.result}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </State>
    </>
  );
}

function Roles({
  onSaved,
}: {
  onSaved: (message: string) => void;
}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<
    Permission[]
  >([]);

  const [selected, setSelected] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const [
        roleResponse,
        permissionResponse,
      ] = await Promise.all([
        apiFetch("/admin/roles"),
        apiFetch("/admin/permissions"),
      ]);

      if (!roleResponse.ok) {
        throw new Error(
          await API_ERROR(roleResponse)
        );
      }

      if (!permissionResponse.ok) {
        throw new Error(
          await API_ERROR(permissionResponse)
        );
      }

      const nextRoles =
        (await roleResponse.json()) as Role[];

      const nextPermissions =
        (await permissionResponse.json()) as Permission[];

      setRoles(nextRoles);
      setPermissions(nextPermissions);

      const firstRole = nextRoles[0];

      setSelected(firstRole?.id || "");

      setChecked(
        firstRole?.permissions.map(
          (item) => item.permission.id
        ) || []
      );
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const role = useMemo(
    () =>
      roles.find(
        (item) => item.id === selected
      ),
    [roles, selected]
  );

  const save = async () => {
    if (!role || role.protected) return;

    setError("");

    try {
      const response = await apiFetch(
        `/admin/roles/${role.id}/permissions`,
        {
          method: "PUT",
          body: JSON.stringify({
            permissionIds: checked,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await API_ERROR(response));
      }

      await load();
      onSaved("Permissions updated.");
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        Loading roles...
      </div>
    );
  }

  return (
    <>
      <Heading label="RBAC">
        Roles & Permissions
      </Heading>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <select
        value={selected}
        onChange={(event) => {
          const next = roles.find(
            (item) =>
              item.id === event.target.value
          );

          setSelected(event.target.value);

          setChecked(
            next?.permissions.map(
              (item) => item.permission.id
            ) || []
          );
        }}
      >
        {roles.map((item) => (
          <option
            key={item.id}
            value={item.id}
          >
            {item.name}
          </option>
        ))}
      </select>

      {role && (
        <div className="admin-panel permissions-panel">
          <p>
            {role.description || "No description"}{" "}
            /{" "}
            {role.protected
              ? "Protected system role"
              : "Editable role"}
          </p>

          <div className="permission-grid">
            {permissions.map((permission) => (
              <label key={permission.id}>
                <input
                  disabled={role.protected}
                  type="checkbox"
                  checked={checked.includes(
                    permission.id
                  )}
                  onChange={(event) => {
                    if (
                      event.target.checked
                    ) {
                      setChecked([
                        ...checked,
                        permission.id,
                      ]);
                    } else {
                      setChecked(
                        checked.filter(
                          (id) =>
                            id !==
                            permission.id
                        )
                      );
                    }
                  }}
                />

                {permission.key}
              </label>
            ))}
          </div>

          {!role.protected && (
            <button
              type="button"
              className="primary-button"
              onClick={() => void save()}
            >
              Save permissions
            </button>
          )}
        </div>
      )}
    </>
  );
}

function Messages({
  onSaved,
}: {
  onSaved: (message: string) => void;
}) {
  const [items, setItems] = useState<Message[]>([]);
  const [form, setForm] = useState({
    name: "",
    content: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);

    try {
      const response = await apiFetch(
        "/admin/message-templates"
      );

      if (!response.ok) {
        throw new Error(await API_ERROR(response));
      }

      const payload =
        (await response.json()) as Message[];

      setItems(
        Array.isArray(payload) ? payload : []
      );
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();

    setError("");

    try {
      const response = await apiFetch(
        "/admin/message-templates",
        {
          method: "POST",
          body: JSON.stringify(form),
        }
      );

      if (!response.ok) {
        throw new Error(await API_ERROR(response));
      }

      setForm({
        name: "",
        content: "",
      });

      await load();
      onSaved("Message template created.");
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    }
  };

  const toggle = async (item: Message) => {
    try {
      const response = await apiFetch(
        `/admin/message-templates/${item.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            active: !item.active,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await API_ERROR(response));
      }

      await load();

      onSaved(
        item.active
          ? "Message template deactivated."
          : "Message template activated."
      );
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    }
  };

  return (
    <>
      <Heading label="CONTENT">
        Message Templates
      </Heading>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <form
        className="admin-panel form-stack"
        onSubmit={create}
      >
        <input
          required
          placeholder="Name"
          value={form.name}
          onChange={(event) =>
            setForm({
              ...form,
              name: event.target.value,
            })
          }
        />

        <textarea
          required
          placeholder="Message content"
          value={form.content}
          onChange={(event) =>
            setForm({
              ...form,
              content: event.target.value,
            })
          }
        />

        <button
          type="submit"
          className="primary-button"
        >
          Create
        </button>
      </form>

      {loading ? (
        <div className="loading-state">
          Loading templates...
        </div>
      ) : (
        <div className="admin-panel admin-table">
          <div className="admin-table-head">
            <span>Name</span>
            <span>Active</span>
            <span>Updated</span>
            <span>Action</span>
          </div>

          {items.map((item) => (
            <div
              className="admin-table-row"
              key={item.id}
            >
              <strong>{item.name}</strong>

              <span>
                {item.active
                  ? "Active"
                  : "Inactive"}
              </span>

              <span>
                {date(item.updatedAt)}
              </span>

              <button
                type="button"
                className="text-button"
                onClick={() =>
                  void toggle(item)
                }
              >
                {item.active
                  ? "Deactivate"
                  : "Activate"}
              </button>
            </div>
          ))}

          {!items.length && (
            <div className="table-empty">
              No message templates found.
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Activity() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [action, setAction] = useState("");

  const data = usePage<Activity>(
    "/admin/activity",
    {
      page: String(page),
      pageSize: String(pageSize),
      action,
    }
  );

  return (
    <>
      <Heading label="AUDIT">
        Activity Logs
      </Heading>

      <div className="template-toolbar">
        <div className="search-box">
          <input
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            placeholder="Search action"
          />
        </div>

        <button
          type="button"
          className="outline-button"
          onClick={() => {
            setAction("");
            setPage(1);
          }}
        >
          Reset
        </button>
      </div>

      <State
        loading={data.loading}
        error={data.error}
        empty={!data.result.items.length}
      >
        <div className="admin-panel activity-table">
          {data.result.items.map((item) => (
            <div
              className="activity-row"
              key={item.id}
            >
              <strong>
                {text(item.action)}
              </strong>

              <span>
                {item.actor
                  ? `${item.actor.firstName} ${item.actor.lastName}`
                  : "System"}
              </span>

              <span>
                {item.entityType}{" "}
                {item.entityId || ""}
              </span>

              <time>
                {date(item.createdAt)}
              </time>
            </div>
          ))}
        </div>

        <Pager
          {...data.result}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </State>
    </>
  );
}

function Settings() {
  return (
    <>
      <Heading label="SYSTEM">
        Settings
      </Heading>

      <div className="admin-panel settings-panel">
        <p>
          Session duration is seven days and
          enforced by the API.
        </p>

        <p>
          Task and workflow defaults are
          configured through existing templates.
        </p>
      </div>
    </>
  );
}
