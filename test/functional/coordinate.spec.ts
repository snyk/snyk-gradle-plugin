import { coordsToString, parseCoordinate } from '../../lib/coordinate';

describe('parseCoordinate', () => {
  it.each`
    input                                              | groupId         | artifactId       | type         | classifier   | version      | msg
    ${''}                                              | ${undefined}    | ${undefined}     | ${undefined} | ${undefined} | ${undefined} | ${'parses empty obj for empty string'}
    ${'a.group.id'}                                    | ${'a.group.id'} | ${undefined}     | ${undefined} | ${undefined} | ${undefined} | ${'parses group id'}
    ${'a.group.id:artifact-id'}                        | ${'a.group.id'} | ${'artifact-id'} | ${undefined} | ${undefined} | ${undefined} | ${'parses group id and artifact id'}
    ${'a.group.id:artifact-id:jar:jdk8:somethingelse'} | ${'a.group.id'} | ${'artifact-id'} | ${'jar'}     | ${'jdk8'}    | ${undefined} | ${'ignores anything extra'}
    ${'a.group.id@1.0.0'}                              | ${'a.group.id'} | ${undefined}     | ${undefined} | ${undefined} | ${'1.0.0'}   | ${'parses group id and version'}
    ${'a.group.id:artifact-id:jar'}                    | ${'a.group.id'} | ${'artifact-id'} | ${'jar'}     | ${undefined} | ${undefined} | ${'parses group id, artifact id and type'}
    ${'a.group.id:artifact-id@1.0.0'}                  | ${'a.group.id'} | ${'artifact-id'} | ${undefined} | ${undefined} | ${'1.0.0'}   | ${'parses group id, artifact id and verison'}
    ${'a.group.id:artifact-id:jar:jdk8@1.0.0'}         | ${'a.group.id'} | ${'artifact-id'} | ${'jar'}     | ${'jdk8'}    | ${'1.0.0'}   | ${'parses group id, artifact id, type, classifier and version'}
    ${'a.group.id:artifact-id:war:jdk8@1.0.0'}         | ${'a.group.id'} | ${'artifact-id'} | ${'war'}     | ${'jdk8'}    | ${'1.0.0'}   | ${'parses with non default type'}
    ${'a.group.id:artifact-id:war@1.0.0'}              | ${'a.group.id'} | ${'artifact-id'} | ${'war'}     | ${undefined} | ${'1.0.0'}   | ${'parses group id, artifact id, type and version'}
    ${'a.group.id:artifact-id:'}                       | ${'a.group.id'} | ${'artifact-id'} | ${undefined} | ${undefined} | ${undefined} | ${'parses group id and artifact id even with trailing colon'}
    ${'a.group.id:artifact-id@'}                       | ${'a.group.id'} | ${'artifact-id'} | ${undefined} | ${undefined} | ${undefined} | ${'parses group id and artifact id even with trailing at'}
  `('$msg', ({ input, groupId, artifactId, type, classifier, version }) => {
    expect(parseCoordinate(input)).toEqual({
      groupId,
      artifactId,
      type,
      classifier,
      version,
    });
  });
});

describe('coordsToString', () => {
  it.each`
    groupId         | artifactId       | type         | classifier   | version      | output                                        | msg
    ${undefined}    | ${undefined}     | ${undefined} | ${undefined} | ${undefined} | ${'unknown:unknown:jar@unknown'}              | ${'handles empty object'}
    ${'a.group.id'} | ${undefined}     | ${undefined} | ${undefined} | ${undefined} | ${'a.group.id:unknown:jar@unknown'}           | ${'string for group id only'}
    ${'a.group.id'} | ${'artifact-id'} | ${undefined} | ${undefined} | ${undefined} | ${'a.group.id:artifact-id:jar@unknown'}       | ${'string for group id and artifact id'}
    ${'a.group.id'} | ${'artifact-id'} | ${'war'}     | ${undefined} | ${undefined} | ${'a.group.id:artifact-id:war@unknown'}       | ${'string for group id, artifact id and type'}
    ${'a.group.id'} | ${'artifact-id'} | ${'war'}     | ${'jdk8'}    | ${undefined} | ${'a.group.id:artifact-id:war:jdk8@unknown'}  | ${'string for group id, artifact id, type, classifier'}
    ${'a.group.id'} | ${'artifact-id'} | ${undefined} | ${undefined} | ${'1.0.0'}   | ${'a.group.id:artifact-id:jar@1.0.0'}         | ${'string for group id, artifact id and version'}
    ${'a.group.id'} | ${'artifact-id'} | ${'war'}     | ${undefined} | ${'1.0.0'}   | ${'a.group.id:artifact-id:war@1.0.0'}         | ${'string for group id, artifact id, type and version'}
    ${'a.group.id'} | ${'artifact-id'} | ${undefined} | ${'jdk8'}    | ${'1.0.0'}   | ${'a.group.id:artifact-id:jar:jdk8@1.0.0'}    | ${'string for group id, artifact id, classifier and version'}
    ${'a.group.id'} | ${'artifact-id'} | ${'test'}    | ${'jdk8'}    | ${'1.0.0'}   | ${'a.group.id:artifact-id:test:jdk8@1.0.0'}   | ${'string for group id, artifact id, type, classifier and version'}
    ${undefined}    | ${'artifact-id'} | ${undefined} | ${undefined} | ${undefined} | ${'unknown:artifact-id:jar@unknown'}          | ${'string for artifact id only'}
    ${undefined}    | ${undefined}     | ${'war'}     | ${undefined} | ${undefined} | ${'unknown:unknown:war@unknown'}              | ${'string for type only'}
    ${undefined}    | ${undefined}     | ${undefined} | ${'jdk8'}    | ${undefined} | ${'unknown:unknown:jar:jdk8@unknown'}         | ${'string for classifier only'}
    ${undefined}    | ${undefined}     | ${undefined} | ${undefined} | ${'1.0.0'}   | ${'unknown:unknown:jar@1.0.0'}                | ${'string for version only'}
    ${undefined}    | ${'artifact-id'} | ${'war'}     | ${'jdk8'}    | ${'1.0.0'}   | ${'unknown:artifact-id:war:jdk8@1.0.0'}       | ${'string without group'}
    ${'a.group.id'} | ${undefined}     | ${'war'}     | ${'jdk8'}    | ${'1.0.0'}   | ${'a.group.id:unknown:war:jdk8@1.0.0'}        | ${'string without artifact id'}
    ${'a.group.id'} | ${'artifact-id'} | ${'test'}    | ${undefined} | ${undefined} | ${'a.group.id:artifact-id:test@unknown'}      | ${'string for group id, artifact id and type test'}
    ${'a.group.id'} | ${'artifact-id'} | ${undefined} | ${'jdk11'}   | ${undefined} | ${'a.group.id:artifact-id:jar:jdk11@unknown'} | ${'string for group id, artifact id and classifier jdk11'}
    ${'a.group.id'} | ${'artifact-id'} | ${'test'}    | ${'jdk11'}   | ${'1.0.0'}   | ${'a.group.id:artifact-id:test:jdk11@1.0.0'}  | ${'string for group id, artifact id, type test, classifier and version'}
  `('$msg', ({ groupId, artifactId, type, classifier, version, output }) => {
    expect(
      coordsToString({ groupId, artifactId, type, classifier, version }),
    ).toEqual(output);
  });
});
