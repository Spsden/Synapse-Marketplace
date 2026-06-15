import { useParams, Link } from "react-router-dom";
import { useMcpServer } from "@/api/hooks";
import Spinner from "@/components/Spinner";

export default function McpServerDetailPage() {
  const { serverId } = useParams<{ serverId: string }>();
  const { data: server, isLoading, error } = useMcpServer(serverId ?? "");

  if (isLoading) return <Spinner />;
  if (error)
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
        {error.message}
      </div>
    );
  if (!server) return <div className="text-gray-400">Server not found</div>;

  return (
    <div>
      <Link
        to="/mcp"
        className="text-sm text-brand-600 hover:text-brand-800 mb-4 inline-block"
      >
        &larr; Back to MCP Registry
      </Link>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {server.displayName}
            </h1>
            <p className="text-sm font-mono text-gray-400 mt-1">
              {server.serverId}
            </p>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-brand-50 text-brand-700 border border-brand-200">
            {server.trustLevel}
          </span>
        </div>

        {server.description && (
          <p className="mt-4 text-gray-700">{server.description}</p>
        )}

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Version" value={server.currentVersion} />
          <Field label="Maintainer" value={server.maintainerName} />
          <Field label="Kind" value={server.maintainerKind} />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
            Schema v{server.schemaVersion}
          </span>
          {server.upstreamHash && (
            <span className="text-xs text-gray-400 font-mono">
              upstream: {server.upstreamHash.slice(0, 12)}...
            </span>
          )}
        </div>

        {server.documentationUrl && (
          <a
            href={server.documentationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm text-brand-600 hover:text-brand-800"
          >
            Documentation &rarr;
          </a>
        )}

        <Section title="Platforms">
          <div className="flex flex-wrap gap-2">
            {server.platforms.map((p) => (
              <span
                key={p}
                className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded border border-blue-200"
              >
                {p}
              </span>
            ))}
          </div>
        </Section>

        <Section title="Runtime Targets">
          <div className="flex flex-wrap gap-2">
            {server.runtimeTargets.map((t) => (
              <span
                key={t}
                className="text-xs bg-gray-100 px-2.5 py-1 rounded border border-gray-200"
              >
                {t}
              </span>
            ))}
          </div>
        </Section>

        <Section title={`Tools (${server.tools.length})`}>
          <div className="flex flex-wrap gap-1.5">
            {server.tools.map((t) => (
              <span
                key={t}
                className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200 font-mono"
              >
                {t}
              </span>
            ))}
          </div>
        </Section>

        <Section title="Source">
          <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto border border-gray-200">
            {JSON.stringify(server.source, null, 2)}
          </pre>
        </Section>

        {server.auth && (
          <Section title="Auth">
            <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto border border-gray-200">
              {JSON.stringify(server.auth, null, 2)}
            </pre>
          </Section>
        )}

        {server.capabilities && (
          <Section title="Capabilities">
            <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto border border-gray-200">
              {JSON.stringify(server.capabilities, null, 2)}
            </pre>
          </Section>
        )}

        {server.authProfiles.length > 0 && (
          <Section title={`Auth Profiles (${server.authProfiles.length})`}>
            <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto border border-gray-200">
              {JSON.stringify(server.authProfiles, null, 2)}
            </pre>
          </Section>
        )}

        {server.artifacts.length > 0 && (
          <Section title={`Artifacts (${server.artifacts.length})`}>
            <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto border border-gray-200">
              {JSON.stringify(server.artifacts, null, 2)}
            </pre>
          </Section>
        )}

        {server.deployments.length > 0 && (
          <Section title={`Deployments (${server.deployments.length})`}>
            <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto border border-gray-200">
              {JSON.stringify(server.deployments, null, 2)}
            </pre>
          </Section>
        )}

        {server.capabilityCatalog &&
          Object.keys(server.capabilityCatalog).length > 0 && (
            <Section title="Capability Catalog">
              <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto border border-gray-200">
                {JSON.stringify(server.capabilityCatalog, null, 2)}
              </pre>
            </Section>
          )}

        {server.cloudCertification && (
          <Section title="Cloud Certification">
            <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto border border-gray-200">
              {JSON.stringify(server.cloudCertification, null, 2)}
            </pre>
          </Section>
        )}

        {server.upstream && (
          <Section title="Upstream">
            <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto border border-gray-200">
              {JSON.stringify(server.upstream, null, 2)}
            </pre>
          </Section>
        )}

        <p className="mt-6 text-xs text-gray-400">
          Published: {new Date(server.publishedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <h3 className="font-medium text-gray-900 mb-2">{title}</h3>
      {children}
    </div>
  );
}
