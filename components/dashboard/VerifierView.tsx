"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button, Card, Badge, Input, Modal } from "@/components/ui";

// ─── Types ───────────────────────────────────────────────────────────

interface VerificationItemData {
  id: string;
  expectedQty: number;
  actualQty: number | null;
  status: string | null;
  recipeComponent: {
    id: string;
    componentName: string;
    piecesPerGarment: number;
    unit: string;
  };
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
    id: string;
    name: string;
    recipeCode: string | null;
    stdFabricYards: number;
    wastageCap: number;
  };
  verificationItems: VerificationItemData[];
  createdBy?: { name: string; email?: string } | null;
}

type TrafficLight = "MATCH" | "EXCESS" | "SHORTAGE";

// ─── Helpers ─────────────────────────────────────────────────────────

function calcStatus(actual: number, expected: number): TrafficLight {
  if (actual < expected) return "SHORTAGE";
  if (actual === expected) return "MATCH";
  return "EXCESS";
}

function statusBadgeVariant(
  status: TrafficLight
): "green" | "yellow" | "red" {
  switch (status) {
    case "MATCH":
      return "green";
    case "EXCESS":
      return "yellow";
    case "SHORTAGE":
      return "red";
  }
}

// ─── VerifierView ────────────────────────────────────────────────────

export default function VerifierView() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Map of orderId -> { itemId -> actualQty string }
  const [actualQtys, setActualQtys] = useState<
    Record<string, Record<string, string>>
  >({});

  // Reject modal state
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    orderId: string;
    orderNo: string;
  }>({ isOpen: false, orderId: "", orderNo: "" });
  const [rejectionNote, setRejectionNote] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Currently expanded order
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // ── Fetch pending orders ────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders?status=PENDING_VERIFICATION", {
        headers: { "x-app-role": "cutting_verifier" },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to load orders.");
      }
      const data = await res.json();
      setOrders(data.orders);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not load orders.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/orders?status=PENDING_VERIFICATION", {
          headers: { "x-app-role": "cutting_verifier" },
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to load orders.");
        }
        const data = await res.json();
        if (!ignore) {
          setOrders(data.orders);
          // Auto-expand first order if available
          if (data.orders.length > 0 && !expandedOrderId) {
            setExpandedOrderId(data.orders[0].id);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : "Could not load orders.";
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
  }, [expandedOrderId]);

  // ── Handle qty input ────────────────────────────────────────────
  const handleQtyChange = useCallback(
    (orderId: string, itemId: string, value: string) => {
      setActualQtys((prev) => ({
        ...prev,
        [orderId]: {
          ...(prev[orderId] || {}),
          [itemId]: value,
        },
      }));
    },
    []
  );

  // ── Compute statuses for an order's items ───────────────────────
  const computeItemStatuses = useCallback(
    (order: OrderData) => {
      return order.verificationItems.map((vi) => {
        const rawVal = actualQtys[order.id]?.[vi.id];
        const actual =
          rawVal !== undefined && rawVal.trim() !== ""
            ? parseInt(rawVal, 10)
            : vi.actualQty != null
            ? vi.actualQty
            : null;

        return {
          ...vi,
          inputActual: rawVal !== undefined ? rawVal : (vi.actualQty != null ? String(vi.actualQty) : ""),
          computedActual: actual,
          computedStatus:
            actual !== null && !isNaN(actual) && actual >= 0
              ? calcStatus(actual, vi.expectedQty)
              : null,
          shortageAmount:
            actual !== null && actual < vi.expectedQty
              ? vi.expectedQty - actual
              : 0,
        };
      });
    },
    [actualQtys]
  );

  // ── Check if approve is allowed (no shortages and all counted) ──
  const canApprove = useCallback(
    (order: OrderData): boolean => {
      const items = computeItemStatuses(order);

      // All items must have valid entered integer counts >= 0
      const allFilled = items.every(
        (i) => i.computedActual !== null && !isNaN(i.computedActual) && i.computedActual >= 0
      );
      if (!allFilled) return false;

      // HARD STOP: No shortages allowed
      const hasShortage = items.some((i) => i.computedStatus === "SHORTAGE");
      return !hasShortage;
    },
    [computeItemStatuses]
  );

  // ── Get list of shortage items ──────────────────────────────────
  const getShortages = useCallback(
    (order: OrderData) => {
      const items = computeItemStatuses(order);
      return items.filter((i) => i.computedStatus === "SHORTAGE");
    },
    [computeItemStatuses]
  );

  // ── Approve handler ─────────────────────────────────────────────
  const handleApprove = useCallback(
    async (order: OrderData) => {
      setError("");
      setSuccessMsg("");
      setSubmitting(true);

      const items = computeItemStatuses(order).map((i) => ({
        verificationItemId: i.id,
        actualQty: i.computedActual!,
      }));

      try {
        const res = await fetch(`/api/orders/${order.id}/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-app-role": "cutting_verifier",
          },
          body: JSON.stringify({
            action: "APPROVE",
            items,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.message || data.error || "Approval failed.");
          return;
        }

        const orderLabel = order.orderNo || order.id.slice(0, 8);
        setSuccessMsg(
          `✅ Batch ${orderLabel} successfully verified and approved! Wastage: ${data.wastagePct ?? 0}% (Transferred to Sewing Queue)`
        );
        fetchOrders();
      } catch {
        setError("Network error during approval.");
      } finally {
        setSubmitting(false);
      }
    },
    [computeItemStatuses, fetchOrders]
  );

  // ── Reject handler ──────────────────────────────────────────────
  const handleReject = useCallback(async () => {
    const trimmed = rejectionNote.trim();
    if (!trimmed) {
      setRejectError("Rejection reason is mandatory.");
      return;
    }

    setRejectError("");
    setError("");
    setSuccessMsg("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/orders/${rejectModal.orderId}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-role": "cutting_verifier",
        },
        body: JSON.stringify({
          action: "REJECT",
          rejectionNote: trimmed,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRejectError(data.message || data.error || "Rejection failed.");
        return;
      }

      setSuccessMsg(`Order ${rejectModal.orderNo} rejected and returned for re-cutting.`);
      setRejectModal({ isOpen: false, orderId: "", orderNo: "" });
      setRejectionNote("");
      fetchOrders();
    } catch {
      setRejectError("Network error during rejection.");
    } finally {
      setSubmitting(false);
    }
  }, [rejectionNote, rejectModal.orderId, rejectModal.orderNo, fetchOrders]);

  // ── Memoize expanded order items ────────────────────────────────
  const expandedOrder = useMemo(
    () => orders.find((o) => o.id === expandedOrderId),
    [orders, expandedOrderId]
  );

  const expandedItems = useMemo(
    () => (expandedOrder ? computeItemStatuses(expandedOrder) : []),
    [expandedOrder, computeItemStatuses]
  );

  const expandedShortages = useMemo(
    () => (expandedOrder ? getShortages(expandedOrder) : []),
    [expandedOrder, getShortages]
  );

  // Fabric Wastage Calculations for Expanded Order
  const fabricStats = useMemo(() => {
    if (!expandedOrder) return null;
    const exp = expandedOrder.expectedFabricYards;
    const act = expandedOrder.actualFabricYards;
    const wastage = exp > 0 ? parseFloat((((act - exp) / exp) * 100).toFixed(2)) : 0;
    const cap = expandedOrder.recipe.wastageCap || 5.0;
    const isWithinCap = wastage <= cap;
    return {
      expected: exp,
      actual: act,
      wastage,
      cap,
      isWithinCap,
    };
  }, [expandedOrder]);

  // ── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-[#0F172A]">
          Gatekeeper Verification Terminal
        </h2>
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse h-28 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#0F172A]">
          Gatekeeper Verification Terminal
        </h2>
        <p className="mt-1 text-xs text-[#64748B]">
          Inspect incoming physical component counts against recipe specifications. Batches with any shortage are hard-stopped.
        </p>
      </div>

      {/* Feedback Notifications */}
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
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-slate-800 font-semibold">
              No orders pending verification
            </p>
            <p className="mt-1 text-xs text-slate-500">
              All cutting batches have been processed through the verification gate.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const orderNo = order.orderNo || `ORD-${order.id.slice(0, 8)}`;

            return (
              <Card key={order.id} className={isExpanded ? "ring-2 ring-blue-500/20" : ""}>
                {/* Order Summary Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-sm font-bold text-[#0F172A] bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                        {orderNo}
                      </span>
                      <h3 className="font-bold text-base text-[#0F172A]">
                        {order.recipe.name}
                      </h3>
                      <Badge variant="blue">PENDING VERIFICATION</Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#64748B] pt-1">
                      <span>Target: <strong className="text-slate-900">{order.targetQty} garments</strong></span>
                      <span>Fabric Roll: <strong className="font-mono text-slate-900">{order.fabricRollId}</strong></span>
                      <span>
                        Fabric: <strong className="text-slate-900">{order.actualFabricYards} yds</strong> (Expected: {order.expectedFabricYards} yds)
                      </span>
                      {order.createdBy && (
                        <span>Supervisor: <strong className="text-slate-800">{order.createdBy.name}</strong></span>
                      )}
                      <span>Created: <span className="font-mono">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></span>
                    </div>
                  </div>

                  <Button
                    variant={isExpanded ? "secondary" : "primary"}
                    size="sm"
                    onClick={() =>
                      setExpandedOrderId(isExpanded ? null : order.id)
                    }
                  >
                    {isExpanded ? "Close Terminal" : "Open Verification Terminal →"}
                  </Button>
                </div>

                {/* Expanded Verification Terminal */}
                {isExpanded && expandedOrder && (
                  <div className="mt-6 border-t border-[#E2E8F0] pt-6 space-y-6">
                    {/* Fabric Wastage Telemetry Card */}
                    {fabricStats && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                        <div>
                          <span className="block text-slate-500 font-medium">Expected Fabric</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">{fabricStats.expected} yds</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Actual Fabric</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">{fabricStats.actual} yds</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Fabric Wastage</span>
                          <span className={`font-mono font-bold text-sm ${fabricStats.wastage > fabricStats.cap ? "text-red-700" : "text-slate-900"}`}>
                            {fabricStats.wastage > 0 ? "+" : ""}{fabricStats.wastage}%
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Wastage Cap</span>
                          <span className="font-mono font-bold text-amber-800 text-sm">{fabricStats.cap}%</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Wastage Status</span>
                          <Badge variant={fabricStats.isWithinCap ? "green" : "red"}>
                            {fabricStats.isWithinCap ? "Within Cap" : "Exceeds Cap"}
                          </Badge>
                        </div>
                      </div>
                    )}

                    {/* Component Count Table */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Component Verification Counts
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          Enter physical counts verified at cutting table
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
                              <th className="text-left py-2.5 px-3 font-semibold">Component</th>
                              <th className="text-center py-2.5 px-3 font-semibold">Pcs/Garment</th>
                              <th className="text-center py-2.5 px-3 font-semibold">Expected Count</th>
                              <th className="text-center py-2.5 px-3 font-semibold w-40">Actual Physical Count</th>
                              <th className="text-center py-2.5 px-3 font-semibold">Gate Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {expandedItems.map((item) => (
                              <tr
                                key={item.id}
                                className={`border-b border-slate-100 last:border-0 transition-colors ${
                                  item.computedStatus === "SHORTAGE"
                                    ? "bg-red-50/70"
                                    : item.computedStatus === "EXCESS"
                                    ? "bg-amber-50/40"
                                    : ""
                                }`}
                              >
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  {item.recipeComponent.componentName}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                                  {item.recipeComponent.piecesPerGarment || 1}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                                  {item.expectedQty} {item.recipeComponent.unit}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="max-w-[140px] mx-auto">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="1"
                                      placeholder="Count"
                                      value={item.inputActual}
                                      onChange={(e) =>
                                        handleQtyChange(
                                          order.id,
                                          item.id,
                                          e.target.value
                                        )
                                      }
                                      className="text-center font-mono font-bold !py-1 text-sm text-[#0F172A]"
                                    />
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {item.computedStatus ? (
                                    <Badge
                                      variant={statusBadgeVariant(
                                        item.computedStatus
                                      )}
                                    >
                                      {item.computedStatus === "MATCH" && "🟢 "}
                                      {item.computedStatus === "EXCESS" && "🟡 "}
                                      {item.computedStatus === "SHORTAGE" && "🔴 "}
                                      {item.computedStatus}
                                    </Badge>
                                  ) : (
                                    <span className="text-slate-400 font-mono italic">Awaiting count</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* ── HARD STOP CALLOUT (Requirement 19) ───────── */}
                    {expandedShortages.length > 0 && (
                      <div className="rounded-xl bg-[#FEE2E2] border-2 border-[#FCA5A5] p-4 text-[#991B1B] shadow-xs space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🔴</span>
                          <h5 className="font-extrabold text-sm uppercase tracking-wide">
                            SHORTAGE DETECTED — APPROVAL BLOCKED
                          </h5>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {expandedShortages.map((s) => (
                            <div
                              key={s.id}
                              className="p-2.5 bg-white/80 rounded-lg border border-red-200"
                            >
                              <strong className="block text-slate-900 font-bold">
                                {s.recipeComponent.componentName}
                              </strong>
                              <div className="mt-1 flex justify-between text-slate-700">
                                <span>Expected: <strong className="font-mono">{s.expectedQty}</strong></span>
                                <span>Actual: <strong className="font-mono">{s.computedActual}</strong></span>
                                <span className="text-red-700 font-bold">Missing: {s.shortageAmount} pcs</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <p className="text-xs font-medium text-red-800">
                          Gatekeeper policy prohibits incomplete batches from advancing to the sewing queue. Approval is blocked on the server until shortages are resolved or the batch is rejected for re-cutting.
                        </p>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200">
                      <div className="text-xs text-slate-500">
                        {canApprove(order) ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            All counts verified. Ready for batch approval.
                          </span>
                        ) : expandedShortages.length > 0 ? (
                          <span className="text-red-700 font-semibold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            Approval blocked due to shortage items.
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">
                            Enter counts for all components to enable approval.
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          variant="danger"
                          size="md"
                          disabled={submitting}
                          onClick={() => {
                            setRejectModal({
                              isOpen: true,
                              orderId: order.id,
                              orderNo,
                            });
                            setRejectionNote(
                              expandedShortages.length > 0
                                ? `Shortage detected in: ${expandedShortages.map(s => `${s.recipeComponent.componentName} (missing ${s.shortageAmount})`).join(", ")}`
                                : ""
                            );
                          }}
                        >
                          Reject Batch…
                        </Button>

                        <Button
                          variant="success"
                          size="md"
                          disabled={!canApprove(order) || submitting}
                          loading={submitting}
                          onClick={() => handleApprove(order)}
                          title={
                            !canApprove(order)
                              ? "Approval is blocked: resolve shortages or fill all counts"
                              : "Approve and send to Sewing Queue"
                          }
                        >
                          ✓ Approve Batch
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Rejection Reason Modal ──────────────────────────────────── */}
      <Modal
        isOpen={rejectModal.isOpen}
        onClose={() => {
          setRejectModal({ isOpen: false, orderId: "", orderNo: "" });
          setRejectionNote("");
          setRejectError("");
        }}
        title={`Reject Batch: ${rejectModal.orderNo}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            A mandatory rejection reason must be recorded in the audit trail before returning this order to the Cutting Supervisor for re-cutting.
          </p>

          {rejectError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
              {rejectError}
            </div>
          )}

          <div className="space-y-1">
            <label
              htmlFor="rejection-note"
              className="block text-xs font-bold text-slate-800"
            >
              Rejection Reason & Defect Notes *
            </label>
            <textarea
              id="rejection-note"
              rows={3}
              className="
                block w-full rounded-lg
                border border-slate-300
                px-3 py-2
                text-xs text-slate-900 placeholder:text-slate-400
                bg-white
                shadow-sm
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600
              "
              placeholder="e.g. 2 sleeve pieces missing due to cutting defect on FAB-ROLL-882"
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setRejectModal({ isOpen: false, orderId: "", orderNo: "" });
                setRejectionNote("");
                setRejectError("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={submitting}
              disabled={!rejectionNote.trim() || submitting}
              onClick={handleReject}
            >
              Confirm Rejection & Return
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
