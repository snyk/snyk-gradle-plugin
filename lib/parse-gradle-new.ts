import {ProjectsDict} from './index';
import {DepTree, DepTreeDep} from '@snyk/cli-interface/legacy/common';

const LOG_LABEL = /^SNYKDEPS\s*/gm;
const DIGRAPH_SEGMENT = /digraph\W([\s\S]*?)/;
const GRADLE_DEP = /([^:]+):([^:]+):([^:]+):([^:]+)(?:([^:]+))?/m;
const ARROW_SEPARATOR = '->';

function depTreeFromGradleString(s: string): DepTreeDep {
    const pkgMeta: RegExpMatchArray | string[] = s.match(GRADLE_DEP) || [];

    // 0 matches
    // 1 -> package name
    // 2 -> also package name?
    // 3 -> just "jar" string
    // 4 -> version
    // 5 -> just "runtime" string
    return {
        name: pkgMeta![1] + ':' + pkgMeta![2],
        version: pkgMeta![4],
        dependencies: {},
    } as DepTree;
}

function extractProject(projectString: string): DepTreeDep {

    // Grade project struct looks like "<project meta> { ..... }"
    // So we want the " .... "
    const depsStart = projectString.indexOf('{');
    const depsEnd = projectString.indexOf('}');
    const project: DepTree = depTreeFromGradleString(projectString
        .substring(0, depsStart));

    const projectDepsAsRows = projectString
        .substring(depsStart + 1, depsEnd)
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);

    projectDepsAsRows
        .map((row) => row
            .split(ARROW_SEPARATOR)
            .map(depTreeFromGradleString)
            .reverse() // We reverse the order to build it bottom-up
            .reduce((tree, curr) => {
                if (!tree) { // first case we return the tree, other-wise his parent
                    return tree;
                }
                curr.dependencies![tree.name!] = tree;
                return curr;
            }), {})
        .forEach((tree) => {
            project.dependencies![tree.name!] = tree;
        });
    return project;
}

function parseGradle(gradleOutput: string): DepTree {
    const projectsSplit: string[] = gradleOutput
        .replace(LOG_LABEL, '')
        .replace(/[;"]/g, '')
        .split(DIGRAPH_SEGMENT)
        .filter((t= '') => t.trim().length);

    if (!projectsSplit.length) {
        throw Error('No projects found');
    }
    const root: DepTree = extractProject(`${projectsSplit.shift()}`);

    projectsSplit
        .forEach((projectString: string) => {
            const pkg: DepTree = extractProject(projectString);
            root.dependencies![pkg.name!] = pkg;
        });
    return root;
}

export function parseTree(gradleOutput: string): { ok: boolean, data: ProjectsDict } {
    return {
        ok: true,
        data: parseGradle(gradleOutput) as ProjectsDict,
    };
}
