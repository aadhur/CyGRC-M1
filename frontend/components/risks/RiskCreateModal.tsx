"use client";

import React, { useState, useEffect } from "react";

interface RiskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ControlOption {
  id: string;
  name: string;
}

export default function RiskCreateModal({ isOpen, onClose, onSuccess }: RiskCreateModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    likelihood: 3,
    impact: 3,
    treatment: "Mitigate",
    treatmentPlan: "",
    targetCloseDate: "",
  });

  const [availableControls, setAvailableControls] = useState<ControlOption[]>([]);
  const [selectedControls, setSelectedControls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setAvailableControls([
      { id: "ctrl-1", name: "AC-2: Account Management Policy" },
      { id: "ctrl-2", name: "IA-5: Multi-Factor Authentication" },
      { id: "ctrl-3", name: "SI-2: Flaw Remediation & Patching" },
      { id: "ctrl-4", name: "CM-8: Information System Component Inventory" },
    ]);
  }, []);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "likelihood" || name === "impact" ? parseInt(value, 10) : value,
    }));
  };

  const handleControlToggle = (controlId: string) => {
    setSelectedControls((prev) =>
      prev.includes(controlId) ? prev.filter((id) => id !== controlId) : [...prev, controlId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/v1/risks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...formData, controlIds: selectedControls }),
      });

      if (!response.ok) {
        throw new Error("Failed to create the risk definition.");
      }

      onSuccess();
    } catch (err: any) {
      setSubmitError(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Identify New Risk</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 bg-background text-foreground">
          {submitError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded">
              {submitError}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Title *</label>
            <input
              type="text"
              name="title"
              required
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Unencrypted backup storage volumes"
              className="w-full text-sm border rounded p-2 bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Description</label>
            <textarea
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className="w-full text-sm border rounded p-2 bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Likelihood (1–5)</label>
              <select
                name="likelihood"
                value={formData.likelihood}
                onChange={handleChange}
                className="w-full text-sm border rounded p-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[1, 2, 3, 4, 5].map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Impact (1–5)</label>
              <select
                name="impact"
                value={formData.impact}
                onChange={handleChange}
                className="w-full text-sm border rounded p-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[1, 2, 3, 4, 5].map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Treatment Option</label>
              <select
                name="treatment"
                value={formData.treatment}
                onChange={handleChange}
                className="w-full text-sm border rounded p-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="Mitigate">Mitigate</option>
                <option value="Accept">Accept</option>
                <option value="Transfer">Transfer</option>
                <option value="Avoid">Avoid</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Target Close Date</label>
              <input
                type="date"
                name="targetCloseDate"
                value={formData.targetCloseDate}
                onChange={handleChange}
                className="w-full text-sm border rounded p-2 bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Treatment Plan</label>
            <textarea
              name="treatmentPlan"
              rows={2}
              value={formData.treatmentPlan}
              onChange={handleChange}
              className="w-full text-sm border rounded p-2 bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium block text-foreground">Link internal Security Controls</label>
            <div className="border rounded p-3 max-h-32 overflow-y-auto space-y-2 bg-muted/20">
              {availableControls.map((control) => (
                <label key={control.id} className="flex items-center space-x-2 text-sm cursor-pointer select-none text-foreground">
                  <input
                    type="checkbox"
                    checked={selectedControls.includes(control.id)}
                    onChange={() => handleControlToggle(control.id)}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>{control.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm border rounded hover:bg-muted text-foreground transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Save Risk"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

