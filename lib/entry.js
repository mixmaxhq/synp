'use strict'

const { findPackageInYarnLock, findEntryInPackageLock } = require('../util/traverse')
const { npmRequires } = require('./dependencies')

function yarnToNpmResolved (yarnResolved) {
  const resolved = yarnResolved.replace(/#.*$/, '')
  const hexChecksum = yarnResolved.replace(/^.*#/, '')
  const integrity = 'sha1-' + Buffer.from(hexChecksum, 'hex').toString('base64')
  return { resolved, integrity }
}

function npmToYarnResolved (resolved, integrity) {
  const hexChecksum = /^sha1-/.test(integrity)
    ? Buffer.from(integrity.replace(/^sha1-/, ''), 'base64').toString('hex')
    : Buffer.from(integrity.replace(/^sha512-/, ''), 'base64').toString('hex')
    // see caveats in README
  return `${resolved}#${hexChecksum}`
}

module.exports = {
  npmEntry (nodeModulesTree, yarnObject, mPath) {
    const { name, version, dependencies } = nodeModulesTree[mPath]
    const entryInYarnFile = findPackageInYarnLock(name, version, yarnObject)
    if (!entryInYarnFile) return null // likely a bundled dependency
    const yarnResolved = entryInYarnFile.resolved
    const { resolved, integrity } = yarnToNpmResolved(yarnResolved)
    const entry = {
      version,
      resolved,
      integrity
    }
    if (dependencies && Object.keys(dependencies).length > 0) {
      entry.requires = npmRequires(dependencies, yarnObject)
    }
    return entry
  },
  yarnEntry (entry, allDeps, flattenedPackageLock, tree) {
    const { name, version } = entry
    const entryInNpmFile = findEntryInPackageLock(entry, flattenedPackageLock)
    if (!entryInNpmFile) return null // likely a bundled dependency
    const {
      resolved,
      integrity
    } = entryInNpmFile
    const { dependencies, optionalDependencies } = allDeps
    const yarnStyleResolved = npmToYarnResolved(resolved || version, integrity)
    const existingPackage = tree[name] || {}
    const existingPackageVersion = tree[name] && tree[name][version]
      ? tree[name][version]
      : {}
    const hasDeps = dependencies && Object.keys(dependencies).length > 0
    const hasOptionalDeps = optionalDependencies &&
      Object.keys(optionalDependencies).length > 0
    return Object.assign({}, existingPackage, {
      [version]: Object.assign({}, existingPackageVersion, {
        resolved: yarnStyleResolved
      },
        hasDeps ? {dependencies} : {},
        hasOptionalDeps ? {optionalDependencies} : {}
      )
    })
  }
}
