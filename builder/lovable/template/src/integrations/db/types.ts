// GENERATED from isibi.schema.json — do not edit by hand. Change the schema and this follows.
//
// This is the placeholder the template ships with, so the client compiles before an app has a
// schema. The pipeline overwrites it the moment the schema stage runs, and every table then gets a
// real row type: `db.from('bookings')` returns typed rows, a column typo is a compile error, and an
// enum column becomes a literal union.

/** Table name → row type. Empty until this app declares a schema. */
export interface Tables {}

export type TableName = keyof Tables
