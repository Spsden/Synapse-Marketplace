import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Store" },
  { to: "/mcp", label: "MCP Registry" },
  { to: "/developer", label: "Developer" },
  { to: "/admin", label: "Admin" },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <NavLink to="/" className="text-xl font-bold tracking-tight">
              Synapse Marketplace
            </NavLink>
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-brand-700 text-white"
                        : "text-brand-200 hover:bg-brand-800 hover:text-white"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="bg-gray-100 border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          Synapse Marketplace &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
