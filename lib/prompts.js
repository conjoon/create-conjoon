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

import logger from "@docusaurus/logger";
import prompts from "prompts";
import shell from "shelljs";
import fs from "fs-extra";
import path from "path";
import semver from "semver";
import {execSync as runChild} from "child_process";

/**
 * This file exports the prompts required for gathering installation info
 * for a conjoon-drop.
 */


const userCancelled = () => {
    logger.error("User cancelled.");
    process.exit(1);
}

/**
 * Will prompt for the version of conjoon to install.
 *
 * @param {Array} versions An array of versions available with the release
 * channel selected by the client.
 * @param {Array} allVersions all versions available across stable and
 * prerelease channel
 *
 * @return {String} version
 */
export async function getVersion (versions) {
    async function validateVersion (version) {
        if (!version) {
            return "A version is required.";
        }

        logger.info`Getting info for required version name=${`@conjoon/conjoon@${version}`}...`;
        const exists = (runChild(`npm view @conjoon/conjoon@${version}`)).toString();

        if (!exists) {
            return `Could not find version ${version}!`;
        }
        return true;
    }

    const { version } = await prompts([{
        type: "select",
        name: "version",
        message: "Which version should be used for this installation?",
        choices: versions.slice(Math.max(0, versions.length - 5)).map(
            v => ({title: v, value: v})
        ).reverse().concat(
            {title: "<enter manually>", value: "manual"}
        ),
        initial: 0,
        validate: validateVersion
    }, {
        type: prev => prev === "manual" ? "text" : null,
        name: "version",
        message: "Enter required Version",
        validate: validateVersion
    }], {
        onCancel: userCancelled
    });

    return version;
}

export async function getInstallationType () {

    const {installationType} = await prompts([{
        type: "select",
        name: "installationType",
        message: "Please select the installation type.",
        choices: [{
            title: logger.interpolate`pre-built release subdue=${"(release)"}`,
            value: "release"
        }, {
            title: logger.interpolate`development environment subdue=${"(npm)"}`,
            value: "npm"
        }],
        initial: 0
    }], {
        onCancel: userCancelled
    });


    return installationType;
}


/**
 * Requests the target dir.
 *
 * @param {String} defaultTarget The default target if reqDir is not specified.
 * @param {String} installationType npm/release. Will not warn if directory exists when installationType is "release"
 *
 * @returns {Promise<void>}
 */
export async function getTargetDir (defaultTarget, installationType) {

    async function validateDir (dir) {
        if (!dir) {
            return "A target directory is required.";
        }

        if (installationType !== "release") {
            const dest = path.resolve(dir);
            if (await fs.pathExists(dest)) {
                return  `Directory already exists at path=${dest}! Please delete the directory first, or chose another one.`;
            }
        }

        return true;
    }

    const { targetDir } = await prompts({
        type: "text",
        name: "targetDir",
        message: "Please specify the target folder for this installation",
        initial: defaultTarget,
        validate: validateDir
    }, {
        onCancel: userCancelled
    });

    return targetDir;

}


/**
 * Requests site name for this installation.
 *
 * @return {String}
 */
export async function getSiteName () {
    async function validateSiteName (siteName) {
        if (!siteName) {
            return "A name is required.";
        }
        return true;
    }

    const { siteName } = await prompts({
        type: "text",
        name: "siteName",
        message: "What should we name this installation?",
        initial: "conjoon",
        validate: validateSiteName
    }, {
        onCancel: userCancelled
    });

    return siteName;
}

export async function confirmOverwriteDir (dest) {

    const { overwrite } = await prompts({
        type: "confirm",
        name: "overwrite",
        message: `Okay to overwrite the existing path ${dest}?`,
        initial: true
    }, {
        onCancel: userCancelled
    });

    return overwrite;
}

