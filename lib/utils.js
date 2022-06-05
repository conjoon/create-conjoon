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

import fs from "fs-extra";
import l8 from "@l8js/l8";

/**
 * Utility function for file operations on configuration and package files.
 */

/**
 * Replaces all needles with values in the file found under dest.
 *
 * @param {String} dest
 * @param {String|Array} needle
 * @param {String} value
 */
async function replaceInFile (dest, needle, value) {
    let txt = await fs.readFile(dest, "UTF-8");
    txt = l8.replace(needle, value, txt);
    await fs.outputFile(dest, txt);
}

/**
 * Updates the information in the json file found at dest, given obj and objPath.
 * 
 * @example 
 *     // file.json: {conjoon: {application: {}}} 
 *     updateJsonFile("file.json", "some value", "conjoon.application");
 *     // file.json: {conjoon: {application: "some value"}} 
 * 
 * @param {String} dest path to file destination
 * @param {*|Array<*>} obj value of arbitrary type used for the objPath
 * @param {String|Array<String>} objPath Array of object chains used with obj
 * 
 * @return {Promise<void>}
 */
export async function updateJsonFile (dest, obj, objPath) {

    let newPkg = await fs.readJSON(dest);
  
    if (objPath) {

        obj = [].concat(obj);

        [].concat(objPath).forEach((path, index) => {
            newPkg = l8.chain(path, newPkg, obj[index] || obj[0], true);
        });
    } else {
        newPkg = Object.assign(newPkg, obj);
    }

    await fs.outputFile(dest, `${JSON.stringify(newPkg, null, 4)}\n`);
}

/**
 * Returns the information from the json file for the specified
 * field in dot notation.
 * 
 * @example
 *    // file.json {conjoon:{application: "some value"}}
 *    getValueFromJsonFile("file.json", "conjoon.application"); // "some value"
 *    
 * @param dest
 * @param {String} path
 * @returns {Promise<*>}
 */
export async function getValueFromJsonFile (dest, path) {
    const pkg = (await fs.readJSON(dest));
    return l8.unchain(path, pkg);
}


/**
 * Updates configuration information for the base installation (build) and
 * the development files of a conjoon information.
 * 
 * @param dest
 * @param {Object} data
 * @param {String} data.siteName
 * @param {String} data.installType can be "quick" or "detailed"
 * @param {String} data.backendUrl
 *
 * @returns {Promise<Awaited<void>[]>}
 */
export async function updateApplicationConfigs (dest, data) {

    data.githubText = "Leave a ⭐ at <a target=\"_blank\" href=\"https://github.com/conjoon/conjoon\">Github</a> if you like it!";

    const
        /**
         *
         * @param dest
         * @param data
         *
         * @returns {Array}
         */
        up = async (dest, data) => {

            const isDev = dest.endsWith("conjoon.dev.conf.json");

            await updateJsonFile(dest, {
                "title": data.siteName,
                "tagline": "webmail made easy",
                "titleTpl": "${title} | " + data.siteName,
                "announcement": {
                    "message": data.siteName.toLowerCase() === "conjoon"
                        ? `Welcome to ${data.siteName}! ${data.githubText}`
                        : `Welcome to ${data.siteName}, powered by conjoon! ${data.githubText}`,
                    "type": "success"
                }
            }, "conjoon.application");

            if (data.installType === "detailed" && data.urls) {

                data.urls = Object.fromEntries(
                    Object.entries(data.urls).map(([key, value]) => [key, l8.unify(value + "/", "/", "://")])
                );
                if (isDev) {
                    await replaceInFile(dest, [
                        "https://ddev-ms-email.ddev.site/rest-imapuser/api/v.*?/",
                        "https://ddev-ms-email.ddev.site/rest-api-email/api/v.*?/"
                    ], [data.urls.auth, data.urls.email]
                    );

                    await updateJsonFile(dest, [data.urls.auth, data.urls.email], [
                        "conjoon.packages.extjs-app-imapuser.config.service.rest-imapuser.base",
                        "conjoon.packages.extjs-app-webmail.config.service.rest-api-email.base"
                    ]);

                } else if (!isDev) {
                    await updateJsonFile(dest, {autoLoad: {registerController: false}}, [
                        "conjoon.packages.extjs-dev-webmailsim",
                        "conjoon.packages.extjs-dev-imapusersim",
                        "conjoon.packages.extjs-ctrl-simmanager"
                    ]);

                    await updateJsonFile(dest, [data.urls.auth, data.urls.email], [
                        "conjoon.packages.extjs-app-imapuser.config.service.rest-imapuser.base",
                        "conjoon.packages.extjs-app-webmail.config.service.rest-api-email.base"
                    ]);
                }

            }
            
        };

    return Promise.all([
        `${dest}/build/production/conjoon/desktop/resources/coon-js/conjoon.conf.json`,
        `${dest}/build/production/conjoon/desktop/resources/coon-js/conjoon.dev.conf.json`,
        `${dest}/resources/coon-js/conjoon.conf.json`,
        `${dest}/resources/coon-js/conjoon.dev.conf.json`
    ].map(dest => up(dest, data)));
}

/**
 * Configures package.json information for a conjoon drop.
 * 
 * @param path
 * @param data
 * 
 * @returns {Promise<void>}
 */
export async function updatePackageJson (path, data) {
    
    return updateJsonFile(path, {
        name: data.siteName,
        author: {
            name: "",
            email: ""
        },
        "repository": {
            "type": "git",
            "url": `git+https://github.com/${data.siteName}.git`
        },
        version: "0.0.1",
        description: "conjoon - webmail made easy",
        private: true,
        contributors: [{
            name: "Thorsten Suckow-Homberg",
            email: "thorsten@suckow-homberg.de",
            url: "https://conjoon.org"
        }]
    });
}