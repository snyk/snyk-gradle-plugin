import {ProjectsDict} from './index';
import {DepTree} from '@snyk/cli-interface/legacy/common';

const LOG_LABEL = /^SNYKDEPS\s*/gm;
const DIGRAPH_SEGMENT = /digraph\W([\s\S]*?)/;
const GRADLE_DEP = /(.+):(.+):(.+):(.+)/m;
const ARROW_SEPARATOR = '->';
const BASE_PROJECT = {
    name: 'no-name',
    version: '0.0.0',
    dependencies: {},
    packageFormatVersion: 'mvn:0.0.1',
};

function depTreeFromGradleString(s: string): DepTree {
    const pkgMeta: RegExpMatchArray | null = s.match(GRADLE_DEP);

    // 0 -> package name
    // 1 -> also package name?
    // 2 -> just "jar" string
    // 3 -> version
    // 4 -> just "runtime" string

    return  {
            name: pkgMeta![1] + ':' + pkgMeta![2],
            version: pkgMeta![4],
            dependencies: {},
        } as DepTree;
}

function extractProject(projectString: string): DepTree {

    // Grade project struct looks like "<project meta> { ..... }"
    // So we want the " .... "
    const depsStart = projectString.indexOf('{');
    const depsEnd =  projectString.indexOf('}');
    const project: DepTree = depTreeFromGradleString(projectString
        .substring(0, depsStart));

    const projectDepsAsRows = projectString
        .substring( depsStart + 1, depsEnd)
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);

    // console.log({projectDepsAsRows});
    const depTrees = projectDepsAsRows
        .map((row) => row.split(ARROW_SEPARATOR).map((t) => t.trim()))
        .reduce((acc, dep) => {
        console.log(dep);
        return acc;
    }, {});
    // const deps = projectDepsAsRows
    //     .map((depRow) => {
    //         const innerDeps = depRow
    //             .split(ARROW_SEPARATOR);
    //         // console.log({innerDeps});
    //     });
    // project.dependencies = deps;

    // console.log({deps});
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
            const pkg: DepTree = extractProject(projectString);
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
