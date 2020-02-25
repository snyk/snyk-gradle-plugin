import {ProjectsDict} from './index';
import {DepTree} from '@snyk/cli-interface/legacy/common';

const LOG_LABEL = /^SNYKDEPS\s*/gm;
const DIGRAPH_SEGMENT = /digraph([\s\S]*?)}/g;
const BASE_PROJECT = {
    name: 'no-name',
    version: '0.0.0',
    dependencies: {},
    packageFormatVersion: 'mvn:0.0.1',
};

function extractProject(projectString: string): DepTree {

}

function parseGradle(gradleOutput: string, withDev: boolean): DepTree {
    const cleanOutput: string = gradleOutput.replace(LOG_LABEL, '');
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
