
(function(){var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';

        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';

        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }

        var n = loadNodeModulesSync(x, y);
        if (n) return n;

        throw new Error("Cannot find module '" + x + "'");

        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }

            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }

        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }

            return loadAsFileSync(x + '/index');
        }

        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }

            var m = loadAsFileSync(x);
            if (m) return m;
        }

        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');

            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }

            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);

    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);

    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};

    require.define = function (filename, fn) {
        if (require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
        }

        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;

        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };

        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};
});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process){var process = module.exports = {};

process.nextTick = (function () {
    var queue = [];
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canPost) {
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
    }

    return function (fn) {
        if (canPost) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        }
        else setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();
});

require.define("vm",function(require,module,exports,__dirname,__filename,process){module.exports = require("vm-browserify")});

require.define("/node_modules/vm-browserify/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/vm-browserify/index.js",function(require,module,exports,__dirname,__filename,process){var Object_keys = function (obj) {
    if (Object.keys) return Object.keys(obj)
    else {
        var res = [];
        for (var key in obj) res.push(key)
        return res;
    }
};

var forEach = function (xs, fn) {
    if (xs.forEach) return xs.forEach(fn)
    else for (var i = 0; i < xs.length; i++) {
        fn(xs[i], i, xs);
    }
};

var Script = exports.Script = function NodeScript (code) {
    if (!(this instanceof Script)) return new Script(code);
    this.code = code;
};

Script.prototype.runInNewContext = function (context) {
    if (!context) context = {};

    var iframe = document.createElement('iframe');
    if (!iframe.style) iframe.style = {};
    iframe.style.display = 'none';

    document.body.appendChild(iframe);

    var win = iframe.contentWindow;

    forEach(Object_keys(context), function (key) {
        win[key] = context[key];
    });

    if (!win.eval && win.execScript) {
        // win.eval() magically appears when this is called in IE:
        win.execScript('null');
    }

    var res = win.eval(this.code);

    forEach(Object_keys(win), function (key) {
        context[key] = win[key];
    });

    document.body.removeChild(iframe);

    return res;
};

Script.prototype.runInThisContext = function () {
    return eval(this.code); // maybe...
};

Script.prototype.runInContext = function (context) {
    // seems to be just runInNewContext on magical context objects which are
    // otherwise indistinguishable from objects except plain old objects
    // for the parameter segfaults node
    return this.runInNewContext(context);
};

forEach(Object_keys(Script.prototype), function (name) {
    exports[name] = Script[name] = function (code) {
        var s = Script(code);
        return s[name].apply(s, [].slice.call(arguments, 1));
    };
});

exports.createScript = function (code) {
    return exports.Script(code);
};

exports.createContext = Script.createContext = function (context) {
    // not really sure what this one does
    // seems to just make a shallow copy
    var copy = {};
    if(typeof context === 'object') {
        forEach(Object_keys(context), function (key) {
            copy[key] = context[key];
        });
    }
    return copy;
};
});

require.define("/lib/natural/phonetics/soundex.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Phonetic = require('./phonetic');

function transformLipps(token) {
    return token.replace(/[bfpv]/g, '1');
}

function transformThroats(token) {
    return token.replace(/[cgjkqsxz]/g, '2');
}

function transformToungue(token) {
    return token.replace(/[dt]/g, '3');
}

function transformL(token) {
    return token.replace(/l/g, '4');
}

function transformHum(token) {
    return token.replace(/[mn]/g, '5');
}

function transformR(token) {
    return token.replace(/r/g, '6');
}

function condense(token) {
    return token.replace(/(\d)[hw]?\1+/g, '$1').replace(/[hw]/g, '');
}

function padRight0(token) {
    if(token.length < 4)
        return token + Array(4 - token.length).join('0');
    else
        return token;
}

var SoundEx = new Phonetic();
module.exports = SoundEx;

SoundEx.process = function(token, maxLength) {
    token = token.toLowerCase();

    return token.charAt(0).toUpperCase() + padRight0(condense(transformLipps(transformThroats(
        transformToungue(transformL(transformHum(transformR(
            token.substr(1, token.length - 1).replace(/[aeiouy]/g, '')))))))
                )).substr(0, (maxLength && maxLength - 1) || 3);
};

// export for tests;
SoundEx.transformLipps = transformLipps;
SoundEx.transformThroats = transformThroats;
SoundEx.transformToungue = transformToungue;
SoundEx.transformL = transformL;
SoundEx.transformHum = transformHum;
SoundEx.transformR = transformR;
SoundEx.condense = condense;
SoundEx.padRight0 = padRight0;
});

require.define("/lib/natural/phonetics/phonetic.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var stopwords = require('../util/stopwords');
var Tokenizer = new require('../tokenizers/aggressive_tokenizer')
    tokenizer = new Tokenizer();

module.exports = function() {
    this.compare = function(stringA, stringB) {
        return this.process(stringA) == this.process(stringB);
    };

    this.attach = function() {
  var phonetic = this;

        String.prototype.soundsLike = function(compareTo) {
            return phonetic.compare(this, compareTo);
        }

        String.prototype.phonetics = function() {
            return phonetic.process(this);
        }

        String.prototype.tokenizeAndPhoneticize = function(keepStops) {
            var phoneticizedTokens = [];

            tokenizer.tokenize(this).forEach(function(token) {
                if(keepStops || stopwords.words.indexOf(token) < 0)
                    phoneticizedTokens.push(token.phonetics());
            });

            return phoneticizedTokens;
        }
    };
};
});

require.define("/lib/natural/util/stopwords.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

// a list of commonly used words that have little meaning and can be excluded
// from analysis.
var words = [
    'about', 'after', 'all', 'also', 'am', 'an', 'and', 'another', 'any', 'are', 'as', 'at', 'be',
    'because', 'been', 'before', 'being', 'between', 'both', 'but', 'by', 'came', 'can',
    'come', 'could', 'did', 'do', 'each', 'for', 'from', 'get', 'got', 'has', 'had',
    'he', 'have', 'her', 'here', 'him', 'himself', 'his', 'how', 'if', 'in', 'into',
    'is', 'it', 'like', 'make', 'many', 'me', 'might', 'more', 'most', 'much', 'must',
    'my', 'never', 'now', 'of', 'on', 'only', 'or', 'other', 'our', 'out', 'over',
    'said', 'same', 'see', 'should', 'since', 'some', 'still', 'such', 'take', 'than',
    'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
    'through', 'to', 'too', 'under', 'up', 'very', 'was', 'way', 'we', 'well', 'were',
    'what', 'where', 'which', 'while', 'who', 'with', 'would', 'you', 'your',
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
    'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '$', '1',
    '2', '3', '4', '5', '6', '7', '8', '9', '0', '_'];

// tell the world about the noise words.
exports.words = words;
});

require.define("/lib/natural/phonetics/metaphone.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Phonetic = require('./phonetic');

function dedup(token) {
    return token.replace(/([^c])\1/g, '$1');
}

function dropInitialLetters(token) {
    if(token.match(/^(kn|gn|pn|ae|wr)/))
        return token.substr(1, token.length - 1);

    return token;
}

function dropBafterMAtEnd(token) {
    return token.replace(/mb$/, 'm');
}

function cTransform(token) {
    token = token.replace(/([^s]|^)(c)(h)/g, '$1x$3').trim();
    token = token.replace(/cia/g, 'xia');
    token = token.replace(/c(i|e|y)/g, 's$1');
    token = token.replace(/c/g, 'k');

    return token;
}

function dTransform(token) {
    token = token.replace(/d(ge|gy|gi)/g, 'j$1');
    token = token.replace(/d/g, 't');

    return token;
}

function dropG(token) {
    token = token.replace(/gh(^$|[^aeiou])/g, 'h$1');
    token = token.replace(/g(n|ned)$/g, '$1');

    return token;
}

function transformG(token) {
    token = token.replace(/([^g]|^)(g)(i|e|y)/g, '$1j$3');
    token = token.replace(/gg/g, 'g');
    token = token.replace(/g/g, 'k');

    return token;
}

function dropH(token) {
    return token.replace(/([aeiou])h([^aeiou])/g, '$1$2');
}

function transformCK(token) {
    return token.replace(/ck/g, 'k');
}
function transformPH(token) {
    return token.replace(/ph/g, 'f');
}

function transformQ(token) {
    return token.replace(/q/g, 'k');
}

function transformS(token) {
    return token.replace(/s(h|io|ia)/g, 'x$1');
}

function transformT(token) {
    token = token.replace(/t(ia|io)/g, 'x$1');
    token = token.replace(/th/, '0');

    return token;
}

function dropT(token) {
    return token.replace(/tch/g, 'ch');
}

function transformV(token) {
    return token.replace(/v/g, 'f');
}

function transformWH(token) {
    return token.replace(/^wh/, 'w');
}

function dropW(token) {
    return token.replace(/w([^aeiou]|$)/g, '$1');
}

function transformX(token) {
    token = token.replace(/^x/, 's');
    token = token.replace(/x/g, 'ks');
    return token;
}

function dropY(token) {
    return token.replace(/y([^aeiou]|$)/g, '$1');
}

function transformZ(token) {
    return token.replace(/z/, 's');
}

function dropVowels(token) {
    return token.charAt(0) + token.substr(1, token.length).replace(/[aeiou]/g, '');
}

var Metaphone = new Phonetic();
module.exports = Metaphone;

Metaphone.process = function(token, maxLength) {
    maxLength == maxLength || 32;
    token = token.toLowerCase();
    token = dedup(token);
    token = dropInitialLetters(token);
    token = dropBafterMAtEnd(token);
    token = transformCK(token);
    token = cTransform(token);
    token = dTransform(token);
    token = dropG(token);
    token = transformG(token);
    token = dropH(token);
    token = transformPH(token);
    token = transformQ(token);
    token = transformS(token);
    token = transformX(token);
    token = transformT(token);
    token = dropT(token);
    token = transformV(token);
    token = transformWH(token);
    token = dropW(token);
    token = dropY(token);
    token = transformZ(token);
    token = dropVowels(token);

    token.toUpperCase();
    if(token.length >= maxLength)
        token = token.substring(0, maxLength);

    return token.toUpperCase();
};

// expose functions for testing
Metaphone.dedup = dedup;
Metaphone.dropInitialLetters = dropInitialLetters;
Metaphone.dropBafterMAtEnd = dropBafterMAtEnd;
Metaphone.cTransform = cTransform;
Metaphone.dTransform = dTransform;
Metaphone.dropG = dropG;
Metaphone.transformG = transformG;
Metaphone.dropH = dropH;
Metaphone.transformCK = transformCK;
Metaphone.transformPH = transformPH;
Metaphone.transformQ = transformQ;
Metaphone.transformS = transformS;
Metaphone.transformT = transformT;
Metaphone.dropT = dropT;
Metaphone.transformV = transformV;
Metaphone.transformWH = transformWH;
Metaphone.dropW = dropW;
Metaphone.transformX = transformX;
Metaphone.dropY = dropY;
Metaphone.transformZ = transformZ;
Metaphone.dropVowels = dropVowels;
});

require.define("/lib/natural/phonetics/double_metaphone.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Phonetic = require('./phonetic');

var DoubleMetaphone = new Phonetic();
module.exports = DoubleMetaphone;

function isVowel(c) {
  return c && c.match(/[aeiouy]/i);
}

function truncate(string, length) {
    if(string.length >= length)
        string = string.substring(0, length);

    return string;
}

function process(token, maxLength) {
  token = token.toUpperCase();
  var primary = '', secondary = '';
    var pos = 0;
    maxLength == maxLength || 32;

    function subMatch(startOffset, stopOffset, terms) {
        return subMatchAbsolute(pos + startOffset, pos + stopOffset, terms);
    }

    function subMatchAbsolute(startOffset, stopOffset, terms) {
        return terms.indexOf(token.substring(startOffset, stopOffset)) > -1;
    }

    function addSecondary(primaryAppendage, secondaryAppendage) {
      primary += primaryAppendage;
      secondary += secondaryAppendage;
    }

    function add(primaryAppendage) {
      addSecondary(primaryAppendage, primaryAppendage);
    }

    function addCompressedDouble(c, encoded) {
      if(token[pos + 1] == c)
        pos++;
      add(encoded || c);
    }

    function handleC() {
        if(pos > 1 && !isVowel(token[pos - 2])
                && token[pos - 1] == 'A' && token[pos + 1] == 'H'
                    && (token[pos + 2] != 'I' && token[pos + 2] != 'I')
                        || subMatch(-2, 4, ['BACHER', 'MACHER'])) {
            add('K');
            pos++;
        } else if(pos == 0 && token.substring(1, 6) == 'EASAR') {
            add('S');
            pos++;
        } else if(token.substring(pos + 1, pos + 4) == 'HIA') {
            add('K');
            pos++;
        } else if(token[pos + 1] == 'H') {
            if(pos > 0 && token.substring(pos + 2, pos + 4) == 'AE') {
                addSecondary('K', 'X');
                pos++;
            } else if(pos == 0
                        && (subMatch(1, 6, ['HARAC', 'HARIS'])
                            || subMatch(1, 3, ['HOR', 'HUM', 'HIA', 'HEM']))
                        && token.substring(pos + 1, pos + 5) != 'HORE') {
                add('K');
                pos++;
            } else {
                if((subMatchAbsolute(0, 3, ['VAN', 'VON']) || token.substring(0,  3) == 'SCH')
                    || subMatch(-2, 4, ['ORCHES', 'ARCHIT', 'ORCHID'])
                    || subMatch(2, 3, ['T', 'S'])
                    || ((subMatch(-1, 0, ['A', 'O', 'U', 'E']) || pos == 0)
                        && subMatch(2, 3, ['B', 'F', 'H', 'L', 'M', 'N', 'R', 'V', 'W']))) {
                    add('K');
                } else if(pos > 0) {
                    if(token.substring(0, 2) == 'MC') {
                        add('K');
                    } else {
                        addSecondary('X', 'K');
                    }
                } else {
                    add('X');
                }

                pos++;
            }
        } else if(token.substring(pos, pos + 2) == 'CZ'
                && token.substring(pos - 2, pos + 1) != 'WICZ') {
            addSecondary('S', 'X');
            pos++;
        } else if(token.substring(pos, pos + 3) == 'CIA') {
            add('X');
            pos += 2;
        } else if(token[pos + 1] == 'C' && pos != 1 && token[0] != 'M') {
            if(['I', 'E', 'H'].indexOf(token[pos + 2]) > -1
                    && token.substring(pos + 2, pos + 4) != 'HU') {
                if(pos == 1 && token[pos - 1] == 'A'
                        || subMatch(-1, 4, ['UCCEE', 'UCCES'])) {
                    add('KS');
                } else {
                   add('X');
                }

               pos +=2;
            } else {
                add('K');
                pos++;
            }
        } else if(['K', 'G', 'Q'].indexOf(token[pos + 1]) > -1) {
            add('K');
            pos++;
        } else if(['E', 'I', 'Y'].indexOf(token[pos + 1]) > -1) {
            if(subMatch(1, 3, ['IA', 'IE', 'IO'])) {
                addSecondary('S', 'X');
            } else {
                add('S');
            }
            pos++;
        } else {
            add('K');
            if(token[pos + 1] == ' ' && ['C', 'Q', 'G'].indexOf(token[pos + 2])) {
                pos += 2;
            } else if(['C', 'K', 'Q'].indexOf(token[pos + 1]) > -1
                    && !subMatch(1, 3, ['CE', 'CI'])) {
                pos++;
            }
        }
    }

    function handleD() {
      if(token[pos + 1] == 'G') {
        if(['I', 'E', 'Y'].indexOf(token[pos + 2]) > -1)  {
          add('J');
          pos += 2;
        } else {
          add('TK');
          pos++;
        }
      } else if(token[pos + 1] == 'T') {
        add('T');
        pos++;
      } else
        addCompressedDouble('D', 'T');
    }

    function handleG() {
        if(token[pos + 1] == 'H') {
            if(pos > 0 && !isVowel(token[pos - 1])) {
                add('K');
                pos++;
            } else if(pos == 0) {
                if(token[pos + 2] == 'I') {
                    add('J');
                } else {
                    add('K');
                }
                pos++;
            } else if(pos > 1
                && (['B', 'H', 'D'].indexOf(token[pos - 2]) > -1
                    || ['B', 'H', 'D'].indexOf(token[pos - 3]) > -1
                    || ['B', 'H'].indexOf(token[pos - 4]) > -1)) {
                pos++;
            } else {
                if(pos > 2
                        && token[pos - 1] == 'U'
                        && ['C', 'G', 'L', 'R', 'T'].indexOf(token[pos - 3]) > -1) {
                    add('F');
                } else if(token[pos - 1] != 'I') {
                    add('K');
                }

                pos++;
            }
        } else if(token[pos + 1] == 'N') {
            if(pos == 1 && startsWithVowel && !slavoGermanic) {
                addSecondary('KN', 'N');
            } else {
                if(token.substring(pos + 2, pos + 4) != 'EY'
                        && (token[pos + 1] != 'Y'
                            && !slavoGermanic)) {
                    addSecondary('N', 'KN');
                } else
                    add('KN');
            }
            pos++;
        } else if(token.substring(pos + 1, pos + 3) == 'LI' && !slavoGermanic) {
            addSecondary('KL', 'L');
            pos++;
        } else if(pos == 0 && (token[pos + 1] == 'Y'
                || subMatch(1, 3, ['ES', 'EP', 'EB', 'EL', 'EY', 'IB', 'IL', 'IN', 'IE', 'EI', 'ER']))) {
            addSecondary('K', 'J')
        } else {
            addCompressedDouble('G', 'K');
        }
    }

    function handleH() {
    // keep if starts a word or is surrounded by vowels
    if((pos == 0 || isVowel(token[pos - 1])) && isVowel(token[pos + 1])) {
      add('H');
      pos++;
    }
    }

    function handleJ() {
        var jose = (token.substring(pos + 1, pos + 4) == 'OSE');

        if(san || jose) {
            if((pos == 0 && token[pos + 4] == ' ')
                    || san) {
                add('H');
            } else
                add('J', 'H');
        } else {
            if(pos == 0/* && !jose*/) {
                addSecondary('J', 'A');
            } else if(isVowel(token[pos - 1]) && !slavoGermanic
                    && (token[pos + 1] == 'A' || token[pos + 1] == 'O')) {
                addSecondary('J', 'H');
            } else if(pos == token.length - 1) {
                addSecondary('J', ' ');
            } else
                addCompressedDouble('J');
        }
    }

    function handleL() {
      if(token[pos + 1] == 'L') {
        if(pos == token.length - 3 && (
              subMatch(-1, 3, ['ILLO', 'ILLA', 'ALLE']) || (
                token.substring(pos - 1, pos + 3) == 'ALLE' &&
                (subMatch(-2, -1, ['AS', 'OS']) > -1 ||
                ['A', 'O'].indexOf(token[token.length - 1]) > -1)))) {
          addSecondary('L', '');
          pos++;
          return;
        }
        pos++;
      }
      add('L');
    }

    function handleM() {
      addCompressedDouble('M');
      if(token[pos - 1] == 'U' && token[pos + 1] == 'B' &&
          ((pos == token.length - 2  || token.substring(pos + 2, pos + 4) == 'ER')))
        pos++;
    }

    function handleP() {
      if(token[pos + 1] == 'H') {
        add('F');
        pos++;
      } else {
        addCompressedDouble('P');

      if(token[pos + 1] == 'B')
          pos++;
      }
    }

    function handleR() {
      if(pos == token.length - 1 && !slavoGermanic
          && token.substring(pos - 2, pos) == 'IE'
          && !subMatch(-4, -3, ['ME', 'MA'])) {
        addSecondary('', 'R');
      } else
        addCompressedDouble('R');
    }

    function handleS() {
        if(pos == 0 && token.substring(0, 5) == 'SUGAR') {
            addSecondary('X', 'S');
        } else if(token[pos + 1] == 'H') {
            if(subMatch(2, 5, ['EIM', 'OEK', 'OLM', 'OLZ'])) {
                add('S');
            } else {
                add('X');
            }
            pos++;
        } else if(subMatch(1, 3, ['IO', 'IA'])) {
            if(slavoGermanic) {
                add('S');
            } else {
                addSecondary('S', 'X');
            }
            pos++;
        } else if((pos == 0 && ['M', 'N', 'L', 'W'].indexOf(token[pos + 1]) > -1)
                || token[pos + 1] == 'Z') {
            addSecondary('S', 'X');
            if(token[pos + 1] == 'Z')
                pos++;
        } else if(token.substring(pos, pos + 2) == 'SC') {
            if(token[pos + 2] == 'H') {
                if(subMatch(3, 5, ['ER', 'EN'])) {
                    addSecondary('X', 'SK');
                } else if(subMatch(3, 5, ['OO', 'UY', 'ED', 'EM'])) {
                    add('SK');
                } else if(pos == 0 && !isVowel(token[3]) && token[3] != 'W') {
                    addSecondary('X', 'S');
                } else {
                    add('X');
                }
            } else if(['I', 'E', 'Y'].indexOf(token[pos + 2]) > -1) {
                add('S');
            } else {
                add('SK');
            }

            pos += 2;
        } else if(pos == token.length - 1
                && subMatch(-2, 0, ['AI', 'OI'])) {
            addSecondary('', 'S');
        } else if(token[pos + 1] != 'L' && (
                token[pos - 1] != 'A' && token[pos - 1] != 'I')) {
            addCompressedDouble('S');
            if(token[pos + 1] == 'Z')
                pos++;
        }
    }

    function handleT() {
        if(token.substring(pos + 1, pos + 4) == 'ION') {
            add('XN');
            pos += 3;
        } else if(subMatch(1, 3, ['IA', 'CH'])) {
            add('X');
            pos += 2;
        } else if(token[pos + 1] == 'H'
                || token.substring(1, 2) == 'TH') {
            if(subMatch(2, 4, ['OM', 'AM'])
                    || ['VAN ', 'VON '].indexOf(token.substring(0, 4)) > -1
                    || token.substring(0, 3) == 'SCH') {
                add('T');
            } else
                addSecondary('0', 'T');
            pos++;
        } else {
            addCompressedDouble('T');

            if(token[pos + 1] == 'D')
                pos++;
        }
    }

    function handleX() {
      if(pos == 0) {
        add('S');
      } else if(!(pos == token.length - 1
          && (['IAU', 'EAU', 'IEU'].indexOf(token.substring(pos - 3, pos)) > -1
            || ['AU', 'OU'].indexOf(token.substring(pos - 2, pos)) > -1))) {
        add('KS');
      }
    }

    function handleW() {
        if(pos == 0) {
            if(token[1] == 'H') {
                add('A');
            } else if (isVowel(token[1])) {
                addSecondary('A', 'F');
            }
        } else if((pos == token.length - 1 && isVowel(token[pos - 1])
                    || subMatch(-1, 4, ['EWSKI', 'EWSKY', 'OWSKI', 'OWSKY'])
                    || token.substring(0, 3) == 'SCH')) {
                addSecondary('', 'F');
                pos++;
        } else if(['ICZ', 'ITZ'].indexOf(token.substring(pos + 1, pos + 4)) > -1) {
            addSecondary('TS', 'FX');
            pos += 3;
        }
    }

    function handleZ() {
        if(token[pos + 1] == 'H') {
            add('J');
            pos++;
        } else if(subMatch(1, 3, ['ZO', 'ZI', 'ZA'])
                || (slavoGermanic && pos > 0 && token[pos - 1] != 'T')) {
            addSecondary('S', 'TS');
            pos++;
        } else
            addCompressedDouble('Z', 'S');
    }

    var san = (token.substring(0, 3) == 'SAN');
    var startsWithVowel = isVowel(token[0]);
    var slavoGermanic = token.match(/(W|K|CZ|WITZ)/);

    if(subMatch(0, 2, ['GN', 'KN', 'PN', 'WR', 'PS'])) {
      pos++;
    }

    while(pos < token.length) {
      switch(token[pos]) {
          case 'A': case 'E': case 'I': case 'O': case 'U': case 'Y':
          case 'Ê': case 'É': case 'É': case'À':
            if(pos == 0)
              add('A');
            break;
        case 'B':
          addCompressedDouble('B', 'P');
          break;
            case 'C':
                handleC();
                break;
          case 'Ç':
              add("S");
              break;
          case 'D':
            handleD();
            break;
          case 'F': case 'K': case 'N':
            addCompressedDouble(token[pos]);
            break;
            case 'G':
                handleG();
                break;
          case 'H':
            handleH();
            break;
            case 'J':
                handleJ();
                break;
          case 'L':
            handleL();
            break;
          case 'M':
            handleM();
            break;
          case 'Ñ':
            add('N');
            break;
          case 'P':
            handleP();
            break;
          case 'Q':
            addCompressedDouble('Q', 'K');
            break;
          case 'R':
            handleR();
            break;
            case 'S':
                handleS();
                break;
            case 'T':
                handleT();
                break;
          case 'V':
            addCompressedDouble('V', 'F');
            break;
            case 'W':
                handleW();
                break;
          case 'X':
            handleX();
            break;
          case 'Z':
            handleZ();
            break;
      }

        if(primary.length >= maxLength && secondary.length >= maxLength) {
            break;
        }

      pos++;
    }

    return [truncate(primary, maxLength), truncate(secondary, maxLength)];
}

function compare(stringA, stringB) {
    var encodingsA = process(stringA),
        encodingsB = process(stringB);

    return encodingsA[0] == encodingsB[0] ||
        encodingsA[1] == encodingsB[1];
};

DoubleMetaphone.compare = compare
DoubleMetaphone.process = process;
DoubleMetaphone.isVowel = isVowel;
});

require.define("/lib/natural/stemmers/porter_stemmer.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Stemmer = require('./stemmer');

// denote groups of consecutive consonants with a C and consecutive vowels
// with a V.
function categorizeGroups(token) {
    return token.replace(/[^aeiou]+/g, 'C').replace(/[aeiouy]+/g, 'V');
}

// denote single consonants with a C and single vowels with a V
function categorizeChars(token) {
    return token.replace(/[^aeiou]/g, 'C').replace(/[aeiouy]/g, 'V');
}

// calculate the "measure" M of a word. M is the count of VC sequences dropping
// an initial C if it exists and a trailing V if it exists.
function measure(token) {
    if(!token)
  return -1;

    return categorizeGroups(token).replace(/^C/, '').replace(/V$/, '').length / 2;
}

// determine if a token end with a double consonant i.e. happ
function endsWithDoublCons(token) {
    return token.match(/([^aeiou])\1$/);
}

// replace a pattern in a word. if a replacement occurs an optional callback
// can be called to post-process the result. if no match is made NULL is
// returned.
function attemptReplace(token, pattern, replacement, callback) {
    var result = null;

    if((typeof pattern == 'string') && token.substr(0 - pattern.length) == pattern)
        result = token.replace(new RegExp(pattern + '$'), replacement);
    else if((pattern instanceof RegExp) && token.match(pattern))
        result = token.replace(pattern, replacement);

    if(result && callback)
        return callback(result);
    else
        return result;
}

// attempt to replace a list of patterns/replacements on a token for a minimum
// measure M.
function attemptReplacePatterns(token, replacements, measureThreshold) {
    var replacement = null;

    for(var i = 0; i < replacements.length; i++) {
  if(measureThreshold == null || measure(attemptReplace(token, replacements[i][0], '')) > measureThreshold)
      replacement = attemptReplace(token, replacements[i][0], replacements[i][1]);

  if(replacement)
      break;
    }

    return replacement;
}

// replace a list of patterns/replacements on a word. if no match is made return
// the original token.
function replacePatterns(token, replacements, measureThreshold) {
    var result = attemptReplacePatterns(token, replacements, measureThreshold);
    token = result == null ? token : result;

    return token;
}

// step 1a as defined for the porter stemmer algorithm.
function step1a(token) {
    if(token.match(/(ss|i)es$/))
        return token.replace(/(ss|i)es$/, '$1');

    if(token.substr(-1) == 's' && token.substr(-2, 1) != 's')
        return token.replace(/s?$/, '');

    return token;
}

// step 1b as defined for the porter stemmer algorithm.
function step1b(token) {
    if(token.substr(-3) == 'eed') {
  if(measure(token.substr(0, token.length - 3)) > 0)
            return token.replace(/eed$/, 'ee');
    } else {
  var result = attemptReplace(token, /ed|ing$/, '', function(token) {
      if(categorizeGroups(token).indexOf('V') > 0) {
    var result = attemptReplacePatterns(token, [['at', 'ate'],  ['bl', 'ble'], ['iz', 'ize']]);

    if(result)
        return result;
    else {
        if(endsWithDoublCons(token) && token.match(/[^lsz]$/))
      return token.replace(/([^aeiou])\1$/, '$1');

        if(measure(token) == 1 && categorizeChars(token).substr(-3) == 'CVC' && token.match(/[^wxy]$/))
      return token + 'e';
    }

    return token;
      }

      return null;
  });

  if(result)
      return result;
    }

    return token;
}

// step 1c as defined for the porter stemmer algorithm.
function step1c(token) {
    if(categorizeGroups(token).substr(-2, 1) == 'V') {
        if(token.substr(-1) == 'y')
            return token.replace(/y$/, 'i');
    }

    return token;
}

// step 2 as defined for the porter stemmer algorithm.
function step2(token) {
    return replacePatterns(token, [['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
        ['izer', 'ize'], ['abli', 'able'], ['alli', 'al'], ['entli', 'ent'], ['eli', 'e'],
        ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'], ['ator', 'ate'],['alism', 'al'],
        ['iveness', 'ive'], ['fulness', 'ful'], ['ousness', 'ous'], ['aliti', 'al'],
        ['iviti', 'ive'], ['biliti', 'ble']], 0);
}

// step 3 as defined for the porter stemmer algorithm.
function step3(token) {
    return replacePatterns(token, [['icate', 'ic'], ['ative', ''], ['alize', 'al'],
           ['iciti', 'ic'], ['ical', 'ic'], ['ful', ''], ['ness', '']], 0);
}

// step 4 as defined for the porter stemmer algorithm.
function step4(token) {
    return replacePatterns(token, [['al', ''], ['ance', ''], ['ence', ''], ['er', ''],
        ['ic', ''], ['able', ''], ['ible', ''], ['ant', ''],
        ['ement', ''], ['ment', ''], ['ent', ''], [/([st])ion/, '$1'], ['ou', ''], ['ism', ''],
        ['ate', ''], ['iti', ''], ['ous', ''], ['ive', ''],
        ['ize', '']], 1);
}

// step 5a as defined for the porter stemmer algorithm.
function step5a(token) {
    var m = measure(token);

    if((m > 1 && token.substr(-1) == 'e') || (m == 1 && !(categorizeChars(token).substr(-4, 3) == 'CVC' && token.match(/[^wxy].$/))))
        return token.replace(/e$/, '');

    return token;
}

// step 5b as defined for the porter stemmer algorithm.
function step5b(token) {
    if(measure(token) > 1) {
        if(endsWithDoublCons(token) && token.substr(-2) == 'll')
           return token.replace(/ll$/, 'l');
    }

    return token;
}

var PorterStemmer = new Stemmer();
module.exports = PorterStemmer;

// perform full stemming algorithm on a single word
PorterStemmer.stem = function(token) {
    return step5b(step5a(step4(step3(step2(step1c(step1b(step1a(token.toLowerCase())))))))).toString();
};

//exports for tests
PorterStemmer.step1a = step1a;
PorterStemmer.step1b = step1b;
PorterStemmer.step1c = step1c;
PorterStemmer.step2 = step2;
PorterStemmer.step3 = step3;
PorterStemmer.step4 = step4;
PorterStemmer.step5a = step5a;
PorterStemmer.step5b = step5b;
});

require.define("/lib/natural/stemmers/stemmer.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var stopwords = require('../util/stopwords');
var Tokenizer = require('../tokenizers/aggressive_tokenizer');

module.exports = function() {
    var stemmer = this;

    stemmer.stem = function(token) {
        return token;
    };

    stemmer.tokenizeAndStem = function(text, keepStops) {
        var stemmedTokens = [];

        new Tokenizer().tokenize(text).forEach(function(token) {
            if(keepStops || stopwords.words.indexOf(token) == -1)
                stemmedTokens.push(stemmer.stem(token));
        });

        return stemmedTokens;
    };

    stemmer.attach = function() {
        String.prototype.stem = function() {
            return stemmer.stem(this);
        };

        String.prototype.tokenizeAndStem = function(keepStops) {
            return stemmer.tokenizeAndStem(this, keepStops);
        };
    };
}
});

require.define("/lib/natural/tokenizers/aggressive_tokenizer.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Tokenizer = require('./tokenizer'),
    util = require('util');

AggressiveTokenizer = function() {
    Tokenizer.call(this);
};
util.inherits(AggressiveTokenizer, Tokenizer);

module.exports = AggressiveTokenizer;

AggressiveTokenizer.prototype.tokenize = function(text) {
    // break a string up into an array of tokens by anything non-word
    return this.trim(text.split(/\W+/));
};
});

require.define("/lib/natural/tokenizers/tokenizer.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Tokenizer = function() {
};

Tokenizer.prototype.trim = function(array) {
    if(array[array.length - 1] == '')
        array.pop();

    if(array[0] == '')
        array.shift();

    return array;
};

// expose an attach function that will patch String with a tokenize method
Tokenizer.prototype.attach = function() {
    var tokenizer = this;

    String.prototype.tokenize = function() {
        return tokenizer.tokenize(this);
    }
};

Tokenizer.prototype.tokenize = function() {};

module.exports = Tokenizer;
});

require.define("util",function(require,module,exports,__dirname,__filename,process){var events = require('events');

exports.print = function () {};
exports.puts = function () {};
exports.debug = function() {};

exports.inspect = function(obj, showHidden, depth, colors) {
  var seen = [];

  var stylize = function(str, styleType) {
    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
    var styles =
        { 'bold' : [1, 22],
          'italic' : [3, 23],
          'underline' : [4, 24],
          'inverse' : [7, 27],
          'white' : [37, 39],
          'grey' : [90, 39],
          'black' : [30, 39],
          'blue' : [34, 39],
          'cyan' : [36, 39],
          'green' : [32, 39],
          'magenta' : [35, 39],
          'red' : [31, 39],
          'yellow' : [33, 39] };

    var style =
        { 'special': 'cyan',
          'number': 'blue',
          'boolean': 'yellow',
          'undefined': 'grey',
          'null': 'bold',
          'string': 'green',
          'date': 'magenta',
          // "name": intentionally not styling
          'regexp': 'red' }[styleType];

    if (style) {
      return '\033[' + styles[style][0] + 'm' + str +
             '\033[' + styles[style][1] + 'm';
    } else {
      return str;
    }
  };
  if (! colors) {
    stylize = function(str, styleType) { return str; };
  }

  function format(value, recurseTimes) {
    // Provide a hook for user-specified inspect functions.
    // Check that value is an object with an inspect function on it
    if (value && typeof value.inspect === 'function' &&
        // Filter out the util module, it's inspect function is special
        value !== exports &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
      return value.inspect(recurseTimes);
    }

    // Primitive types cannot have properties
    switch (typeof value) {
      case 'undefined':
        return stylize('undefined', 'undefined');

      case 'string':
        var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                                 .replace(/'/g, "\\'")
                                                 .replace(/\\"/g, '"') + '\'';
        return stylize(simple, 'string');

      case 'number':
        return stylize('' + value, 'number');

      case 'boolean':
        return stylize('' + value, 'boolean');
    }
    // For some reason typeof null is "object", so special case here.
    if (value === null) {
      return stylize('null', 'null');
    }

    // Look up the keys of the object.
    var visible_keys = Object_keys(value);
    var keys = showHidden ? Object_getOwnPropertyNames(value) : visible_keys;

    // Functions without properties can be shortcutted.
    if (typeof value === 'function' && keys.length === 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        var name = value.name ? ': ' + value.name : '';
        return stylize('[Function' + name + ']', 'special');
      }
    }

    // Dates without properties can be shortcutted
    if (isDate(value) && keys.length === 0) {
      return stylize(value.toUTCString(), 'date');
    }

    var base, type, braces;
    // Determine the object type
    if (isArray(value)) {
      type = 'Array';
      braces = ['[', ']'];
    } else {
      type = 'Object';
      braces = ['{', '}'];
    }

    // Make functions say that they are functions
    if (typeof value === 'function') {
      var n = value.name ? ': ' + value.name : '';
      base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';
    } else {
      base = '';
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
      base = ' ' + value.toUTCString();
    }

    if (keys.length === 0) {
      return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        return stylize('[Object]', 'special');
      }
    }

    seen.push(value);

    var output = keys.map(function(key) {
      var name, str;
      if (value.__lookupGetter__) {
        if (value.__lookupGetter__(key)) {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Getter/Setter]', 'special');
          } else {
            str = stylize('[Getter]', 'special');
          }
        } else {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Setter]', 'special');
          }
        }
      }
      if (visible_keys.indexOf(key) < 0) {
        name = '[' + key + ']';
      }
      if (!str) {
        if (seen.indexOf(value[key]) < 0) {
          if (recurseTimes === null) {
            str = format(value[key]);
          } else {
            str = format(value[key], recurseTimes - 1);
          }
          if (str.indexOf('\n') > -1) {
            if (isArray(value)) {
              str = str.split('\n').map(function(line) {
                return '  ' + line;
              }).join('\n').substr(2);
            } else {
              str = '\n' + str.split('\n').map(function(line) {
                return '   ' + line;
              }).join('\n');
            }
          }
        } else {
          str = stylize('[Circular]', 'special');
        }
      }
      if (typeof name === 'undefined') {
        if (type === 'Array' && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.substr(1, name.length - 2);
          name = stylize(name, 'name');
        } else {
          name = name.replace(/'/g, "\\'")
                     .replace(/\\"/g, '"')
                     .replace(/(^"|"$)/g, "'");
          name = stylize(name, 'string');
        }
      }

      return name + ': ' + str;
    });

    seen.pop();

    var numLinesEst = 0;
    var length = output.reduce(function(prev, cur) {
      numLinesEst++;
      if (cur.indexOf('\n') >= 0) numLinesEst++;
      return prev + cur.length + 1;
    }, 0);

    if (length > 50) {
      output = braces[0] +
               (base === '' ? '' : base + '\n ') +
               ' ' +
               output.join(',\n  ') +
               ' ' +
               braces[1];

    } else {
      output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }

    return output;
  }
  return format(obj, (typeof depth === 'undefined' ? 2 : depth));
};


function isArray(ar) {
  return ar instanceof Array ||
         Array.isArray(ar) ||
         (ar && ar !== Object.prototype && isArray(ar.__proto__));
}


function isRegExp(re) {
  return re instanceof RegExp ||
    (typeof re === 'object' && Object.prototype.toString.call(re) === '[object RegExp]');
}


function isDate(d) {
  if (d instanceof Date) return true;
  if (typeof d !== 'object') return false;
  var properties = Date.prototype && Object_getOwnPropertyNames(Date.prototype);
  var proto = d.__proto__ && Object_getOwnPropertyNames(d.__proto__);
  return JSON.stringify(proto) === JSON.stringify(properties);
}

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}

exports.log = function (msg) {};

exports.pump = null;

var Object_keys = Object.keys || function (obj) {
    var res = [];
    for (var key in obj) res.push(key);
    return res;
};

var Object_getOwnPropertyNames = Object.getOwnPropertyNames || function (obj) {
    var res = [];
    for (var key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) res.push(key);
    }
    return res;
};

var Object_create = Object.create || function (prototype, properties) {
    // from es5-shim
    var object;
    if (prototype === null) {
        object = { '__proto__' : null };
    }
    else {
        if (typeof prototype !== 'object') {
            throw new TypeError(
                'typeof prototype[' + (typeof prototype) + '] != \'object\''
            );
        }
        var Type = function () {};
        Type.prototype = prototype;
        object = new Type();
        object.__proto__ = prototype;
    }
    if (typeof properties !== 'undefined' && Object.defineProperties) {
        Object.defineProperties(object, properties);
    }
    return object;
};

exports.inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object_create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};
});

require.define("events",function(require,module,exports,__dirname,__filename,process){if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    }
;

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var args = Array.prototype.slice.call(arguments, 1);

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // Check for listener leak
    if (!this._events[type].warned) {
      var m;
      if (this._events.maxListeners !== undefined) {
        m = this._events.maxListeners;
      } else {
        m = defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
                      'leak detected. %d listeners added. ' +
                      'Use emitter.setMaxListeners() to increase limit.',
                      this._events[type].length);
        console.trace();
      }
    }

    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  var self = this;
  self.on(type, function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  });

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var i = list.indexOf(listener);
    if (i < 0) return this;
    list.splice(i, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (this._events[type] === listener) {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};
});

require.define("/lib/natural/stemmers/porter_stemmer_ru.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2012, Polyakov Vladimir, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights