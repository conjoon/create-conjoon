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

/**
 * This script was inspired by the great work of the docusaurus-team over at facebook/meta!
 */

import fs from "fs-extra";
import path from "path";
import shell from "shelljs";
import supportsColor from "supports-color";
import l8 from "@l8js/l8";
import { fileURLToPath } from "url";
import logger from "@docusaurus/logger";
import * as client from "./prompts.js";
import * as util from "./utils.js";

/**
 *
 * @param rootDir
 * @param {Boolean} isExternal true if this script is not used with `npm init @conjoon/conjoon`,
 * but npx create-conjoon directly
 * @returns {Promise<void>}
 */
export default async function init (rootDir, isExternal) {
    const
        debug        = false,
        pkgManager   = "npm",
        siteName     = await client.getSiteName("", rootDir),
        {installType, urls}  = await client.getInstallationInfo(),
        dest         = path.resolve(rootDir, encodeURIComponent(siteName)),
        cdpath       = path.relative(".", dest);

    try {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        } else {
            logger.error`The path path=${dest} already exists. Exiting...`;
            process.exit(1);
        }
    } catch (err) {
        logger.error(err);
        process.exit(1);
    }

    debug && logger.warn`debug set to name=${"true"}`;
    logger.info`Created path=${dest} for new installation of name=${siteName} ...`;
    logger.info`Using subdue=${isExternal ? "external" : "internal"} initializer, resolving paths...`;
    logger.info`Fetching available versions of name=${"conjoon"} ...`;

    let versions = shell.exec("npm view @conjoon/conjoon versions").stdout, latest;

    versions = versions.split("', ").map(v => l8.replace(["[", "'", "]"], "", v).trim());
    latest = versions[versions.length - 1];

    logger.info`Latest release of name=${"conjoon"} is name=${latest}`;

    if (installType === "quick") {
        logger.info`Using name=${latest} for installation.`;
    }

    let version = installType === "quick" ? latest : await client.getVersion(versions),
        cwd = fileURLToPath(new URL(`${isExternal ? "" : "../"}../../../`, import.meta.url));

    if (debug === true) {
        cwd = "./";
    }


    logger.info`Running code=${`${pkgManager} i --prefix ${cwd} @conjoon/conjoon@${version}`}`;
    if (shell.exec(`${pkgManager} i --prefix ${cwd} @conjoon/conjoon@${version}`, {
        env: {
            ...process.env,
            ...(supportsColor.stdout ? { FORCE_COLOR: "1" } : {})
        }
    }).code !== 0) {
        logger.error`Installing name=${"conjoon"} failed. We suggest you check for the correct version.`;
        logger.info`Removing path=${dest} ...`;
        fs.removeSync(dest);
        process.exit(1);
    }

    let source = `${cwd}/node_modules/@conjoon/conjoon`;

    if (!fs.existsSync(source)) {
        logger.error`Target directory path=${source} does not exists.`;
        logger.info`Removing path=${dest} and exiting...`;
        fs.removeSync(dest);
        process.exit(1);
    }

    version = await util.getValueFromJsonFile(`${source}/package.json`, "version");

    logger.info`Copying release name=${`v${version}`} to path=${dest}...`;

    fs.copySync(source, dest);
    shell.cd(dest);
    fs.moveSync(`${dest}/package.json`, `${dest}/package.json.tmp`);

    logger.info`Installing name=${"webpack"}...`;
    if (debug !== true && shell.exec(`${pkgManager} i --silent --prefix ${dest} webpack-dev-server@~3.8.0 webpack-cli@~3.3.6`, {
        env: {
            ...process.env,
            ...(supportsColor.stdout ? { FORCE_COLOR: "1" } : {})
        }
    }).code !== 0) {
        logger.error`Installing name=${"webpack"} failed, but base installation available at path=${cdpath}`;
        process.exit(0);
    }

    logger.info("Cleaning up...");
    fs.removeSync(`${dest}/package.json`);
    fs.moveSync(`${dest}/package.json.tmp`, `${dest}/package.json`);

    logger.info("Updating package information...");

    await util.updateApplicationConfigs(dest, {siteName, installType, urls});
    await util.updatePackageJson(`${dest}/package.json`, {siteName});

    /* eslint-disable */
    logger.success`
        Created name=${cdpath}.
        Inside that directory, you can run several commands:
    
        code=${`${pkgManager} start`}
        Starts the development server.
    
        code=${`${pkgManager} run build`}
        Bundles your name=${`conjoon`} installation into static files for production.
    
        We recommend that you begin by typing:
    
        code=${`cd ${cdpath}`}
        code=${`${pkgManager} run stage`}
    
        Make sure to read the documentation at url=${`https://conjoon.org`}.
            
        Happy coding!
    `;
    /* eslint-enable */

    process.exit(0);
}
