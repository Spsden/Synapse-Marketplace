import { useState } from "react";
import {
  useSubmitPlugin,
  useSubmitMcpServer,
  useImportOfficialMcpServer,
  useOAuthCredentials,
  useSubmitOAuthCredential,
  useUpdateOAuthCredential,
  useDisableOAuthCredential,
} from "@/api/hooks";
import type {
  SubmitMcpServerRequest,
  OAuthProvider,
  ScopeMode,
} from "@/types";
import Spinner from "@/components/Spinner";

const OAUTH_PROVIDERS: OAuthProvider[] = [
  "notion",
  "google",
  "github",
  "slack",
  "microsoft",
  "discord",
  "linear",
  "figma",
  "salesforce",
  "dropbox",
  "stripe",
];

type Tab = "plugin" | "mcp" | "import" | "oauth";

export default function DeveloperPage() {
  const [tab, setTab] = useState<Tab>("plugin");

  const tabs: { key: Tab; label: string }[] = [
    { key: "plugin", label: "Submit Plugin" },
    { key: "mcp", label: "Submit MCP Server" },
    { key: "import", label: "Import Official MCP" },
    { key: "oauth", label: "OAuth Credentials" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Developer Portal</h1>
        <p className="text-gray-500 mt-1">
          Submit plugins and MCP server definitions
        </p>
      </div>

      <div className="flex gap-1 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t.key
                ? "bg-brand-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "plugin" && <PluginSubmitForm />}
      {tab === "mcp" && <McpSubmitForm />}
      {tab === "import" && <ImportOfficialForm />}
      {tab === "oauth" && <OAuthCredentialsManager />}
    </div>
  );
}

function PluginSubmitForm() {
  const [packageId, setPackageId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const mutation = useSubmitPlugin();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    mutation.mutate({ file, packageId });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg border border-gray-200 p-6 max-w-lg"
    >
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Submit .synx Package
      </h2>

      <label className="block text-sm font-medium text-gray-700 mb-1">
        Package ID
      </label>
      <input
        type="text"
        required
        value={packageId}
        onChange={(e) => setPackageId(e.target.value)}
        placeholder="com.example.my-plugin"
        pattern="^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$"
        className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none mb-4"
      />

      <label className="block text-sm font-medium text-gray-700 mb-1">
        .synx File
      </label>
      <input
        type="file"
        required
        accept=".synx"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 mb-4"
      />

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 disabled:opacity-50 transition-colors"
      >
        {mutation.isPending ? "Submitting..." : "Submit Plugin"}
      </button>

      {mutation.isError && (
        <p className="mt-3 text-sm text-red-600">{mutation.error.message}</p>
      )}
      {mutation.isSuccess && (
        <p className="mt-3 text-sm text-green-600">
          Plugin submitted successfully!
        </p>
      )}
    </form>
  );
}

function McpSubmitForm() {
  const mutation = useSubmitMcpServer();
  const [form, setForm] = useState<Partial<SubmitMcpServerRequest>>({
    maintainerKind: "community",
    trustLevel: "community-reviewed",
    tools: [],
    runtimeTargets: ["desktop-node"],
    platforms: ["macos", "windows", "linux"],
    source: {},
    createdBy: "",
  });

  const [toolsStr, setToolsStr] = useState("");

  function setField<K extends keyof SubmitMcpServerRequest>(
    key: K,
    value: SubmitMcpServerRequest[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tools = toolsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    mutation.mutate({ ...form, tools } as SubmitMcpServerRequest);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg border border-gray-200 p-6 max-w-lg"
    >
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Submit MCP Server Definition
      </h2>

      <div className="space-y-4">
        <Field
          label="Server ID"
          value={form.serverId ?? ""}
          onChange={(v) => setField("serverId", v)}
          placeholder="my-mcp-server"
          required
        />
        <Field
          label="Display Name"
          value={form.displayName ?? ""}
          onChange={(v) => setField("displayName", v)}
          placeholder="My MCP Server"
          required
        />
        <Field
          label="Version"
          value={form.currentVersion ?? ""}
          onChange={(v) => setField("currentVersion", v)}
          placeholder="1.0.0"
          required
        />
        <Field
          label="Maintainer Name"
          value={form.maintainerName ?? ""}
          onChange={(v) => setField("maintainerName", v)}
          placeholder="Your Name"
          required
        />
        <Field
          label="Your Email (createdBy)"
          value={form.createdBy ?? ""}
          onChange={(v) => setField("createdBy", v)}
          placeholder="dev@example.com"
          required
        />
        <Field
          label="Description"
          value={form.description ?? ""}
          onChange={(v) => setField("description", v)}
          textarea
        />
        <Field
          label="Documentation URL"
          value={form.documentationUrl ?? ""}
          onChange={(v) => setField("documentationUrl", v)}
          placeholder="https://docs.example.com"
        />
        <Field
          label="Tools (comma-separated)"
          value={toolsStr}
          onChange={setToolsStr}
          placeholder="tool-one, tool-two"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maintainer Kind
            </label>
            <select
              value={form.maintainerKind}
              onChange={(e) =>
                setField(
                  "maintainerKind",
                  e.target.value as SubmitMcpServerRequest["maintainerKind"],
                )
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="official">Official</option>
              <option value="community">Community</option>
              <option value="synapse">Synapse</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trust Level
            </label>
            <select
              value={form.trustLevel}
              onChange={(e) =>
                setField(
                  "trustLevel",
                  e.target.value as SubmitMcpServerRequest["trustLevel"],
                )
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="official">Official</option>
              <option value="community-reviewed">Community Reviewed</option>
              <option value="synapse-managed">Synapse Managed</option>
            </select>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full mt-6 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 disabled:opacity-50 transition-colors"
      >
        {mutation.isPending ? "Submitting..." : "Submit MCP Server"}
      </button>

      {mutation.isError && (
        <p className="mt-3 text-sm text-red-600">{mutation.error.message}</p>
      )}
      {mutation.isSuccess && (
        <p className="mt-3 text-sm text-green-600">
          MCP server submitted for review!
        </p>
      )}
    </form>
  );
}

function ImportOfficialForm() {
  const mutation = useImportOfficialMcpServer();
  const [serverJson, setServerJson] = useState("");
  const [overlayJson, setOverlayJson] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let server: Record<string, unknown>;
    let overlay: Record<string, unknown>;
    try {
      server = JSON.parse(serverJson);
    } catch {
      alert("Server JSON is not valid JSON");
      return;
    }
    try {
      overlay = JSON.parse(overlayJson);
    } catch {
      alert("Overlay JSON is not valid JSON");
      return;
    }
    mutation.mutate({ server, overlay });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl"
    >
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Import Official MCP Server
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Paste an official registry server.json and a Synapse review overlay. The
        backend converts it to a schema v2 submission.
      </p>

      <label className="block text-sm font-medium text-gray-700 mb-1">
        Official server.json
      </label>
      <textarea
        required
        value={serverJson}
        onChange={(e) => setServerJson(e.target.value)}
        placeholder='{ "name": "...", "description": "..." }'
        rows={8}
        className="w-full font-mono text-xs rounded-md border border-gray-300 px-4 py-2 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none mb-4"
      />

      <label className="block text-sm font-medium text-gray-700 mb-1">
        Synapse review overlay
      </label>
      <textarea
        required
        value={overlayJson}
        onChange={(e) => setOverlayJson(e.target.value)}
        placeholder='{ "serverId": "...", "tools": [...], "createdBy": "..." }'
        rows={8}
        className="w-full font-mono text-xs rounded-md border border-gray-300 px-4 py-2 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none mb-4"
      />

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 disabled:opacity-50 transition-colors"
      >
        {mutation.isPending ? "Importing..." : "Import Official Server"}
      </button>

      {mutation.isError && (
        <p className="mt-3 text-sm text-red-600">{mutation.error.message}</p>
      )}
      {mutation.isSuccess && (
        <p className="mt-3 text-sm text-green-600">
          Official server imported and submitted for review!
        </p>
      )}
    </form>
  );
}

function OAuthCredentialsManager() {
  const [developerId, setDeveloperId] = useState("");
  const [fetchId, setFetchId] = useState("");
  const { data, isLoading, error, refetch } = useOAuthCredentials(fetchId);
  const submitMutation = useSubmitOAuthCredential();

  function loadCredentials(e: React.FormEvent) {
    e.preventDefault();
    setFetchId(developerId);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <form
        onSubmit={loadCredentials}
        className="bg-white rounded-lg border border-gray-200 p-6"
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          OAuth Credentials Vault
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Manage OAuth client credentials for your plugins. Secrets are
          encrypted at rest.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            required
            value={developerId}
            onChange={(e) => setDeveloperId(e.target.value)}
            placeholder="Developer ID (email)"
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700"
          >
            Load Credentials
          </button>
        </div>
      </form>

      {fetchId && (
        <>
          <OAuthSubmitForm developerId={fetchId} />

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Stored Credentials for {fetchId}
            </h3>
            {isLoading && <Spinner />}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
                {error.message}
              </div>
            )}
            {data && (
              <>
                {data.credentials.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 bg-white rounded-lg border border-gray-200">
                    No credentials stored
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.credentials.map((cred) => (
                      <OAuthCredentialCard
                        key={cred.id}
                        cred={cred}
                        developerId={fetchId}
                        onUpdate={() => refetch()}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {submitMutation.isSuccess && (
            <p className="text-sm text-green-600">
              Credentials submitted successfully!
            </p>
          )}
        </>
      )}
    </div>
  );
}

function OAuthSubmitForm({ developerId }: { developerId: string }) {
  const mutation = useSubmitOAuthCredential();
  const [packageId, setPackageId] = useState("");
  const [provider, setProvider] = useState<OAuthProvider>("notion");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [scopesStr, setScopesStr] = useState("");
  const [scopeMode, setScopeMode] = useState<ScopeMode>("required");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const scopes = scopesStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    mutation.mutate(
      {
        body: {
          package_id: packageId,
          provider,
          client_id: clientId,
          client_secret: clientSecret,
          scopes,
          scope_mode: scopeMode,
          owner_developer_id: developerId,
        },
        developerId,
      },
      {
        onSuccess: () => {
          setPackageId("");
          setClientId("");
          setClientSecret("");
          setScopesStr("");
        },
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg border border-gray-200 p-6"
    >
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Add New Credentials
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Package ID <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            placeholder="com.example.my-plugin"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Provider <span className="text-red-400">*</span>
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as OAuthProvider)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
          >
            {OAUTH_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Scope Mode
          </label>
          <select
            value={scopeMode}
            onChange={(e) => setScopeMode(e.target.value as ScopeMode)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
          >
            <option value="required">Required</option>
            <option value="optional">Optional</option>
            <option value="forbidden">Forbidden</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client ID <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="oauth-client-id"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client Secret <span className="text-red-400">*</span>
          </label>
          <input
            type="password"
            required
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Scopes (comma-separated)
          </label>
          <input
            type="text"
            value={scopesStr}
            onChange={(e) => setScopesStr(e.target.value)}
            placeholder="read,write"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="mt-4 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 disabled:opacity-50 transition-colors"
      >
        {mutation.isPending ? "Storing..." : "Store Credentials"}
      </button>

      {mutation.isError && (
        <p className="mt-3 text-sm text-red-600">{mutation.error.message}</p>
      )}
    </form>
  );
}

function OAuthCredentialCard({
  cred,
  developerId,
  onUpdate,
}: {
  cred: import("@/types").OAuthCredentialResponse;
  developerId: string;
  onUpdate: () => void;
}) {
  const updateMutation = useUpdateOAuthCredential();
  const disableMutation = useDisableOAuthCredential();
  const [showEdit, setShowEdit] = useState(false);
  const [editClientId, setEditClientId] = useState("");
  const [editSecret, setEditSecret] = useState("");
  const [editScopes, setEditScopes] = useState(cred.scopes.join(", "));

  function handleDisable() {
    if (!confirm(`Disable ${cred.provider} credentials for ${cred.package_id}?`))
      return;
    disableMutation.mutate(
      { id: cred.id, developerId },
      { onSuccess: onUpdate },
    );
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    const scopes = editScopes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateMutation.mutate(
      {
        id: cred.id,
        developerId,
        body: {
          client_id: editClientId || undefined,
          client_secret: editSecret || undefined,
          scopes,
        },
      },
      {
        onSuccess: () => {
          setShowEdit(false);
          setEditClientId("");
          setEditSecret("");
          onUpdate();
        },
      },
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900">{cred.provider}</h4>
            <span className="text-xs text-gray-400 font-mono">
              {cred.package_id}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Client ID: <code className="font-mono">{cred.client_id}</code>
          </p>
          {cred.scopes.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              Scopes: {cred.scopes.join(", ")}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            {cred.scope_mode && <span>mode: {cred.scope_mode} &middot; </span>}
            Created {new Date(cred.created_at).toLocaleDateString()}
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
            cred.is_active
              ? "bg-green-100 text-green-800 border-green-200"
              : "bg-gray-100 text-gray-600 border-gray-200"
          }`}
        >
          {cred.is_active ? "Active" : "Disabled"}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setShowEdit(!showEdit)}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200"
        >
          {showEdit ? "Cancel" : "Edit"}
        </button>
        {cred.is_active && (
          <button
            onClick={handleDisable}
            disabled={disableMutation.isPending}
            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 disabled:opacity-50"
          >
            Disable
          </button>
        )}
      </div>

      {showEdit && (
        <form
          onSubmit={handleUpdate}
          className="mt-3 pt-3 border-t border-gray-100 space-y-2"
        >
          <input
            type="text"
            value={editClientId}
            onChange={(e) => setEditClientId(e.target.value)}
            placeholder="New client ID (leave blank to skip)"
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-xs"
          />
          <input
            type="password"
            value={editSecret}
            onChange={(e) => setEditSecret(e.target.value)}
            placeholder="New secret (leave blank to skip)"
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-xs"
          />
          <input
            type="text"
            value={editScopes}
            onChange={(e) => setEditScopes(e.target.value)}
            placeholder="Scopes (comma-separated)"
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded hover:bg-brand-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
          {updateMutation.isError && (
            <p className="text-xs text-red-600">
              {updateMutation.error.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const cls =
    "w-full rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={cls}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={cls}
        />
      )}
    </div>
  );
}
