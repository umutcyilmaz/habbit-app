// Native stack can expose AX nodes before it accepts touches.
// Give the real slide transition 700 ms before tapping the incoming header.
// This changes no application state and keeps device animations enabled.
var transitionStarted = Date.now();
while (Date.now() - transitionStarted < 700) {}
