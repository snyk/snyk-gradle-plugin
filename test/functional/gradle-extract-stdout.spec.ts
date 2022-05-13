import { exportsForTests as testableMethods } from '../../lib';

describe('Gradle Extract Stdout', () => {
  it('extractJsonFromScriptOutput', () => {
    const output = `Mr Gradle says hello
      la dee da, la dee da
JSONDEPS {"hello": "world"}
      some other noise`;
    const result = testableMethods.extractJsonFromScriptOutput(output) as any;
    expect(result).toEqual({ hello: 'world' });
  });

  it('extractJsonFromScriptOutput throws on no JSONDEPS', () => {
    expect.assertions(1);
    const output = 'something else entirely';
    try {
      testableMethods.extractJsonFromScriptOutput(output);
    } catch ({ message }) {
      const errorMessage = `No line prefixed with "JSONDEPS " was returned; full output:\n${output}`;
      expect(message).toBe(errorMessage);
    }
  });

  it('extractJsonFromScriptOutput returns first on multiple JSONDEPS', () => {
    const output = 'JSONDEPS {"hello": "world"}\nJSONDEPS ["one more thing"]';
    const result = testableMethods.extractJsonFromScriptOutput(output);
    expect(result).toEqual({ hello: 'world' });
  });

  it('getGradleAttributesPretty returns undefined when throws', async () => {
    expect(testableMethods.getGradleAttributesPretty(``)).toBeUndefined();
  });

  //TODO: unlock this one by applying a fixture that works for both unix and windows (currently failing for windows)
  // Is not dangerous skip it as it does not have an user impact.
  it.skip('getGradleAttributesPretty returns attributes on success', () => {
    const result = testableMethods.getGradleAttributesPretty(
      `SNYKECHO snykResolvedDepsJson task is executing via doLast
        JSONATTRS {"org.gradle.usage":["java-runtime","java-api"],"org.gradle.category":["library"],"org.gradle.libraryelements":["jar"],"org.gradle.dependency.bundling":["external"]}
        SNYKECHO processing project: subproj`,
    );

    const output =
      '[97m              org.gradle.usage[39m: [90mjava-runtime, java-api[39m\n[97m           org.gradle.category[39m: [90mlibrary[39m\n[97m    org.gradle.libraryelements[39m: [90mjar[39m\n[97morg.gradle.dependency.bundling[39m: [90mexternal[39m';
    expect(result).toMatch(output);
  });
});
