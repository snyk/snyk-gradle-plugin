import { exportsForTests as testableMethods } from '../../lib';

describe('validate gradle version build info', () => {
  beforeEach(() => {
    jest.setTimeout(30000);
  });

  it('should extract gradle -v output info', async () => {
    // Setup
    const expectedGradleOutput =
      '\n' +
      '------------------------------------------------------------\n' +
      'Gradle 4.10.3\n' +
      '------------------------------------------------------------\n' +
      '\n' +
      'Build time:   2018-12-05 00:50:54 UTC\n' +
      'Revision:     e76905e3a1034e6f724566aeb985621347ff43bc\n' +
      '\n' +
      'Kotlin DSL:   1.0-rc-6\n' +
      'Kotlin:       1.2.61\n' +
      'Groovy:       2.4.15\n' +
      'Ant:          Apache Ant(TM) version 1.9.11 compiled on March 23 2018\n' +
      'JVM:          1.8.0_222 (Eclipse OpenJ9 openj9-0.15.1)\n' +
      'OS:           Mac OS X 10.14.6 x86_64';

    // Exercise
    const versionBuildInfo = testableMethods.getVersionBuildInfo(
      expectedGradleOutput,
    )!;

    // Verify `returns correct gradle version`
    expect(versionBuildInfo.gradleVersion).toBe('4.10.3');
    // Verify `returns build time`
    expect(versionBuildInfo.metaBuildVersion.buildTime).toBe(
      '2018-12-05 00:50:54 UTC',
    );
    // Verify `returns revision`
    expect(versionBuildInfo.metaBuildVersion.revision).toBe(
      'e76905e3a1034e6f724566aeb985621347ff43bc',
    );
    // Verify `returns Kotlin DSL version`
    expect(versionBuildInfo.metaBuildVersion.kotlinDsl).toBe('1.0-rc-6');
    // Verify `returns Kotlin version`
    expect(versionBuildInfo.metaBuildVersion.kotlin).toBe('1.2.61');
    // Verify `returns groovy version`
    expect(versionBuildInfo.metaBuildVersion.groovy).toBe('2.4.15');
    // Verify `returns ant version`
    expect(versionBuildInfo.metaBuildVersion.ant).toBe(
      'Apache Ant(TM) version 1.9.11 compiled on March 23 2018',
    );
    // Verify `returns jvm version`
    expect(versionBuildInfo.metaBuildVersion.jvm).toBe(
      '1.8.0_222 (Eclipse OpenJ9 openj9-0.15.1)',
    );
    // Verify `returns OS`
    expect(versionBuildInfo.metaBuildVersion.os).toBe(
      'Mac OS X 10.14.6 x86_64',
    );
  });
  it('should extract gradle -v output info when running gradlew -v the first time', async () => {
    // Setup
    const expectedGradleOutput =
      'Downloading https://services.gradle.org/distributions/gradle-5.4.1-all.zip\n' +
      '..............................................................................................................................\n' +
      '\n' +
      'Welcome to Gradle 5.4.1!\n' +
      '\n' +
      'Here are the highlights of this release:\n' +
      ' - Run builds with JDK12\n' +
      ' - New API for Incremental Tasks\n' +
      ' - Updates to native projects, including Swift 5 support\n' +
      '\n' +
      'For more details see https://docs.gradle.org/5.4.1/release-notes.html\n' +
      '\n' +
      '\n' +
      '------------------------------------------------------------\n' +
      'Gradle 5.4.1\n' +
      '------------------------------------------------------------\n' +
      '\n' +
      'Build time:   2019-04-26 08:14:42 UTC\n' +
      'Revision:     261d171646b36a6a28d5a19a69676cd098a4c19d\n' +
      '\n' +
      'Kotlin:       1.3.21\n' +
      'Groovy:       2.5.4\n' +
      'Ant:          Apache Ant(TM) version 1.9.13 compiled on July 10 2018\n' +
      'JVM:          9.0.4 (Oracle Corporation 9.0.4+11)\n' +
      'OS:           Mac OS X 10.15 x86_64';

    // Exercise
    const versionBuildInfo = testableMethods.getVersionBuildInfo(
      expectedGradleOutput,
    )!;

    // Verify `returns correct gradle version`
    expect(versionBuildInfo.gradleVersion).toBe('5.4.1');
    // Verify `returns build time`
    expect(versionBuildInfo.metaBuildVersion.buildTime).toBe(
      '2019-04-26 08:14:42 UTC',
    );
    // Verify `returns revision`
    expect(versionBuildInfo.metaBuildVersion.revision).toBe(
      '261d171646b36a6a28d5a19a69676cd098a4c19d',
    );
    // Verify `returns Kotlin version`
    expect(versionBuildInfo.metaBuildVersion.kotlin).toBe('1.3.21');
    // Verify `returns groovy version`
    expect(versionBuildInfo.metaBuildVersion.groovy).toBe('2.5.4');

    // Verify `returns ant version`
    expect(versionBuildInfo.metaBuildVersion.ant).toBe(
      'Apache Ant(TM) version 1.9.13 compiled on July 10 2018',
    );
    // Verify `returns OS`
    expect(versionBuildInfo.metaBuildVersion.jvm).toBe(
      '9.0.4 (Oracle Corporation 9.0.4+11)',
    );
    expect(versionBuildInfo.metaBuildVersion.os).toBe('Mac OS X 10.15 x86_64');
  });
  it('should not extract gradle -v output info when output is malformed', async () => {
    const expectedGradleOutput = 'malformed data';
    const versionBuildInfo = testableMethods.getVersionBuildInfo(
      expectedGradleOutput,
    );
    // Verify `returns undefined due of malformed data`
    expect(versionBuildInfo).toEqual(undefined);
  });
});
