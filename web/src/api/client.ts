import type {
  ImportOfficialMcpServerRequest,
  IngestPluginsRequest,
  IngestReport,
  McpRegistryEntry,
  McpRegistryReviewItem,
  McpRegistrySnapshot,
  OAuthCredentialResponse,
  OAuthCredentialsListResponse,
  PaginatedResponse,
  PluginDetailResponse,
  PluginResponse,
  PluginReviewItem,
  PluginStatisticsResponse,
  PluginVersionResponse,
  ReviewDecisionRequest,
  ReviewMcpSubmissionRequest,
  SubmitMcpServerRequest,
  SubmitOAuthCredentialRequest,
  UpdateOAuthCredentialRequest,
} from "@/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

const MARKETPLACE_TOKEN = import.meta.env.VITE_MARKETPLACE_TOKEN ?? "";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(MARKETPLACE_TOKEN
        ? { Authorization: `Bearer ${MARKETPLACE_TOKEN}` }
        : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const api = {
  store: {
    listPlugins: (params?: {
      category?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    }) => {
      const sp = new URLSearchParams();
      if (params?.category) sp.set("category", params.category);
      if (params?.search) sp.set("search", params.search);
      if (params?.page !== undefined) sp.set("page", String(params.page));
      if (params?.pageSize !== undefined)
        sp.set("pageSize", String(params.pageSize));
      const qs = sp.toString();
      return request<PaginatedResponse<PluginResponse>>(
        `/store/plugins${qs ? `?${qs}` : ""}`,
      );
    },

    getPlugin: (packageId: string, appVersion?: string) => {
      const qs = appVersion ? `?appVersion=${appVersion}` : "";
      return request<PluginDetailResponse>(
        `/store/plugins/${packageId}${qs}`,
      );
    },

    getPluginVersions: (packageId: string) =>
      request<PluginVersionResponse[]>(
        `/store/plugins/${packageId}/versions`,
      ),

    getStatistics: (packageId: string) =>
      request<PluginStatisticsResponse>(
        `/store/plugins/${packageId}/statistics`,
      ),
  },

  mcp: {
    getRegistry: () => request<McpRegistrySnapshot>("/mcp/registry"),

    getServer: (serverId: string) =>
      request<McpRegistryEntry>(`/mcp/servers/${serverId}`),
  },

  dev: {
    submitMcpServer: (body: SubmitMcpServerRequest) =>
      request<McpRegistryReviewItem>("/dev/mcp/servers/submit", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    importOfficialMcpServer: (body: ImportOfficialMcpServerRequest) =>
      request<McpRegistryReviewItem>("/dev/mcp/servers/import-official", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  admin: {
    getReviewQueue: () =>
      request<PluginReviewItem[]>("/admin/review-queue"),

    submitReviewDecision: (
      versionId: string,
      body: ReviewDecisionRequest,
    ) =>
      request<void>(`/admin/plugins/${versionId}/verify`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    flagVersion: (versionId: string, reason: string, flaggedBy: string) => {
      const sp = new URLSearchParams({ reason, flaggedBy });
      return request<void>(`/admin/plugins/${versionId}/flag?${sp}`, {
        method: "POST",
      });
    },

    unflagVersion: (versionId: string) =>
      request<void>(`/admin/plugins/${versionId}/flag`, {
        method: "DELETE",
      }),

    deletePlugin: (packageId: string) =>
      request<void>(`/admin/plugins/${packageId}`, { method: "DELETE" }),

    ingestPlugins: (body: IngestPluginsRequest) =>
      request<IngestReport>("/admin/plugins/ingest", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    getMcpReviewQueue: () =>
      request<McpRegistryReviewItem[]>("/admin/mcp/review-queue"),

    reviewMcpSubmission: (
      submissionId: string,
      body: ReviewMcpSubmissionRequest,
    ) =>
      request<void>(
        `/admin/mcp/submissions/${submissionId}/review`,
        { method: "PATCH", body: JSON.stringify(body) },
      ),
  },

  oauth: {
    submitCredentials: (
      body: SubmitOAuthCredentialRequest,
      developerId?: string,
    ) =>
      request<OAuthCredentialResponse>("/oauth/credentials", {
        method: "POST",
        body: JSON.stringify(body),
        headers: developerId ? { "x-developer-id": developerId } : {},
      }),

    listByDeveloper: (developerId: string) =>
      request<OAuthCredentialsListResponse>(
        `/oauth/credentials/developer/${developerId}`,
      ),

    updateCredentials: (
      id: string,
      body: UpdateOAuthCredentialRequest,
      developerId?: string,
    ) =>
      request<OAuthCredentialResponse>(`/oauth/credentials/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
        headers: developerId ? { "x-developer-id": developerId } : {},
      }),

    disableCredentials: (id: string, developerId?: string) =>
      request<void>(`/oauth/credentials/${id}`, {
        method: "DELETE",
        headers: developerId ? { "x-developer-id": developerId } : {},
      }),
  },
};
