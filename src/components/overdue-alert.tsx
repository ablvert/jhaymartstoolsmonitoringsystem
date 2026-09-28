import { useNavigate } from "@tanstack/react-router";
import { Button, Modal, StatusBadge } from "@/components/ui";
import { durationSince, formatDateTime } from "@/lib/format";
import type { Area, Department, Tool, Transfer } from "@/lib/domain";
import { nameById } from "@/lib/data";

export function OverdueAlert({
  open,
  onClose,
  overdue,
  tools,
  departments,
}: {
  open: boolean;
  onClose: () => void;
  overdue: Transfer[];
  tools: Tool[];
  departments: (Department | Area)[];
}) {
  const navigate = useNavigate();

  return (
    <Modal open={open} title="Overdue tools alert" onClose={onClose} wide>
      <p className="mb-[12px] text-[13px] text-muted-foreground">
        The following tools are overdue and need to be returned to their original department.
      </p>
      <div className="max-h-[50vh] overflow-auto rounded-[6px] border border-border">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Tool name</th>
              <th scope="col">Qty</th>
              <th scope="col">Borrowed by</th>
              <th scope="col">Current dept.</th>
              <th scope="col">Original dept.</th>
              <th scope="col">Expected return</th>
              <th scope="col">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {overdue.map((t) => {
              const original = nameById(departments as Department[], t.transfer_from_department_id);
              return (
                <tr key={t.id}>
                  <td className="font-medium">{nameById(tools as any, t.tool_id)}</td>
                  <td>{t.quantity - t.returned_quantity}</td>
                  <td>{t.borrowed_by}</td>
                  <td>{nameById(departments as Department[], t.transfer_to_department_id)}</td>
                  <td>
                    <span className="font-medium text-danger">
                      RETURN TO ORIGINAL DEPARTMENT: {original.toUpperCase()}
                    </span>
                  </td>
                  <td>{formatDateTime(t.expected_return_at)}</td>
                  <td>
                    <StatusBadge status="Overdue" /> <span>{durationSince(t.expected_return_at)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-[14px] flex justify-end gap-[6px]">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button
          onClick={() => {
            onClose();
            void navigate({ to: "/overdue" });
          }}
        >
          View overdue tools
        </Button>
      </div>
    </Modal>
  );
}
