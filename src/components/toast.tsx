import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

const ToastContext = createContext<{
  notify: (message: string, tone?: Toast["tone"]) => void;
}>({ notify: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-[16px] bottom-[16px] z-[100] flex flex-col gap-[8px]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={
              "pointer-events-auto min-w-[240px] rounded-[6px] border px-[12px] py-[9px] text-[13px] shadow-md " +
              (t.tone === "error"
                ? "border-danger bg-danger-soft text-danger"
                : t.tone === "info"
                  ? "border-info bg-info-soft text-info"
                  : "border-success bg-success-soft text-success")
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
