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
import {execSync as runChild} from "child_process";

/**
 * @param {Boolean} isExternal true if this script is not used with `npm init @conjoon/conjoon`,
 * but npx create-conjoon directly
 * @returns {Promise<void>}
 */
export default async function init (isExternal) {

    /**
     *
     * @type {Object} clientConfig
     * @type {String} clientConfig.installationType
     * @type {String} clientConfig.siteName
     * @type {String} clientConfig.targetDir
     * @type {String} clientConfig.version
     */
    const clientConfig = {};

    const promptForTargetDir = true;

    /**
     * siteName used for this installation. Will be prompted later on,
     * otherwise the siteName of an existing application is used.
     * @type {string}
     */
    clientConfig.siteName = "conjoon";


    // +--------------------------------------------
    // | 1. installationType
    // +--------------------------------------------
    clientConfig.installationType = await client.getInstallationType();
    logger.info`Using "${clientConfig.installationType}" for installation.`;

    // +--------------------------------------------
    // | 2. require target directory for installation
    // +--------------------------------------------
    clientConfig.targetDir = await client.getTargetDir(
        `./${encodeURIComponent(clientConfig.siteName)}`,
        clientConfig.installationType
    );
    clientConfig.targetDir = path.resolve(clientConfig.targetDir);


    // +--------------------------------------------
    // | 3. choose version
    // +--------------------------------------------
    logger.info`Fetching available versions of name=${"conjoon"} ...`;
    // do not list beta releases
    let versions = runChild("npm view @conjoon/conjoon@* version").toString(), latest;
    if (!versions) {
        logger.error`Could not retrieve versions. Exiting...`;
        process.exit(1);
    }
    versions = versions.split("\n").filter(line => !!line).map(line => l8.replace("'", "", line.split(" ")[1]));
    latest = versions[versions.length - 1];
    logger.info`Latest release of name=${"conjoon"} is name=${latest}`;

    clientConfig.version = await client.getVersion(versions);

    const
        debug        = false,
        pkgManager   = "npm",
        cdpath = path.relative(".", clientConfig.targetDir);


    // +--------------------------------------------
    // | 4. create target directory for installation
    // +--------------------------------------------
    let overwriteExistingRelease = false;
    if (clientConfig.installationType === "release") {
        if (fs.existsSync(clientConfig.targetDir)) {
            overwriteExistingRelease = await client.confirmOverwriteDir(clientConfig.targetDir);
            if (overwriteExistingRelease !== true) {
                logger.error`The path path=${clientConfig.targetDir} already exists. Exiting...`;
                process.exit(1);
            }
        }

    } else {
        try {
            if (!fs.existsSync(clientConfig.targetDir)) {
                fs.mkdirSync(clientConfig.targetDir);
            } else {
                logger.error`The path path=${clientConfig.targetDir} already exists. Exiting...`;
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


    if (clientConfig.installationType === "npm") { // dive into npm install

        /**
         * Request the siteName from the user, so the config can be updated
         * accordingly.
         * @type {String}
         */
        clientConfig.siteName = await client.getSiteName();


        // +--------------------------------------------
        // | Download from npm
        // +--------------------------------------------
        logger.info`Running code=${`${pkgManager} i --prefix ${cwd} @conjoon/conjoon@${clientConfig.version}`}`;
        if (shell.exec(`${pkgManager} i --prefix ${cwd} @conjoon/conjoon@${clientConfig.version}`, {
            env: {
                ...process.env,
                ...(supportsColor.stdout ? { FORCE_COLOR: "1" } : {})
            }
        }).code !== 0) {
            logger.error`Installing name=${"conjoon"} failed. We suggest you check for the correct version.`;
            logger.info`Removing path=${clientConfig.targetDir} ...`;
            fs.removeSync(clientConfig.targetDir);
            process.exit(1);
        }

        let source = `${cwd}/node_modules/@conjoon/conjoon`;

        if (!fs.existsSync(source)) {
            logger.error`Target directory path=${source} does not exists.`;
            logger.info`Removing path=${clientConfig.targetDir} and exiting...`;
            fs.removeSync(clientConfig.targetDir);
            process.exit(1);
        }

        logger.info`Copying release name=${`v${clientConfig.version}`} to path=${clientConfig.targetDir}...`;

        fs.copySync(source, clientConfig.targetDir);
        shell.cd(clientConfig.targetDir);
        fs.moveSync(`${clientConfig.targetDir}/package.json`, `${clientConfig.targetDir}/package.json.tmp`);

        logger.info`Installing name=${"webpack"}...`;
        if (debug !== true && shell.exec(`${pkgManager} i --silent --prefix ${clientConfig.targetDir} webpack-dev-server@~3.8.0 webpack-cli@~3.3.6`, {
            env: {
                ...process.env,
                ...(supportsColor.stdout ? { FORCE_COLOR: "1" } : {})
            }
        }).code !== 0) {
            logger.error`Installing name=${"webpack"} failed, but base installation available at path=${cdpath}`;
            process.exit(0);
        }

        logger.info("Cleaning up...");
        fs.removeSync(`${clientConfig.targetDir}/package.json`);
        fs.moveSync(`${clientConfig.targetDir}/package.json.tmp`, `${clientConfig.targetDir}/package.json`);

        logger.info("Updating package information...");

        util.updateApplicationConfigsSync(clientConfig.targetDir, clientConfig);
        util.updatePackageJsonSync(`${clientConfig.targetDir}/package.json`, clientConfig);

    } else if (clientConfig.installationType === "release") { // dive into release install

        let prodFileBackup, devFileBackup, backupDir, backupTmpDir,prodConfig, devConfig, prodFile, devFile;

        // +--------------------------------------------
        // | If installatione exist, tmp-save configs.
        // +--------------------------------------------
        if (overwriteExistingRelease === true) {
            logger.info("Looking for existing configuration...");

            // +--------------------------------------------
            // | 1.2. If existing installation was found, try to read out
            // |      config from existing config files of a release only
            // +--------------------------------------------

            // read in exsiting config from a possible existing release built.
            prodFile = `${clientConfig.targetDir}/desktop/resources/conjoon.conf.json`;
            devFile  = `${clientConfig.targetDir}/desktop/resources/conjoon.dev.conf.json`;

            if (fs.existsSync(prodFile)) {
                logger.info`Found an existing configuration file at path=${prodFile}...`;
                prodConfig = fs.readJsonSync(prodFile);
            }

            if (fs.existsSync(devFile)) {
                logger.info`Found an existing dev-configuration file at path=${devFile}...`;
                devConfig = fs.readJsonSync(devFile);
            }

            // read out version we are overwriting
            const currVersionFile = `${clientConfig.targetDir}/generatedFiles/desktop.json`;
            if (fs.existsSync(currVersionFile)) {
                const backupMarker = fs.readJsonSync(currVersionFile)?.version;
                backupDir = `${clientConfig.targetDir}/_backup/`;
                prodFileBackup = `${backupDir}/conjoon.conf.${backupMarker}.json`;
                devFileBackup = `${backupDir}/conjoon.dev.conf.${backupMarker}.json`;
                backupTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "conjoon"));

                if (fs.existsSync(backupDir)) {
                    fs.copySync(backupDir, backupTmpDir);
                }
            }

            fs.removeSync(`${clientConfig.targetDir}`, { recursive: true });
        } else {
            // if installation did not exist, require the siteName now
            clientConfig.siteName = await client.getSiteName();
        }


        // +--------------------------------------------
        // | Download as release from Github
        // +--------------------------------------------
        // url https://github.com/conjoon/conjoon/releases/download/v1.1.0-beta.0/conjoon.build.refs.tags.v1.1.0-beta.0.zip
        const url = `https://github.com/conjoon/conjoon/releases/download/v${clientConfig.version}/conjoon.build.refs.tags.v${clientConfig.version}.zip`;
        logger.info(`Downloading release: v${clientConfig.version}`);
        const tmpDir = os.tmpdir();
        const zipFile = `${tmpDir}/conjoon.v${clientConfig.version}.zip`;
        let response;
        try {
            response = await got(url, {
                responseType: "buffer"
            });
        } catch (e) {
            logger.error(`Downloading release: v${clientConfig.version} failed, please check that ${url} still exists.`);
            process.exit(1);
        }
        fs.writeFileSync(zipFile, response.body);

        try {
            const zip = new AdmZip(zipFile);
            const outputDir = `${clientConfig.targetDir}`;
            zip.extractAllTo(outputDir);

            logger.info(`Extracted to "${outputDir}" successfully`);

            if (fs.existsSync(backupTmpDir)) {
                fs.copySync(backupTmpDir, backupDir);
            }

            if (prodConfig || devConfig) {
                if (devConfig) {
                    logger.info`Creating backup for ${devFile}`;
                    !fs.existsSync(backupDir) && fs.mkdirSync(backupDir);
                    fs.writeJsonSync(devFileBackup, devConfig);
                    logger.info`... backup available at ${devFileBackup}.`;
                    util.mergeDevConfigSync(`${clientConfig.targetDir}/desktop`, devConfig);
                }

                if (prodConfig) {
                    logger.info`Creating backup for ${prodFile}`;
                    !fs.existsSync(backupDir) && fs.mkdirSync(backupDir);
                    fs.writeJsonSync(prodFileBackup, prodConfig);
                    logger.info`... backup available at ${prodFileBackup}.`;
                    util.mergeProdConfigSync(`${clientConfig.targetDir}/desktop`, prodConfig);
                }
            } else {
                util.updateApplicationConfigsSync(`${clientConfig.targetDir}/desktop`, clientConfig);
            }
        } catch (e) {
            logger.error(`Something went wrong. ${e}`);
            process.exit(0);
        }

        if (fs.existsSync(backupTmpDir)) {
            fs.removeSync(backupTmpDir, { recursive: true });
        }
    }
    

    if (clientConfig.installationType === "npm") {
        /* eslint-disable */
        logger.success`
        Created name=${cdpath}.
        We recommend you get your development environment up and running with 
    
        code=${`cd ${cdpath}`}
        code=${`${pkgManager} i`}
        
        to install the required dependencies.
        You can then run several commands:
    
        code=${`${pkgManager} start`}:
         - serves this instance locally
                                   
        code=${`${pkgManager} run build`}: 
         - bundles your name=${`conjoon`} installation into static files 
           for production, followed by
    
        code=${`${pkgManager} run stage`}
        to serve a production build locally.
         
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
