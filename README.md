# `create-conjoon`

A scaffolding utility to help you instantly set up a functional **conjoon** app.

Run 

```bash
npx create-conjoon@latest
```
or
```bash
npm init @conjoon/conjoon@latest
```
and follow the instructions on screen.

## Usage

Please see the [installation documentation](https://conjoon.org/docs/api/misc/@conjoon/create-conjoon).

## On merging configurations

**create-conjoon** will try to merge configurations when the installation type is set to `release` and the target
folder already contains an instance of **conjoon**. The configuration keys from the previous instance will only
end up in the new instance if those keys are recognized by the version to be installed.

Thus, if you have **added additional configuration** options, you need to add them **manually** to the new instance.

A backup folder containing previous configuration files will be created during the merge process, so you can easily check
which keys were not recognized by the installed instance.