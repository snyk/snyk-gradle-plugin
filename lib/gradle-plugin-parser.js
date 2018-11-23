module.exports = {
  parse: parse,
};

function parse(text) {
  var pluginRe = /^[a-zA-Z0-9_\-\.]+@[0-9a-f]+$/;
  if (text && text.length) {
    return text.split('\n')
      .map(trim)
      .filter(function (line) {
        return pluginRe.test(line);
      });
  }
  return [];
}

function trim(text) {
  // String.trim not available in es3
  // see: https://goo.gl/EH6gh4
  return text.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
}
