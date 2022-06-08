# pruned-spring-app

Ensure duplicate nodes are labeled with 'pruned' and transitive line terminates.
This application has two pruned nodes, spring-beans and spring-core.

DepTree without pruning:

```
pruned-spring-app @ unspecified
   ├─ org.springframework:spring-web @ 5.3.10
   │  ├─ org.springframework:spring-beans @ 5.3.17
   │  │  └─ org.springframework:spring-core @ 5.3.17 
   │  │     └─ org.springframework:spring-jcl @ 5.3.17
   │  └─ org.springframework:spring-core @ 5.3.17
   │     └─ org.springframework:spring-jcl @ 5.3.17
   └─ org.springframework:spring-beans @ 5.3.17
      └─ org.springframework:spring-core @ 5.3.17
         └─ org.springframework:spring-jcl @ 5.3.17
```

DepTree with pruning:

```
pruned-spring-app @ unspecified
   ├─ org.springframework:spring-web @ 5.3.10
   │  ├─ org.springframework:spring-beans @ 5.3.17 (pruned)
   │  └─ org.springframework:spring-core @ 5.3.17
   │     └─ org.springframework:spring-jcl @ 5.3.17
   └─ org.springframework:spring-beans @ 5.3.17
      └─ org.springframework:spring-core @ 5.3.17 (pruned)
```

First in wins, the shortest path the spring-beans is the direct dependency so spring-beans under spring-web is pruned.
Similarly the fist seen spring-core is under spring-web and the spring-core under spring-beans (top-level) is pruned.
