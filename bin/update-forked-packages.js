/* 

Update the sub-modules we plan to publish as our own scoped modules. Adapted from:

https://github.com/pouchdb/pouchdb-server/blob/master/bin/update-package-json-for-publish.js

*/
'use strict';

// Update all the dependencies inside packages/node_modules/*/package.json
// to reflect the true dependencies (automatically determined by require())
// and update the version numbers to reflect the version from the top-level
// package.json.

var fs = require('fs');
var path = require('path');
var glob = require('glob');
var findRequires = require('find-requires');
var builtinModules = require('builtin-modules');
var uniq = require('lodash.uniq');
var flatten = require('lodash.flatten');

var topPkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
var version = topPkg.version;

var packagesToProcess = [
    "./packages/node_modules/express-pouchdb",
    "./packages/node_modules/pouchdb-auth"
];

packagesToProcess.forEach(function(pkgDir) {
    var pkgPath = path.join(pkgDir, 'package.json');
    var pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    
    // all packages get the same version as the top package.json
    pkg.version = version;

    // Clear out any existing generated dependencies.
    pkg.dependencies = {};
    pkg.optionalDependencies = {};

    // for the dependencies, find all require() calls
    var srcFiles = glob.sync(path.join(pkgDir, 'lib/**/*.js'));
    var uniqDeps = uniq(flatten(srcFiles.map(function (srcFile) {
	var code = fs.readFileSync(srcFile, 'utf8');
	try {
	    return findRequires(code);
	} catch (e) {
	    return []; // happens if this is an es6 module, parsing fails
	}
    }))).filter(function (dep) {
	// some modules require() themselves, e.g. for plugins
	return dep !== pkg.name &&
	    // exclude built-ins like 'inherits', 'fs', etc.
	builtinModules.indexOf(dep) === -1;
    }).sort();
    
    //find dependencies and igonore if we referencing a local file
    var newPkg = uniqDeps.reduce(function (deps, dep) {
	if (/^\.\//.test(dep) || /^\.\.\//.test(dep)) {
	    return deps; // do nothing its a local file
	}
	
	dep = dep.indexOf("@the-t-in-rtf") === 0 ? dep : dep.split('/')[0]; // split colors/safe to be colors
	
	if (topPkg.dependencies[dep]) {
	    deps.dependencies[dep] = topPkg.dependencies[dep].indexOf("file:") == 0 ? version : topPkg.dependencies[dep];
	} else if (topPkg.optionalDependencies[dep]) {
	    deps.optionalDependencies[dep] = topPkg.optionalDependencies[dep].indexOf("file:") == 0 ? version : topPkg.optionalDependencies[dep];
	} else {
	    throw new Error('Unknown dependency ' + dep);
	}
	
	return deps;
    }, {
	dependencies: {},
	optionalDependencies: {}
    });
    
    // special case – `pouchdb-fauxton` is included using `require.resolve()`,
    // meaning that `find-requires` doesn't find it. so we have to do it manually
    newPkg.dependencies['pouchdb-fauxton'] = topPkg.dependencies['pouchdb-fauxton'];
    
    Object.assign(pkg, newPkg);
    
    var jsonString = JSON.stringify(pkg, null, '  ') + '\n';
    fs.writeFileSync(pkgPath, jsonString, 'utf8');
});
