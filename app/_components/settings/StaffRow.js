"use client";

import { useState, useTransition } from "react";
import { setStaff } from "@/app/_lib/actions";
import Badge from "@/app/_components/ui/Badge";
import Spinner from "@/app/_components/ui/Spinner";
import { useToast } from "@/app/_components/layout/ToastProvider";
import { formatDate } from "@/app/_lib/format-helpers";

export default function StaffRow({ person, isSelf }) {
  const toast = useToast();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function change(role, active) {
    setError("");
    startTransition(async () => {
      const r = await setStaff(person.id, role, active);
      if (r.ok) toast(r);
      else setError(r.message);
    });
  }

  return (
    <tr>
      <td>
        <p className="font-semibold">{person.full_name || "No name"} {isSelf ? <span className="text-xs font-normal text-[var(--color-muted)]">(you)</span> : null}</p>
        <p className="text-xs text-[var(--color-muted)]">{person.email}</p>
        {error ? <p role="alert" className="text-xs font-semibold text-[var(--color-danger)]">{error}</p> : null}
      </td>
      <td className="whitespace-nowrap">{formatDate(person.created_at)}</td>
      <td>{person.active ? <Badge tone="good">Active</Badge> : <Badge tone="warn">Waiting</Badge>}</td>
      <td>
        <select aria-label={`Role of ${person.full_name}`} className="field w-32" value={person.role} disabled={isPending || isSelf} onChange={(e) => change(e.target.value, person.active)}>
          <option value="staff">Staff</option>
          <option value="admin">Owner (admin)</option>
        </select>
      </td>
      <td className="text-right">
        {isPending ? <Spinner /> : null}{" "}
        {isSelf ? null : person.active ? (
          <button type="button" className="btn btn-secondary btn-sm" disabled={isPending} onClick={() => change(person.role, false)}>Switch off</button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" disabled={isPending} onClick={() => change(person.role, true)}>Switch on</button>
        )}
      </td>
    </tr>
  );
}
