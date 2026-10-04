"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button, Card, Badge, Input, Modal } from "@/components/ui";
import { useRole } from "@/app/context/RoleContext";

// ─── Types ───────────────────────────────────────────────────────────

interface VerificationItemData {
  id: string;
  expectedQty: number;
  actualQty: number | null;
  status: string | null;
  recipeComponent: {
    id: string;
    componentName: string;
    unit: string;
  };
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
    id: string;
    name: string;
  };
  verificationItems: VerificationItemData[];
  createdBy?: { name: string } | null;
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
  const { role } = useRole();

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Map of orderId -> { itemId -> actualQty (string for input) }
  const [actualQtys, setActualQtys] = useState<
    Record<string, Record<string, string>>
  >({});

  // Reject modal state
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    orderId: string;
  }>({ isOpen: false, orderId: "" });
  const [rejectionNote, setRejectionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Selected order for expanded view
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // ── Fetch pending orders ────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/orders?status=PENDING_VERIFICATION");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setOrders(data.orders);
    } catch {
      setError("Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
        const actual = rawVal !== undefined ? parseInt(rawVal, 10) : null;

        return {
          ...vi,
          inputActual: rawVal ?? "",
          computedActual: actual,
          computedStatus:
            actual !== null && !isNaN(actual)
              ? calcStatus(actual, vi.expectedQty)
              : null,
        };
      });
    },
    [actualQtys]
  );

  // ── Check if approve is allowed (no shortages) ──────────────────
  const canApprove = useCallback(
    (order: OrderData): boolean => {
      const items = computeItemStatuses(order);

      // All items must have a valid actual qty entered
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

  // Helper: check if any item has a shortage
  const hasAnyShortage = useCallback(
    (order: OrderData): boolean => {
      const items = computeItemStatuses(order);
      return items.some((i) => i.computedStatus === "SHORTAGE");
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "APPROVE",
            role,
            items,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Approval failed.");
          return;
        }

        setSuccessMsg(
          `✅ Order ${order.id.slice(0, 8)}… approved! Wastage: ${data.wastagePct ?? 0}%`
        );
        fetchOrders();
      } catch {
        setError("Network error during approval.");
      } finally {
        setSubmitting(false);
      }
    },
    [computeItemStatuses, role, fetchOrders]
  );

  // ── Reject handler ──────────────────────────────────────────────
  const handleReject = useCallback(async () => {
    if (!rejectionNote.trim()) {
      setError("Rejection note is mandatory.");
      return;
    }

    setError("");
    setSuccessMsg("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/orders/${rejectModal.orderId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REJECT",
          role,
          rejectionNote: rejectionNote.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Rejection failed.");
        return;
      }

      setSuccessMsg(`Order ${rejectModal.orderId.slice(0, 8)}… rejected.`);
      setRejectModal({ isOpen: false, orderId: "" });
      setRejectionNote("");
      fetchOrders();
    } catch {
      setError("Network error during rejection.");
    } finally {
      setSubmitting(false);
    }
  }, [rejectionNote, rejectModal.orderId, role, fetchOrders]);

  // ── Memoize expanded order items ────────────────────────────────
  const expandedOrder = useMemo(
    () => orders.find((o) => o.id === expandedOrderId),
    [orders, expandedOrderId]
  );

  const expandedItems = useMemo(
    () => (expandedOrder ? computeItemStatuses(expandedOrder) : []),
    [expandedOrder, computeItemStatuses]
  );

  // ── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">
          Gatekeeper Verification
        </h2>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse h-24 bg-slate-100 rounded-xl"
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
          Gatekeeper Verification
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Verify component counts for pending cutting orders. RED items block
          approval.
        </p>
      </div>

      {/* Feedback */}
      {successMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
          {successMsg}
        </div>
      )}
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="mt-4 text-slate-500 font-medium">
              No orders pending verification
            </p>
            <p className="mt-1 text-sm text-slate-400">
              All cutting orders have been processed.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;

            return (
              <Card key={order.id}>
                {/* Order header row */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {order.recipe.name}
                      </h3>
                      <Badge variant="blue">Pending</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span>
                        Order:{" "}
                        <span className="font-mono text-slate-700">
                          {order.id.slice(0, 8)}…
                        </span>
                      </span>
                      <span>Target Qty: <strong className="text-slate-700">{order.targetQty}</strong></span>
                      <span>Roll: <strong className="text-slate-700">{order.fabricRollId}</strong></span>
                      <span>
                        Fabric:{" "}
                        <strong className="text-slate-700">
                          {order.actualFabricYards}yd
                        </strong>{" "}
                        / {order.expectedFabricYards}yd expected
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setExpandedOrderId(isExpanded ? null : order.id)
                    }
                  >
                    {isExpanded ? "Collapse" : "Verify →"}
                  </Button>
                </div>

                {/* Expanded verification table */}
                {isExpanded && expandedOrder && (
                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b-2 border-slate-200">
                            <th className="text-left py-3 px-2 font-semibold text-slate-700">
                              Component
                            </th>
                            <th className="text-center py-3 px-2 font-semibold text-slate-700">
                              Expected Qty
                            </th>
                            <th className="text-center py-3 px-2 font-semibold text-slate-700 w-36">
                              Actual Qty
                            </th>
                            <th className="text-center py-3 px-2 font-semibold text-slate-700">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {expandedItems.map((item) => (
                            <tr
                              key={item.id}
                              className={`border-b border-slate-100 last:border-0 ${
                                item.computedStatus === "SHORTAGE"
                                  ? "bg-red-50"
                                  : ""
                              }`}
                            >
                              <td className="py-3 px-2 text-slate-900 font-medium">
                                {item.recipeComponent.componentName}
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-slate-900">
                                {item.expectedQty}
                              </td>
                              <td className="py-3 px-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="0"
                                  value={item.inputActual}
                                  onChange={(e) =>
                                    handleQtyChange(
                                      order.id,
                                      item.id,
                                      e.target.value
                                    )
                                  }
                                  className="text-center !py-1.5"
                                />
                              </td>
                              <td className="py-3 px-2 text-center">
                                {item.computedStatus ? (
                                  <Badge
                                    variant={statusBadgeVariant(
                                      item.computedStatus
                                    )}
                                  >
                                    {item.computedStatus}
                                  </Badge>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Shortage warning */}
                    {hasAnyShortage(order) && (
                      <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-start gap-2">
                        <svg
                          className="h-5 w-5 text-red-600 shrink-0 mt-0.5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>
                          <strong>Hard Stop:</strong> One or more components have
                          a SHORTAGE (RED). Approval is blocked until all
                          quantities meet or exceed the expected count.
                        </span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-6 flex gap-3">
                      <Button
                        variant="primary"
                        size="lg"
                        disabled={!canApprove(order) || submitting}
                        loading={submitting}
                        onClick={() => handleApprove(order)}
                        title={
                          !canApprove(order)
                            ? "Cannot approve: fill all quantities and resolve shortages"
                            : "Approve this batch"
                        }
                      >
                        ✓ Approve Batch
                      </Button>

                      <Button
                        variant="danger"
                        size="lg"
                        disabled={submitting}
                        onClick={() =>
                          setRejectModal({
                            isOpen: true,
                            orderId: order.id,
                          })
                        }
                      >
                        ✗ Reject
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Rejection Modal */}
      <Modal
        isOpen={rejectModal.isOpen}
        onClose={() => {
          setRejectModal({ isOpen: false, orderId: "" });
          setRejectionNote("");
        }}
        title="Reject Cutting Order"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Please provide a reason for rejecting order{" "}
            <span className="font-mono font-semibold text-slate-900">
              {rejectModal.orderId.slice(0, 8)}…
            </span>
            . This note will be part of the permanent audit trail.
          </p>

          <div className="space-y-1">
            <label
              htmlFor="rejection-note"
              className="block text-sm font-medium text-slate-700"
            >
              Rejection Note <span className="text-red-500">*</span>
            </label>
            <textarea
              id="rejection-note"
              rows={4}
              className="
                block w-full rounded-lg
                border border-slate-300
                px-3 py-2
                text-slate-950 placeholder-slate-400
                bg-white
                shadow-sm
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600
              "
              placeholder="e.g. Fabric pattern mismatch on front panels…"
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setRejectModal({ isOpen: false, orderId: "" });
                setRejectionNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={submitting}
              disabled={!rejectionNote.trim() || submitting}
              onClick={handleReject}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
