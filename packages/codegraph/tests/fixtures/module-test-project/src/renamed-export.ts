// A9 Test: Renamed Export Handling
// Expected MODULE node: name="formatDate", id="MODULE:renamed-export.ts#formatDate"
// Expected metadata: { originalName: "formatDateInternal", exports: ["named"] }

function formatDateInternal(date: Date): string {
  return date.toLocaleDateString();
}

export { formatDateInternal as formatDate };

// Additional test: multiple renamed exports
function parseDateInternal(str: string): Date {
  return new Date(str);
}

function validateDateInternal(d: Date): boolean {
  return !isNaN(d.getTime());
}

export {
  parseDateInternal as parseDate,
  validateDateInternal as validateDate
};

// Expected: 3 MODULE nodes
// - MODULE:renamed-export.ts#formatDate (originalName: formatDateInternal)
// - MODULE:renamed-export.ts#parseDate (originalName: parseDateInternal)
// - MODULE:renamed-export.ts#validateDate (originalName: validateDateInternal)