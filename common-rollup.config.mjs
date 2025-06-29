// generate mjs file
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
    input: 'src/deps.ts',
    output: {
        dir: 'lib',
        format: 'cjs',
        entryFileNames: '[name].cjs'
    },
    "paths": {
        "node_modules/*": ["node_modules/*"],
    },
    plugins: [
        json(),
        commonjs(),
        nodeResolve(),
        typescript(),
        terser({
            format: {
                comments: 'some',
                beautify: true,
                ecma: '2022',
            },
            compress: false,
            mangle: false,
            module: true,
        })
    ]
};