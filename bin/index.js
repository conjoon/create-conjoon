#!/usr/bin/env node

/**
 * conjoon
 * create-conjoon
 * Copyright (C) 2022 Thorsten Suckow-Homberg https://github.com/conjoon/create-conjoon
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


import {program} from "commander";
import path from "path";

program
    .name("create-conjoon")
    .arguments("[name] [rootDir]")
    .description([
        "-------------------------------------------------------",
        "----         [@conjoon/create-conjoon]             ----",
        "----         Create conjoon apps easily            ----",
        "-------------------------------------------------------"
    ].join("\n"))
    .action((name, rootDir) =>
        import("../lib/index.js").then(({default: init}) =>
            init(path.resolve(rootDir ?? "."), name)
        )
    );

program.parse(process.argv);

if (!process.argv.slice(1).length) {
    program.outputHelp();
}

process.on("unhandledRejection", (err) => {
    console.error(err);
    process.exit(1);
});