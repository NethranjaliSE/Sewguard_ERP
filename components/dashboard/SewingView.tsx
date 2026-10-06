"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, Badge, Button } from "@/components/ui";

// ─── Types ───────────────────────────────────────────────────────────

interface VerificationItem {
  id: string;
  expectedQty: number;
  actualQty: number | null;
  status: string | null;
  recipeComponent: {
    componentName: string;
    piecesPerGarment: number;
    unit: string;
  };
}

interface VerificationLog {
  id: string;
  action: string;
  decision: string | null;
  wastagePct: number | null;
  createdAt: string;
  verifiedBy?: {
    name: string;
    email: string | null;
  } | null;
}

interface OrderData {
  id: string;
  orderNo: string | null;
  targetQty: number;
  fabricRollId: string;
  actualFabricYards: number;
  expectedFabricYards: number;
  status: string;
  createdAt: string;
  recipe: {
    name: string;
    recipeCode: string | null;
    wastageCap: number;
  };
  verificationItems: VerificationItem[];
  verificationLog: VerificationLog | null;
}

// ─── SewingView ──────────────────────────────────────────────────────

export default function SewingView() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [startingOrderId, setStartingOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // ── Fetch only verified queue from backend ──────────────────────
  const fetchSewingQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/sewing/queue", {
        headers: { "x-app-role": "sewing_supervisor" },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to fetch sewing queue.");
      }
      const data = await res.json();
      setOrders(data.orders);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not load sewing queue.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/sewing/queue", {
          headers: { "x-app-role": "sewing_supervisor" },
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to fetch sewing queue.");
        }
        const data = await res.json();
        if (!ignore) {
          setOrders(data.orders);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : "Could not load sewing queue.";
          setError(msg);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  // ── Handle Start Sewing Assembly ────────────────────────────────
  const handleStartSewing = useCallback(
    async (orderId: string, orderNo: string) => {
      setError("");
      setSuccessMsg("");
      setStartingOrderId(orderId);

      try {
        const res = await fetch(`/api/sewing/${orderId}/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-app-role": "sewing_supervisor",
          },
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.message || data.error || "Failed to start sewing.");
          return;
        }

        setSuccessMsg(`🚀 Sewing assembly successfully started for batch ${orderNo}!`);
        fetchSewingQueue();
      } catch {
        setError("Network error while starting sewing.");
      } finally {
        setStartingOrderId(null);
      }
    },
    [fetchSewingQueue]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-[#0F172A]">
          Sewing Queue — Verified Assembly Batches
        </h2>
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse h-24 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#0F172A]">
          Sewing Queue — Verified Assembly Batches
        </h2>
        <p className="mt-1 text-xs text-[#64748B]">
          Only batches that have passed 100% component verification by the Gatekeeper appear here.
        </p>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="rounded-xl bg-[#DCFCE7] border border-[#86EFAC] p-4 text-sm text-[#166534] shadow-xs flex items-center gap-3">
          <svg className="w-5 h-5 text-emerald-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-[#FEE2E2] border border-[#FCA5A5] p-4 text-sm text-[#991B1B] shadow-xs flex items-center gap-2">
          <svg className="w-5 h-5 text-red-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {orders.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-slate-800 font-semibold">
              No verified batches in sewing queue
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Orders will appear here once approved by Gatekeeper verification without any component shortage.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const orderNo = order.orderNo || `ORD-${order.id.slice(0, 8)}`;
            const wastage = order.verificationLog?.wastagePct;
            const isStarting = startingOrderId === order.id;
            const canStart = order.status === "VERIFIED";

            return (
              <Card key={order.id} className="hover:border-slate-300 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                        {orderNo}
                      </span>
                      <h3 className="text-base font-bold text-[#0F172A]">
                        {order.recipe.name}
                      </h3>
                      <Badge
                        variant={
                          order.status === "SEWING_IN_PROGRESS" ? "info" : "green"
                        }
                      >
                        {order.status === "SEWING_IN_PROGRESS"
                          ? "⚡ SEWING IN PROGRESS"
                          : "✓ VERIFIED"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#64748B] pt-1">
                      <span>Quantity: <strong className="text-slate-900">{order.targetQty} garments</strong></span>
                      <span>Fabric Roll: <strong className="font-mono text-slate-800">{order.fabricRollId}</strong></span>
                      <span>
                        Fabric: <strong className="text-slate-900">{order.actualFabricYards} yds</strong> / {order.expectedFabricYards} yds
                      </span>
                      <span>
                        Wastage:{" "}
                        <strong
                          className={
                            wastage != null && wastage > (order.recipe.wastageCap || 5.0)
                              ? "text-red-700"
                              : "text-emerald-700 font-mono"
                          }
                        >
                          {wastage != null ? `${wastage > 0 ? "+" : ""}${wastage}%` : "—"}
                        </strong>
                      </span>
                      {order.verificationLog?.verifiedBy && (
                        <span>
                          Verified by:{" "}
                          <strong className="text-slate-800">
                            {order.verificationLog.verifiedBy.name}
                          </strong>
                        </span>
                      )}
                      {order.verificationLog?.createdAt && (
                        <span>
                          Verified at:{" "}
                          <span className="font-mono">
                            {new Date(order.verificationLog.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedOrderId(isExpanded ? null : order.id)
                      }
                    >
                      {isExpanded ? "Hide Specs ▲" : "View Specs ▼"}
                    </Button>

                    {canStart ? (
                      <Button
                        variant="primary"
                        size="md"
                        loading={isStarting}
                        disabled={isStarting}
                        onClick={() => handleStartSewing(order.id, orderNo)}
                      >
                        Start Sewing Assembly →
                      </Button>
                    ) : (
                      <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                        In Assembly
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded Verified Components Breakdown */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="max-w-3xl">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Gatekeeper Verified Bill of Materials
                        </h4>
                        <span className="text-[11px] text-emerald-700 font-semibold">
                          100% Passed Gatekeeper Check
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/50">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
                              <th className="text-left py-2 px-3 font-semibold">Component</th>
                              <th className="text-center py-2 px-3 font-semibold">Pcs / Garment</th>
                              <th className="text-center py-2 px-3 font-semibold">Expected Count</th>
                              <th className="text-center py-2 px-3 font-semibold">Physical Count</th>
                              <th className="text-center py-2 px-3 font-semibold">Audit Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.verificationItems.map((vi) => (
                              <tr key={vi.id} className="border-b border-slate-100 last:border-0">
                                <td className="py-2 px-3 font-medium text-slate-900">
                                  {vi.recipeComponent.componentName}
                                </td>
                                <td className="py-2 px-3 text-center font-mono text-slate-600">
                                  {vi.recipeComponent.piecesPerGarment || 1}
                                </td>
                                <td className="py-2 px-3 text-center font-mono text-slate-700">
                                  {vi.expectedQty} {vi.recipeComponent.unit}
                                </td>
                                <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                                  {vi.actualQty ?? "—"} {vi.recipeComponent.unit}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <Badge
                                    variant={
                                      vi.status === "MATCH"
                                        ? "green"
                                        : vi.status === "EXCESS"
                                        ? "yellow"
                                        : "red"
                                    }
                                  >
                                    {vi.status === "MATCH" && "🟢 "}
                                    {vi.status === "EXCESS" && "🟡 "}
                                    {vi.status === "SHORTAGE" && "🔴 "}
                                    {vi.status || "VERIFIED"}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
