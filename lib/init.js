/**
 * conjoon
 * create-conjoon
 * Copyright (C) 2022-2023 Thorsten Suckow-Homberg https://github.com/conjoon/create-conjoon
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
import got from "got";
import os from "os";
import AdmZip from "adm-zip";


/**
 *
 * @param rootDir
 * @param {Boolean} isExternal true if this script is not used with `npm init @conjoon/conjoon`,
 * but npx create-conjoon directly
 * @returns {Promise<void>}
 */
export default async function init (targetDir, reqName, isExternal) {

    /**
     * Set to true if reqName and targetDir where not specified to make sure
     * required values are confirmed by the user
     * @type {boolean}
     */
    const
        requestInstallType = !(targetDir && reqName),
        siteName = await client.getSiteName(reqName);

    // +--------------------------------------------
    // | 1. require target directory for installation
    // +--------------------------------------------
    const bundleType = await client.getBundleType();
    logger.info`Using "${bundleType}" for installation.`;

    // +--------------------------------------------
    // | 1.1. require target directory for installation
    // +--------------------------------------------
    targetDir = await client.getTargetDir(targetDir, `./${encodeURIComponent(siteName)}`, requestInstallType, bundleType);
    const dest = path.resolve(targetDir);


    // +--------------------------------------------
    // | 1.2. If existing installation was found, try to read out
    // |      config from existing config files of a release only
    // +--------------------------------------------
    let prodConfig;

    // read in exsiting config from a possible existing release built.
    let prodFile = `${dest}/desktop/resources/conjoon.conf.json`;

    if (fs.existsSync(prodFile)) {
        logger.info`Found an existing configuration file at path=${prodFile}.`;
        logger.info`We'll use the information therein to configure a few default values.`;
        prodConfig = fs.existsSync(prodFile) ? fs.readJsonSync(prodFile) : undefined;
    }


    // +--------------------------------------------
    // | 2. choose version
    // +--------------------------------------------
    logger.info`Fetching available versions of name=${"conjoon"} ...`;
    let versions = shell.exec("npm view @conjoon/conjoon versions").stdout, latest;
    versions = JSON.parse(l8.replace("'", "\"", versions));
    latest = versions[versions.length - 1];
    logger.info`Latest release of name=${"conjoon"} is name=${latest}`;

    let version = await client.getVersion(versions);

    const
        debug        = false,
        pkgManager   = "npm",
        {installType, authType, urls}  = requestInstallType
            ? await client.getInstallationInfo(version, prodConfig)
            : {installType: "quick"},
        cdpath = path.relative(".", dest);


    // +--------------------------------------------
    // | 3. create target directory for installation
    // +--------------------------------------------
    let overwriteExistingRelease = false;
    if (bundleType === "release") {
        if (fs.existsSync(dest)) {
            overwriteExistingRelease = await client.confirmOverwriteDir(dest);
            if (overwriteExistingRelease !== true) {
                logger.error`The path path=${dest} already exists. Exiting...`;
                process.exit(1);
            }
        }

    } else {
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
    }


    debug && logger.warn`debug set to name=${"true"}`;
    logger.info`Using subdue=${isExternal ? "external" : "internal"} initializer, resolving paths...`;

    let cwd = fileURLToPath(new URL(`${isExternal ? "" : "../"}../../../`, import.meta.url));

    if (debug === true) {
        cwd = "./";
    }


    if (bundleType === "npm") { // dive into npm install

        // +--------------------------------------------
        // | Download from npm
        // +--------------------------------------------
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
        version = util.getValueFromJsonFileSync(`${source}/package.json`, "version");

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

        util.updateApplicationConfigsSync(dest, {siteName, authType, installType, urls});
        util.updatePackageJsonSync(`${dest}/package.json`, {siteName});

    } else if (bundleType === "release") { // dive into release install

        let devFile, prodFileBackup, devFileBackup, devConfig;

        // +--------------------------------------------
        // | If installatione exist, tmp-save configs.
        // +--------------------------------------------
        if (overwriteExistingRelease === true) {
            logger.info("Fetching current config:...");

            let deleteDest = await client.confirmDelete(dest);
            if (deleteDest !== true) {
                logger.error`User cancelled`;
                process.exit(0);
            }

            const backupPostfix = (new Date()).toDateString().replace(/\s/g, "-");


            devFile = `${dest}/desktop/resources/conjoon.dev.conf.json`;
            prodFileBackup = `${dest}/desktop/resources/conjoon.conf.json.${backupPostfix}`;
            devFileBackup = `${dest}/desktop/resources/conjoon.dev.conf.json.${backupPostfix}`;
            devConfig = fs.existsSync(devFile) ? fs.readJsonSync(devFile) : undefined;

            fs.removeSync(`${dest}`);
        }


        // +--------------------------------------------
        // | Download as release from Github
        // +--------------------------------------------
        // url https://github.com/conjoon/conjoon/releases/download/v1.1.0-beta.0/conjoon.build.refs.tags.v1.1.0-beta.0.zip
        const url = `https://github.com/conjoon/conjoon/releases/download/v${version}/conjoon.build.refs.tags.v${version}.zip`;
        logger.info(`Downloading release: v${version}`);
        const tmpDir = os.tmpdir();
        const zipFile = `${tmpDir}/conjoon.v${version}.zip`;
        const { body } = await got(url, {
            responseType: "buffer"
        });
        fs.writeFileSync(zipFile, body);

        try {
            const zip = new AdmZip(zipFile);
            const outputDir = `${dest}`;
            zip.extractAllTo(outputDir);

            logger.info(`Extracted to "${outputDir}" successfully`);

            if (prodConfig) {
                logger.info`The original contents of ${prodFile} will be backed up at ${prodFileBackup}.`;
                fs.writeJsonSync(prodFileBackup, prodConfig);
            }
            if (devConfig) {
                logger.info`The original contents of ${devFile} will be backed up at ${devFileBackup}.`;
                fs.writeJsonSync(devFileBackup, devConfig);
            }

            util.updateApplicationConfigsSync(`${dest}/desktop`, {siteName, authType, installType, urls});

        } catch (e) {
            logger.error(`Something went wrong. ${e}`);
            process.exit(0);
        }

    }
    

    if (bundleType === "npm") {
        /* eslint-disable */
        logger.success`
        Created name=${cdpath}.
        Inside that directory, you can run several commands:
    
        Run
        code=${`${pkgManager} i`}
        to install the required dependencies. You can then run
    
        code=${`${pkgManager} start`} (Serves this instance locally.)
                                    - or -
        code=${`${pkgManager} run build`} (Bundles your name=${`conjoon`} 
        installation into static files for production.)
    
        We recommend that you start with a production-ready build by typing:
    
        code=${`cd ${cdpath}`}
        code=${`${pkgManager} run stage`}
    
        Make sure to read the documentation at url=${`https://conjoon.org`}.
            
        Happy coding!
    `;
        /* eslint-enable */    
    } else {
        /* eslint-disable */
        logger.success`
        Created name=${cdpath}.
        Inside that directory, you will find an official release build of conjoon.
    
        Make sure to read the documentation at url=${`https://conjoon.org`}.
            
        Happy messaging!
    `;
        /* eslint-enable */
    }
    

    process.exit(0);
}
