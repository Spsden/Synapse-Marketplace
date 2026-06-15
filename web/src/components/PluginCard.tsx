import { Link } from "react-router-dom";
import type { PluginResponse } from "@/types";

export default function PluginCard({ plugin }: { plugin: PluginResponse }) {
  return (
    <Link
      to={`/plugins/${plugin.packageId}`}
      className="block bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md hover:border-brand-300 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {plugin.name}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">{plugin.author}</p>
        </div>
        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200">
          {plugin.status}
        </span>
      </div>
      <p className="text-sm text-gray-600 mt-3 line-clamp-2">
        {plugin.description || "No description"}
      </p>
      <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
        {plugin.category && (
          <span className="bg-gray-100 px-2 py-0.5 rounded">
            {plugin.category}
          </span>
        )}
        <span>{new Date(plugin.createdAt).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}
