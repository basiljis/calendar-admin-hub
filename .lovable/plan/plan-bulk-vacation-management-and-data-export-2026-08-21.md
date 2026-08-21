# Plan: Bulk Vacation Management and Data Export

Implement bulk operations for vacation requests and export functionality for administrators.

## User Review Required
> [!IMPORTANT]
> The text in the description of the vacations page will be updated to the requested verbatim prompt.

## Proposed Changes

### Database & Logic
- No schema changes required.
- Add utility for CSV generation from vacation data.

### Vacations Admin Page (`src/routes/_authenticated/vacations.tsx`)
- **Visual Text Update**: Replace the description with the requested verbatim block.
- **Bulk Actions**:
    - Add multi-select checkboxes to the vacation table.
    - Add a "Bulk Actions" bar that appears when items are selected.
    - Implement "Approve All" and "Reject All" with a confirmation dialog.
    - Update `vacation_audit_logs` and trigger notifications for each affected vacation.
- **Export**:
    - Add an "Export to CSV" button.
    - Ensure export respects current filters (search, status, dates).

## Technical Details
- Using `react-query` for bulk mutations.
- Multi-select state management in the component.
- Simple client-side CSV generation using data already fetched or a specific fetch if needed.

