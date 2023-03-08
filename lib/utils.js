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

import fs from "fs-extra";
import l8 from "@l8js/l8";
import logger from "@docusaurus/logger";
import path from "path";

/**
 * Utility function for file operations on configuration and package files.
 */

/**
 * Updates the information in the json file found at dest, given obj and objPath.
 *
 * @example
 *     // file.json: {conjoon: {application: {}}}
 *     updateJsonFileSync("file.json", "some value", "conjoon.application");
 *     // file.json: {conjoon: {application: "some value"}}
 *
 * @param {String} dest path to file destination
 * @param {*|Array<*>} obj value of arbitrary type used for the objPath
 * @param {String|Array<String>} objPath Array of object chains used with obj
 *
 * @return {Promise<void>}
 */
export function updateJsonFileSync (dest, obj, objPath) {

    if (!fs.pathExistsSync(dest)) {
        throw new Error(`${dest} does not exist`);
    }

    let newPkg = fs.readJsonSync(dest);

    if (objPath) {

        obj = [].concat(obj);

        [].concat(objPath).forEach((path, index) => {
            newPkg = l8.chain(path, newPkg, obj[index] !== undefined ? obj[index] : obj[0], true);
        });
    } else {
        newPkg = Object.assign(newPkg, obj);
    }

    fs.outputFileSync(dest, `${JSON.stringify(newPkg, null, 4)}\n`);
}


/**
 * Updates configuration information for the base installation (build) and
 * the development files of a conjoon information.
 *
 * @param dest
 * @param {Object} data
 * @param {String} data.siteName
 *
 * @returns {Promise<Awaited<void>[]>}
 */
export function updateApplicationConfigsSync (dest, data) {

    data.githubText = "Leave a ⭐ at <a target=\"_blank\" href=\"https://github.com/conjoon/conjoon\">Github</a> if you like it!";

    const
        /**
         *
         * @param dest
         * @param data
         *
         * @returns {Array}
         */
        upSync = (dest, data) => {

            if (!fs.pathExistsSync(dest)) {
                return;
            }

            updateJsonFileSync(dest, {
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

        };

    return [
        `${dest}/build/production/conjoon/desktop/resources/`,
        `${dest}/build/production/conjoon/desktop/resources/coon-js`,
        `${dest}/resources/`,
        `${dest}/resources/coon-js`
    ].map(dest => {

        const files = [
            "conjoon.conf.json",
            "conjoon.dev.conf.json"
        ];

        files.map (file => {
            if (fs.pathExistsSync(dest)) {
                upSync(`${dest}/${file}`, data);
            }
        });

    });
}

function probeConfigExistsSync(targetDir, fileName) {
    return [
        `${targetDir}/build/production/conjoon/desktop/resources/`,
        `${targetDir}/resources/`
    ].map(dest => {
        return fs.pathExistsSync(`${dest}/${fileName}`) ? `${dest}/${fileName}` : undefined;
    }).filter(file => !!file);
}


export function mergeDevConfigSync (targetDir, devConfig) {

    const targetFiles = probeConfigExistsSync(targetDir, "conjoon.dev.conf.json");

    return targetFiles.map(file => {
        return [file, mergeConfigsSync(file, devConfig)];
    });
}


export function mergeProdConfigSync (targetDir, prodConfig) {
    const targetFiles = probeConfigExistsSync(targetDir, "conjoon.prod.conf.json").concat(
        probeConfigExistsSync(targetDir, "conjoon.conf.json")
    );
    return targetFiles.map(file => {
        return [file, mergeConfigsSync(file, prodConfig)];
    });
}

const mergeConfigsSync = (targetFile, oldConfig) => {

    const mergeMiss = [];

    let targetConfig = fs.readJsonSync(targetFile);

    l8.visit(oldConfig, (leaf, path) => {

        // find oldConfig in new config?
        let target = l8.unchain(path, targetConfig);

        // no: add entry to mergeMiss
        if (target === undefined) {
            mergeMiss.push({
                path, value: leaf
            });
            return;
        }

        targetConfig = l8.chain([path], targetConfig, leaf, true, "/");
    });

    fs.outputFileSync(targetFile, `${JSON.stringify(targetConfig, null, 4)}`);
    return mergeMiss;
};


export function printMergeMisses(mergeMisses) {

    mergeMisses.map(([file, misses]) => {
        if (!misses.length) {
            return;
        }

        logger.warn`Experienced merge misses for ${path.normalize(file)}.`;
        logger.warn`The following configuration could not be applied to this file:`;
        misses.forEach(({path, value}) => {
            logger.warn` -- ["${path.join("\", \"") }"]: ${value}`;
        });
    });
}

/**
 * Configures package.json information for a conjoon drop.
 *
 * @param path
 * @param data
 *
 * @returns {Promise<void>}
 */
export function updatePackageJsonSync (path, data) {

    return updateJsonFileSync(path, {
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
