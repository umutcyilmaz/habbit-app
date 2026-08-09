# Arousal Control Lifecycle

Practice mode confirmation creates one canonical `arousalControl.draft` with
a new id. Every check-in, pause, ending, reflection, note, and duration update
targets that id. Duration is the only completion point and repeated completion
is idempotent.

Duration input has one explicit mode: prefer not, range, or exact. Switching
modes clears inactive values before the completion patch is resolved. The
reflection model keeps a semantic `3plus` pause bucket so summaries display
`3+` without presenting it as an exact count.

Starting a new mode replaces an abandoned draft. Completed logs are immutable
except for the explicit private-note edit on the same log id. Saved completion
navigation carries an exact log id and reports success only when that exact log
is durably persisted, without falling back to the latest durable log. Without a
completion log id, Saved and Progress Preview use the latest valid durable log
only as historical presentation, explicitly distinct from completion
acknowledgement. Neither route creates or completes data on mount. Historical
pre-status logs are recognized only when the complete former reflection and
duration signature is present.
