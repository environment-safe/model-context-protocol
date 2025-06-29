model-context-protocol
======================
[`model-context-protocol`]](https://modelcontextprotocol.io/specification/) is a specification by anthropic for providing external services to an AI to be used in agent flows and is widespread in agent tooling. 

Without a needless digression into the merits of typescript, the powers that be made it impossible to generate both a CJS and an MJS file from a single .ts file (you *must* fork the source to provide legacy support in the server) and they standardized *not* publishing the executable dist to source control (you *must* compile to have executable source in the repo). Because the overall goal of the `environment-safe` project is to preserve source-first executability in Javascript while adding multi-target testability (where source from a server or a repo is just as vaild as a module link), this is not a viable path for us, so we do this.

Eventually this may be it's own implementation backed by [@environment-safe/server](https://github.com/environment-safe/server) but for now we're just wrapping [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)

Usage
-----
TBD

Testing
-------

Run the es module tests to test the root modules
```bash
npm run import-test
```
to run the same test inside the browser:

```bash
npm run browser-test
```
to run the same test headless in chrome:
```bash
npm run headless-browser-test
```

to run the same test inside docker:
```bash
npm run container-test
```

Run the commonjs tests against the `/dist` commonjs source (generated with the `build-commonjs` target).
```bash
npm run require-test
```

Development
-----------
All work is done in the .mjs files and will be transpiled on commit to commonjs and tested.

If the above tests pass, then attempt a commit which will generate .d.ts files alongside the `src` files and commonjs classes in `dist`

