import * as path from 'path';
import { processProjectsInExtractedJSON } from '../../lib';

describe('findProjectsInExtractedJSON', () => {
  const fakeRootDir = path.join('dev', 'tardis-master');

  it.each`
    targetFile
    ${'build.gradle'}
    ${'build.gradle'}
    ${'build.gradle'}
    ${path.join(fakeRootDir, 'build.gradle')}
  `(
    'project with targetFile `$targetFile` have valid name when rootDir is `$rootDir`',
    async ({ targetFile }) => {
      const jsonExtractedFromGradleStdout = {
        defaultProject: 'tardis-master',
        defaultProjectKey: 'tardis-master',
        projects: {
          'tardis-master': {
            targetFile,
            snykGraph: {
              'com.tardis:b@1.0.13': {
                name: 'com.tardis:b',
                version: '1.0.13',
                parentIds: ['com.tardis:a@1.5.0'],
              },
              'com.tardis:a@1.5.0': {
                name: 'com.tardis:a',
                version: '1.5.0',
                parentIds: ['root-node'],
              },
            },
            projectVersion: 'unspecified',
          },
        },
        allSubProjectNames: [],
      };

      const { defaultProject, projects, allSubProjectNames } =
        await processProjectsInExtractedJSON(jsonExtractedFromGradleStdout);

      expect(defaultProject).toEqual('tardis-master');
      expect(projects['tardis-master']?.targetFile).toEqual(`${targetFile}`);
      expect(projects['tardis-master'].depGraph.rootPkg).toEqual({
        name: 'tardis-master',
        version: 'unspecified',
      });
      expect(projects['tardis-master']?.depGraph.getPkgs()).toEqual([
        { name: 'tardis-master', version: 'unspecified' },
        { name: 'com.tardis:a', version: '1.5.0' },
        { name: 'com.tardis:b', version: '1.0.13' },
      ]);
      expect(allSubProjectNames).toEqual([]);
    },
  );
});
