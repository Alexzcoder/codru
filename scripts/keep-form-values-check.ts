// Self-check for the form-value restore used by useKeepFormValues.
//   npx tsx scripts/keep-form-values-check.ts
import assert from "node:assert";
import { restoreValues, type FieldSnapshot } from "../src/lib/use-keep-form-values";

const snap = (
  rows: [string, string, boolean | null][],
): FieldSnapshot[] =>
  rows.map(([name, value, checked]) => ({ name, value, checked }));

// A rejected submit blanked the fields; the snapshot puts them back.
{
  const els = [
    { name: "email", value: "" },
    { name: "notes", value: "" },
    { name: "reverseCharge", value: "on", checked: false },
  ];
  const ok = restoreValues(
    snap([
      ["email", "jan@example.cz", null],
      ["notes", "volal v pondělí", null],
      ["reverseCharge", "on", true],
    ]),
    els,
  );
  assert.equal(ok, true);
  assert.equal(els[0].value, "jan@example.cz");
  assert.equal(els[1].value, "volal v pondělí");
  assert.equal(els[2].checked, true, "checkbox state restored, not its value");
}

// Repeated names are matched by position, not by name.
{
  const els = [
    { name: "qty", value: "" },
    { name: "qty", value: "" },
    { name: "qty", value: "" },
  ];
  restoreValues(
    snap([
      ["qty", "1", null],
      ["qty", "7", null],
      ["qty", "3", null],
    ]),
    els,
  );
  assert.deepEqual(els.map((e) => e.value), ["1", "7", "3"]);
}

// Form grew a row between submit and response — refuse rather than misalign.
{
  const els = [
    { name: "qty", value: "keep" },
    { name: "qty", value: "keep" },
  ];
  assert.equal(restoreValues(snap([["qty", "1", null]]), els), false);
  assert.deepEqual(els.map((e) => e.value), ["keep", "keep"]);
}

// Same field count but a different field order — also refuse.
{
  const els = [
    { name: "city", value: "keep" },
    { name: "zip", value: "keep" },
  ];
  assert.equal(
    restoreValues(
      snap([
        ["zip", "11000", null],
        ["city", "Praha", null],
      ]),
      els,
    ),
    false,
  );
  assert.deepEqual(els.map((e) => e.value), ["keep", "keep"]);
}

console.log("keep-form-values: 4/4 ok");
