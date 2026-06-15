import { Link } from "react-router-dom";
import { useMcpRegistry } from "@/api/hooks";
import Spinner from "@/components/Spinner";

export default function McpRegistryPage() {
  const { data: registry, isLoading, error } = useMcpRegistry();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">MCP Registry</h1>
        <p className="text-gray-500 mt-1">
          Published MCP server definitions for Synapse runtimes
        </p>
      </div>

      {isLoading && <Spinner />}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
          {error.message}
        </div>
      )}

      {registry && (
        <>
          <p className="text-sm text-gray-500 mb-4">
            Registry version {registry.version} &middot; Updated{" "}
            {new Date(registry.updatedAt).toLocaleString()} &middot;{" "}
            {registry.servers.length} server
            {registry.servers.length !== 1 ? "s" : ""}
          </p>

          {registry.servers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No MCP servers published
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registry.servers.map((server) => (
                <Link
                  key={server.id}
                  to={`/mcp/${server.serverId}`}
                  className="block bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md hover:border-brand-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {server.displayName}
                      </h3>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                        {server.serverId}
                      </p>
                    </div>
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200">
                      {server.trustLevel}
                    </span>
                  </div>
                  {server.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                      {server.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                      v{server.currentVersion}
                    </span>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                      {server.maintainerName}
                    </span>
                    {server.platforms.slice(0, 3).map((p) => (
                      <span
                        key={p}
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    {server.tools.length} tool{server.tools.length !== 1 ? "s" : ""}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
