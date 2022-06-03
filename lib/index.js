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
import prompts from "prompts";
import shell from "shelljs";
import supportsColor from "supports-color";
import l8 from "@l8js/l8";
import { fileURLToPath } from "url";
import logger from "@docusaurus/logger";


/**
 * Will prompt for the version of conjoon to install.
 * Presnts default version with defaultVersion.
 *
 */
async function getVersion(defaultVersion) {
    async function validateVersion (version) {
        if (!version) {
            return "A version is required.";
        }

        logger.info(`Getting info @conjoon/conjoon@${version}...`);
        const exists = shell.exec(`npm view @conjoon/conjoon@${version}`).stdout;
        if (!exists) {
            return logger.error(`Could not find version ${version}!`);
        }
        return true;
    }

    const { version } = await prompts({
        type: "text",
        name: "version",
        message: "Which version do you want to use for this installation?",
        initial: defaultVersion,
        validate: validateVersion
    }, {
        onCancel () {
            logger.error("A version is required.");
            process.exit(1);
        }
    });
    return version;
};


/**
 * Requests site name.
 *
 *
 * @param reqName
 * @param rootDir
 * @returns {Promise<*>}
 */
async function getSiteName (reqName, rootDir) {
    async function validateSiteName (siteName) {
        if (!siteName) {
            return "A name is required.";
        }

        const dest = path.resolve(rootDir, encodeURIComponent(siteName));
        if (await fs.pathExists(dest)) {
            return logger.error(`Directory already exists at path path=${dest}!`);
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


/**
 *
 * @param pkgPath
 * @param obj
 * @returns {Promise<void>}
 */
async function updatePkg (pkgPath, obj, path) {
    const pkg = (await fs.readJSON(pkgPath));
    const newPkg = path ? l8.chain(path, pkg, obj, true) : Object.assign(pkg, obj);
    await fs.outputFile(pkgPath, `${JSON.stringify(newPkg, null, 2)}\n`);
}

/**
 *
 * @param pkgPath
 * @param obj
 * @returns {Promise<void>}
 */
async function getPkgInfo (pkgPath, path) {
    const pkg = (await fs.readJSON(pkgPath));
    return l8.unchain(path, pkg);
}


/**
 *
 * @param dest
 * @param siteName
 * @returns {Promise<Awaited<void>[]>}
 */
async function updatePackageConfigs (dest, siteName) {

    const
        githubText = "Leave a ⭐ at <a target=\"_blank\" href=\"https://github.com/conjoon/conjoon\">Github</a> if you like it!",
        up = async (dest, siteName) => await updatePkg(dest, {
            "title": siteName,
            "tagline": "webmail made easy",
            "titleTpl": "${title} | " + siteName,
            "announcement": {
                "message": siteName.toLowerCase() === "conjoon"
                    ? `Welcome to ${siteName}! ${githubText}`
                    : `Welcome to ${siteName}, powered by conjoon! ${githubText}`,
                "type": "success"
            }
        }, "conjoon.application");

    return Promise.all([
        `${dest}/build/production/conjoon/desktop/resources/coon-js/conjoon.conf.json`,
        `${dest}/build/production/conjoon/desktop/resources/coon-js/conjoon.dev.conf.json`,
        `${dest}/resources/coon-js/conjoon.conf.json`,
        `${dest}/resources/coon-js/conjoon.dev.conf.json`
    ].map(dest => up(dest, siteName)));
}


/**
 *
 * @param rootDir
 * @param {Boolean} isExternal true if this script is not used with `npm init @conjoon/conjoon`,
 * but npx create-conjoon directly
 * @returns {Promise<void>}
 */
export default async function init (rootDir, isExternal) {
    const
        pkgManager   = "npm",
        siteName     = await getSiteName("", rootDir),
        dest         = path.resolve(rootDir, encodeURIComponent(siteName)),
        cdpath       = path.relative(".", dest);

    try {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        } else {
            logger.error(`The path path=${dest} already exists. Exiting...`);
            process.exit(1);
        }
    } catch (err) {
        logger.error(err);
        process.exit(1);
    }

    logger.info(`Created path=${dest} for new installation  "${siteName}"...`);
    logger.info(`Using ${isExternal ? "external" : "internal"} initializer, resolving paths...`);


    logger.info("Fetching latest version of @conjoon/conjoon:");
    const latest = shell.exec("npm view @conjoon/conjoon version").stdout;

    let version = await getVersion(latest);

    let cwd = fileURLToPath(new URL(`${isExternal ? "" : "../"}../../../node_modules/`, import.meta.url));


    logger.info(`Running code=${`${pkgManager} i --prefix ${cwd} @conjoon/conjoon@${version}`}`);
    if (shell.exec(`${pkgManager} i --prefix ${cwd} @conjoon/conjoon@${version}`, {
        env: {
            ...process.env,
            ...(supportsColor.stdout ? { FORCE_COLOR: "1" } : {})
        }
    }).code !== 0) {
        logger.error(`Installing @conjoon/conjoon failed. We suggest you check for the correct version.`);
        logger.info(`Removing path=${dest}...`);
        fs.removeSync(dest);
        process.exit(1);
    }

    let source = `${cwd}/@conjoon/conjoon`;

    if (!fs.existsSync(cwd)) {
        logger.error(`Target directory path=${cwd} does not exists.`);
        logger.info(`Removing path=${dest} and exiting...`);
        fs.removeSync(dest);
        process.exit(1);
    }

    version = await getPkgInfo(`${cwd}/@conjoon/conjoon/package.json`, "version");

    logger.info(`Copying release v${version} to path=${dest}...`);

    fs.copySync(source, dest);
    shell.cd(dest);
    fs.moveSync(`${dest}/package.json`, `${dest}/package.json.tmp`);

    logger.info("Installing webpack...");
    if (shell.exec(`${pkgManager} i --silent --prefix ${dest} webpack-dev-server@~3.8.0 webpack-cli@~3.3.6`, {
        env: {
            ...process.env,
            ...(supportsColor.stdout ? { FORCE_COLOR: "1" } : {})
        }
    }).code !== 0) {
        logger.error(`Installing webpack failed, but base installation available at path=${cdpath}`);
        process.exit(0);
    }

    logger.info("Cleaning up...");
    fs.removeSync(`${dest}/package.json`);
    fs.moveSync(`${dest}/package.json.tmp`, `${dest}/package.json`);

    logger.info("Updating package information...");

    await updatePackageConfigs(dest, siteName);


    await updatePkg(`${dest}/package.json`, {
        name: siteName,
        author: {
            name: "",
            email: ""
        },
        "repository": {
            "type": "git",
            "url": `git+https://github.com/${siteName}.git`
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

    logger.success(`
        Created path=${cdpath}.
        Inside that directory, you can run several commands:
    
        code=${`${pkgManager} start`}
        Starts the development server.
    
        code=${`${pkgManager} run build`}
        Bundles your conjoon installation into static files for production
    
        We recommend that you begin by typing:
    
        code=${`cd ${cdpath}`}
        code=${`${pkgManager} run stage`}
    
        Make sure to read the documentation at url=https://conjoon.org.
    
        Happy coding!
    `);

    process.exit(0);
}
