import { useState } from "react";
import { useSubmitPlugin, useSubmitMcpServer } from "@/api/hooks";
import type { SubmitMcpServerRequest } from "@/types";

export default function DeveloperPage() {
  const [tab, setTab] = useState<"plugin" | "mcp">("plugin");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Developer Portal</h1>
        <p className="text-gray-500 mt-1">
          Submit plugins and MCP server definitions
        </p>
      </div>

      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setTab("plugin")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === "plugin"
              ? "bg-brand-600 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Submit Plugin
        </button>
        <button
          onClick={() => setTab("mcp")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === "mcp"
              ? "bg-brand-600 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Submit MCP Server
        </button>
      </div>

      {tab === "plugin" ? <PluginSubmitForm /> : <McpSubmitForm />}
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
