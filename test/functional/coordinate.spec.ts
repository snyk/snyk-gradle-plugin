import { coordsToString, parseCoordinate } from '../../lib/coordinate';

describe('parseCoordinate', () => {
  it.each`
    input                                      | output                                                                                                     | msg
    ${''}                                      | ${{}}                                                                                                      | ${'should return empty obj for empty string'}
    ${'a.group.id'}                            | ${{ groupId: 'a.group.id' }}                                                                               | ${'should return group id'}
    ${'a.group.id:artifact-id'}                | ${{ groupId: 'a.group.id', artifactId: 'artifact-id' }}                                                    | ${'should return group id and artifact id'}
    ${'g:a:t:c:somethingelse'}                 | ${{ groupId: 'g', artifactId: 'a', type: 't', classifier: 'c' }}                                           | ${'ignores anything extra'}
    ${'a.group.id@1.0.0'}                      | ${{ groupId: 'a.group.id', version: '1.0.0' }}                                                             | ${'should return group id and version'}
    ${'a.group.id:artifact-id:jar'}            | ${{ groupId: 'a.group.id', artifactId: 'artifact-id', type: 'jar' }}                                       | ${'should return group id, artifact id and type'}
    ${'a.group.id:artifact-id@1.0.0'}          | ${{ groupId: 'a.group.id', artifactId: 'artifact-id', version: '1.0.0' }}                                  | ${'should return group id, artifact id and verison'}
    ${'a.group.id:artifact-id:jar:jdk8@1.0.0'} | ${{ groupId: 'a.group.id', artifactId: 'artifact-id', type: 'jar', classifier: 'jdk8', version: '1.0.0' }} | ${'should return group id, artifact id, type, classifier and version'}
    ${'a.group.id:artifact-id:war:jdk8@1.0.0'} | ${{ groupId: 'a.group.id', artifactId: 'artifact-id', type: 'war', classifier: 'jdk8', version: '1.0.0' }} | ${'should return group id, artifact id, type, classifier and version'}
    ${'a.group.id:artifact-id:war@1.0.0'}      | ${{ groupId: 'a.group.id', artifactId: 'artifact-id', type: 'war', version: '1.0.0' }}                     | ${'should return group id, artifact id, type and version'}
  `('$msg', ({ input, output }) => {
    expect(parseCoordinate(input)).toEqual(output);
  });
});

describe('coordsToString', () => {
  it.each`
    input                                                                                                       | output                                      | msg
    ${{}}                                                                                                       | ${'unknown:unknown:jar@unknown'}            | ${'should handle empty object'}
    ${{ groupId: 'a.group.id' }}                                                                                | ${'a.group.id:unknown:jar@unknown'}         | ${'should return group id'}
    ${{ groupId: 'a.group.id', artifactId: 'artifact-id' }}                                                     | ${'a.group.id:artifact-id:jar@unknown'}     | ${'should return group id and artifact id'}
    ${{ groupId: 'a.group.id', artifactId: 'artifact-id', version: '1.0.0' }}                                   | ${'a.group.id:artifact-id:jar@1.0.0'}       | ${'should return group id, artifact id and version'}
    ${{ groupId: 'a.group.id', artifactId: 'artifact-id', type: 'war', version: '1.0.0' }}                      | ${'a.group.id:artifact-id:war@1.0.0'}       | ${'should return group id, artifact id, type and version'}
    ${{ groupId: 'a.group.id', artifactId: 'artifact-id', classifier: 'jdk8', version: '1.0.0' }}               | ${'a.group.id:artifact-id:jar:jdk8@1.0.0'}  | ${'should return group id, artifact id, type, classifier and version'}
    ${{ groupId: 'a.group.id', artifactId: 'artifact-id', type: 'pom', classifier: 'jdk8', version: '1.0.0' }}  | ${'a.group.id:artifact-id:pom:jdk8@1.0.0'}  | ${'should return group id, artifact id, type, classifier and version'}
    ${{ groupId: 'a.group.id', artifactId: 'artifact-id', type: 'test', classifier: 'jdk8', version: '1.0.0' }} | ${'a.group.id:artifact-id:test:jdk8@1.0.0'} | ${'should return group id, artifact id, type, classifier and version'}
    ${{ groupId: 'a.group.id', artifactId: 'artifact-id', type: 'war' }}                                        | ${'a.group.id:artifact-id:war@unknown'}     | ${'should return group id, artifact id and type'}
    ${{ artifactId: 'artifact-id' }}                                                                            | ${'unknown:artifact-id:jar@unknown'}        | ${'should return artifact id'}
    ${{ type: 'war' }}                                                                                          | ${'unknown:unknown:war@unknown'}            | ${'should return type'}
    ${{ classifier: 'jdk8' }}                                                                                   | ${'unknown:unknown:jar:jdk8@unknown'}       | ${'should return classifier'}
    ${{ version: '1.0.0' }}                                                                                     | ${'unknown:unknown:jar@1.0.0'}              | ${'should return version'}
    ${{ groupId: 'a.group.id', artifactId: 'artifact-id', type: 'war', classifier: 'jdk8', version: '1.0.0' }}  | ${'a.group.id:artifact-id:war:jdk8@1.0.0'}  | ${'should return group id, artifact id, type, classifier and version'}
  `('$msg', ({ input, output }) => {
    expect(coordsToString(input)).toEqual(output);
  });
});
