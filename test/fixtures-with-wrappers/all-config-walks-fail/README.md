# all-config-walks-fail

Forces every resolvable configuration walk to throw so the dependency graph
stays empty. Expects `inspect()` to reject with an empty-graph resolution
error rather than returning success with zero dependencies.
