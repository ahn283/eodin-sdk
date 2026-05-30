import React from "react";
import { Outlet, Link, useLocation } from "react-router";
import svgPaths from "../imports/svg-58dytggail";

function EodinLogoMark({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
       <path d={svgPaths.p30d97fd0} fill="white" stroke="#FFC095" strokeWidth="0.711111" />
       <path d={svgPaths.pabd2680} fill="#FC8D42" />
       <path d={svgPaths.p14935300} fill="#363739" />
       <path d={svgPaths.p1def4e00} fill="#FAA668" />
    </svg>
  );
}

export default function Root() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <EodinLogoMark className="w-8 h-8 transition-transform group-hover:scale-110" />
              <span className="font-bold text-lg text-[#363739]">Eodin</span>
            </Link>

            {/* Navigation Links */}
            <div className="flex items-center gap-1">
              <Link
                to="/"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive("/") && !isActive("/design-system")
                    ? "bg-[#fc8d42] text-white"
                    : "text-[#363739]/70 hover:bg-gray-50 hover:text-[#363739]"
                }`}
              >
                Deep Link
              </Link>
              <Link
                to="/design-system"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive("/design-system")
                    ? "bg-[#fc8d42] text-white"
                    : "text-[#363739]/70 hover:bg-gray-50 hover:text-[#363739]"
                }`}
              >
                Design System
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <Outlet />
    </div>
  );
}
