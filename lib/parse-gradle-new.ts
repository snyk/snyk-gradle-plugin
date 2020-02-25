import {ProjectsDict} from './index';
import {DepTree} from '@snyk/cli-interface/legacy/common';

const LOG_LABEL = /^SNYKDEPS\s*/gm;
const DIGRAPH_SEGMENT = /digraph([\s\S]*?)}/g;
const GRADLE_DEP = /(\S+):(\S+):(\S+):(\S+):(\S+)/gmi;
const BASE_PROJECT = {
    name: 'no-name',
    version: '0.0.0',
    dependencies: {},
    packageFormatVersion: 'mvn:0.0.1',
};

function extractProject(projectString: string): DepTree {

    // 0 -> package name
    // 1 -> also package name?
    // 2 -> just "jar" string
    // 3 -> version
    // 4 -> just "runtime" string
    const projectSplit: string[] = projectString.split(GRADLE_DEP);
    const packageName: string = `${projectSplit[0]}:${projectSplit[1]}`;
    const packageVersion: string = projectSplit[3];

}

function parseGradle(gradleOutput: string, withDev: boolean): DepTree {
    const cleanOutput: string = gradleOutput
        .replace(LOG_LABEL, '')
        .replace('"', '');

    const projectsSplit: string[] = cleanOutput.split(DIGRAPH_SEGMENT);
    if (!projectsSplit.length) {
        throw Error('No projects found');
    }

    const root: DepTree = {
        ...BASE_PROJECT,
        ...extractProject(`${projectsSplit.shift()}`),
    };

    projectsSplit.forEach((projectString: string) => {
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
