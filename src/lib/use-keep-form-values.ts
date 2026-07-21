"use client";

import { useEffect, useRef } from "react";

/**
 * React 19 resets uncontrolled fields once a `<form action={...}>` action
 * resolves. That is fine when the action redirects, but our server actions
 * return a state object to report a rejected submit (duplicate e-mail, failed
 * IČO checksum, validation error) — and the form stays mounted with every
 * field blanked, losing whatever the operator typed.
 *
 * Snapshot the fields on submit, put them back once the action has resolved.
 * Fields are matched positionally so repeated names survive, and the restore
 * is skipped if the form changed shape rather than guessing.
 *
 * Usage:
 *   const { formRef, capture } = useKeepFormValues(state);
 *   <form action={formAction} ref={formRef} onSubmit={capture}>
 */
export function useKeepFormValues(state: unknown) {
  const formRef = useRef<HTMLFormElement>(null);
  const snapshot = useRef<
    { name: string; value: string; checked: boolean | null }[] | null
  >(null);

  const capture = () => {
    const form = formRef.current;
    if (!form) return;
    snapshot.current = fields(form).map((el) => ({
      name: el.name,
      value: el.value,
      checked:
        el instanceof HTMLInputElement &&
        (el.type === "checkbox" || el.type === "radio")
          ? el.checked
          : null,
    }));
  };

  useEffect(() => {
    const form = formRef.current;
    const snap = snapshot.current;
    snapshot.current = null;
    if (!form || !snap) return;

    restoreValues(snap, fields(form));
  }, [state]);

  return { formRef, capture };
}

export type FieldSnapshot = {
  name: string;
  value: string;
  checked: boolean | null;
};

/** Anything with the bits of a form control we care about. */
type Restorable = { name: string; value: string; checked?: boolean };

/**
 * Put a snapshot back onto the live controls, matched positionally so repeated
 * names (line-item rows) land on the right control. Bails out entirely if the
 * form changed shape — a partial restore would be worse than none.
 */
export function restoreValues(
  snap: FieldSnapshot[],
  els: Restorable[],
): boolean {
  if (els.length !== snap.length) return false;
  if (snap.some((s, i) => s.name !== els[i].name)) return false;

  snap.forEach((s, i) => {
    if (s.checked !== null) els[i].checked = s.checked;
    else if (els[i].value !== s.value) els[i].value = s.value;
  });
  return true;
}

function fields(form: HTMLFormElement) {
  return Array.from(form.elements).filter(
    (
      el,
    ): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
      (el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement) &&
      !!el.name &&
      // ponytail: file inputs cannot be restored programmatically, and buttons
      // carry no operator input worth keeping.
      el.type !== "file" &&
      el.type !== "submit" &&
      el.type !== "button",
  );
}
