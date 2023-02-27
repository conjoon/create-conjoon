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

        logger.info`\nGetting info for required version name=${`@conjoon/conjoon@${version}`}...`;
        const exists = (runChild(`npm view @conjoon/conjoon@${version}`)).toString();
        console.log(exists);
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

export async function getBundleType () {

    const {bundleType} = await prompts([{
        type: "select",
        name: "bundleType",
        message: "Please select the bundle type.",
        choices: [{
            title: logger.interpolate`Pre-built release for immediate deploying subdue=${"(release)"}`,
            value: "release"
        }, {
            title: logger.interpolate`npm-Package providing build-options and development tools subdue=${"(npm)"}`,
            value: "npm"
        }],
        initial: 0
    }], {
        onCancel: userCancelled
    });


    return bundleType;
}

/**
 * Requests the install type of the user. Can either be
 * "quick" or "custom". If custom, continues with selecting necessary
 * information, such as the urls where the service endpoints are found, and auth packagea used.
 *
 * @param {String} version
 * @param {Object} defaultConfig An object of an existing default configuration to apply
 *
 * @return {Object} data
 * @return {String} data.installType "quick" or "custom"
 * @return {!Object} data.urls
 * @return {String} data.urls.email
 * @return {String} data.urls.auth
 */
export async function getInstallationInfo (version, defaultConfig) {

    const authTypeOptions = [{
        title: logger.interpolate`extjs-app-imapuser subdue=${"(sign in at remote IMAP server)"}`,
        value: "extjs-app-imapuser"
    }];

    if (semver.gte(version, "1.0.4")) {
        authTypeOptions.push({
            title: logger.interpolate`extjs-app-localmailaccount subdue=${"(Mail Accounts in browser's Local Storage)"}`,
            value: "extjs-app-localmailaccount"
        });
    }

    const { installType, authType, urlAuth, urlEmail} = await prompts([{
        type: "select",
        name: "installType",
        message: "Please select the type of installation.",
        choices: [{
            title: logger.interpolate`Quick subdue=${"(with demo data)"}`,
            value: "quick"
        }, {
            title: logger.interpolate`Custom subdue=${"(requires backend, e.g. lumen-app-email)"}`,
            value: "custom"
        }],
        initial: 0
    }, {
        type: prev => prev === "custom" ? "select" : null,
        name: "authType",
        message: "Please select the Authentication Package used with this installation.",
        choices: authTypeOptions,
        initial: defaultConfig?.conjoon?.packages["extjs-app-imapuser"]?.disabled === true ? 1 : 0
    }, {
        type: prev => prev === "extjs-app-imapuser" ? "text" : null,
        name: "urlAuth",
        message: "Base URL for auth",
        initial: defaultConfig?.conjoon?.packages["extjs-app-imapuser"]?.config?.service["rest-imapuser"]?.base
            || "https://ddev-ms-email.ddev.site/rest-imapuser/v0",
        validate: value => !value ? "URL required" : true
    }, {
        type: prev => prev === "quick" ? null : "text",
        name: "urlEmail",
        message: "Base URL for rest-api-email",
        initial: defaultConfig?.conjoon?.packages["extjs-app-webmail"]?.config?.service["rest-api-email"]?.base
            || "https://ddev-ms-email.ddev.site/rest-api-email/v0",
        validate: value => !value ? "URL required" : true
    }], {
        onCancel: userCancelled
    });

    let data = {installType, authType};

    if (installType === "custom") {
        data = Object.assign(data, {
            urls: {
                email: urlEmail,
                auth: urlAuth
            }
        });
    }

    return data;
}


/**
 * Requests the target dir of the user, if reqDir contains an invalid value.
 *
 * @param {String} reqDir The dir where conjoon should be installed to.
 * @param {String} defaultTarget The default target if reqDir is not specified.
 * @param {Boolean} promptForTargetDir if set to true, will not automatically use reqDir or
 * defaultTarget (if available) and instead show a prompt and verify the defaultTarget
 * from the user
 * @param {String} bundleType npm/release. Will not warn if directory exists when bundleType is "release"
 *
 * @returns {Promise<void>}
 */
export async function getTargetDir (reqDir, defaultTarget, promptForTargetDir, bundleType) {

    let prompt = promptForTargetDir;
    async function validateDir (dir) {
        if (!dir) {
            return "A target directory is required.";
        }

        if (bundleType !== "release") {
            const dest = path.resolve(dir);
            if (await fs.pathExists(dest)) {
                return logger.error`Directory already exists at path=${dest}!`;
            }
        }

        return true;
    }

    if (reqDir && !prompt) {
        const res = await validateDir(reqDir);
        if (typeof res === "string") {
            throw new Error(res);
        }
        return reqDir;
    }

    if (defaultTarget && !prompt) {
        const res = await validateDir(defaultTarget);
        if (typeof res === "string") {
            throw new Error(res);
        }
        return defaultTarget;
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
 * @param {String} reqName
 *
 * @return {String}
 */
export async function getSiteName (reqName) {
    async function validateSiteName (siteName) {
        if (!siteName) {
            return "A name is required.";
        }
        return true;
    }


    if (reqName) {
        const res = validateSiteName(reqName);
        if (typeof res === "string") {
            throw new Error(res);
        }
        return reqName;
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

export async function confirmDelete (dest) {

    const { overwrite } = await prompts({
        type: "confirm",
        name: "overwrite",
        message: `okay to delete ${dest}?`,
        initial: false
    }, {
        onCancel: userCancelled
    });

    return overwrite;
}

export async function confirmOverwriteDir (dest) {

    const { overwrite } = await prompts({
        type: "confirm",
        name: "overwrite",
        message: `The path ${dest} already exists. Overwrite?`,
        initial: true
    }, {
        onCancel: userCancelled
    });

    return overwrite;
}

