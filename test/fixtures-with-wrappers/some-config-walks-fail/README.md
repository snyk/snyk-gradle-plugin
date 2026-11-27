# some-config-walks-fail

Forces `testRuntimeClasspath` walks to throw while other resolvable
configurations succeed. Expects `inspect()` to succeed with a non-empty
graph (partial failures must not trigger the empty-graph abort).
