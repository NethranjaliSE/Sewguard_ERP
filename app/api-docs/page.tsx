"use client";

import dynamic from "next/dynamic";
import { swaggerSpec } from "@/lib/swaggerSpec";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-24 text-slate-500 font-medium">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mr-3" />
      <span>Loading Swagger UI Documentation...</span>
    </div>
  ),
});

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700 tracking-wide uppercase">
                ApparelFlow ERP
              </span>
              <span className="text-xs font-semibold text-slate-400">v1.0.0</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Gatekeeper Verification System — API Documentation
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Interactive OpenAPI 3.0 console to test Cutting Order creation, querying, and Gatekeeper verification endpoints.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              OpenAPI 3.0.3
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              Interactive Testing
            </span>
          </div>
        </header>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 md:p-6">
          <SwaggerUI spec={swaggerSpec} />
        </div>
      </div>
    </div>
  );
}
