"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, Badge } from "@/components/ui";

// ─── Types ───────────────────────────────────────────────────────────

interface VerificationItem {
  id: string;
  expectedQty: number;
  actualQty: number | null;
  status: string | null;
  recipeComponent: {
    componentName: string;
    unit: string;
  };
}

interface VerificationLog {
  id: string;
  action: string;
  wastagePct: number | null;
  createdAt: string;
}

interface OrderData {
  id: string;
  targetQty: number;
  fabricRollId: string;
  actualFabricYards: number;
  expectedFabricYards: number;
  status: string;
  createdAt: string;
  recipe: {
    name: string;
  };
  verificationItems: VerificationItem[];
  verificationLog: VerificationLog | null;
}

// ─── SewingView ──────────────────────────────────────────────────────

export default function SewingView() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const fetchVerifiedOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/orders?status=VERIFIED");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setOrders(data.orders);
    } catch {
      setError("Could not load verified orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVerifiedOrders();
  }, [fetchVerifiedOrders]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">
          Verified Orders — Ready for Sewing
        </h2>
        {[1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse h-20 bg-slate-100 rounded-xl"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Verified Orders — Ready for Sewing
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Only orders that have passed Gatekeeper verification appear here.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <p className="mt-4 text-slate-500 font-medium">
              No verified orders yet
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Orders will appear here once they pass verification.
            </p>
          </div>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-50">
                <th className="text-left py-3 px-4 font-semibold text-slate-700">
                  Order ID
                </th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">
                  Recipe
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">
                  Target Qty
                </th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">
                  Fabric Roll
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">
                  Fabric (Actual / Expected)
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">
                  Wastage %
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">
                  Status
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const wastage = order.verificationLog?.wastagePct;

                return (
                  <React.Fragment key={order.id}>
                    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-900">
                        {order.id.slice(0, 8)}…
                      </td>
                      <td className="py-3 px-4 text-slate-900 font-medium">
                        {order.recipe.name}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-900">
                        {order.targetQty}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {order.fabricRollId}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-900">
                        {order.actualFabricYards}yd / {order.expectedFabricYards}yd
                      </td>
                      <td className="py-3 px-4 text-center">
                        {wastage != null ? (
                          <Badge
                            variant={
                              wastage <= 0
                                ? "green"
                                : wastage <= 5
                                ? "yellow"
                                : "red"
                            }
                          >
                            {wastage > 0 ? "+" : ""}
                            {wastage}%
                          </Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="green">VERIFIED</Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
                          onClick={() =>
                            setExpandedOrderId(isExpanded ? null : order.id)
                          }
                        >
                          {isExpanded ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded component details */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="bg-slate-50 px-4 py-4">
                          <div className="max-w-2xl mx-auto">
                            <h4 className="text-sm font-semibold text-slate-700 mb-3">
                              Verified Component Breakdown
                            </h4>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="text-left py-2 font-medium text-slate-600">
                                    Component
                                  </th>
                                  <th className="text-center py-2 font-medium text-slate-600">
                                    Expected
                                  </th>
                                  <th className="text-center py-2 font-medium text-slate-600">
                                    Actual
                                  </th>
                                  <th className="text-center py-2 font-medium text-slate-600">
                                    Status
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.verificationItems.map((vi) => (
                                  <tr
                                    key={vi.id}
                                    className="border-b border-slate-100 last:border-0"
                                  >
                                    <td className="py-2 text-slate-900">
                                      {vi.recipeComponent.componentName}
                                    </td>
                                    <td className="py-2 text-center font-mono text-slate-700">
                                      {vi.expectedQty}
                                    </td>
                                    <td className="py-2 text-center font-mono text-slate-900">
                                      {vi.actualQty ?? "—"}
                                    </td>
                                    <td className="py-2 text-center">
                                      {vi.status ? (
                                        <Badge
                                          variant={
                                            vi.status === "MATCH"
                                              ? "green"
                                              : vi.status === "EXCESS"
                                              ? "yellow"
                                              : "red"
                                          }
                                        >
                                          {vi.status}
                                        </Badge>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {order.verificationLog && (
                              <div className="mt-3 text-xs text-slate-500">
                                Verified at:{" "}
                                {new Date(
                                  order.verificationLog.createdAt
                                ).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
