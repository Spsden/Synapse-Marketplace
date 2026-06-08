import { useParams, Link } from "react-router-dom";
import { usePlugin, usePluginVersions, usePluginStatistics } from "@/api/hooks";
import StatusBadge from "@/components/StatusBadge";
import Spinner from "@/components/Spinner";

export default function PluginDetailPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const { data: plugin, isLoading, error } = usePlugin(packageId ?? "");
  const { data: versions } = usePluginVersions(packageId ?? "");
  const { data: stats } = usePluginStatistics(packageId ?? "");

  if (isLoading) return <Spinner />;
  if (error)
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
        {error.message}
      </div>
    );
  if (!plugin) return <div className="text-gray-400">Plugin not found</div>;

  return (
    <div>
      <Link
        to="/"
        className="text-sm text-brand-600 hover:text-brand-800 mb-4 inline-block"
      >
        &larr; Back to Store
      </Link>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {plugin.name}
            </h1>
            <p className="text-gray-500 mt-1">
              by {plugin.author} &middot; {plugin.packageId}
            </p>
          </div>
          <StatusBadge status={plugin.status} />
        </div>

        {plugin.description && (
          <p className="mt-4 text-gray-700">{plugin.description}</p>
        )}

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <InfoTile label="Version" value={plugin.version} />
          <InfoTile label="Min App" value={plugin.minAppVersion} />
          <InfoTile label="Downloads" value={String(plugin.downloadCount)} />
          <InfoTile
            label="File Size"
            value={
              plugin.fileSizeBytes
                ? `${(plugin.fileSizeBytes / 1024).toFixed(1)} KB`
                : "N/A"
            }
          />
        </div>

        {stats && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 rounded-md p-4">
            <InfoTile label="Total Versions" value={String(stats.totalVersions)} />
            <InfoTile
              label="Published Versions"
              value={String(stats.publishedVersions)}
            />
            <InfoTile
              label="Total Downloads"
              value={String(stats.totalDownloads)}
            />
            <InfoTile
              label="Last Updated"
              value={new Date(stats.updatedAt).toLocaleDateString()}
            />
          </div>
        )}

        {plugin.releaseNotes && (
          <div className="mt-6">
            <h3 className="font-medium text-gray-900 mb-2">Release Notes</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {plugin.releaseNotes}
            </p>
          </div>
        )}

        {plugin.downloadUrl && (
          <a
            href={plugin.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 transition-colors"
          >
            Download .synx
          </a>
        )}

        {plugin.checksumSha256 && (
          <p className="mt-3 text-xs text-gray-400 font-mono break-all">
            SHA-256: {plugin.checksumSha256}
          </p>
        )}
      </div>

      {versions && versions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            All Versions
          </h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Version
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Min App
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Downloads
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {versions.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-brand-700">
                      {v.version}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {v.minAppVersion}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {v.downloadCount}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
