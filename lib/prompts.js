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

import logger from "@docusaurus/logger";
import prompts from "prompts";
import shell from "shelljs";
import fs from "fs-extra";
import path from "path";

/**
 * This file exports the prompts required for gathering installation info
 * for a conjoon-drop.
 */

/**
 * Will prompt for the version of conjoon to install.
 *
 * @params {Array} versions An array of all published version of conjoon
 * so far.
 *
 * @return {String} version
 */
export async function getVersion (versions) {
    async function validateVersion (version) {
        if (!version) {
            return "A version is required.";
        }

        if (!versions.includes(version)) {
            return `${version} does not seem to be in the list of published versions`;
        }

        logger.info`Getting info for required version name=${`@conjoon/conjoon@${version}`}...`;
        const exists = shell.exec(`npm view @conjoon/conjoon@${version}`);
        if (exists.code !== 0 || !exists.stdout) {
            return `Could not find version ${version}!`;
        }
        return true;
    }

    const { version } = await prompts([{
        type: "select",
        name: "version",
        message: "Which version should be used for this installation?",
        choices: versions.slice(Math.max(0, versions.length - 5)).map(v => ({title: v, value: v})).reverse().concat(
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
        onCancel () {
            logger.error`A version is required.`;
            process.exit(1);
        }
    });

    return version;
}


/**
 * Requests the install type of the user. Can either be
 * "quick" or "custom". If custom, continues with selecting necessary
 * information, such as the urls where the service endpoints are found.
 *
 * @return {Object} data
 * @return {String} data.installType "quick" or "custom"
 * @return {!Object} data.urls
 * @return {String} data.urls.email
 * @return {String} data.urls.auth
 */
export async function getInstallationInfo () {

    const { installType, urlEmail, urlAuth} = await prompts([{
        type: "select",
        name: "installType",
        message: "Please select the type of installation.",
        choices: [{
            title: logger.interpolate`Quick subdue=${`(with demo data)`}`,
            value: "quick"
        }, {
            title: logger.interpolate`Custom subdue=${`(for connecting with an available backend)`}`,
            value: "custom"
        }],
        initial: 0
    }, {
        type: prev => prev === "custom" ? "text" : null,
        name: "urlAuth",
        message: "Base URL for auth",
        initial: "https://ddev-ms-email.ddev.site/rest-imapuser/api/v0",
        validate: value => !value ? "URL required" : true
    }, {
        type: prev => prev === "quick" ? null : "text",
        name: "urlEmail",
        message: "Base URL for rest-api-email",
        initial: "https://ddev-ms-email.ddev.site/rest-api-email/api/v0",
        validate: value => !value ? "URL required" : true
    }], {
        onCancel () {
            logger.error("An install type is required.");
            process.exit(1);
        }
    });

    let data = {installType};

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
 * @param {Boolean} prompt if set to true, will not automatically use reqDir or
 * defaultTarget (if available) and instead show a prompt and verify the defaultTarget
 * from the user
 *
 * @returns {Promise<void>}
 */
export async function getTargetDir(reqDir, defaultTarget, prompt) {

    async function validateDir (dir) {
        if (!dir) {
            return "A target directory is required.";
        }

        const dest = path.resolve(dir);
        if (await fs.pathExists(dest)) {
            return logger.error`Directory already exists at path=${dest}!`;
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
        onCancel () {
            logger.error("A target directory is required.");
            process.exit(1);
        }
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
export async function getSiteName (reqName, ir) {
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
        onCancel () {
            logger.error("A name is required.");
            process.exit(1);
        }
    });

    return siteName;
}