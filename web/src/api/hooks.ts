import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "./client";

export function usePlugins(params?: {
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ["plugins", params],
    queryFn: () => api.store.listPlugins(params),
  });
}

export function usePlugin(packageId: string, appVersion?: string) {
  return useQuery({
    queryKey: ["plugin", packageId, appVersion],
    queryFn: () => api.store.getPlugin(packageId, appVersion),
    enabled: !!packageId,
  });
}

export function usePluginVersions(packageId: string) {
  return useQuery({
    queryKey: ["plugin-versions", packageId],
    queryFn: () => api.store.getPluginVersions(packageId),
    enabled: !!packageId,
  });
}

export function usePluginStatistics(packageId: string) {
  return useQuery({
    queryKey: ["plugin-statistics", packageId],
    queryFn: () => api.store.getStatistics(packageId),
    enabled: !!packageId,
  });
}

export function useMcpRegistry() {
  return useQuery({
    queryKey: ["mcp-registry"],
    queryFn: () => api.mcp.getRegistry(),
  });
}

export function useMcpServers() {
  return useQuery({
    queryKey: ["mcp-servers"],
    queryFn: () => api.mcp.listServers,
  });
}

export function useMcpServer(serverId: string) {
  return useQuery({
    queryKey: ["mcp-server", serverId],
    queryFn: () => api.mcp.getServer(serverId),
    enabled: !!serverId,
  });
}

export function useSubmitPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, packageId }: { file: File; packageId: string }) =>
      api.dev.submitPlugin(file, packageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plugins"] }),
  });
}

export function useSubmitMcpServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.dev.submitMcpServer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcp-registry"] }),
  });
}

export function useAdminReviewQueue() {
  return useQuery({
    queryKey: ["admin-review-queue"],
    queryFn: () => api.admin.getReviewQueue(),
  });
}

export function useAdminMcpReviewQueue() {
  return useQuery({
    queryKey: ["admin-mcp-review-queue"],
    queryFn: () => api.admin.getMcpReviewQueue(),
  });
}

export function useReviewDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      versionId,
      body,
    }: {
      versionId: string;
      body: import("@/types").ReviewDecisionRequest;
    }) => api.admin.submitReviewDecision(versionId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-review-queue"] }),
  });
}

export function useFlagVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      versionId,
      reason,
      flaggedBy,
    }: {
      versionId: string;
      reason: string;
      flaggedBy: string;
    }) => api.admin.flagVersion(versionId, reason, flaggedBy),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-review-queue"] }),
  });
}

export function useUnflagVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => api.admin.unflagVersion(versionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-review-queue"] }),
  });
}

export function useDeletePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packageId: string) => api.admin.deletePlugin(packageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-review-queue"] });
      qc.invalidateQueries({ queryKey: ["plugins"] });
    },
  });
}

export function useReviewMcpSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      submissionId,
      body,
    }: {
      submissionId: string;
      body: import("@/types").ReviewMcpSubmissionRequest;
    }) => api.admin.reviewMcpSubmission(submissionId, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-mcp-review-queue"] }),
  });
}
