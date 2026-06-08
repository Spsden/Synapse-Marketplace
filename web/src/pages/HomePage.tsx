import { useState } from "react";
import { usePlugins } from "@/api/hooks";
import PluginCard from "@/components/PluginCard";
import Pagination from "@/components/Pagination";
import Spinner from "@/components/Spinner";

const PAGE_SIZE = 12;

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("");

  const { data, isLoading, error } = usePlugins({
    search: appliedSearch || undefined,
    category: appliedCategory || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedSearch(search);
    setAppliedCategory(category);
    setPage(0);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Plugin Store</h1>
        <p className="text-gray-500 mt-1">
          Browse and discover published plugins for Synapse
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row gap-3 mb-8"
      >
        <input
          type="text"
          placeholder="Search plugins..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
        >
          <option value="">All Categories</option>
          <option value="PRODUCTIVITY">Productivity</option>
          <option value="SOCIAL">Social</option>
          <option value="DEVELOPMENT">Development</option>
          <option value="ENTERTAINMENT">Entertainment</option>
          <option value="EDUCATION">Education</option>
          <option value="FINANCE">Finance</option>
          <option value="HEALTH">Health</option>
          <option value="UTILITIES">Utilities</option>
        </select>
        <button
          type="submit"
          className="px-6 py-2 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 transition-colors"
        >
          Search
        </button>
      </form>

      {isLoading && <Spinner />}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
          {error.message}
        </div>
      )}

      {data && (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {data.total} plugin{data.total !== 1 ? "s" : ""} found
          </p>
          {data.data.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No plugins found
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.data.map((p) => (
                <PluginCard key={p.id} plugin={p} />
              ))}
            </div>
          )}
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
