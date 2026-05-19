import * as path from 'path';

import { fixtureDir } from '../common';
import { inspect } from '../../lib';

// Verifies the walker correctly applies cross-project conflict resolution
// when a local subproject is exposed as multiple artifact variants.
//
// Project shape (test/fixtures/multi-variant-project-dep):
//   lib-provider/  java-library + java-test-fixtures.
//                  Brings spring-boot-dependencies BOM via `api`, which
//                  manages tomcat-embed-core at 10.1.26. Also declares
//                  `implementation tomcat-embed-core:10.1.40` — visible to
//                  lib-provider's own main classpath but NOT to its
//                  test-fixtures variant.
//   app/           implementation project(':lib-provider')          (main jar)
//                  testImplementation testFixtures(project(':lib-provider'))
//
// Gradle's actual classpath resolution for :app (verifiable with
// `./gradlew :app:dependencies --configuration <CONFIG>`):
//   compileClasspath        → tomcat-embed-core:10.1.26 (api leaks BOM only)
//   runtimeClasspath        → tomcat-embed-core:10.1.40
//   testCompileClasspath    → tomcat-embed-core:10.1.26
//   testRuntimeClasspath    → tomcat-embed-core:10.1.40
//
// Both 10.1.26 and 10.1.40 jars are genuinely on real classpaths. A correct
// merged dep graph for :app should include both. This test asserts the
// walker surfaces both.

const reproRoot = fixtureDir('multi-variant-project-dep');

function tomcatVersionsForApp(scannedProjects: any[]): string[] {
  const app = scannedProjects.find(
    (sp) =>
      sp.meta.projectName.endsWith('/app') || sp.meta.projectName === 'app',
  );
  if (!app || !app.depGraph) return [];
  return app.depGraph
    .getDepPkgs()
    .filter((p: any) => p.name === 'org.apache.tomcat.embed:tomcat-embed-core')
    .map((p: any) => p.version)
    .sort();
}

describe('multi-variant project dependency', () => {
  it('surfaces both real classpath versions of tomcat-embed-core for :app', async () => {
    const result = await inspect('.', path.join(reproRoot, 'build.gradle'), {
      allSubProjects: true,
    });
    const versions = tomcatVersionsForApp(result.scannedProjects ?? []);
    expect(versions).toEqual(['10.1.26', '10.1.40']);
  }, 120_000);
});
