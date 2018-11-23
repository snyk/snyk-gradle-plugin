var test = require('tap-only');
var parse = require('../../lib/gradle-plugin-parser').parse;

test('parse empty text', function (t) {
  t.same(parse(''), [], 'empty list');
  t.end();
});

test('parse normal text', function (t) {
  var text = `org.gradle.api.plugins.HelpTasksPlugin@1517f633
org.gradle.language.base.plugins.LifecycleBasePlugin@5560bcdf
org.gradle.api.plugins.BasePlugin@6d9fb2d1
org.gradle.api.plugins.ReportingBasePlugin@f2ce6b
org.gradle.platform.base.plugins.ComponentBasePlugin@40298285
org.gradle.language.base.plugins.LanguageBasePlugin@5bcb04cb
org.gradle.platform.base.plugins.BinaryBasePlugin@21d1b321
org.gradle.api.plugins.JavaBasePlugin@b25b095
org.gradle.api.plugins.JavaPlugin@2f37f1f9
org.gradle.api.plugins.quality.CheckstylePlugin@15639440`;

  var expected = [
    'org.gradle.api.plugins.HelpTasksPlugin@1517f633',
    'org.gradle.language.base.plugins.LifecycleBasePlugin@5560bcdf',
    'org.gradle.api.plugins.BasePlugin@6d9fb2d1',
    'org.gradle.api.plugins.ReportingBasePlugin@f2ce6b',
    'org.gradle.platform.base.plugins.ComponentBasePlugin@40298285',
    'org.gradle.language.base.plugins.LanguageBasePlugin@5bcb04cb',
    'org.gradle.platform.base.plugins.BinaryBasePlugin@21d1b321',
    'org.gradle.api.plugins.JavaBasePlugin@b25b095',
    'org.gradle.api.plugins.JavaPlugin@2f37f1f9',
    'org.gradle.api.plugins.quality.CheckstylePlugin@15639440',
  ];
  t.same(parse(text), expected, 'plugin list');
  t.end();
});

test('parse badly formatted text', function (t) {
  var text = `:listAllPlugins
org.gradle.api.plugins.HelpTasksPlugin@1517f633
org.gradle.language.base.plugins.LifecycleBasePlugin@5560bcdf
org.gradle.api.plugins.BasePlugin@6d9fb2d1
org.gradle.api.plugins.ReportingBasePlugin@f2ce6b
org.gradle.platform.base.plugins.ComponentBasePlugin@40298285
org.gradle.language.base.plugins.LanguageBasePlugin@5bcb04cb
org.gradle.platform.base.plugins.BinaryBasePlugin@21d1b321
org.gradle.api.plugins.JavaBasePlugin@b25b095
org.gradle.api.plugins.JavaPlugin@2f37f1f9
org.gradle.api.plugins.quality.CheckstylePlugin@15639440

BUILD SUCCESSFUL

Total time: 3.62 secs

This build could be faster, please consider using the Gradle Daemon: https://docs.gradle.org/2.14.1/userguide/gradle_daemon.html`;

  var expected = [
    'org.gradle.api.plugins.HelpTasksPlugin@1517f633',
    'org.gradle.language.base.plugins.LifecycleBasePlugin@5560bcdf',
    'org.gradle.api.plugins.BasePlugin@6d9fb2d1',
    'org.gradle.api.plugins.ReportingBasePlugin@f2ce6b',
    'org.gradle.platform.base.plugins.ComponentBasePlugin@40298285',
    'org.gradle.language.base.plugins.LanguageBasePlugin@5bcb04cb',
    'org.gradle.platform.base.plugins.BinaryBasePlugin@21d1b321',
    'org.gradle.api.plugins.JavaBasePlugin@b25b095',
    'org.gradle.api.plugins.JavaPlugin@2f37f1f9',
    'org.gradle.api.plugins.quality.CheckstylePlugin@15639440',
  ];
  t.same(parse(text), expected, 'plugin list');
  t.end();
});
