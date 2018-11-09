var cloneDeep = require('clone-deep');

module.exports = {
  parse: parse,
};

function parse(text) {
  var data = processGradleOutput(text);
  var depArray = createTree(data.lines, data.omittedDeps);
  fillOmittedDependencies(depArray, data.omittedDeps);
  var depTree = convertNodeArrayToObject(depArray);
  return depTree;
}

function processGradleOutput(text) {
  var omittedDeps = {};
  var lines = text.split('\n')
    .filter(function (element) {
    // filter out stuff that isn't dependencies
      return element.indexOf('\\---') !== -1 ||
      element.indexOf('+---') !== -1 ||
      element === '';
    })
    .reduce(function (acc, element) {
    // only return the first configuration, in case there are multiple
      if (acc.done) {
        return acc;
      }
      if (element === '') {
        if (acc.length > 0) {
          acc.done = true;
        }
        return acc;
      }
      acc.push(element);
      return acc;
    }, [])
    .filter(function (element) {
    // filter out FAILED dependencies
      return element.match(/ FAILED$/) === null;
    })
    .map(function (element) {
    // remove all hierarchy markings, but keep the hierarchy structure
      element = element
        .replace(/\|/g, ' ')          // remove pipe symbol
        .replace(/\\/g, '+')          // convert all prefixes to '+---'
        .replace(/\+\-\-\-/g, '    ') // remove all prefixes
        .replace(/     /g, ' ');      // convert each 5 spaces to 1 space
      // update the element with its resolved version, if exists
      var elementParts = element.split(' -> ');
      if (elementParts.length > 1) {
        var partialCoordinate = elementParts[0];
        var resolvedVersion = elementParts[1];
        if (partialCoordinate.split(':').length === 2) {
          // No version in partialCoordinate: org.example:foo
          element = partialCoordinate + ':' + resolvedVersion;
        } else {
          // Has version to replace: org.example:foo:1.2.3
          element = element.replace(/[^:]*$/, resolvedVersion);
        }
      }
      // mark omitted dependencies for later review,
      // and remove the '(*)' at the end of the element
      var omitStarSplit = element.split(' (*)');
      if (omitStarSplit.length > 1) {
        element = omitStarSplit[0];
        var parts = element.split(':');
        // omittedDeps key is 'groupId:artifactId' (without the version)
        omittedDeps[parts[0].trim() + ':' + parts[1]] = true;
      }

      // trim (n) - Not resolved (configuration is not meant to be resolved)
      element = element.split(' (n)')[0];

      return element;
    });
  return {
    lines: lines,
    omittedDeps: omittedDeps,
  };
}

function getIndent(line) {
  if (line) {
    return line.match(/^\s*/)[0].length;
  }
  return 0;
}

function getElementAsObject(element) {
  if (!element) {
    return null;
  }
  var elementParts = element.trim().split(':');
  var groupId = elementParts[0];
  var artifactId = elementParts[1];
  var version = elementParts[2];
  return {
    version: version,
    name: groupId + ':' + artifactId,
    // array is required to keep the order for omitted deps,
    // will be converted to object after processing
    dependencies: [],
  };
}

function getSubTreeLines(lines, parentIndent) {
  var subTreeLines = [];
  for (var i = 0; i < lines.length; i++) {
    if (getIndent(lines[i]) <= parentIndent) {
      return subTreeLines;
    }
    subTreeLines.push(lines[i]);
  }
  return subTreeLines;
}

function cloneOmittedDependencies(node, omittedDeps) {
  var clonedDeps = cloneDeep(omittedDeps[node.name]);
  return clonedDeps;
}

// deep-clone a node's dependencies
function cloneDependencies(node, omittedDeps) {
  var clonedDeps = cloneDeep(node.dependencies);
  fillOmittedDependencies(clonedDeps, omittedDeps);
  return clonedDeps;
}

function createTree(lines, omittedDeps) {
  if (lines.length === 0) {
    return [];
  }
  var array = [];
  var currentLine = lines.shift();
  var currentIndent = getIndent(currentLine);
  var current = getElementAsObject(currentLine);
  array.push(current);

  var nextLine = lines[0];
  var nextIndent;
  var next;
  while (nextLine) {
    nextIndent = getIndent(nextLine);
    if (nextIndent === currentIndent) {
      next = getElementAsObject(lines[0]);
      array.push(next);
      lines.shift();
    } else if (nextIndent > currentIndent) {
      next = getElementAsObject(lines[0]);
      var subTreeLines = getSubTreeLines(lines, currentIndent);
      lines.splice(0, subTreeLines.length);
      current.dependencies = createTree(subTreeLines, omittedDeps);
    }
    if (omittedDeps[current.name] === true) {
      // we have an omitted dependency somewhere
      // create a clean copy of the current dependency and store it for later
      omittedDeps[current.name] = cloneDependencies(current, omittedDeps);
    }
    current = next;
    currentIndent = nextIndent;
    nextLine = lines[0];
  }
  return array;
}

function fillOmittedDependencies(nodes, omittedDeps) {
  if (nodes === null) {
    return;
  }
  nodes.map(function (node) {
    if (typeof omittedDeps[node.name] === 'object') {
      node.dependencies = cloneOmittedDependencies(node, omittedDeps);
      return;
    }
    fillOmittedDependencies(node.dependencies, omittedDeps);
  });
}

// convert all dependencies from arrays to objects
function convertNodeArrayToObject(nodeArray) {
  return nodeArray.reduce(function (acc, element) {
    element.dependencies = convertNodeArrayToObject(element.dependencies);
    acc[element.name] = element;
    return acc;
  }, {});
}
