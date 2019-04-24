'use strict';

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const klawSync = require('klaw-sync');
const minimatch = require('minimatch');

module.exports = {

	/**
	 * export fs-extra capability
	 */
	fs: fs,
	
	/**
	 * get html files automatically
	 * @param {Object} options
	 *        - {String}  srcPath [directory contains html files]
	 *        - {Integer} level   [0 => current level, 1 => next level]
	 * @return {Array}          [array of html files path]
	 */
	getHtmlEntry: function(options) {
		let opt = options || {};

		let level = opt.level || 0,
			srcPath = opt.srcPath || '',
			keyType = opt.keyType || 'folderName';

		if (!fs.existsSync(srcPath)) {
			return [];
		}
		
		// read html filename from 
		let srcFiles = fs.readdirSync(srcPath),
			htmlFiles = [];

		if (level) {
			srcFiles.map((item) => {
				let folder = path.join(srcPath, item);
				if (fs.lstatSync(folder).isDirectory()) {
					let subSrcFiles = fs.readdirSync(folder);
					htmlFiles = htmlFiles.concat(getFromSrc(subSrcFiles, item));
				}
			});
		}
		else {
			htmlFiles = htmlFiles.concat(getFromSrc(srcFiles));
		}
		
		function getFromSrc(srcFiles, folderPath) {
			let folder = folderPath || '';

			srcFiles = srcFiles.filter((item) => {
			    return !!~item.indexOf('.html');
			});

			let htmlFiles = [];

			srcFiles = srcFiles.map((item) => {
			    let obj = {};

			    if (keyType === 'fileName') {
			    	obj.key = item.replace('.html', '');
			    }
			    else {
			    	obj.key = folder || item.replace('.html', '');
			    }

			    obj.path = path.join(srcPath, folder, item);

			    htmlFiles.push(obj);
			});

			return htmlFiles;
		}

		return htmlFiles;
	},

	/**
	 * get sprite folder, only depth 1st folder matter
	 * @param {Object} options
	 *        - {String} srcPath [sprite image parent folder]
	 * @return {Array}             [sprite folder]
	 */
	getSpriteEntry: function(options) {
		let opt = options || {};

		let srcPath = opt.srcPath || '';

		if (!fs.existsSync(srcPath)) {
			return [];
		}

		let srcFiles = fs.readdirSync(srcPath),
			spriteFiles = [];

		srcFiles = srcFiles.filter((item) => {
		    return !~item.indexOf('.');
		});

		srcFiles.map((item) => {
			let obj = {};
			obj.key = item;
			obj.path = path.join(srcPath, item);
			spriteFiles.push(obj);
		});

		return spriteFiles;
	},
	
	/**
	 * get js files automatically
	 * @param {Object} options
	 *        - {String} srcPath [directory contains js files]
	 *        - {String} fileName    [entry js filename]
	 *        - {Array} extensions   [possiable js extension]
	 *        - {String} keyPrefix  [prefix of key]
	 *        - {Integer} level   [0 => current level, 1 => next level]
	 * @return {Object}             [Object of js files path]
	 */
	getJsEntry: function(options) {
		let opt = options || {};

		let srcPath = opt.srcPath || '', 
			fileName = opt.fileName || 'main', 
			extensions = opt.extensions || ['js', 'jsx', 'ts', 'tsx'], 
			keyPrefix = opt.keyPrefix || '', 
			level = opt.level || 0;

		let jsFileArray = {};

		if (!fs.existsSync(srcPath)) {
			return jsFileArray;
		}

		//read js filename
		let srcFiles = fs.readdirSync(srcPath);

		if (level) {
			srcFiles.filter((item) => {
				let folder = path.join(srcPath, item);
				return fs.lstatSync(folder).isDirectory();
			});

			srcFiles.map((item) => {
				extensions.map((ext) => {
					let jsPath = path.join(srcPath, item, fileName + '.' + ext);

					if (fs.existsSync(jsPath) && !jsFileArray[keyPrefix + item]) {
						jsFileArray[keyPrefix + item] = [jsPath];
					}
				});
			});
		}
		else {
			extensions.map((ext) => {
				let jsPath = path.join(srcPath, fileName + '.' + ext);
				if (fs.existsSync(jsPath)) {
					jsFileArray[keyPrefix + fileName] = [jsPath];
				}
			});
		}

		return jsFileArray;
	},

	/**
	 * select js files for compilation
	 * @param  {Object} jsFiles       [all js files]
	 * @param  {Array} selectedFiles [selected js files]
	 * @return {Array}               [selected js files in certain format]
	 */
	filterJsFile: function(jsFiles, selectedFiles) {

		if (!selectedFiles || !selectedFiles.length) {
			return jsFiles;
		}

		var newJsFiles = {};

		Object.keys(jsFiles).map((item) => {
			selectedFiles.forEach((pattern) => {
				if (minimatch(item, pattern)) {
					newJsFiles[item] = jsFiles[item];
				}
			});
		});

		return newJsFiles;
	},

	/**
	 * select js files for compilation by npm command
	 * @param  {Object} jsFiles       [all js files]
	 * @return {Array}               [selected js files in certain format]
	 */
	filterJsFileByCmd: function(jsFiles) {
		let argvs = this.getNpmArgvs();

		if (argvs.entry) {
		    let entries = argvs.entry.split(',');
		    jsFiles =  this.filterJsFile(jsFiles, entries);
		}

		return jsFiles;
	},

	/**
	 * select html files for compilation
	 * @param  {Array} htmlFiles     [all html files]
	 * @param  {Array} selectedFiles [selected html files]
	 * @return {Array}               [selected html files in certain format]
	 */
	filterHtmlFile: function(htmlFiles, selectedFiles) {
		if (!selectedFiles || !selectedFiles.length) {
			return htmlFiles;
		}
		
		htmlFiles = htmlFiles.filter((item) => {
			for (let i = 0; i < selectedFiles.length; i += 1) {
				if (minimatch(item.key, selectedFiles[i])) {
					return true;
				}
			}
			return false;
		});

		return htmlFiles;
	},

	/**
	 * select html files for compilation by npm command
	 * @param  {Array} htmlFiles     [all html files]
	 * @return {Array}               [selected html files in certain format]
	 */
	filterHtmlFileByCmd: function(htmlFiles) {
		let argvs = this.getNpmArgvs();

		if (argvs.entry) {
		    let entries = argvs.entry.split(',');
		    htmlFiles = this.filterHtmlFile(htmlFiles, entries);
		}
		
		return htmlFiles;
	},

	/**
	 * walk files and replace file string
	 * @param  {String} folder   [src folder]
	 * @param  {Array}  extensions  [include which extensions]
	 * @param  {Object}  replaceObj  [name need to be replaced]
	 */
	walkAndReplace: function(folder, extensions, replaceObj) {

		var extensions = extensions || [],
			replaceObj = replaceObj || {};

		var files = klawSync(folder, {nodir: true});

		if (extensions.length) {
			files = files.filter((item) => {
				let ext = path.extname(item.path);
				return extensions.includes(ext);
			});
		}

		files.forEach((file) => {
			let content = fs.readFileSync(file.path, 'utf-8');

			Object.keys(replaceObj).forEach((key) => {
				content = content.replace(new RegExp('<% ' + key + ' %>', 'ig'), function(match) {
					return replaceObj[key];
				});
			});

			fs.writeFileSync(file.path, content, 'utf-8');
		});
	},

	/**
	 * copy template to specific place
	 * @param  {String} srcFolder  [src folder]
	 * @param  {String} destFolder [destination folder]
	 */
	copyTemplate: function(srcFolder, destFolder) {
		if (fs.existsSync(destFolder)) {
			throw new Error(destFolder + ' exists');
		}

		fs.copySync(srcFolder, destFolder);
	},

	/**
	 * add plugin for webpack config
	 * @param {Object} conf   [webpack config]
	 * @param {Object} plugin [webpack plugin]
	 * @param {Object} opt    [plugin config]
	 */
	addPlugins: function(conf, plugin, opt) {
		conf.plugins.push(new plugin(opt));
	},

	/**
	 * get command line argvs
	 * @param  {Array} argvs  [original argvs array]
	 * @return {Object}       [parsed result]
	 */
	getArgvs: function(argvs) {
		var yargs = require('yargs');

		if (argvs) {
			return yargs(argvs).argv;
		} 
		else {
			return yargs(process.argv).argv;
		}
	},

	/**
	 * get npm command line argvs
	 * @return {Object} [parsed result]
	 */
	getNpmArgvs: function() {
		return this.getArgvs(JSON.parse(process.env.npm_config_argv || '[]').original);
	},

	/**
	 * add protocal for url string
	 * @param {String} urlString [url string]
	 */
	addProtocal: function(urlString) {
		if (urlString.includes('http:') || urlString.includes('https:')) {
			return urlString;
		}
		return 'http:' + urlString;
	},

	/**
	 * print error message
	 * @param  {String} str [message]
	 * @return {String}     [msg]
	 */
	error: function(str) {
		this.log(str, 'red');
	},

	/**
	 * print information
	 * @param  {String} str [message]
	 * @return {String}     [msg]
	 */
	info: function(str) {
		this.log(str, 'cyan');
	},

	/**
	 * print warning message
	 * @param  {String} str [message]
	 * @return {String}     [msg]
	 */
	warn: function(str) {
		this.log(str, 'yellow');
	},

	/**
	 * print success message
	 * @param  {String} str [message]
	 * @return {String}     [msg]
	 */
	success: function(str) {
		this.log(str, 'green');
	},

	_isType: function(type, obj) {
		return Object.prototype.toString.call(obj) === '[object ' + type + ']';
	},

	/**
	 * pring message
	 * @param  {String} str   [message]
	 * @param  {String} color [color name]
	 * @return {String}       [message with color]
	 */
	log: function(str, color) {
		str = str || '';
		str = this._isType('Object', str) ? JSON.stringify(str) : str;
		let msg = chalk[color](str);
		console.log(msg);
		return msg;
	}
};