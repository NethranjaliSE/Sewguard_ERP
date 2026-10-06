"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button, Input, Select, Card, Badge } from "@/components/ui";

// ─── Types ───────────────────────────────────────────────────────────

interface RecipeComponent {
  id: string;
  componentName: string;
  piecesPerGarment: number;
  expectedQty: number;
  unit: string;
}

interface Recipe {
  id: string;
  recipeCode: string | null;
  name: string;
  category: string | null;
  description: string | null;
  stdFabricYards: number;
  wastageCap: number;
  components: RecipeComponent[];
}

interface CuttingOrderSummary {
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
  };
}

// ─── SupervisorView ──────────────────────────────────────────────────

export default function SupervisorView() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);

  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [targetQty, setTargetQty] = useState("");
  const [fabricRollId, setFabricRollId] = useState("");
  const [actualFabricYards, setActualFabricYards] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{
    orderNo: string;
    recipeName: string;
    quantity: number;
    status: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [recentOrders, setRecentOrders] = useState<CuttingOrderSummary[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // ── Fetch recipes ───────────────────────────────────────────────
  useEffect(() => {
    let ignore = false;
    async function fetchRecipes() {
      try {
        const res = await fetch("/api/recipes");
        if (!res.ok) throw new Error("Failed to fetch recipes");
        const data = await res.json();
        if (!ignore) {
          setRecipes(data.recipes);
          if (data.recipes.length > 0 && !selectedRecipeId) {
            setSelectedRecipeId(data.recipes[0].id);
          }
        }
      } catch {
        if (!ignore) {
          setErrorMsg("Could not load recipes. Please refresh.");
        }
      } finally {
        if (!ignore) {
          setLoadingRecipes(false);
        }
      }
    }
    fetchRecipes();
    return () => {
      ignore = true;
    };
  }, [selectedRecipeId]);

  // ── Fetch supervisor's recent orders ────────────────────────────
  const fetchRecentOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      setRecentOrders(data.orders);
    } catch {
      // Non-critical, ignore
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadOrders() {
      try {
        const res = await fetch("/api/orders");
        if (!res.ok) throw new Error("Failed to fetch orders");
        const data = await res.json();
        if (!ignore) {
          setRecentOrders(data.orders);
        }
      } catch {
        // Non-critical, ignore
      } finally {
        if (!ignore) {
          setLoadingOrders(false);
        }
      }
    }
    loadOrders();
    return () => {
      ignore = true;
    };
  }, []);

  // ── Selected recipe preview calculations ────────────────────────
  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId);
  const parsedTargetQty = parseInt(targetQty, 10);
  const isValidQty = !isNaN(parsedTargetQty) && parsedTargetQty > 0;

  const expectedFabric =
    selectedRecipe && isValidQty
      ? (parsedTargetQty * (selectedRecipe.stdFabricYards || 1.5)).toFixed(2)
      : null;

  // ── Form submit ─────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSuccessData(null);
      setErrorMsg("");

      // Strict client-side validation
      if (!selectedRecipeId) {
        setErrorMsg("Please select a valid recipe.");
        return;
      }

      if (!targetQty || isNaN(parsedTargetQty) || parsedTargetQty <= 0) {
        setErrorMsg("Target Quantity must be a positive integer greater than zero.");
        return;
      }

      if (targetQty.includes(".")) {
        setErrorMsg("Target Quantity must be a whole integer with no decimals.");
        return;
      }

      if (!fabricRollId.trim()) {
        setErrorMsg("Fabric Roll ID is required and cannot be empty.");
        return;
      }

      const yards = parseFloat(actualFabricYards);
      if (isNaN(yards) || yards <= 0) {
        setErrorMsg("Actual Fabric Yards must be a positive number greater than zero.");
        return;
      }

      setSubmitting(true);

      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-app-role": "cutting_supervisor",
          },
          body: JSON.stringify({
            recipeId: selectedRecipeId,
            targetQty: parsedTargetQty,
            fabricRollId: fabricRollId.trim(),
            actualFabricYards: yards,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setErrorMsg(data.message || data.error || "Failed to create cutting order.");
          return;
        }

        setSuccessData({
          orderNo: data.order.orderNo || data.order.id.slice(0, 8),
          recipeName: selectedRecipe?.name || "Recipe",
          quantity: data.order.targetQty,
          status: data.order.status,
        });

        // Reset inputs
        setTargetQty("");
        setFabricRollId("");
        setActualFabricYards("");

        // Refresh orders list
        fetchRecentOrders();
      } catch {
        setErrorMsg("Network error. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      selectedRecipeId,
      targetQty,
      parsedTargetQty,
      fabricRollId,
      actualFabricYards,
      selectedRecipe,
      fetchRecentOrders,
    ]
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#0F172A]">
          Cutting Supervisor Operations
        </h2>
        <p className="mt-1 text-xs text-[#64748B]">
          Configure cutting orders, scale recipe components, and dispatch batches to Gatekeeper verification.
        </p>
      </div>

      {/* Success Notification */}
      {successData && (
        <div className="rounded-xl bg-[#DCFCE7] border border-[#86EFAC] p-4 text-sm text-[#166534] shadow-xs flex items-start gap-3">
          <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-bold text-emerald-950">
              Cutting Order Successfully Created & Dispatched!
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-emerald-900">
              <span>Order No: <strong className="font-mono text-emerald-950">{successData.orderNo}</strong></span>
              <span>Recipe: <strong>{successData.recipeName}</strong></span>
              <span>Batch Quantity: <strong>{successData.quantity} garments</strong></span>
              <span>Status: <Badge variant="blue">{successData.status}</Badge></span>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="rounded-xl bg-[#FEE2E2] border border-[#FCA5A5] p-4 text-sm text-[#991B1B] shadow-xs flex items-start gap-2">
          <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Order Creation Form ──────────────────────────────────── */}
        <div className="lg:col-span-7">
          <Card
            title="Create Cutting Order"
            subtitle="Enter production run parameters and actual fabric consumption"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              {loadingRecipes ? (
                <div className="animate-pulse h-10 bg-slate-100 rounded-lg" />
              ) : (
                <Select
                  label="Target Garment Recipe *"
                  placeholder="-- Select a manufacturing recipe --"
                  value={selectedRecipeId}
                  onChange={(e) => setSelectedRecipeId(e.target.value)}
                  options={recipes.map((r) => ({
                    value: r.id,
                    label: `${r.name} (${r.recipeCode || "NO-CODE"})`,
                  }))}
                  required
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Target Quantity (Garments) *"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 50"
                  value={targetQty}
                  onChange={(e) => setTargetQty(e.target.value)}
                  helperText="Whole integer > 0"
                  required
                />

                <Input
                  label="Fabric Roll ID *"
                  type="text"
                  placeholder="e.g. FAB-ROLL-882"
                  value={fabricRollId}
                  onChange={(e) => setFabricRollId(e.target.value)}
                  helperText="Batch barcode or roll ID"
                  required
                />
              </div>

              <Input
                label="Actual Fabric Used (Yards) *"
                type="number"
                min="0.1"
                step="0.01"
                placeholder="e.g. 92.5"
                value={actualFabricYards}
                onChange={(e) => setActualFabricYards(e.target.value)}
                helperText={
                  expectedFabric
                    ? `Standard Expected: ${expectedFabric} yds (@ ${selectedRecipe?.stdFabricYards} yds/garment)`
                    : "Standard yardage calculated upon quantity entry"
                }
                required
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  size="lg"
                  loading={submitting}
                  className="w-full sm:w-auto"
                >
                  Create Cutting Order
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* ── Dynamic Recipe Components Panel ──────────────────────── */}
        <div className="lg:col-span-5">
          <Card
            title="Recipe Components & Spec"
            subtitle="Bill of materials breakdown and expected cut pieces"
          >
            {selectedRecipe ? (
              <div className="space-y-4">
                {/* Recipe Overview Badge Grid */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Recipe:</span>
                    <strong className="text-slate-900">{selectedRecipe.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Code & Category:</span>
                    <span className="font-mono text-slate-900">
                      {selectedRecipe.recipeCode || "—"} • {selectedRecipe.category || "General"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Std Fabric / Garment:</span>
                    <span className="font-semibold text-slate-900">{selectedRecipe.stdFabricYards} yds</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Wastage Tolerance Cap:</span>
                    <span className="font-semibold text-amber-700">{selectedRecipe.wastageCap}%</span>
                  </div>
                </div>

                {/* Scaled Batch Yardage Summary */}
                {isValidQty && expectedFabric && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex justify-between items-center">
                    <div>
                      <span className="block text-blue-700 font-medium">Expected Batch Fabric:</span>
                      <span className="text-base font-bold font-mono text-blue-950">{expectedFabric} yards</span>
                    </div>
                    <span className="text-[11px] text-blue-600 bg-white/80 px-2 py-1 rounded border border-blue-200">
                      {targetQty} garments × {selectedRecipe.stdFabricYards} yds
                    </span>
                  </div>
                )}

                {/* Components Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50">
                        <th className="text-left py-2 px-2 font-semibold text-slate-700">
                          Component
                        </th>
                        <th className="text-center py-2 px-2 font-semibold text-slate-700">
                          Pcs / Garment
                        </th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-700">
                          {isValidQty ? `Expected (${targetQty})` : "Expected Qty"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecipe.components.map((comp) => {
                        const pcs = comp.piecesPerGarment || comp.expectedQty || 1;
                        const totalExpected = isValidQty ? pcs * parsedTargetQty : "—";

                        return (
                          <tr
                            key={comp.id}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                          >
                            <td className="py-2 px-2 font-medium text-slate-900">
                              {comp.componentName}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-slate-700">
                              {pcs}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                              {totalExpected}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                Select a recipe to preview components and required cuts.
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* ── Order Workflow Status Table ───────────────────────────── */}
      <Card
        title="Cutting Workflow & Dispatched Orders"
        subtitle="Real-time status of orders dispatched to Gatekeeper verification"
      >
        {loadingOrders ? (
          <div className="animate-pulse h-24 bg-slate-100 rounded-lg" />
        ) : recentOrders.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center italic">
            No cutting orders created yet. Submit an order above to dispatch.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-50">
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Order No</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Recipe</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-slate-700">Batch Qty</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Fabric Roll</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-slate-700">Fabric (Actual / Expected)</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-slate-700">Verification Status</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-slate-700">Dispatched At</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((ord) => (
                  <tr key={ord.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {ord.orderNo || ord.id.slice(0, 8)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 font-medium">
                      {ord.recipe.name}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-900">
                      {ord.targetQty}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {ord.fabricRollId}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-800">
                      {ord.actualFabricYards} yds / {ord.expectedFabricYards} yds
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge
                        variant={
                          ord.status === "VERIFIED"
                            ? "green"
                            : ord.status === "REJECTED"
                            ? "red"
                            : ord.status === "SEWING_IN_PROGRESS"
                            ? "info"
                            : "blue"
                        }
                      >
                        {ord.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500 font-mono">
                      {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
