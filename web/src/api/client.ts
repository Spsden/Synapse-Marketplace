const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

const MARKETPLACE_TOKEN = import.meta.env.VITE_MARKETPLACE_TOKEN ?? "";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
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
      return request<{
        data: import("@/types").PluginResponse[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(`/store/plugins${qs ? `?${qs}` : ""}`);
    },

    getPlugin: (packageId: string, appVersion?: string) => {
      const qs = appVersion ? `?appVersion=${appVersion}` : "";
      return request<import("@/types").PluginDetailResponse>(
        `/store/plugins/${packageId}${qs}`,
      );
    },

    getPluginVersions: (packageId: string) =>
      request<import("@/types").PluginVersionResponse[]>(
        `/store/plugins/${packageId}/versions`,
      ),

    getVersion: (versionId: string) =>
      request<import("@/types").PluginVersionResponse>(
        `/store/versions/${versionId}`,
      ),

    getStatistics: (packageId: string) =>
      request<import("@/types").PluginStatisticsResponse>(
        `/store/plugins/${packageId}/statistics`,
      ),
  },

  mcp: {
    getRegistry: () =>
      request<import("@/types").McpRegistrySnapshot>("/mcp/registry"),

    listServers: () =>
      request<import("@/types").McpRegistryEntry[]>("/mcp/servers"),

    getServer: (serverId: string) =>
      request<import("@/types").McpRegistryEntry>(
        `/mcp/servers/${serverId}`,
      ),
  },

  dev: {
    submitPlugin: (file: File, packageId: string) => {
      const form = new FormData();
      form.append("file", file);
      form.append("packageId", packageId);
      return request<import("@/types").PluginDetailResponse>(
        "/dev/plugins/submit",
        { method: "POST", body: form, headers: {} },
      );
    },

    submitMcpServer: (body: import("@/types").SubmitMcpServerRequest) =>
      request<import("@/types").McpRegistryReviewItem>("/dev/mcp/servers/submit", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    importOfficialMcpServer: (
      body: import("@/types").ImportOfficialMcpServerRequest,
    ) =>
      request<import("@/types").McpRegistryReviewItem>(
        "/dev/mcp/servers/import-official",
        { method: "POST", body: JSON.stringify(body) },
      ),
  },

  admin: {
    getReviewQueue: () =>
      request<import("@/types").PluginReviewItem[]>(
        "/admin/review-queue",
      ),

    submitReviewDecision: (
      versionId: string,
      body: import("@/types").ReviewDecisionRequest,
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

    getMcpReviewQueue: () =>
      request<import("@/types").McpRegistryReviewItem[]>(
        "/admin/mcp/review-queue",
      ),

    reviewMcpSubmission: (
      submissionId: string,
      body: import("@/types").ReviewMcpSubmissionRequest,
    ) =>
      request<void>(
        `/admin/mcp/submissions/${submissionId}/review`,
        { method: "PATCH", body: JSON.stringify(body) },
      ),
  },

  oauth: {
    submitCredentials: (
      body: import("@/types").SubmitOAuthCredentialRequest,
      developerId?: string,
    ) =>
      request<import("@/types").OAuthCredentialResponse>(
        "/oauth/credentials",
        {
          method: "POST",
          body: JSON.stringify(body),
          headers: developerId
            ? { "x-developer-id": developerId }
            : {},
        },
      ),

    listByDeveloper: (developerId: string) =>
      request<import("@/types").OAuthCredentialsListResponse>(
        `/oauth/credentials/developer/${developerId}`,
      ),

    updateCredentials: (
      id: string,
      body: import("@/types").UpdateOAuthCredentialRequest,
      developerId?: string,
    ) =>
      request<import("@/types").OAuthCredentialResponse>(
        `/oauth/credentials/${id}`,
        {
          method: "PUT",
          body: JSON.stringify(body),
          headers: developerId
            ? { "x-developer-id": developerId }
            : {},
        },
      ),

    disableCredentials: (id: string, developerId?: string) =>
      request<void>(`/oauth/credentials/${id}`, {
        method: "DELETE",
        headers: developerId
          ? { "x-developer-id": developerId }
          : {},
      }),
  },
};
