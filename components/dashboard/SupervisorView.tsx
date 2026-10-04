"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button, Input, Select, Card } from "@/components/ui";
import { useRole } from "@/app/context/RoleContext";

// ─── Types ───────────────────────────────────────────────────────────

interface RecipeComponent {
  id: string;
  componentName: string;
  expectedQty: number;
  unit: string;
}

interface Recipe {
  id: string;
  name: string;
  description: string | null;
  components: RecipeComponent[];
}

// ─── SupervisorView ──────────────────────────────────────────────────

export default function SupervisorView() {
  const { role } = useRole();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);

  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [targetQty, setTargetQty] = useState("");
  const [fabricRollId, setFabricRollId] = useState("");
  const [actualFabricYards, setActualFabricYards] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // ── Fetch recipes ───────────────────────────────────────────────
  useEffect(() => {
    async function fetchRecipes() {
      try {
        const res = await fetch("/api/recipes");
        if (!res.ok) throw new Error("Failed to fetch recipes");
        const data = await res.json();
        setRecipes(data.recipes);
      } catch {
        setErrorMsg("Could not load recipes. Please refresh.");
      } finally {
        setLoadingRecipes(false);
      }
    }
    fetchRecipes();
  }, []);

  // ── Get selected recipe for preview ─────────────────────────────
  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId);

  // ── Form submit ─────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSuccessMsg("");
      setErrorMsg("");

      // Client-side validation
      if (!selectedRecipeId) {
        setErrorMsg("Please select a recipe.");
        return;
      }

      const qty = parseInt(targetQty, 10);
      if (isNaN(qty) || qty < 1) {
        setErrorMsg("Target Quantity must be a positive integer.");
        return;
      }

      if (!fabricRollId.trim()) {
        setErrorMsg("Fabric Roll ID is required.");
        return;
      }

      const yards = parseFloat(actualFabricYards);
      if (isNaN(yards) || yards <= 0) {
        setErrorMsg("Actual Fabric Yards must be a positive number.");
        return;
      }

      setSubmitting(true);

      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipeId: selectedRecipeId,
            targetQty: qty,
            fabricRollId: fabricRollId.trim(),
            actualFabricYards: yards,
            role,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setErrorMsg(data.error || "Failed to create order.");
          return;
        }

        setSuccessMsg(
          `✅ Cutting Order created successfully! Order ID: ${data.order.id.slice(0, 8)}…`
        );

        // Reset form
        setSelectedRecipeId("");
        setTargetQty("");
        setFabricRollId("");
        setActualFabricYards("");
      } catch {
        setErrorMsg("Network error. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [selectedRecipeId, targetQty, fabricRollId, actualFabricYards, role]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Create Cutting Order
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Define a new cutting batch to send for verification.
        </p>
      </div>

      {/* Feedback messages */}
      {successMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Order Form ───────────────────────────────────────────── */}
        <Card
          className="lg:col-span-2"
          title="Order Details"
          subtitle="Fill in all fields to create a new cutting order"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {loadingRecipes ? (
              <div className="animate-pulse h-10 bg-slate-100 rounded-lg" />
            ) : (
              <Select
                label="Recipe"
                placeholder="-- Select a recipe --"
                value={selectedRecipeId}
                onChange={(e) => setSelectedRecipeId(e.target.value)}
                options={recipes.map((r) => ({
                  value: r.id,
                  label: r.name,
                }))}
                required
              />
            )}

            <Input
              label="Target Quantity (# of garments)"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 50"
              value={targetQty}
              onChange={(e) => setTargetQty(e.target.value)}
              required
            />

            <Input
              label="Fabric Roll ID"
              type="text"
              placeholder="e.g. ROLL-2024-A037"
              value={fabricRollId}
              onChange={(e) => setFabricRollId(e.target.value)}
              required
            />

            <Input
              label="Actual Fabric Yards"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 125.5"
              value={actualFabricYards}
              onChange={(e) => setActualFabricYards(e.target.value)}
              required
            />

            <div className="pt-2">
              <Button type="submit" size="lg" loading={submitting}>
                {submitting ? "Creating Order…" : "Create Cutting Order"}
              </Button>
            </div>
          </form>
        </Card>

        {/* ── Recipe Preview ───────────────────────────────────────── */}
        <Card title="Recipe Components" subtitle="Expected components per garment">
          {selectedRecipe ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-600 mb-3">
                {selectedRecipe.description}
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 font-medium text-slate-700">
                      Component
                    </th>
                    <th className="text-right py-2 font-medium text-slate-700">
                      Qty
                    </th>
                    <th className="text-right py-2 font-medium text-slate-700">
                      Unit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRecipe.components.map((comp) => (
                    <tr
                      key={comp.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2 text-slate-900">
                        {comp.componentName}
                      </td>
                      <td className="py-2 text-right text-slate-900 font-mono">
                        {comp.expectedQty}
                      </td>
                      <td className="py-2 text-right text-slate-500">
                        {comp.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {targetQty && parseInt(targetQty) > 0 && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <strong>Scaled total for {targetQty} garments:</strong>
                  <ul className="mt-1 space-y-0.5">
                    {selectedRecipe.components.map((comp) => (
                      <li key={comp.id}>
                        {comp.componentName}:{" "}
                        <span className="font-mono font-semibold">
                          {comp.expectedQty * parseInt(targetQty)} {comp.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">
              Select a recipe to preview its components.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
