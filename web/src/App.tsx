import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import PluginDetailPage from "./pages/PluginDetailPage";
import McpRegistryPage from "./pages/McpRegistryPage";
import McpServerDetailPage from "./pages/McpServerDetailPage";
import DeveloperPage from "./pages/DeveloperPage";
import AdminPage from "./pages/AdminPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="plugins/:packageId" element={<PluginDetailPage />} />
            <Route path="mcp" element={<McpRegistryPage />} />
            <Route path="mcp/:serverId" element={<McpServerDetailPage />} />
            <Route path="developer" element={<DeveloperPage />} />
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
