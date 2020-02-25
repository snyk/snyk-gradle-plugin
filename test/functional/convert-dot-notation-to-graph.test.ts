/* tslint:disable:forin */
import * as fs from 'fs';
import * as path from 'path';
import {test} from 'tap';

function dotNotationToTree(o: object): object {
    const oo = {} as object;
    let t: object;
    let parts: string[];
    let part: string;
    Object
        .keys(o)
        .forEach((k: string) => {
            t = oo;
            parts = k.split('.');
            const key = parts.pop();
            while (parts.length) {
                part = parts.shift() + '';
                t[part] = t[part] || {};
                t = t[part];
            }
            t[key] = o[k];
        });
    return oo;
}

test('a', async (t) => {
    const dump = fs.readFileSync('./graph.txt');
    console.log(dump);
});
