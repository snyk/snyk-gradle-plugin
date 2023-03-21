# Multi project with shadow deps

Adds a separate build project (`third-party`) that provides modified version of 
a jar using [shadow](https://imperceptiblethoughts.com/shadow/getting-started/#default-java-groovy-tasks)

This would cause the `snykResolvedDepsJson` to be called twice, leading to gradle never
finishing processing.