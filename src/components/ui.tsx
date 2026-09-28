import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover border border-transparent",
  secondary: "bg-card text-foreground border border-input hover:bg-muted",
  ghost: "bg-transparent text-foreground border border-transparent hover:bg-muted",
  danger: "bg-danger text-primary-foreground hover:opacity-90 border border-transparent",
  accent: "bg-accent text-accent-foreground hover:opacity-90 border border-transparent",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-[6px] rounded-[6px] px-[14px] py-[7px] text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
    />
  );
}

export function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-[4px] text-[13px]">
      <span className="font-medium text-foreground">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="text-[12px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

const controlClass =
  "w-full rounded-[6px] border border-input bg-card px-[10px] py-[7px] text-[13px] text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlClass, "min-h-[64px]", className)} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, className)} />;
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("panel", className)}>{children}</div>;
}

export function PanelHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-[10px] border-b border-border px-[14px] py-[10px]">
      <h2 className="text-[14px] font-medium text-foreground">{title}</h2>
      {actions ? <div className="flex items-center gap-[6px]">{actions}</div> : null}
    </div>
  );
}

const statusTone: Record<string, string> = {
  Available: "bg-success-soft text-success",
  Returned: "bg-success-soft text-success",
  Good: "bg-success-soft text-success",
  Active: "bg-success-soft text-success",
  Borrowed: "bg-info-soft text-info",
  Extended: "bg-info-soft text-info",
  "Partially Borrowed": "bg-warning-soft text-warning",
  "Partially Returned": "bg-warning-soft text-warning",
  "Fully Borrowed": "bg-accent-soft text-accent",
  "Needs Repair": "bg-warning-soft text-warning",
  Damaged: "bg-danger-soft text-danger",
  Overdue: "bg-danger-soft text-danger",
  Inactive: "bg-danger-soft text-danger",
  admin: "bg-accent-soft text-accent",
  user: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[10px] px-[8px] py-[2px] text-[11px] font-medium whitespace-nowrap",
        statusTone[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status === "admin" ? "Admin" : status === "user" ? "User" : status}
    </span>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-[16px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          "my-[24px] w-full rounded-[10px] border border-border bg-card shadow-lg",
          wide ? "max-w-[980px]" : "max-w-[560px]",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-[16px] py-[12px]">
          <h2 className="text-[15px] font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-[6px] p-[4px] text-muted-foreground transition-colors hover:bg-muted"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-[16px]">{children}</div>
      </div>
    </div>
  );
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-[10px] py-[24px] text-center text-muted-foreground">
        {label}
      </td>
    </tr>
  );
}

export function PageHeader({
  title,
  breadcrumb,
  actions,
  description,
}: {
  title: string;
  breadcrumb?: string;
  actions?: ReactNode;
  description?: string;
}) {
  return (
    <div className="mb-[14px] flex flex-wrap items-end justify-between gap-[10px]">
      <div>
        {breadcrumb ? (
          <div className="text-[12px] text-muted-foreground">{breadcrumb}</div>
        ) : null}
        <h1 className="text-[21px] font-medium text-foreground">{title}</h1>
        {description ? (
          <p className="mt-[2px] text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-[6px]">{actions}</div> : null}
    </div>
  );
}
