// What the kit does NOT already have, as SHAPES.
//
// This list is short on purpose. A 1000-name draft went in and 26 came out,
// because the test is not "is the name new" but "is the STRUCTURE new" — and
// against 975 shipped components almost nothing is. The draft was organised by
// trade (restaurants, clinics, garages) and every trade wanted the same dozen
// shapes wearing its own nouns: `menu-item-row`, `medication-row`, `lesson-row`
// and `payslip-row` are one titled record with metadata, which is `list-row`,
// `two-line-row` and `data-list`, already built. Six countdowns to six
// different events are `countdown-ring`. Forty-odd badges are `status-badge`.
//
// The rule that did the work: if two components would take the same props and
// render the same structure, differing only in the words passed in, they are
// ONE component and the kit has it.
//
// Each entry says what the shape IS and why nothing shipped covers it. An entry
// that cannot answer the second half does not belong here.
export const NEXT_SHAPES = {

  "Grids and boards — 2D arrangements the kit has no answer for": {
    "kanban-board": "Columns of cards, dragged between columns, per-column limit, optional swimlane rows. `drag-list` and `sortable-list` reorder WITHIN one list; nothing moves an item across lists.",
    "gantt-bars": "Task bars positioned and sized on a shared time axis, with links between them. `timeline-horizontal` places points on a line; it has no spans and no dependencies.",
    "heatmap-grid": "A day-by-week grid where each cell's fill is a count. `heat-strip` is one dimension; `mini-bars` is a series, not a calendar.",
    "time-lane-grid": "Lanes down one axis, time along the other, blocks positioned by start and duration and overlapping side by side — the week view AND the staff rota, which are one shape with the lane relabelled. `day-schedule` is one day as a list; `calendar-month` has no time axis.",
    "seat-map": "Pick from a positioned plan (seats, tables, pitches) where position carries meaning. Every other picker in the kit is a list.",
    "variant-matrix": "Size against colour, each cell in stock or not, one cell selectable. `variant-picker` is a row of options and cannot express a combination that is unavailable.",
    "funnel-steps": "Stages with the drop-off BETWEEN them as the thing being read. `steps` and `progress-stack` show where you are, not what was lost at each stage.",
    "tree-table": "A hierarchy and columns at once — expandable parents with aligned numeric columns. The kit has `tree-view` and `data-table` as separate things.",
    "node-graph": "Boxes joined by edges, positioned and pannable. `workflow-map` is deliberately a list, and `org-chart` is a fixed hierarchy.",
    "timesheet-grid": "Days across, projects down, hours typed in cells, totals on both edges. `spreadsheet-grid` is generic cells with no totals contract.",
  },

  "Pickers with a shape the kit's pickers do not have": {
    "multi-date-picker": "Several arbitrary dates, not a range and not weekdays. `date-range-picker` is contiguous; `weekday-picker` repeats.",
    "nl-date-input": "Type “next Tuesday 2pm” and see it resolve. Every other date input in the kit is a control, not parsed text.",
    "meeting-poll-grid": "People against candidate slots, counts per slot, a winner picked from them. `availability-grid` shows one person's free time.",
    "rule-builder": "When THIS happens, do THAT — a trigger, conditions and actions. `query-builder` filters rows; `cron-builder` is only a schedule.",
    "option-priced-list": "Options that each change the price, with a running total — toppings, add-ons, and pick-any-N-for-a-fixed-price, which is the same control with a different total rule. `checkbox-group` has no money and `order-summary` takes finished lines.",
  },

  "Money shapes the kit's money components do not cover": {
    "split-tender": "Part cash, part card, part voucher, with the remainder falling as each is entered. `split-amount` divides among people; `payment-picker` chooses one method.",
    "split-by-item": "Assign each line of a bill to a person and total per person. A different question from splitting a number.",
  },

  "Media editing": {
    "range-trim": "Two handles on a media timeline for in and out points. `scrubber` has one handle and seeks.",
    "image-annotate": "Draw boxes or drop pins ON an image with notes attached. `comment-pin` anchors to a page, not to image coordinates.",
    "focal-point": "Click a point on an image so every crop keeps it. `image-crop` produces one crop; this drives all of them.",
  },

  "Reading and language": {
    "read-aloud": "Play this page as speech, with the sentence being spoken highlighted. `voice-input` is the other direction.",
    "rtl-preview": "Mirror the layout to check a right-to-left language without changing the app's own direction. `direction` sets it; this previews it.",
  },

  "Small things with no near neighbour": {
    "barcode": "A 1D barcode (Code128/EAN) as SVG. `qr-code` is 2D and takes its matrix from elsewhere; a shelf label needs the linear one.",
    "stamp-card": "A grid of earned and unearned stamps toward a reward. `checklist-dot` counts tasks; this counts visits and has a prize at the end.",
    "poll-composer": "Build a poll — add and reorder options, set how long it runs. `poll-result` displays one; nothing makes one.",
    "minimap-scroll": "A shrunk map of a long document with the viewport marked, draggable. `scroll-progress` is a bar and `table-of-contents` is headings.",
  },

};

// Flat groups for the doc generator.
export const NEXT_THOUSAND = Object.fromEntries(
  Object.entries(NEXT_SHAPES).map(([group, entries]) => [group, Object.keys(entries)]),
);
