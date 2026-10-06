"use client";

import React, { type ButtonHTMLAttributes, forwardRef } from "react";

// ─── Button ──────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-600 shadow-sm border border-transparent",
  secondary:
    "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 focus:ring-blue-600 shadow-sm",
  success:
    "bg-green-600 text-white hover:bg-green-700 focus:ring-green-600 shadow-sm border border-transparent",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 shadow-sm border border-transparent",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-blue-600 border border-transparent",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs font-medium",
  md: "px-4 py-2 text-sm font-medium",
  lg: "px-6 py-2.5 text-base font-semibold",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center gap-2
          rounded-lg transition-all duration-150 cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:border-transparent
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `.trim()}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

// ─── Input ───────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, id, className = "", ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-800"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            block w-full rounded-lg
            border border-slate-300
            px-3 py-2
            text-slate-900 placeholder:text-slate-500
            bg-white
            shadow-sm
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600
            disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed
            ${error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : ""}
            ${className}
          `.trim()}
          {...props}
        />
        {helperText && !error && (
          <p className="text-xs text-slate-500 mt-1">{helperText}</p>
        )}
        {error && (
          <p className="text-xs font-medium text-red-600 mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

// ─── Select ──────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, id, className = "", ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-slate-800"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`
            block w-full rounded-lg
            border border-slate-300
            px-3 py-2
            text-slate-900
            bg-white
            shadow-sm
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600
            disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed
            ${error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : ""}
            ${className}
          `.trim()}
          {...props}
        >
          {placeholder && (
            <option value="" disabled className="text-slate-400">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-slate-900">
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-xs font-medium text-red-600 mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

// ─── Badge ───────────────────────────────────────────────────────────

type BadgeVariant = "green" | "yellow" | "red" | "blue" | "gray" | "info";

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

// Exact specification palette matching Section 4
const badgeVariantClasses: Record<BadgeVariant, string> = {
  green: "bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]",
  yellow: "bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]",
  red: "bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]",
  blue: "bg-blue-50 text-blue-700 border border-blue-200",
  info: "bg-sky-50 text-[#0284C7] border border-sky-200",
  gray: "bg-slate-100 text-slate-700 border border-slate-200",
};

export function Badge({ variant, children, className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1
        px-2.5 py-0.5
        rounded-md
        text-xs font-semibold
        ${badgeVariantClasses[variant]}
        ${className}
      `.trim()}
    >
      {children}
    </span>
  );
}

// ─── Card ────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Card({
  children,
  className = "",
  title,
  subtitle,
  actions,
}: CardProps) {
  return (
    <div
      className={`
        bg-white border border-[#E2E8F0]
        rounded-xl shadow-xs
        overflow-hidden
        ${className}
      `.trim()}
    >
      {(title || subtitle || actions) && (
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-[#0F172A]">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-[#64748B]">{subtitle}</p>
            )}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const modalSizeClasses: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className={`
          relative w-full ${modalSizeClasses[size]}
          bg-white rounded-xl shadow-xl
          border border-slate-200
          transform transition-all
        `.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2
            id="modal-title"
            className="text-base font-bold text-slate-900"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors rounded-lg p-1 hover:bg-slate-100 cursor-pointer"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
