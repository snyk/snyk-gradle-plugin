# multi-project-compile

This test fixture ensures we only resolve a single version of 'tomcat-embed-core' when one subproject depends on another using the 'compile' configuration.

Changes made to the init.gradle now ensure empty configurations and dependencies that come from non-resolvable configurations are ignored.
