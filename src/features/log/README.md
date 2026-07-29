# Log Feature

Owns daily check-ins, event logs, content reflections, and private reflection entry points.

The log experience should be optional, calm, and focused on noticing patterns without judgment.

Saved check-ins live in canonical Bloom state under `checkIns.records`. The
primary Save Check-In action creates a fresh id and timestamp for every
logical moment, including repeated saves while the tab remains mounted.
Context and note actions target the most recently saved record id; they do not
reuse that id for the next primary save. Recent Moments renders persisted
records only and shows an empty state when no check-ins exist.
