import {ProjectsDict} from './index';
import {DepTree} from '@snyk/cli-interface/legacy/common';

const LOG_LABEL = /^SNYKDEPS\s*/gm;
const DIGRAPH_SEGMENT = /digraph\W([\s\S]*?)/;
const GRADLE_DEP = /(.+):(.+):(.+):(.+)/m;
const ARROW_SEPARATOR = /->/g;
const BASE_PROJECT = {
    name: 'no-name',
    version: '0.0.0',
    dependencies: {},
    packageFormatVersion: 'mvn:0.0.1',
};

function depTreeFromGradleString(s: string): DepTree {
    const projectMeta: RegExpMatchArray | null = s.match(GRADLE_DEP);
    return {
        name: projectMeta![1] + ':' + projectMeta![3],
        version: projectMeta![4],
        dependencies: {},
    } as DepTree;
}

function extractProject(projectString: string): DepTree {

    const project: DepTree = depTreeFromGradleString(projectString
        .substring(0, projectString.indexOf('{')));

    const projectDeps = projectString
        .substring(projectString.indexOf('{') + 1, projectString.indexOf('}'));
    const projectRows: string[] = projectString
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);

    // 0 -> package name
    // 1 -> also package name?
    // 2 -> just "jar" string
    // 3 -> version
    // 4 -> just "runtime" string
    // const projectMeta: RegExpMatchArray | null = projectRows[0]
    //     .match(GRADLE_DEP);

    return project;

}

function parseGradle(gradleOutput: string, withDev: boolean): DepTree {
    const projectsSplit: string[] = gradleOutput
        .replace(LOG_LABEL, '')
        .replace(/[;"]/g, '')
        .split(DIGRAPH_SEGMENT)
        .filter((t: string = '') => t.trim().length);

    if (!projectsSplit.length) {
        throw Error('No projects found');
    }
    const root: DepTree = extractProject(`${projectsSplit.shift()}`);

    projectsSplit
        .forEach((projectString: string) => {
            const pkg: DepTree = {};
            if (pkg && pkg.name) {
                root.dependencies![pkg.name] = pkg;
            }
        });
    return root;
}

export function parseTree(gradleOutput: string, withDev: boolean): { ok: boolean, data: ProjectsDict } {
    return {
        ok: true,
        data: parseGradle(gradleOutput, withDev) as ProjectsDict,
    };
}
