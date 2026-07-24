import { cx } from '../lib/cx.js'

// MatrixQuestion — the survey grid: rows of statements, columns of choices, one answer per row. Likert
// scales, satisfaction batteries, self-assessments, rubrics.
// rows: [{id, label}]  columns: [{value, label}]
export default function MatrixQuestion({
  question, hint, rows = [], columns = [], value = {}, onChange, required, name = 'matrix', className,
}) {
  const answered = rows.filter((r) => value[r.id] != null).length
  return (
    <fieldset className={className}>
      {question && (
        <legend className="mb-1 font-display text-base font-semibold text-ink-900">
          {question}{required && <span className="ml-1 text-rose-500">*</span>}
        </legend>
      )}
      {hint && <p className="mb-3 text-sm text-ink-500">{hint}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr>
              <th className="w-2/5 pb-2 text-left" />
              {columns.map((c) => (
                <th key={c.value} className="px-1 pb-2 text-center text-xs font-medium text-ink-500">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              // Zebra striping is doing real work here: on a wide grid it's what stops your eye slipping
              // onto the wrong row between the statement and the radio you're clicking.
              <tr key={r.id} className={cx('rounded-lg', i % 2 === 1 && 'bg-ink-50/70')}>
                <th scope="row" className="py-2.5 pl-3 pr-4 text-left font-normal text-ink-800">{r.label}</th>
                {columns.map((c) => (
                  <td key={c.value} className="px-1 py-2.5 text-center">
                    <label className="inline-flex cursor-pointer p-1.5">
                      <input type="radio" name={`${name}-${r.id}`} value={c.value} checked={value[r.id] === c.value}
                        onChange={() => onChange && onChange({ ...value, [r.id]: c.value })}
                        aria-label={`${r.label}: ${c.label}`}
                        className="h-4 w-4 accent-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" />
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {required && answered < rows.length && (
        <p className="mt-2 text-xs text-ink-400">{answered} of {rows.length} answered</p>
      )}
    </fieldset>
  )
}
