import * as fs from 'fs';
import * as path from 'path';
import {parseTree} from '../../lib/parse-gradle-new';

describe('Gradle output to depgraph suite',  () => {
    it('should ', () => {
        const dump = fs.readFileSync(path.join(__dirname, 'graph.txt'), 'utf-8');
        console.log(parseTree(dump, true));
    });
});
