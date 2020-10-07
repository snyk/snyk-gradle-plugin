import * as chalk from 'chalk';

export function getGradleAttributesPretty(output: string): string | undefined {
  try {
    const lines = output.split('\n');

    if (lines === null) {
      return undefined;
    }
    let jsonLine: string | null = null;
    lines.forEach((l) => {
      const line = l.trim();
      // Extract attribute information via JSONATTRS marker:
      if (/^JSONATTRS /.test(line)) {
        if (jsonLine === null) {
          jsonLine = line.substr(10);
        }
      }
    });

    const jsonAttrs = JSON.parse(jsonLine);
    const attrNameWidth = Math.max(
      ...Object.keys(jsonAttrs).map((name) => name.length),
    );
    const jsonAttrsPretty = Object.keys(jsonAttrs)
      .map(
        (name) =>
          chalk.whiteBright(leftPad(name, attrNameWidth)) +
          ': ' +
          chalk.gray(jsonAttrs[name].join(', ')),
      )
      .join('\n');
    return jsonAttrsPretty;
  } catch (e) {
    return undefined;
  }
}

// <insert a npm left-pad joke here>
function leftPad(s: string, n: number) {
  return ' '.repeat(Math.max(n - s.length, 0)) + s;
}
