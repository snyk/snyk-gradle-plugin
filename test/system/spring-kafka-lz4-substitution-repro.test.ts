import * as path from 'path';

import { fixtureDir } from '../common';
import { inspect } from '../../lib';

const reproRoot = fixtureDir('spring-kafka-lz4-substitution-repro');

describe('Spring / kafka-clients / lz4-java substitution repro', () => {
  it('includes org.lz4:lz4-java after dependency substitution (merged configurations)', async () => {
    const result = await inspect('.', path.join(reproRoot, 'build.gradle'));
    const depPkgs = result.dependencyGraph.getDepPkgs();

    const lz4Org = depPkgs.filter((p) => p.name === 'org.lz4:lz4-java');
    expect(lz4Org.length).toBeGreaterThan(0);
    expect(lz4Org.some((p) => p.version === '1.8.1')).toBe(true);

    expect(depPkgs.some((p) => p.name.startsWith('at.yawk'))).toBe(false);

    expect(
      depPkgs.some((p) => p.name === 'org.apache.kafka:kafka-clients'),
    ).toBe(true);

    expect(result.dependencyGraph.rootPkg.name).toBe(
      'spring-kafka-lz4-substitution-repro',
    );
  });
});
