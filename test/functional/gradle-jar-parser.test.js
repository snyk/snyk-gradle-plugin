var test = require('tap').test;
var parse = require('../../lib/gradle-jar-parser').parse;

test('parse empty text', function (t) {
  t.same(parse(''), [], 'empty list');
  t.end();
});

test('parse normal text', function (t) {
  var text = 'commons-cli-1.1.jar\ncommons-codec-1.6.jar\n';
  var expected = [
    'commons-cli-1.1.jar',
    'commons-codec-1.6.jar',
  ];
  t.same(parse(text), expected, 'jar list');
  t.end();
});

test('parse badly formatted text', function (t) {
  var text = 'Extra\nMore\n commons-cli-1.1.jar \n  commons-codec-1.6.jar  \n';
  var expected = [
    'commons-cli-1.1.jar',
    'commons-codec-1.6.jar',
  ];
  t.same(parse(text), expected, 'jar list');
  t.end();
});
