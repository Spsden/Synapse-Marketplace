import { useState } from "react";
import {
  useAdminReviewQueue,
  useAdminMcpReviewQueue,
  useReviewDecision,
  useFlagVersion,
  useUnflagVersion,
  useDeletePlugin,
  useReviewMcpSubmission,
} from "@/api/hooks";
import StatusBadge from "@/components/StatusBadge";
import Spinner from "@/components/Spinner";

export default function AdminPage() {
  const [tab, setTab] = useState<"plugins" | "mcp">("plugins");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-500 mt-1">
          Review submissions and manage marketplace content
        </p>
      </div>

      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setTab("plugins")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === "plugins"
              ? "bg-brand-600 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Plugin Review Queue
        </button>
        <button
          onClick={() => setTab("mcp")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === "mcp"
              ? "bg-brand-600 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          MCP Review Queue
        </button>
      </div>

      {tab === "plugins" ? <PluginReviewQueue /> : <McpReviewQueue />}
    </div>
  );
}

function PluginReviewQueue() {
  const { data: queue, isLoading, error } = useAdminReviewQueue();
  const reviewMutation = useReviewDecision();
  const flagMutation = useFlagVersion();
  const unflagMutation = useUnflagVersion();
  const deleteMutation = useDeletePlugin();

  if (isLoading) return <Spinner />;
  if (error)
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
        {error.message}
      </div>
    );

  if (!queue?.length)
    return (
      <div className="text-center py-12 text-gray-400">
        No items in review queue
      </div>
    );

  return (
    <div className="space-y-4">
      {queue.map((item) => (
        <PluginReviewCard
          key={item.id}
          item={item}
          onApprove={(reviewedBy) =>
            reviewMutation.mutate({
              versionId: item.id,
              body: { decision: "PUBLISH", reviewedBy },
            })
          }
          onReject={(reviewedBy, reason) =>
            reviewMutation.mutate({
              versionId: item.id,
              body: { decision: "REJECT", reviewedBy, rejectionReason: reason },
            })
          }
          onFlag={(reason, by) =>
            flagMutation.mutate({
              versionId: item.id,
              reason,
              flaggedBy: by,
            })
          }
          onUnflag={() => unflagMutation.mutate(item.id)}
          onDelete={() => deleteMutation.mutate(item.packageId)}
        />
      ))}
    </div>
  );
}

function PluginReviewCard({
  item,
  onApprove,
  onReject,
  onFlag,
  onUnflag,
  onDelete,
}: {
  item: import("@/types").PluginReviewItem;
  onApprove: (reviewedBy: string) => void;
  onReject: (reviewedBy: string, reason: string) => void;
  onFlag: (reason: string, by: string) => void;
  onUnflag: () => void;
  onDelete: () => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewer, setReviewer] = useState("admin");
  const [showFlag, setShowFlag] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagBy, setFlagBy] = useState("admin");
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900">{item.name}</h3>
          <p className="text-sm text-gray-500">
            {item.packageId} &middot; v{item.version} &middot; by{" "}
            {item.author}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {item.description?.slice(0, 200)}
            {(item.description?.length ?? 0) > 200 ? "..." : ""}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Submitted {new Date(item.createdAt).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      {item.isFlagged && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          Flagged: {item.flagReason}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Reviewer ID"
          value={reviewer}
          onChange={(e) => setReviewer(e.target.value)}
          className="w-32 rounded border border-gray-300 px-2 py-1.5 text-xs"
        />
        <button
          onClick={() => onApprove(reviewer)}
          className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700"
        >
          Approve
        </button>
        <button
          onClick={() => setShowReject(!showReject)}
          className="px-3 py-1.5 bg-yellow-500 text-white text-xs font-medium rounded hover:bg-yellow-600"
        >
          Reject
        </button>
        {item.isFlagged ? (
          <button
            onClick={onUnflag}
            className="px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded hover:bg-gray-700"
          >
            Unflag
          </button>
        ) : (
          <button
            onClick={() => setShowFlag(!showFlag)}
            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700"
          >
            Flag
          </button>
        )}
        <button
          onClick={() => setShowDelete(!showDelete)}
          className="px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded hover:bg-gray-900"
        >
          Delete Plugin
        </button>
      </div>

      {showReject && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="Rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs"
          />
          <button
            onClick={() => {
              onReject(reviewer, rejectReason);
              setShowReject(false);
            }}
            className="px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded"
          >
            Confirm Reject
          </button>
        </div>
      )}

      {showFlag && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="Flag reason..."
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs"
          />
          <input
            type="text"
            placeholder="Flagged by"
            value={flagBy}
            onChange={(e) => setFlagBy(e.target.value)}
            className="w-28 rounded border border-gray-300 px-2 py-1.5 text-xs"
          />
          <button
            onClick={() => {
              onFlag(flagReason, flagBy);
              setShowFlag(false);
            }}
            className="px-3 py-1.5 bg-red-700 text-white text-xs font-medium rounded"
          >
            Confirm Flag
          </button>
        </div>
      )}

      {showDelete && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-700 mb-2">
            Permanently delete <strong>{item.packageId}</strong> and all its
            versions?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onDelete();
                setShowDelete(false);
              }}
              className="px-3 py-1.5 bg-red-700 text-white text-xs font-medium rounded"
            >
              Confirm Delete
            </button>
            <button
              onClick={() => setShowDelete(false)}
              className="px-3 py-1.5 bg-white border border-gray-300 text-xs font-medium rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function McpReviewQueue() {
  const { data: queue, isLoading, error } = useAdminMcpReviewQueue();
  const reviewMutation = useReviewMcpSubmission();

  if (isLoading) return <Spinner />;
  if (error)
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
        {error.message}
      </div>
    );

  if (!queue?.length)
    return (
      <div className="text-center py-12 text-gray-400">
        No MCP submissions pending review
      </div>
    );

  return (
    <div className="space-y-4">
      {queue.map((item) => (
        <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900">
                {item.displayName}
              </h3>
              <p className="text-sm text-gray-500">
                {item.serverId} &middot; v{item.currentVersion} &middot;{" "}
                {item.maintainerName}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {item.changeType} &middot; by {item.createdBy} &middot;{" "}
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
            <StatusBadge status={item.status} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Reviewer ID"
              defaultValue="admin"
              id={`reviewer-${item.id}`}
              className="w-32 rounded border border-gray-300 px-2 py-1.5 text-xs"
            />
            <button
              onClick={() => {
                const el = document.getElementById(
                  `reviewer-${item.id}`,
                ) as HTMLInputElement;
                reviewMutation.mutate({
                  submissionId: item.id,
                  body: {
                    decision: "PUBLISH",
                    reviewedBy: el?.value || "admin",
                  },
                });
              }}
              className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700"
            >
              Approve
            </button>
            <button
              onClick={() => {
                const el = document.getElementById(
                  `reviewer-${item.id}`,
                ) as HTMLInputElement;
                reviewMutation.mutate({
                  submissionId: item.id,
                  body: {
                    decision: "REJECT",
                    reviewedBy: el?.value || "admin",
                  },
                });
              }}
              className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
