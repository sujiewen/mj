require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return b64.length * 3 / 4 - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  var actual = that.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual)
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":1,"ieee754":4,"isarray":3}],3:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],4:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],"Alert":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'c12553sxCxG/on0Bz7rkX0f', 'Alert');
// scripts/components/Alert.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _alert: null,
        _btnOK: null,
        _btnCancel: null,
        _title: null,
        _content: null,
        _onok: null
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (cc.vv == null) {
            return;
        }
        this._alert = cc.find("Canvas/alert");
        this._title = cc.find("Canvas/alert/title").getComponent(cc.Label);
        this._content = cc.find("Canvas/alert/content").getComponent(cc.Label);

        this._btnOK = cc.find("Canvas/alert/btn_ok");
        this._btnCancel = cc.find("Canvas/alert/btn_cancel");

        cc.vv.utils.addClickEvent(this._btnOK, this.node, "Alert", "onBtnClicked");
        cc.vv.utils.addClickEvent(this._btnCancel, this.node, "Alert", "onBtnClicked");

        this._alert.active = false;
        cc.vv.alert = this;
    },

    onBtnClicked: function onBtnClicked(event) {
        if (event.target.name == "btn_ok") {
            if (this._onok) {
                this._onok();
            }
        }
        this._alert.active = false;
        this._onok = null;
    },

    show: function show(title, content, onok, needcancel) {
        this._alert.active = true;
        this._onok = onok;
        this._title.string = title;
        this._content.string = content;
        if (needcancel) {
            this._btnCancel.active = true;
            this._btnOK.x = -150;
            this._btnCancel.x = 150;
        } else {
            this._btnCancel.active = false;
            this._btnOK.x = 0;
        }
    },

    onDestory: function onDestory() {
        if (cc.vv) {
            cc.vv.alert = null;
        }
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"AudioMgr":[function(require,module,exports){
"use strict";
cc._RF.push(module, '55caepcpvFK5r0Ax5f8jss4', 'AudioMgr');
// scripts/AudioMgr.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        bgmVolume: 1.0,
        sfxVolume: 1.0,

        bgmAudioID: -1
    },

    // use this for initialization
    init: function init() {
        var t = cc.sys.localStorage.getItem("bgmVolume");
        if (t != null) {
            this.bgmVolume = parseFloat(t);
        }

        var t = cc.sys.localStorage.getItem("sfxVolume");
        if (t != null) {
            this.sfxVolume = parseFloat(t);
        }

        cc.game.on(cc.game.EVENT_HIDE, function () {
            console.log("cc.audioEngine.pauseAll");
            cc.audioEngine.pauseAll();
        });
        cc.game.on(cc.game.EVENT_SHOW, function () {
            console.log("cc.audioEngine.resumeAll");
            cc.audioEngine.resumeAll();
        });
    },

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },

    getUrl: function getUrl(url) {
        return cc.url.raw("resources/sounds/" + url);
    },

    playBGM: function playBGM(url) {
        var audioUrl = this.getUrl(url);
        console.log(audioUrl);
        if (this.bgmAudioID >= 0) {
            cc.audioEngine.stop(this.bgmAudioID);
        }
        this.bgmAudioID = cc.audioEngine.play(audioUrl, true, this.bgmVolume);
    },
    playSFX: function playSFX(url) {
        var audioUrl = this.getUrl(url);
        if (this.sfxVolume > 0) {
            var audioId = cc.audioEngine.play(audioUrl, false, this.sfxVolume);
        }
    },


    setSFXVolume: function setSFXVolume(v) {
        if (this.sfxVolume != v) {
            cc.sys.localStorage.setItem("sfxVolume", v);
            this.sfxVolume = v;
        }
    },

    setBGMVolume: function setBGMVolume(v, force) {
        if (this.bgmAudioID >= 0) {
            if (v > 0) {
                cc.audioEngine.resume(this.bgmAudioID);
            } else {
                cc.audioEngine.pause(this.bgmAudioID);
            }
            //cc.audioEngine.setVolume(this.bgmAudioID,this.bgmVolume);
        }
        if (this.bgmVolume != v || force) {
            cc.sys.localStorage.setItem("bgmVolume", v);
            this.bgmVolume = v;
            cc.audioEngine.setVolume(this.bgmAudioID, v);
        }
    },

    pauseAll: function pauseAll() {
        cc.audioEngine.pauseAll();
    },

    resumeAll: function resumeAll() {
        cc.audioEngine.resumeAll();
    }
});

cc._RF.pop();
},{}],"Chat":[function(require,module,exports){
"use strict";
cc._RF.push(module, '58f27rxustNsYlRX3fryN8X', 'Chat');
// scripts/components/Chat.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _chatRoot: null,
        _tabQuick: null,
        _tabEmoji: null,
        _iptChat: null,

        _quickChatInfo: null,
        _btnChat: null
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (cc.vv == null) {
            return;
        }

        cc.vv.chat = this;

        this._btnChat = this.node.getChildByName("btn_chat");
        this._btnChat.active = cc.vv.replayMgr.isReplay() == false;

        this._chatRoot = this.node.getChildByName("chat");
        this._chatRoot.active = false;

        this._tabQuick = this._chatRoot.getChildByName("quickchatlist");
        this._tabEmoji = this._chatRoot.getChildByName("emojis");

        this._iptChat = this._chatRoot.getChildByName("iptChat").getComponent(cc.EditBox);

        this._quickChatInfo = {};
        this._quickChatInfo["item0"] = { index: 0, content: "快点啊，都等到我花儿都谢谢了！", sound: "fix_msg_1.mp3" };
        this._quickChatInfo["item1"] = { index: 1, content: "怎么又断线了，网络怎么这么差啊！", sound: "fix_msg_2.mp3" };
        this._quickChatInfo["item2"] = { index: 2, content: "不要走，决战到天亮！", sound: "fix_msg_3.mp3" };
        this._quickChatInfo["item3"] = { index: 3, content: "你的牌打得也太好了！", sound: "fix_msg_4.mp3" };
        this._quickChatInfo["item4"] = { index: 4, content: "你是妹妹还是哥哥啊？", sound: "fix_msg_5.mp3" };
        this._quickChatInfo["item5"] = { index: 5, content: "和你合作真是太愉快了！", sound: "fix_msg_6.mp3" };
        this._quickChatInfo["item6"] = { index: 6, content: "大家好，很高兴见到各位！", sound: "fix_msg_7.mp3" };
        this._quickChatInfo["item7"] = { index: 7, content: "各位，真是不好意思，我得离开一会儿。", sound: "fix_msg_8.mp3" };
        this._quickChatInfo["item8"] = { index: 8, content: "不要吵了，专心玩游戏吧！", sound: "fix_msg_9.mp3" };
    },

    getQuickChatInfo: function getQuickChatInfo(index) {
        var key = "item" + index;
        return this._quickChatInfo[key];
    },


    onBtnChatClicked: function onBtnChatClicked() {
        this._chatRoot.active = true;
    },

    onBgClicked: function onBgClicked() {
        this._chatRoot.active = false;
    },

    onTabClicked: function onTabClicked(event) {
        if (event.target.name == "tabQuick") {
            this._tabQuick.active = true;
            this._tabEmoji.active = false;
        } else if (event.target.name == "tabEmoji") {
            this._tabQuick.active = false;
            this._tabEmoji.active = true;
        }
    },

    onQuickChatItemClicked: function onQuickChatItemClicked(event) {
        this._chatRoot.active = false;
        var info = this._quickChatInfo[event.target.name];
        cc.vv.net.send("quick_chat", info.index);
    },

    onEmojiItemClicked: function onEmojiItemClicked(event) {
        console.log(event.target.name);
        this._chatRoot.active = false;
        cc.vv.net.send("emoji", event.target.name);
    },

    onBtnSendChatClicked: function onBtnSendChatClicked() {
        this._chatRoot.active = false;
        if (this._iptChat.string == "") {
            return;
        }
        cc.vv.net.send("chat", this._iptChat.string);
        this._iptChat.string = "";
    }

});

cc._RF.pop();
},{}],"CheckBox":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'dc9e5hcegFBFpbh0CwUFw8V', 'CheckBox');
// scripts/components/CheckBox.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        target: cc.Node,
        sprite: cc.SpriteFrame,
        checkedSprite: cc.SpriteFrame,
        checked: false
    },

    // use this for initialization
    onLoad: function onLoad() {
        this.refresh();
    },

    onClicked: function onClicked() {
        this.checked = !this.checked;
        this.refresh();
    },

    refresh: function refresh() {
        var targetSprite = this.target.getComponent(cc.Sprite);
        if (this.checked) {
            targetSprite.spriteFrame = this.checkedSprite;
        } else {
            targetSprite.spriteFrame = this.sprite;
        }
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"Cocos2dxBridge":[function(require,module,exports){
"use strict";
cc._RF.push(module, '0ebe9drjYtCKYYDoErhlbbz', 'Cocos2dxBridge');
// scripts/Cocos2dxBridge.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
    },

    login: function login() {
        if (cc.sys.isNative) {
            var ret;
            switch (cc.sys.os) {
                case cc.sys.OS_ANDROID:
                    ret = jsb.reflection.callStaticMethod("org/cocos2dx/javascript/AppActivity", "login", "()V");
                    break;
                case cc.sys.OS_IOS:
                    ret = jsb.reflection.callStaticMethod("WXAuthUtil", "login:", "NBWXCallback");
                    break;
            }
            cc.log("微信登录--" + ret);
        }
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"CreateRole":[function(require,module,exports){
"use strict";
cc._RF.push(module, '5d56bFYy/REb77pQCq9YHh6', 'CreateRole');
// scripts/components/CreateRole.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        inputName: cc.EditBox
    },

    onRandomBtnClicked: function onRandomBtnClicked() {
        var names = ["上官", "欧阳", "东方", "端木", "独孤", "司马", "南宫", "夏侯", "诸葛", "皇甫", "长孙", "宇文", "轩辕", "东郭", "子车", "东阳", "子言"];

        var names2 = ["雀圣", "赌侠", "赌圣", "稳赢", "不输", "好运", "自摸", "有钱", "土豪"];
        var idx = Math.floor(Math.random() * (names.length - 1));
        var idx2 = Math.floor(Math.random() * (names2.length - 1));
        this.inputName.string = names[idx] + names2[idx2];
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (!cc.sys.isNative && cc.sys.isMobile) {
            var cvs = this.node.getComponent(cc.Canvas);
            cvs.fitHeight = true;
            cvs.fitWidth = true;
        }
        this.onRandomBtnClicked();
    },

    onBtnConfirmClicked: function onBtnConfirmClicked() {
        var name = this.inputName.string;
        if (name == "") {
            console.log("invalid name.");
            return;
        }
        console.log(name);
        cc.vv.userMgr.create(name);
    }
    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"CreateRoom":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'eec07HsL4pBn5/PiT3SYBew', 'CreateRoom');
// scripts/components/CreateRoom.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _difenxuanze: null,
        _zimo: null,
        _wanfaxuanze: null,
        _zuidafanshu: null,
        _jushuxuanze: null,
        _dianganghua: null,
        _leixingxuanze: null
    },

    // use this for initialization
    onLoad: function onLoad() {
        this._leixingxuanze = [];
        var t = this.node.getChildByName("leixingxuanze");
        for (var i = 0; i < t.childrenCount; ++i) {
            var n = t.children[i].getComponent("RadioButton");
            if (n != null) {
                this._leixingxuanze.push(n);
            }
        }

        this._difenxuanze = [];
        var t = this.node.getChildByName("difenxuanze");
        for (var i = 0; i < t.childrenCount; ++i) {
            var n = t.children[i].getComponent("RadioButton");
            if (n != null) {
                this._difenxuanze.push(n);
            }
        }
        //console.log(this._difenxuanze);

        this._zimo = [];
        var t = this.node.getChildByName("zimojiacheng");
        for (var i = 0; i < t.childrenCount; ++i) {
            var n = t.children[i].getComponent("RadioButton");
            if (n != null) {
                this._zimo.push(n);
            }
        }
        //console.log(this._zimo);

        this._wanfaxuanze = [];
        var t = this.node.getChildByName("wanfaxuanze");
        for (var i = 0; i < t.childrenCount; ++i) {
            var n = t.children[i].getComponent("CheckBox");
            if (n != null) {
                this._wanfaxuanze.push(n);
            }
        }
        //console.log(this._wanfaxuanze);

        this._zuidafanshu = [];
        var t = this.node.getChildByName("zuidafanshu");
        for (var i = 0; i < t.childrenCount; ++i) {
            var n = t.children[i].getComponent("RadioButton");
            if (n != null) {
                this._zuidafanshu.push(n);
            }
        }
        //console.log(this._zuidafanshu);

        this._jushuxuanze = [];
        var t = this.node.getChildByName("xuanzejushu");
        for (var i = 0; i < t.childrenCount; ++i) {
            var n = t.children[i].getComponent("RadioButton");
            if (n != null) {
                this._jushuxuanze.push(n);
            }
        }

        this._dianganghua = [];
        var t = this.node.getChildByName("dianganghua");
        for (var i = 0; i < t.childrenCount; ++i) {
            var n = t.children[i].getComponent("RadioButton");
            if (n != null) {
                this._dianganghua.push(n);
            }
        }
        //console.log(this._jushuxuanze);
    },

    onBtnBack: function onBtnBack() {
        this.node.active = false;
    },

    onBtnOK: function onBtnOK() {
        this.node.active = false;
        this.createRoom();
    },

    createRoom: function createRoom() {
        var self = this;
        var onCreate = function onCreate(ret) {
            if (ret.errcode !== 0) {
                cc.vv.wc.hide();
                //console.log(ret.errmsg);
                if (ret.errcode == 2222) {
                    cc.vv.alert.show("提示", "房卡不足，创建房间失败!");
                } else {
                    cc.vv.alert.show("提示", "创建房间失败,错误码:" + ret.errcode);
                }
            } else {
                cc.vv.gameNetMgr.connectGameServer(ret);
            }
        };

        var difen = 0;
        for (var i = 0; i < self._difenxuanze.length; ++i) {
            if (self._difenxuanze[i].checked) {
                difen = i;
                break;
            }
        }

        var zimo = 0;
        for (var i = 0; i < self._zimo.length; ++i) {
            if (self._zimo[i].checked) {
                zimo = i;
                break;
            }
        }

        var huansanzhang = self._wanfaxuanze[0].checked;
        var jiangdui = self._wanfaxuanze[1].checked;
        var menqing = self._wanfaxuanze[2].checked;
        var tiandihu = self._wanfaxuanze[3].checked;

        var type = 0;
        for (var i = 0; i < self._leixingxuanze.length; ++i) {
            if (self._leixingxuanze[i].checked) {
                type = i;
                break;
            }
        }

        if (type == 0) {
            type = "xzdd";
        } else {
            type = "xlch";
        }

        var zuidafanshu = 0;
        for (var i = 0; i < self._zuidafanshu.length; ++i) {
            if (self._zuidafanshu[i].checked) {
                zuidafanshu = i;
                break;
            }
        }

        var jushuxuanze = 0;
        for (var i = 0; i < self._jushuxuanze.length; ++i) {
            if (self._jushuxuanze[i].checked) {
                jushuxuanze = i;
                break;
            }
        }

        var dianganghua = 0;
        for (var i = 0; i < self._dianganghua.length; ++i) {
            if (self._dianganghua[i].checked) {
                dianganghua = i;
                break;
            }
        }

        var conf = {
            type: type,
            difen: difen,
            zimo: zimo,
            jiangdui: jiangdui,
            huansanzhang: huansanzhang,
            zuidafanshu: zuidafanshu,
            jushuxuanze: jushuxuanze,
            dianganghua: dianganghua,
            menqing: menqing,
            tiandihu: tiandihu
        };

        var data = {
            account: cc.vv.userMgr.account,
            sign: cc.vv.userMgr.sign,
            conf: JSON.stringify(conf)
        };
        console.log(data);
        cc.vv.wc.show("正在创建房间");
        cc.vv.http.sendRequest("/create_private_room", data, onCreate);
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"DingQue":[function(require,module,exports){
"use strict";
cc._RF.push(module, '907582awNJFnobC/mZGFLBq', 'DingQue');
// scripts/components/DingQue.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        queYiMen: null,
        tips: [],
        selected: [],
        dingques: []
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (cc.vv == null) {
            return;
        }
        this.initView();
        this.initDingQue();
        this.initEventHandlers();
    },

    initView: function initView() {
        var gameChild = this.node.getChildByName("game");
        this.queYiMen = gameChild.getChildByName("dingque");
        this.queYiMen.active = cc.vv.gameNetMgr.isDingQueing;

        var arr = ["myself", "right", "up", "left"];
        for (var i = 0; i < arr.length; ++i) {
            var side = gameChild.getChildByName(arr[i]);
            var seat = side.getChildByName("seat");
            var dingque = seat.getChildByName("que");
            this.dingques.push(dingque);
        }
        this.reset();

        var tips = this.queYiMen.getChildByName("tips");
        for (var i = 0; i < tips.childrenCount; ++i) {
            var n = tips.children[i];
            this.tips.push(n.getComponent(cc.Label));
        }

        if (cc.vv.gameNetMgr.gamestate == "dingque") {
            this.showDingQueChoice();
        }
    },

    initEventHandlers: function initEventHandlers() {
        var self = this;
        this.node.on('game_dingque', function (data) {
            self.showDingQueChoice();
        });

        this.node.on('game_dingque_notify', function (data) {
            var seatIndex = cc.vv.gameNetMgr.getSeatIndexByID(data.detail);
            var localIndex = cc.vv.gameNetMgr.getLocalIndex(seatIndex);
            console.log("game_dingque_notify:" + localIndex);
            self.tips[localIndex].node.active = true;
        });

        this.node.on('game_dingque_finish', function () {
            //通知每一个玩家定缺的花色
            self.queYiMen.active = false;
            cc.vv.gameNetMgr.isDingQueing = false;
            self.initDingQue();
        });
    },

    showDingQueChoice: function showDingQueChoice() {
        this.queYiMen.active = true;
        var sd = cc.vv.gameNetMgr.getSelfData();
        var typeCounts = [0, 0, 0];
        for (var i = 0; i < sd.holds.length; ++i) {
            var pai = sd.holds[i];
            var type = cc.vv.mahjongmgr.getMahjongType(pai);
            typeCounts[type]++;
        }

        var min = 65535;
        var minIndex = 0;
        for (var i = 0; i < typeCounts.length; ++i) {
            if (typeCounts[i] < min) {
                min = typeCounts[i];
                minIndex = i;
            }
        }

        var arr = ["tong", "tiao", "wan"];
        for (var i = 0; i < arr.length; ++i) {
            var node = this.queYiMen.getChildByName(arr[i]);
            if (minIndex == i) {
                node.getComponent(cc.Animation).play("dingque_tuijian");
            } else {
                node.getComponent(cc.Animation).stop();
            }
            //this.queYiMen.getChildByName(arr[i]).getChildByName('jian').active = minIndex == i;    
        }

        this.reset();
        for (var i = 0; i < this.tips.length; ++i) {
            var n = this.tips[i];
            if (i > 0) {
                n.node.active = false;
            } else {
                n.node.active = true;
            }
        }
    },

    initDingQue: function initDingQue() {
        var arr = ["tong", "tiao", "wan"];
        var data = cc.vv.gameNetMgr.seats;
        for (var i = 0; i < data.length; ++i) {
            var que = data[i].dingque;
            if (que == null || que < 0 || que >= arr.length) {
                que = null;
            } else {
                que = arr[que];
            }

            var localIndex = cc.vv.gameNetMgr.getLocalIndex(i);
            if (que) {
                this.dingques[localIndex].getChildByName(que).active = true;
            }
        }
    },

    reset: function reset() {
        this.setInteractable(true);

        this.selected.push(this.queYiMen.getChildByName("tong_selected"));
        this.selected.push(this.queYiMen.getChildByName("tiao_selected"));
        this.selected.push(this.queYiMen.getChildByName("wan_selected"));
        for (var i = 0; i < this.selected.length; ++i) {
            this.selected[i].active = false;
        }

        for (var i = 0; i < this.dingques.length; ++i) {
            for (var j = 0; j < this.dingques[i].children.length; ++j) {
                this.dingques[i].children[j].active = false;
            }
        }
    },

    onQueYiMenClicked: function onQueYiMenClicked(event) {
        var type = 0;
        if (event.target.name == "tong") {
            type = 0;
        } else if (event.target.name == "tiao") {
            type = 1;
        } else if (event.target.name == "wan") {
            type = 2;
        }

        for (var i = 0; i < this.selected.length; ++i) {
            this.selected[i].active = false;
        }
        this.selected[type].active = true;
        cc.vv.gameNetMgr.dingque = type;
        cc.vv.net.send("dingque", type);

        //this.setInteractable(false);
    },

    setInteractable: function setInteractable(value) {
        this.queYiMen.getChildByName("tong").getComponent(cc.Button).interactable = value;
        this.queYiMen.getChildByName("tiao").getComponent(cc.Button).interactable = value;
        this.queYiMen.getChildByName("wan").getComponent(cc.Button).interactable = value;
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"Folds":[function(require,module,exports){
"use strict";
cc._RF.push(module, '0bf63eiZEFMWbW03o8heqa5', 'Folds');
// scripts/components/Folds.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _folds: null
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (cc.vv == null) {
            return;
        }

        this.initView();
        this.initEventHandler();

        this.initAllFolds();
    },

    initView: function initView() {
        this._folds = {};
        var game = this.node.getChildByName("game");
        var sides = ["myself", "right", "up", "left"];
        for (var i = 0; i < sides.length; ++i) {
            var sideName = sides[i];
            var sideRoot = game.getChildByName(sideName);
            var folds = [];
            var foldRoot = sideRoot.getChildByName("folds");
            for (var j = 0; j < foldRoot.children.length; ++j) {
                var n = foldRoot.children[j];
                n.active = false;
                var sprite = n.getComponent(cc.Sprite);
                sprite.spriteFrame = null;
                folds.push(sprite);
            }
            this._folds[sideName] = folds;
        }

        this.hideAllFolds();
    },

    hideAllFolds: function hideAllFolds() {
        for (var k in this._folds) {
            var f = this._folds[i];
            for (var i in f) {
                f[i].node.active = false;
            }
        }
    },

    initEventHandler: function initEventHandler() {
        var self = this;
        this.node.on('game_begin', function (data) {
            self.initAllFolds();
        });

        this.node.on('game_sync', function (data) {
            self.initAllFolds();
        });

        this.node.on('game_chupai_notify', function (data) {
            self.initFolds(data.detail);
        });

        this.node.on('guo_notify', function (data) {
            self.initFolds(data.detail);
        });
    },

    initAllFolds: function initAllFolds() {
        var seats = cc.vv.gameNetMgr.seats;
        for (var i in seats) {
            this.initFolds(seats[i]);
        }
    },

    initFolds: function initFolds(seatData) {
        var folds = seatData.folds;
        if (folds == null) {
            return;
        }
        var localIndex = cc.vv.gameNetMgr.getLocalIndex(seatData.seatindex);
        var pre = cc.vv.mahjongmgr.getFoldPre(localIndex);
        var side = cc.vv.mahjongmgr.getSide(localIndex);

        var foldsSprites = this._folds[side];
        for (var i = 0; i < foldsSprites.length; ++i) {
            var index = i;
            if (side == "right" || side == "up") {
                index = foldsSprites.length - i - 1;
            }
            var sprite = foldsSprites[index];
            sprite.node.active = true;
            this.setSpriteFrameByMJID(pre, sprite, folds[i]);
        }
        for (var i = folds.length; i < foldsSprites.length; ++i) {
            var index = i;
            if (side == "right" || side == "up") {
                index = foldsSprites.length - i - 1;
            }
            var sprite = foldsSprites[index];

            sprite.spriteFrame = null;
            sprite.node.active = false;
        }
    },

    setSpriteFrameByMJID: function setSpriteFrameByMJID(pre, sprite, mjid) {
        sprite.spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID(pre, mjid);
        sprite.node.active = true;
    }

});

cc._RF.pop();
},{}],"GameNetMgr":[function(require,module,exports){
"use strict";
cc._RF.push(module, '9545659TARKZLMoHGqXoY2N', 'GameNetMgr');
// scripts/GameNetMgr.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        dataEventHandler: null,
        roomId: null,
        maxNumOfGames: 0,
        numOfGames: 0,
        numOfMJ: 0,
        seatIndex: -1,
        seats: null,
        turn: -1,
        button: -1,
        dingque: -1,
        chupai: -1,
        isDingQueing: false,
        isHuanSanZhang: false,
        gamestate: "",
        isOver: false,
        dissoveData: null
    },

    reset: function reset() {
        this.turn = -1;
        this.chupai = -1, this.dingque = -1;
        this.button = -1;
        this.gamestate = "";
        this.dingque = -1;
        this.isDingQueing = false;
        this.isHuanSanZhang = false;
        this.curaction = null;
        for (var i = 0; i < this.seats.length; ++i) {
            this.seats[i].holds = [];
            this.seats[i].folds = [];
            this.seats[i].pengs = [];
            this.seats[i].angangs = [];
            this.seats[i].diangangs = [];
            this.seats[i].wangangs = [];
            this.seats[i].dingque = -1;
            this.seats[i].ready = false;
            this.seats[i].hued = false;
            this.seats[i].huanpais = null;
            this.huanpaimethod = -1;
        }
    },

    clear: function clear() {
        this.dataEventHandler = null;
        if (this.isOver == null) {
            this.seats = null;
            this.roomId = null;
            this.maxNumOfGames = 0;
            this.numOfGames = 0;
        }
    },

    dispatchEvent: function dispatchEvent(event, data) {
        if (this.dataEventHandler) {
            this.dataEventHandler.emit(event, data);
        }
    },


    getSeatIndexByID: function getSeatIndexByID(userId) {
        for (var i = 0; i < this.seats.length; ++i) {
            var s = this.seats[i];
            if (s.userid == userId) {
                return i;
            }
        }
        return -1;
    },

    isOwner: function isOwner() {
        return this.seatIndex == 0;
    },

    getSeatByID: function getSeatByID(userId) {
        var seatIndex = this.getSeatIndexByID(userId);
        var seat = this.seats[seatIndex];
        return seat;
    },

    getSelfData: function getSelfData() {
        return this.seats[this.seatIndex];
    },

    getLocalIndex: function getLocalIndex(index) {
        var ret = (index - this.seatIndex + 4) % 4;
        return ret;
    },

    prepareReplay: function prepareReplay(roomInfo, detailOfGame) {
        this.roomId = roomInfo.id;
        this.seats = roomInfo.seats;
        this.turn = detailOfGame.base_info.button;
        var baseInfo = detailOfGame.base_info;
        for (var i = 0; i < this.seats.length; ++i) {
            var s = this.seats[i];
            s.seatindex = i;
            s.score = null;
            s.holds = baseInfo.game_seats[i];
            s.pengs = [];
            s.angangs = [];
            s.diangangs = [];
            s.wangangs = [];
            s.folds = [];
            console.log(s);
            if (cc.vv.userMgr.userId == s.userid) {
                this.seatIndex = i;
            }
        }
        this.conf = {
            type: baseInfo.type
        };
        if (this.conf.type == null) {
            this.conf.type == "xzdd";
        }
    },

    getWanfa: function getWanfa() {
        var conf = this.conf;
        if (conf && conf.maxGames != null && conf.maxFan != null) {
            var strArr = [];
            strArr.push(conf.maxGames + "局");
            strArr.push(conf.maxFan + "番封顶");
            if (conf.hsz) {
                strArr.push("换三张");
            }
            if (conf.zimo == 1) {
                strArr.push("自摸加番");
            } else {
                strArr.push("自摸加底");
            }
            if (conf.jiangdui) {
                strArr.push("将对");
            }
            if (conf.dianganghua == 1) {
                strArr.push("点杠花(自摸)");
            } else {
                strArr.push("点杠花(放炮)");
            }
            if (conf.menqing) {
                strArr.push("门清、中张");
            }
            if (conf.tiandihu) {
                strArr.push("天地胡");
            }
            return strArr.join(" ");
        }
        return "";
    },

    initHandlers: function initHandlers() {
        var self = this;
        cc.vv.net.addHandler("login_result", function (data) {
            console.log(data);
            if (data.errcode === 0) {
                var data = data.data;
                self.roomId = data.roomid;
                self.conf = data.conf;
                self.maxNumOfGames = data.conf.maxGames;
                self.numOfGames = data.numofgames;
                self.seats = data.seats;
                self.seatIndex = self.getSeatIndexByID(cc.vv.userMgr.userId);
                self.isOver = false;
            } else {
                console.log(data.errmsg);
            }
        });

        cc.vv.net.addHandler("login_finished", function (data) {
            console.log("login_finished");
            cc.director.loadScene("mjgame");
        });

        cc.vv.net.addHandler("exit_result", function (data) {
            self.roomId = null;
            self.turn = -1;
            self.dingque = -1;
            self.isDingQueing = false;
            self.seats = null;
        });

        cc.vv.net.addHandler("exit_notify_push", function (data) {
            var userId = data;
            var s = self.getSeatByID(userId);
            if (s != null) {
                s.userid = 0;
                s.name = "";
                self.dispatchEvent("user_state_changed", s);
            }
        });

        cc.vv.net.addHandler("dispress_push", function (data) {
            self.roomId = null;
            self.turn = -1;
            self.dingque = -1;
            self.isDingQueing = false;
            self.seats = null;
        });

        cc.vv.net.addHandler("disconnect", function (data) {
            if (self.roomId == null) {
                cc.director.loadScene("hall");
            } else {
                if (self.isOver == false) {
                    cc.vv.userMgr.oldRoomId = self.roomId;
                    self.dispatchEvent("disconnect");
                } else {
                    self.roomId = null;
                }
            }
        });

        cc.vv.net.addHandler("new_user_comes_push", function (data) {
            //console.log(data);
            var seatIndex = data.seatindex;
            if (self.seats[seatIndex].userid > 0) {
                self.seats[seatIndex].online = true;
            } else {
                data.online = true;
                self.seats[seatIndex] = data;
            }
            self.dispatchEvent('new_user', self.seats[seatIndex]);
        });

        cc.vv.net.addHandler("user_state_push", function (data) {
            //console.log(data);
            var userId = data.userid;
            var seat = self.getSeatByID(userId);
            seat.online = data.online;
            self.dispatchEvent('user_state_changed', seat);
        });

        cc.vv.net.addHandler("user_ready_push", function (data) {
            //console.log(data);
            var userId = data.userid;
            var seat = self.getSeatByID(userId);
            seat.ready = data.ready;
            self.dispatchEvent('user_state_changed', seat);
        });

        cc.vv.net.addHandler("game_holds_push", function (data) {
            var seat = self.seats[self.seatIndex];
            console.log(data);
            seat.holds = data;

            for (var i = 0; i < self.seats.length; ++i) {
                var s = self.seats[i];
                if (s.folds == null) {
                    s.folds = [];
                }
                if (s.pengs == null) {
                    s.pengs = [];
                }
                if (s.angangs == null) {
                    s.angangs = [];
                }
                if (s.diangangs == null) {
                    s.diangangs = [];
                }
                if (s.wangangs == null) {
                    s.wangangs = [];
                }
                s.ready = false;
            }
            self.dispatchEvent('game_holds');
        });

        cc.vv.net.addHandler("game_begin_push", function (data) {
            console.log('game_action_push');
            console.log(data);
            self.button = data;
            self.turn = self.button;
            self.gamestate = "begin";
            self.dispatchEvent('game_begin');
        });

        cc.vv.net.addHandler("game_playing_push", function (data) {
            console.log('game_playing_push');
            self.gamestate = "playing";
            self.dispatchEvent('game_playing');
        });

        cc.vv.net.addHandler("game_sync_push", function (data) {
            console.log("game_sync_push");
            console.log(data);
            self.numOfMJ = data.numofmj;
            self.gamestate = data.state;
            if (self.gamestate == "dingque") {
                self.isDingQueing = true;
            } else if (self.gamestate == "huanpai") {
                self.isHuanSanZhang = true;
            }
            self.turn = data.turn;
            self.button = data.button;
            self.chupai = data.chuPai;
            self.huanpaimethod = data.huanpaimethod;
            for (var i = 0; i < 4; ++i) {
                var seat = self.seats[i];
                var sd = data.seats[i];
                seat.holds = sd.holds;
                seat.folds = sd.folds;
                seat.angangs = sd.angangs;
                seat.diangangs = sd.diangangs;
                seat.wangangs = sd.wangangs;
                seat.pengs = sd.pengs;
                seat.dingque = sd.que;
                seat.hued = sd.hued;
                seat.iszimo = sd.iszimo;
                seat.huinfo = sd.huinfo;
                seat.huanpais = sd.huanpais;
                if (i == self.seatIndex) {
                    self.dingque = sd.que;
                }
            }
        });

        cc.vv.net.addHandler("game_dingque_push", function (data) {
            self.isDingQueing = true;
            self.isHuanSanZhang = false;
            self.dispatchEvent('game_dingque');
        });

        cc.vv.net.addHandler("game_huanpai_push", function (data) {
            self.isHuanSanZhang = true;
            self.dispatchEvent('game_huanpai');
        });

        cc.vv.net.addHandler("hangang_notify_push", function (data) {
            self.dispatchEvent('hangang_notify', data);
        });

        cc.vv.net.addHandler("game_action_push", function (data) {
            self.curaction = data;
            console.log(data);
            self.dispatchEvent('game_action', data);
        });

        cc.vv.net.addHandler("game_chupai_push", function (data) {
            console.log('game_chupai_push');
            //console.log(data);
            var turnUserID = data;
            var si = self.getSeatIndexByID(turnUserID);
            self.doTurnChange(si);
        });

        cc.vv.net.addHandler("game_num_push", function (data) {
            self.numOfGames = data;
            self.dispatchEvent('game_num', data);
        });

        cc.vv.net.addHandler("game_over_push", function (data) {
            console.log('game_over_push');
            var results = data.results;
            for (var i = 0; i < self.seats.length; ++i) {
                self.seats[i].score = results.length == 0 ? 0 : results[i].totalscore;
            }
            self.dispatchEvent('game_over', results);
            if (data.endinfo) {
                self.isOver = true;
                self.dispatchEvent('game_end', data.endinfo);
            }
            self.reset();
            for (var i = 0; i < self.seats.length; ++i) {
                self.dispatchEvent('user_state_changed', self.seats[i]);
            }
        });

        cc.vv.net.addHandler("mj_count_push", function (data) {
            console.log('mj_count_push');
            self.numOfMJ = data;
            //console.log(data);
            self.dispatchEvent('mj_count', data);
        });

        cc.vv.net.addHandler("hu_push", function (data) {
            console.log('hu_push');
            console.log(data);
            self.doHu(data);
        });

        cc.vv.net.addHandler("game_chupai_notify_push", function (data) {
            var userId = data.userId;
            var pai = data.pai;
            var si = self.getSeatIndexByID(userId);
            self.doChupai(si, pai);
        });

        cc.vv.net.addHandler("game_mopai_push", function (data) {
            console.log('game_mopai_push');
            self.doMopai(self.seatIndex, data);
        });

        cc.vv.net.addHandler("guo_notify_push", function (data) {
            console.log('guo_notify_push');
            var userId = data.userId;
            var pai = data.pai;
            var si = self.getSeatIndexByID(userId);
            self.doGuo(si, pai);
        });

        cc.vv.net.addHandler("guo_result", function (data) {
            console.log('guo_result');
            self.dispatchEvent('guo_result');
        });

        cc.vv.net.addHandler("guohu_push", function (data) {
            console.log('guohu_push');
            self.dispatchEvent("push_notice", { info: "过胡", time: 1.5 });
        });

        cc.vv.net.addHandler("huanpai_notify", function (data) {
            var seat = self.getSeatByID(data.si);
            seat.huanpais = data.huanpais;
            self.dispatchEvent('huanpai_notify', seat);
        });

        cc.vv.net.addHandler("game_huanpai_over_push", function (data) {
            console.log('game_huanpai_over_push');
            var info = "";
            var method = data.method;
            if (method == 0) {
                info = "换对家牌";
            } else if (method == 1) {
                info = "换下家牌";
            } else {
                info = "换上家牌";
            }
            self.huanpaimethod = method;
            cc.vv.gameNetMgr.isHuanSanZhang = false;
            self.dispatchEvent("game_huanpai_over");
            self.dispatchEvent("push_notice", { info: info, time: 2 });
        });

        cc.vv.net.addHandler("peng_notify_push", function (data) {
            console.log('peng_notify_push');
            console.log(data);
            var userId = data.userid;
            var pai = data.pai;
            var si = self.getSeatIndexByID(userId);
            self.doPeng(si, data.pai);
        });

        cc.vv.net.addHandler("gang_notify_push", function (data) {
            console.log('gang_notify_push');
            console.log(data);
            var userId = data.userid;
            var pai = data.pai;
            var si = self.getSeatIndexByID(userId);
            self.doGang(si, pai, data.gangtype);
        });

        cc.vv.net.addHandler("game_dingque_notify_push", function (data) {
            self.dispatchEvent('game_dingque_notify', data);
        });

        cc.vv.net.addHandler("game_dingque_finish_push", function (data) {
            for (var i = 0; i < data.length; ++i) {
                self.seats[i].dingque = data[i];
            }
            self.dispatchEvent('game_dingque_finish', data);
        });

        cc.vv.net.addHandler("chat_push", function (data) {
            self.dispatchEvent("chat_push", data);
        });

        cc.vv.net.addHandler("quick_chat_push", function (data) {
            self.dispatchEvent("quick_chat_push", data);
        });

        cc.vv.net.addHandler("emoji_push", function (data) {
            self.dispatchEvent("emoji_push", data);
        });

        cc.vv.net.addHandler("dissolve_notice_push", function (data) {
            console.log("dissolve_notice_push");
            console.log(data);
            self.dissoveData = data;
            self.dispatchEvent("dissolve_notice", data);
        });

        cc.vv.net.addHandler("dissolve_cancel_push", function (data) {
            self.dissoveData = null;
            self.dispatchEvent("dissolve_cancel", data);
        });

        cc.vv.net.addHandler("voice_msg_push", function (data) {
            self.dispatchEvent("voice_msg", data);
        });
    },

    doGuo: function doGuo(seatIndex, pai) {
        var seatData = this.seats[seatIndex];
        var folds = seatData.folds;
        folds.push(pai);
        this.dispatchEvent('guo_notify', seatData);
    },

    doMopai: function doMopai(seatIndex, pai) {
        var seatData = this.seats[seatIndex];
        if (seatData.holds) {
            seatData.holds.push(pai);
            this.dispatchEvent('game_mopai', { seatIndex: seatIndex, pai: pai });
        }
    },

    doChupai: function doChupai(seatIndex, pai) {
        this.chupai = pai;
        var seatData = this.seats[seatIndex];
        if (seatData.holds) {
            var idx = seatData.holds.indexOf(pai);
            seatData.holds.splice(idx, 1);
        }
        this.dispatchEvent('game_chupai_notify', { seatData: seatData, pai: pai });
    },

    doPeng: function doPeng(seatIndex, pai) {
        var seatData = this.seats[seatIndex];
        //移除手牌
        if (seatData.holds) {
            for (var i = 0; i < 2; ++i) {
                var idx = seatData.holds.indexOf(pai);
                seatData.holds.splice(idx, 1);
            }
        }

        //更新碰牌数据
        var pengs = seatData.pengs;
        pengs.push(pai);

        this.dispatchEvent('peng_notify', seatData);
    },

    getGangType: function getGangType(seatData, pai) {
        if (seatData.pengs.indexOf(pai) != -1) {
            return "wangang";
        } else {
            var cnt = 0;
            for (var i = 0; i < seatData.holds.length; ++i) {
                if (seatData.holds[i] == pai) {
                    cnt++;
                }
            }
            if (cnt == 3) {
                return "diangang";
            } else {
                return "angang";
            }
        }
    },

    doGang: function doGang(seatIndex, pai, gangtype) {
        var seatData = this.seats[seatIndex];

        if (!gangtype) {
            gangtype = this.getGangType(seatData, pai);
        }

        if (gangtype == "wangang") {
            if (seatData.pengs.indexOf(pai) != -1) {
                var idx = seatData.pengs.indexOf(pai);
                if (idx != -1) {
                    seatData.pengs.splice(idx, 1);
                }
            }
            seatData.wangangs.push(pai);
        }
        if (seatData.holds) {
            for (var i = 0; i <= 4; ++i) {
                var idx = seatData.holds.indexOf(pai);
                if (idx == -1) {
                    //如果没有找到，表示移完了，直接跳出循环
                    break;
                }
                seatData.holds.splice(idx, 1);
            }
        }
        if (gangtype == "angang") {
            seatData.angangs.push(pai);
        } else if (gangtype == "diangang") {
            seatData.diangangs.push(pai);
        }
        this.dispatchEvent('gang_notify', { seatData: seatData, gangtype: gangtype });
    },

    doHu: function doHu(data) {
        this.dispatchEvent('hupai', data);
    },

    doTurnChange: function doTurnChange(si) {
        var data = {
            last: this.turn,
            turn: si
        };
        this.turn = si;
        this.dispatchEvent('game_chupai', data);
    },

    connectGameServer: function connectGameServer(data) {
        this.dissoveData = null;
        cc.vv.net.ip = data.ip + ":" + data.port;
        console.log(cc.vv.net.ip);
        var self = this;

        var onConnectOK = function onConnectOK() {
            console.log("onConnectOK");
            var sd = {
                token: data.token,
                roomid: data.roomid,
                time: data.time,
                sign: data.sign
            };
            cc.vv.net.send("login", sd);
        };

        var onConnectFailed = function onConnectFailed() {
            console.log("failed.");
            cc.vv.wc.hide();
        };
        cc.vv.wc.show("正在进入房间");
        cc.vv.net.connect(onConnectOK, onConnectFailed);
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"GameOver":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'facfdljnx5F+rFDAq5Qbmqa', 'GameOver');
// scripts/components/GameOver.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _gameover: null,
        _gameresult: null,
        _seats: [],
        _isGameEnd: false,
        _pingju: null,
        _win: null,
        _lose: null
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (cc.vv == null) {
            return;
        }
        if (cc.vv.gameNetMgr.conf == null) {
            return;
        }
        if (cc.vv.gameNetMgr.conf.type == "xzdd") {
            this._gameover = this.node.getChildByName("game_over");
        } else {
            this._gameover = this.node.getChildByName("game_over_xlch");
        }

        this._gameover.active = false;

        this._pingju = this._gameover.getChildByName("pingju");
        this._win = this._gameover.getChildByName("win");
        this._lose = this._gameover.getChildByName("lose");

        this._gameresult = this.node.getChildByName("game_result");

        var wanfa = this._gameover.getChildByName("wanfa").getComponent(cc.Label);
        wanfa.string = cc.vv.gameNetMgr.getWanfa();

        var listRoot = this._gameover.getChildByName("result_list");
        for (var i = 1; i <= 4; ++i) {
            var s = "s" + i;
            var sn = listRoot.getChildByName(s);
            var viewdata = {};
            viewdata.username = sn.getChildByName('username').getComponent(cc.Label);
            viewdata.reason = sn.getChildByName('reason').getComponent(cc.Label);

            var f = sn.getChildByName('fan');
            if (f != null) {
                viewdata.fan = f.getComponent(cc.Label);
            }

            viewdata.score = sn.getChildByName('score').getComponent(cc.Label);
            viewdata.hu = sn.getChildByName('hu');
            viewdata.mahjongs = sn.getChildByName('pai');
            viewdata.zhuang = sn.getChildByName('zhuang');
            viewdata.hupai = sn.getChildByName('hupai');
            viewdata._pengandgang = [];
            this._seats.push(viewdata);
        }

        //初始化网络事件监听器
        var self = this;
        this.node.on('game_over', function (data) {
            self.onGameOver(data.detail);
        });

        this.node.on('game_end', function (data) {
            self._isGameEnd = true;
        });
    },

    onGameOver: function onGameOver(data) {
        if (cc.vv.gameNetMgr.conf.type == "xzdd") {
            this.onGameOver_XZDD(data);
        } else {
            this.onGameOver_XLCH(data);
        }
    },
    onGameOver_XZDD: function onGameOver_XZDD(data) {
        console.log(data);
        if (data.length == 0) {
            this._gameresult.active = true;
            return;
        }
        this._gameover.active = true;
        this._pingju.active = false;
        this._win.active = false;
        this._lose.active = false;

        var myscore = data[cc.vv.gameNetMgr.seatIndex].score;
        if (myscore > 0) {
            this._win.active = true;
        } else if (myscore < 0) {
            this._lose.active = true;
        } else {
            this._pingju.active = true;
        }

        //显示玩家信息
        for (var i = 0; i < 4; ++i) {
            var seatView = this._seats[i];
            var userData = data[i];
            var hued = false;
            //胡牌的玩家才显示 是否清一色 根xn的字样
            var numOfGangs = userData.angangs.length + userData.wangangs.length + userData.diangangs.length;
            var numOfGen = userData.numofgen;
            var actionArr = [];
            var is7pairs = false;
            var ischadajiao = false;
            for (var j = 0; j < userData.actions.length; ++j) {
                var ac = userData.actions[j];
                if (ac.type == "zimo" || ac.type == "ganghua" || ac.type == "dianganghua" || ac.type == "hu" || ac.type == "gangpaohu" || ac.type == "qiangganghu" || ac.type == "chadajiao") {
                    if (userData.pattern == "7pairs") {
                        actionArr.push("七对");
                    } else if (userData.pattern == "l7pairs") {
                        actionArr.push("龙七对");
                    } else if (userData.pattern == "j7pairs") {
                        actionArr.push("将七对");
                    } else if (userData.pattern == "duidui") {
                        actionArr.push("碰碰胡");
                    } else if (userData.pattern == "jiangdui") {
                        actionArr.push("将对");
                    }

                    if (ac.type == "zimo") {
                        actionArr.push("自摸");
                    } else if (ac.type == "ganghua") {
                        actionArr.push("杠上花");
                    } else if (ac.type == "dianganghua") {
                        actionArr.push("点杠花");
                    } else if (ac.type == "gangpaohu") {
                        actionArr.push("杠炮胡");
                    } else if (ac.type == "qiangganghu") {
                        actionArr.push("抢杠胡");
                    } else if (ac.type == "chadajiao") {
                        ischadajiao = true;
                    }
                    hued = true;
                } else if (ac.type == "fangpao") {
                    actionArr.push("放炮");
                } else if (ac.type == "angang") {
                    actionArr.push("暗杠");
                } else if (ac.type == "diangang") {
                    actionArr.push("明杠");
                } else if (ac.type == "wangang") {
                    actionArr.push("弯杠");
                } else if (ac.type == "fanggang") {
                    actionArr.push("放杠");
                } else if (ac.type == "zhuanshougang") {
                    actionArr.push("转手杠");
                } else if (ac.type == "beiqianggang") {
                    actionArr.push("被抢杠");
                } else if (ac.type == "beichadajiao") {
                    actionArr.push("被查叫");
                }
            }

            if (hued) {
                if (userData.qingyise) {
                    actionArr.push("清一色");
                }

                if (userData.menqing) {
                    actionArr.push("门清");
                }

                if (userData.zhongzhang) {
                    actionArr.push("中张");
                }

                if (userData.jingouhu) {
                    actionArr.push("金钩胡");
                }

                if (userData.haidihu) {
                    actionArr.push("海底胡");
                }

                if (userData.tianhu) {
                    actionArr.push("天胡");
                }

                if (userData.dihu) {
                    actionArr.push("地胡");
                }

                if (numOfGen > 0) {
                    actionArr.push("根x" + numOfGen);
                }

                if (ischadajiao) {
                    actionArr.push("查大叫");
                }
            }

            for (var o = 0; o < 3; ++o) {
                seatView.hu.children[o].active = false;
            }
            if (userData.huorder >= 0) {
                seatView.hu.children[userData.huorder].active = true;
            }

            seatView.username.string = cc.vv.gameNetMgr.seats[i].name;
            seatView.zhuang.active = cc.vv.gameNetMgr.button == i;
            seatView.reason.string = actionArr.join("、");

            //胡牌的玩家才有番
            var fan = 0;
            if (hued) {
                fan = userData.fan;
            }
            seatView.fan.string = fan + "番";

            //
            if (userData.score > 0) {
                seatView.score.string = "+" + userData.score;
            } else {
                seatView.score.string = userData.score;
            }

            var hupai = -1;
            if (hued) {
                hupai = userData.holds.pop();
            }

            cc.vv.mahjongmgr.sortMJ(userData.holds, userData.dingque);

            //胡牌不参与排序
            if (hued) {
                userData.holds.push(hupai);
            }

            //隐藏所有牌
            for (var k = 0; k < seatView.mahjongs.childrenCount; ++k) {
                var n = seatView.mahjongs.children[k];
                n.active = false;
            }

            var lackingNum = (userData.pengs.length + numOfGangs) * 3;
            //显示相关的牌
            for (var k = 0; k < userData.holds.length; ++k) {
                var pai = userData.holds[k];
                var n = seatView.mahjongs.children[k + lackingNum];
                n.active = true;
                var sprite = n.getComponent(cc.Sprite);
                sprite.spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID("M_", pai);
            }

            for (var k = 0; k < seatView._pengandgang.length; ++k) {
                seatView._pengandgang[k].active = false;
            }

            //初始化杠牌
            var index = 0;
            var gangs = userData.angangs;
            for (var k = 0; k < gangs.length; ++k) {
                var mjid = gangs[k];
                this.initPengAndGangs(seatView, index, mjid, "angang");
                index++;
            }

            var gangs = userData.diangangs;
            for (var k = 0; k < gangs.length; ++k) {
                var mjid = gangs[k];
                this.initPengAndGangs(seatView, index, mjid, "diangang");
                index++;
            }

            var gangs = userData.wangangs;
            for (var k = 0; k < gangs.length; ++k) {
                var mjid = gangs[k];
                this.initPengAndGangs(seatView, index, mjid, "wangang");
                index++;
            }

            //初始化碰牌
            var pengs = userData.pengs;
            if (pengs) {
                for (var k = 0; k < pengs.length; ++k) {
                    var mjid = pengs[k];
                    this.initPengAndGangs(seatView, index, mjid, "peng");
                    index++;
                }
            }
        }
    },

    onGameOver_XLCH: function onGameOver_XLCH(data) {
        console.log(data);
        if (data.length == 0) {
            this._gameresult.active = true;
            return;
        }
        this._gameover.active = true;
        this._pingju.active = false;
        this._win.active = false;
        this._lose.active = false;

        var myscore = data[cc.vv.gameNetMgr.seatIndex].score;
        if (myscore > 0) {
            this._win.active = true;
        } else if (myscore < 0) {
            this._lose.active = true;
        } else {
            this._pingju.active = true;
        }

        //显示玩家信息
        for (var i = 0; i < 4; ++i) {
            var seatView = this._seats[i];
            var userData = data[i];
            var hued = false;
            var actionArr = [];
            var is7pairs = false;
            var ischadajiao = false;
            var hupaiRoot = seatView.hupai;

            for (var j = 0; j < hupaiRoot.children.length; ++j) {
                hupaiRoot.children[j].active = false;
            }

            var hi = 0;
            for (var j = 0; j < userData.huinfo.length; ++j) {
                var info = userData.huinfo[j];
                hued = hued || info.ishupai;
                if (info.ishupai) {
                    if (hi < hupaiRoot.children.length) {
                        var hupaiView = hupaiRoot.children[hi];
                        hupaiView.active = true;
                        hupaiView.getComponent(cc.Sprite).spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID("B_", info.pai);
                        hi++;
                    }
                }

                var str = "";
                var sep = "";

                var dataseat = userData;
                if (!info.ishupai) {
                    if (info.action == "fangpao") {
                        str = "放炮";
                    } else if (info.action == "gangpao") {
                        str = "杠上炮";
                    } else if (info.action == "beiqianggang") {
                        str = "被抢杠";
                    } else {
                        str = "被查大叫";
                    }

                    dataseat = data[info.target];
                    info = dataseat.huinfo[info.index];
                } else {
                    if (info.action == "hu") {
                        str = "接炮胡";
                    } else if (info.action == "zimo") {
                        str = "自摸";
                    } else if (info.action == "ganghua") {
                        str = "杠上花";
                    } else if (info.action == "dianganghua") {
                        str = "点杠花";
                    } else if (info.action == "gangpaohu") {
                        str = "杠炮胡";
                    } else if (info.action == "qiangganghu") {
                        str = "抢杠胡";
                    } else if (info.action == "chadajiao") {
                        str = "查大叫";
                    }
                }

                str += "(";

                if (info.pattern == "7pairs") {
                    str += "七对";
                    sep = "、";
                } else if (info.pattern == "l7pairs") {
                    str += "龙七对";
                    sep = "、";
                } else if (info.pattern == "j7pairs") {
                    str += "将七对";
                    sep = "、";
                } else if (info.pattern == "duidui") {
                    str += "碰碰胡";
                    sep = "、";
                } else if (info.pattern == "jiangdui") {
                    str += "将对";
                    sep = "、";
                }

                if (info.haidihu) {
                    str += sep + "海底胡";
                    sep = "、";
                }

                if (info.tianhu) {
                    str += sep + "天胡";
                    sep = "、";
                }

                if (info.dihu) {
                    str += sep + "地胡";
                    sep = "、";
                }

                if (dataseat.qingyise) {
                    str += sep + "清一色";
                    sep = "、";
                }

                if (dataseat.menqing) {
                    str += sep + "门清";
                    sep = "、";
                }

                if (dataseat.jingouhu) {
                    str += sep + "金钩胡";
                    sep = "、";
                }

                if (dataseat.zhongzhang) {
                    str += sep + "中张";
                    sep = "、";
                }

                if (info.numofgen > 0) {
                    str += sep + "根x" + info.numofgen;
                    sep = "、";
                }

                if (sep == "") {
                    str += "平胡";
                }

                str += "、" + info.fan + "番";

                str += ")";
                actionArr.push(str);
            }

            seatView.hu.active = hued;

            if (userData.angangs.length) {
                actionArr.push("暗杠x" + userData.angangs.length);
            }

            if (userData.diangangs.length) {
                actionArr.push("明杠x" + userData.diangangs.length);
            }

            if (userData.wangangs.length) {
                actionArr.push("巴杠x" + userData.wangangs.length);
            }

            seatView.username.string = cc.vv.gameNetMgr.seats[i].name;
            seatView.zhuang.active = cc.vv.gameNetMgr.button == i;
            seatView.reason.string = actionArr.join("、");

            //
            if (userData.score > 0) {
                seatView.score.string = "+" + userData.score;
            } else {
                seatView.score.string = userData.score;
            }

            //隐藏所有牌
            for (var k = 0; k < seatView.mahjongs.childrenCount; ++k) {
                var n = seatView.mahjongs.children[k];
                n.active = false;
            }

            cc.vv.mahjongmgr.sortMJ(userData.holds, userData.dingque);

            var numOfGangs = userData.angangs.length + userData.wangangs.length + userData.diangangs.length;

            var lackingNum = (userData.pengs.length + numOfGangs) * 3;
            //显示相关的牌
            for (var k = 0; k < userData.holds.length; ++k) {
                var pai = userData.holds[k];
                var n = seatView.mahjongs.children[k + lackingNum];
                n.active = true;
                var sprite = n.getComponent(cc.Sprite);
                sprite.spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID("M_", pai);
            }

            for (var k = 0; k < seatView._pengandgang.length; ++k) {
                seatView._pengandgang[k].active = false;
            }

            //初始化杠牌
            var index = 0;
            var gangs = userData.angangs;
            for (var k = 0; k < gangs.length; ++k) {
                var mjid = gangs[k];
                this.initPengAndGangs(seatView, index, mjid, "angang");
                index++;
            }

            var gangs = userData.diangangs;
            for (var k = 0; k < gangs.length; ++k) {
                var mjid = gangs[k];
                this.initPengAndGangs(seatView, index, mjid, "diangang");
                index++;
            }

            var gangs = userData.wangangs;
            for (var k = 0; k < gangs.length; ++k) {
                var mjid = gangs[k];
                this.initPengAndGangs(seatView, index, mjid, "wangang");
                index++;
            }

            //初始化碰牌
            var pengs = userData.pengs;
            if (pengs) {
                for (var k = 0; k < pengs.length; ++k) {
                    var mjid = pengs[k];
                    this.initPengAndGangs(seatView, index, mjid, "peng");
                    index++;
                }
            }
        }
    },

    initPengAndGangs: function initPengAndGangs(seatView, index, mjid, flag) {
        var pgroot = null;
        if (seatView._pengandgang.length <= index) {
            pgroot = cc.instantiate(cc.vv.mahjongmgr.pengPrefabSelf);
            seatView._pengandgang.push(pgroot);
            seatView.mahjongs.addChild(pgroot);
        } else {
            pgroot = seatView._pengandgang[index];
            pgroot.active = true;
        }

        var sprites = pgroot.getComponentsInChildren(cc.Sprite);
        for (var s = 0; s < sprites.length; ++s) {
            var sprite = sprites[s];
            if (sprite.node.name == "gang") {
                var isGang = flag != "peng";
                sprite.node.active = isGang;
                sprite.node.scaleX = 1.0;
                sprite.node.scaleY = 1.0;
                if (flag == "angang") {
                    sprite.spriteFrame = cc.vv.mahjongmgr.getEmptySpriteFrame("myself");
                    sprite.node.scaleX = 1.4;
                    sprite.node.scaleY = 1.4;
                } else {
                    sprite.spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID("B_", mjid);
                }
            } else {
                sprite.spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID("B_", mjid);
            }
        }
        pgroot.x = index * 55 * 3 + index * 10;
    },

    onBtnReadyClicked: function onBtnReadyClicked() {
        console.log("onBtnReadyClicked");
        if (this._isGameEnd) {
            this._gameresult.active = true;
        } else {
            cc.vv.net.send('ready');
        }
        this._gameover.active = false;
    },

    onBtnShareClicked: function onBtnShareClicked() {
        console.log("onBtnShareClicked");
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"GameResult":[function(require,module,exports){
"use strict";
cc._RF.push(module, '2b08d8pm0VBDLYlZIdfLuPS', 'GameResult');
// scripts/components/GameResult.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _gameresult: null,
        _seats: []
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (cc.vv == null) {
            return;
        }

        this._gameresult = this.node.getChildByName("game_result");
        //this._gameresult.active = false;

        var seats = this._gameresult.getChildByName("seats");
        for (var i = 0; i < seats.children.length; ++i) {
            this._seats.push(seats.children[i].getComponent("Seat"));
        }

        var btnClose = cc.find("Canvas/game_result/btnClose");
        if (btnClose) {
            cc.vv.utils.addClickEvent(btnClose, this.node, "GameResult", "onBtnCloseClicked");
        }

        var btnShare = cc.find("Canvas/game_result/btnShare");
        if (btnShare) {
            cc.vv.utils.addClickEvent(btnShare, this.node, "GameResult", "onBtnShareClicked");
        }

        //初始化网络事件监听器
        var self = this;
        this.node.on('game_end', function (data) {
            self.onGameEnd(data.detail);
        });
    },

    showResult: function showResult(seat, info, isZuiJiaPaoShou) {
        seat.node.getChildByName("zuijiapaoshou").active = isZuiJiaPaoShou;

        seat.node.getChildByName("zimocishu").getComponent(cc.Label).string = info.numzimo;
        seat.node.getChildByName("jiepaocishu").getComponent(cc.Label).string = info.numjiepao;
        seat.node.getChildByName("dianpaocishu").getComponent(cc.Label).string = info.numdianpao;
        seat.node.getChildByName("angangcishu").getComponent(cc.Label).string = info.numangang;
        seat.node.getChildByName("minggangcishu").getComponent(cc.Label).string = info.numminggang;
        seat.node.getChildByName("chajiaocishu").getComponent(cc.Label).string = info.numchadajiao;
    },

    onGameEnd: function onGameEnd(endinfo) {
        var seats = cc.vv.gameNetMgr.seats;
        var maxscore = -1;
        var maxdianpao = 0;
        var dianpaogaoshou = -1;
        for (var i = 0; i < seats.length; ++i) {
            var seat = seats[i];
            if (seat.score > maxscore) {
                maxscore = seat.score;
            }
            if (endinfo[i].numdianpao > maxdianpao) {
                maxdianpao = endinfo[i].numdianpao;
                dianpaogaoshou = i;
            }
        }

        for (var i = 0; i < seats.length; ++i) {
            var seat = seats[i];
            var isBigwin = false;
            if (seat.score > 0) {
                isBigwin = seat.score == maxscore;
            }
            this._seats[i].setInfo(seat.name, seat.score, isBigwin);
            this._seats[i].setID(seat.userid);
            var isZuiJiaPaoShou = dianpaogaoshou == i;
            this.showResult(this._seats[i], endinfo[i], isZuiJiaPaoShou);
        }
    },

    onBtnCloseClicked: function onBtnCloseClicked() {
        cc.director.loadScene("hall");
    },

    onBtnShareClicked: function onBtnShareClicked() {
        cc.vv.anysdkMgr.shareResult();
    }
});

cc._RF.pop();
},{}],"Global":[function(require,module,exports){
"use strict";
cc._RF.push(module, '24e30ZJLgdH3rs1R1CvqN8U', 'Global');
// scripts/Global.js

"use strict";

var Global = cc.Class({
    extends: cc.Component,
    statics: {
        isstarted: false,
        netinited: false,
        userguid: 0,
        nickname: "",
        money: 0,
        lv: 0,
        roomId: 0
    }
});

cc._RF.pop();
},{}],"HTTP":[function(require,module,exports){
"use strict";
cc._RF.push(module, '90ae61J525JQIt5taF3Nce2', 'HTTP');
// scripts/HTTP.js

"use strict";

var URL = "http://10.0.37.22:10000";
//var URL = "http://120.24.181.145:9000";
//var URL = "http://120.24.59.70:9000";
//var URL = "http://192.168.1.168:9000";
cc.VERSION = 20161227;
var HTTP = cc.Class({
    extends: cc.Component,

    statics: {
        sessionId: 0,
        userId: 0,
        master_url: URL,
        url: URL,
        sendRequest: function sendRequest(path, data, handler, extraUrl) {
            var xhr = cc.loader.getXMLHttpRequest();
            xhr.timeout = 5000;
            var str = "?";
            for (var k in data) {
                if (str != "?") {
                    str += "&";
                }
                str += k + "=" + data[k];
            }
            if (extraUrl == null) {
                extraUrl = HTTP.url;
            }
            var requestURL = extraUrl + path + encodeURI(str);
            console.log("RequestURL:" + requestURL);
            xhr.open("GET", requestURL, true);
            if (cc.sys.isNative) {
                xhr.setRequestHeader("Accept-Encoding", "gzip,deflate", "text/html;charset=UTF-8");
            }

            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
                    console.log("http res(" + xhr.responseText.length + "):" + xhr.responseText);
                    try {
                        var ret = JSON.parse(xhr.responseText);
                        if (handler !== null) {
                            handler(ret);
                        } /* code */
                    } catch (e) {
                        console.log("err:" + e);
                        //handler(null);
                    } finally {
                        if (cc.vv && cc.vv.wc) {
                            //       cc.vv.wc.hide();    
                        }
                    }
                }
            };

            if (cc.vv && cc.vv.wc) {
                //cc.vv.wc.show();
            }
            xhr.send();
            return xhr;
        }
    }
});

cc._RF.pop();
},{}],"Hall":[function(require,module,exports){
"use strict";
cc._RF.push(module, '6edb3jjx+FBepS1mk1xKDF2', 'Hall');
// scripts/components/Hall.js

"use strict";

var Net = require("Net");
var Global = require("Global");
cc.Class({
    extends: cc.Component,

    properties: {
        lblName: cc.Label,
        lblMoney: cc.Label,
        lblGems: cc.Label,
        lblID: cc.Label,
        lblNotice: cc.Label,
        joinGameWin: cc.Node,
        createRoomWin: cc.Node,
        settingsWin: cc.Node,
        helpWin: cc.Node,
        xiaoxiWin: cc.Node,
        btnJoinGame: cc.Node,
        btnReturnGame: cc.Node,
        sprHeadImg: cc.Sprite
    },

    initNetHandlers: function initNetHandlers() {
        var self = this;
    },

    onShare: function onShare() {
        cc.vv.anysdkMgr.share("达达麻将", "达达麻将，包含了血战到底、血流成河等多种四川流行麻将玩法。");
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (!cc.sys.isNative && cc.sys.isMobile) {
            var cvs = this.node.getComponent(cc.Canvas);
            cvs.fitHeight = true;
            cvs.fitWidth = true;
        }
        if (!cc.vv) {
            cc.director.loadScene("loading");
            return;
        }
        this.initLabels();

        if (cc.vv.gameNetMgr.roomId == null) {
            this.btnJoinGame.active = true;
            this.btnReturnGame.active = false;
        } else {
            this.btnJoinGame.active = false;
            this.btnReturnGame.active = true;
        }

        //var params = cc.vv.args;
        var roomId = cc.vv.userMgr.oldRoomId;
        if (roomId != null) {
            cc.vv.userMgr.oldRoomId = null;
            cc.vv.userMgr.enterRoom(roomId);
        }

        var imgLoader = this.sprHeadImg.node.getComponent("ImageLoader");
        imgLoader.setUserID(cc.vv.userMgr.userId);
        cc.vv.utils.addClickEvent(this.sprHeadImg.node, this.node, "Hall", "onBtnClicked");

        this.addComponent("UserInfoShow");

        this.initButtonHandler("Canvas/right_bottom/btn_shezhi");
        this.initButtonHandler("Canvas/right_bottom/btn_help");
        this.initButtonHandler("Canvas/right_bottom/btn_xiaoxi");
        this.helpWin.addComponent("OnBack");
        this.xiaoxiWin.addComponent("OnBack");

        if (!cc.vv.userMgr.notice) {
            cc.vv.userMgr.notice = {
                version: null,
                msg: "数据请求中..."
            };
        }

        if (!cc.vv.userMgr.gemstip) {
            cc.vv.userMgr.gemstip = {
                version: null,
                msg: "数据请求中..."
            };
        }

        this.lblNotice.string = cc.vv.userMgr.notice.msg;

        this.refreshInfo();
        this.refreshNotice();
        this.refreshGemsTip();

        cc.vv.audioMgr.playBGM("bgMain.mp3");
    },

    refreshInfo: function refreshInfo() {
        var self = this;
        var onGet = function onGet(ret) {
            if (ret.errcode !== 0) {
                console.log(ret.errmsg);
            } else {
                if (ret.gems != null) {
                    this.lblGems.string = ret.gems;
                }
            }
        };

        var data = {
            account: cc.vv.userMgr.account,
            sign: cc.vv.userMgr.sign
        };
        cc.vv.http.sendRequest("/get_user_status", data, onGet.bind(this));
    },

    refreshGemsTip: function refreshGemsTip() {
        var self = this;
        var onGet = function onGet(ret) {
            if (ret.errcode !== 0) {
                console.log(ret.errmsg);
            } else {
                cc.vv.userMgr.gemstip.version = ret.version;
                cc.vv.userMgr.gemstip.msg = ret.msg.replace("<newline>", "\n");
            }
        };

        var data = {
            account: cc.vv.userMgr.account,
            sign: cc.vv.userMgr.sign,
            type: "fkgm",
            version: cc.vv.userMgr.gemstip.version
        };
        cc.vv.http.sendRequest("/get_message", data, onGet.bind(this));
    },

    refreshNotice: function refreshNotice() {
        var self = this;
        var onGet = function onGet(ret) {
            if (ret.errcode !== 0) {
                console.log(ret.errmsg);
            } else {
                cc.vv.userMgr.notice.version = ret.version;
                cc.vv.userMgr.notice.msg = ret.msg;
                this.lblNotice.string = ret.msg;
            }
        };

        var data = {
            account: cc.vv.userMgr.account,
            sign: cc.vv.userMgr.sign,
            type: "notice",
            version: cc.vv.userMgr.notice.version
        };
        cc.vv.http.sendRequest("/get_message", data, onGet.bind(this));
    },

    initButtonHandler: function initButtonHandler(btnPath) {
        var btn = cc.find(btnPath);
        cc.vv.utils.addClickEvent(btn, this.node, "Hall", "onBtnClicked");
    },

    initLabels: function initLabels() {
        this.lblName.string = cc.vv.userMgr.userName;
        this.lblMoney.string = cc.vv.userMgr.coins;
        this.lblGems.string = cc.vv.userMgr.gems;
        this.lblID.string = "ID:" + cc.vv.userMgr.userId;
    },

    onBtnClicked: function onBtnClicked(event) {
        if (event.target.name == "btn_shezhi") {
            this.settingsWin.active = true;
        } else if (event.target.name == "btn_help") {
            this.helpWin.active = true;
        } else if (event.target.name == "btn_xiaoxi") {
            this.xiaoxiWin.active = true;
        } else if (event.target.name == "head") {
            cc.vv.userinfoShow.show(cc.vv.userMgr.userName, cc.vv.userMgr.userId, this.sprHeadImg, cc.vv.userMgr.sex, cc.vv.userMgr.ip);
        }
    },

    onJoinGameClicked: function onJoinGameClicked() {
        this.joinGameWin.active = true;
    },

    onReturnGameClicked: function onReturnGameClicked() {
        cc.director.loadScene("mjgame");
    },

    onBtnAddGemsClicked: function onBtnAddGemsClicked() {
        cc.vv.alert.show("提示", cc.vv.userMgr.gemstip.msg);
        this.refreshInfo();
    },

    onCreateRoomClicked: function onCreateRoomClicked() {
        if (cc.vv.gameNetMgr.roomId != null) {
            cc.vv.alert.show("提示", "房间已经创建!\n必须解散当前房间才能创建新的房间");
            return;
        }
        console.log("onCreateRoomClicked");
        this.createRoomWin.active = true;
    },

    // called every frame, uncomment this function to activate update callback
    update: function update(dt) {
        var x = this.lblNotice.node.x;
        x -= dt * 100;
        if (x + this.lblNotice.node.width < -1000) {
            x = 500;
        }
        this.lblNotice.node.x = x;

        if (cc.vv && cc.vv.userMgr.roomData != null) {
            cc.vv.userMgr.enterRoom(cc.vv.userMgr.roomData);
            cc.vv.userMgr.roomData = null;
        }
    }
});

cc._RF.pop();
},{"Global":"Global","Net":"Net"}],"History":[function(require,module,exports){
(function (Buffer){
"use strict";
cc._RF.push(module, '4d7bci0LUxMT6MJKXJDj89w', 'History');
// scripts/components/History.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        HistoryItemPrefab: {
            default: null,
            type: cc.Prefab
        },
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _history: null,
        _viewlist: null,
        _content: null,
        _viewitemTemp: null,
        _historyData: null,
        _curRoomInfo: null,
        _emptyTip: null
    },

    // use this for initialization
    onLoad: function onLoad() {
        this._history = this.node.getChildByName("history");
        this._history.active = false;

        this._emptyTip = this._history.getChildByName("emptyTip");
        this._emptyTip.active = true;

        this._viewlist = this._history.getChildByName("viewlist");
        this._content = cc.find("view/content", this._viewlist);

        this._viewitemTemp = this._content.children[0];
        this._content.removeChild(this._viewitemTemp);

        var node = cc.find("Canvas/btn_zhanji");
        this.addClickEvent(node, this.node, "History", "onBtnHistoryClicked");

        var node = cc.find("Canvas/history/btn_back");
        this.addClickEvent(node, this.node, "History", "onBtnBackClicked");
    },

    addClickEvent: function addClickEvent(node, target, component, handler) {
        var eventHandler = new cc.Component.EventHandler();
        eventHandler.target = target;
        eventHandler.component = component;
        eventHandler.handler = handler;

        var clickEvents = node.getComponent(cc.Button).clickEvents;
        clickEvents.push(eventHandler);
    },

    onBtnBackClicked: function onBtnBackClicked() {
        if (this._curRoomInfo == null) {
            this._historyData = null;
            this._history.active = false;
        } else {
            this.initRoomHistoryList(this._historyData);
        }
    },

    onBtnHistoryClicked: function onBtnHistoryClicked() {
        this._history.active = true;
        var self = this;
        cc.vv.userMgr.getHistoryList(function (data) {
            data.sort(function (a, b) {
                return a.time < b.time;
            });
            self._historyData = data;
            for (var i = 0; i < data.length; ++i) {
                for (var j = 0; j < 4; ++j) {
                    var s = data[i].seats[j];
                    s.name = new Buffer(s.name, 'base64').toString();
                }
            }
            self.initRoomHistoryList(data);
        });
    },

    dateFormat: function dateFormat(time) {
        var date = new Date(time);
        var datetime = "{0}-{1}-{2} {3}:{4}:{5}";
        var year = date.getFullYear();
        var month = date.getMonth() + 1;
        month = month >= 10 ? month : "0" + month;
        var day = date.getDate();
        day = day >= 10 ? day : "0" + day;
        var h = date.getHours();
        h = h >= 10 ? h : "0" + h;
        var m = date.getMinutes();
        m = m >= 10 ? m : "0" + m;
        var s = date.getSeconds();
        s = s >= 10 ? s : "0" + s;
        datetime = datetime.format(year, month, day, h, m, s);
        return datetime;
    },

    initRoomHistoryList: function initRoomHistoryList(data) {
        for (var i = 0; i < data.length; ++i) {
            var node = this.getViewItem(i);
            node.idx = i;
            var titleId = "" + (i + 1);
            node.getChildByName("title").getComponent(cc.Label).string = titleId;
            node.getChildByName("roomNo").getComponent(cc.Label).string = "房间ID:" + data[i].id;
            var datetime = this.dateFormat(data[i].time * 1000);
            node.getChildByName("time").getComponent(cc.Label).string = datetime;

            var btnOp = node.getChildByName("btnOp");
            btnOp.idx = i;
            btnOp.getChildByName("Label").getComponent(cc.Label).string = "详情";

            for (var j = 0; j < 4; ++j) {
                var s = data[i].seats[j];
                var info = s.name + ":" + s.score;
                //console.log(info);
                node.getChildByName("info" + j).getComponent(cc.Label).string = info;
            }
        }
        this._emptyTip.active = data.length == 0;
        this.shrinkContent(data.length);
        this._curRoomInfo = null;
    },

    initGameHistoryList: function initGameHistoryList(roomInfo, data) {
        data.sort(function (a, b) {
            return a.create_time < b.create_time;
        });
        for (var i = 0; i < data.length; ++i) {
            var node = this.getViewItem(i);
            var idx = data.length - i - 1;
            node.idx = idx;
            var titleId = "" + (idx + 1);
            node.getChildByName("title").getComponent(cc.Label).string = titleId;
            node.getChildByName("roomNo").getComponent(cc.Label).string = "房间ID:" + roomInfo.id;
            var datetime = this.dateFormat(data[i].create_time * 1000);
            node.getChildByName("time").getComponent(cc.Label).string = datetime;

            var btnOp = node.getChildByName("btnOp");
            btnOp.idx = idx;
            btnOp.getChildByName("Label").getComponent(cc.Label).string = "回放";

            var result = JSON.parse(data[i].result);
            for (var j = 0; j < 4; ++j) {
                var s = roomInfo.seats[j];
                var info = s.name + ":" + result[j];
                //console.log(info);
                node.getChildByName("info" + j).getComponent(cc.Label).string = info;
            }
        }
        this.shrinkContent(data.length);
        this._curRoomInfo = roomInfo;
    },

    getViewItem: function getViewItem(index) {
        var content = this._content;
        if (content.childrenCount > index) {
            return content.children[index];
        }
        var node = cc.instantiate(this._viewitemTemp);
        content.addChild(node);
        return node;
    },
    shrinkContent: function shrinkContent(num) {
        while (this._content.childrenCount > num) {
            var lastOne = this._content.children[this._content.childrenCount - 1];
            this._content.removeChild(lastOne, true);
        }
    },

    getGameListOfRoom: function getGameListOfRoom(idx) {
        var self = this;
        var roomInfo = this._historyData[idx];
        cc.vv.userMgr.getGamesOfRoom(roomInfo.uuid, function (data) {
            if (data != null && data.length > 0) {
                self.initGameHistoryList(roomInfo, data);
            }
        });
    },

    getDetailOfGame: function getDetailOfGame(idx) {
        var self = this;
        var roomUUID = this._curRoomInfo.uuid;
        cc.vv.userMgr.getDetailOfGame(roomUUID, idx, function (data) {
            data.base_info = JSON.parse(data.base_info);
            data.action_records = JSON.parse(data.action_records);
            cc.vv.gameNetMgr.prepareReplay(self._curRoomInfo, data);
            cc.vv.replayMgr.init(data);
            cc.director.loadScene("mjgame");
        });
    },

    onViewItemClicked: function onViewItemClicked(event) {
        var idx = event.target.idx;
        console.log(idx);
        if (this._curRoomInfo == null) {
            this.getGameListOfRoom(idx);
        } else {
            this.getDetailOfGame(idx);
        }
    },

    onBtnOpClicked: function onBtnOpClicked(event) {
        var idx = event.target.parent.idx;
        console.log(idx);
        if (this._curRoomInfo == null) {
            this.getGameListOfRoom(idx);
        } else {
            this.getDetailOfGame(idx);
        }
    }

});

cc._RF.pop();
}).call(this,require("buffer").Buffer)
},{"buffer":2}],"HotUpdate":[function(require,module,exports){
"use strict";
cc._RF.push(module, '17141EodNRM/4IpsE04IyCU', 'HotUpdate');
// scripts/HotUpdate.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        updatePanel: {
            default: null,
            type: cc.Node
        },
        manifestUrl: {
            default: null,
            url: cc.RawAsset
        },
        percent: {
            default: null,
            type: cc.Label
        },
        lblErr: {
            default: null,
            type: cc.Label
        }
    },

    checkCb: function checkCb(event) {
        cc.log('Code: ' + event.getEventCode());
        switch (event.getEventCode()) {
            case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
                cc.log("No local manifest file found, hot update skipped.");
                cc.eventManager.removeListener(this._checkListener);
                break;
            case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
            case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
                cc.log("Fail to download manifest file, hot update skipped.");
                cc.eventManager.removeListener(this._checkListener);
                break;
            case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
                cc.log("Already up to date with the latest remote version.");
                cc.eventManager.removeListener(this._checkListener);
                this.lblErr.string += "游戏不需要更新\n";
                cc.director.loadScene("loading");
                break;
            case jsb.EventAssetsManager.NEW_VERSION_FOUND:
                this._needUpdate = true;
                this.updatePanel.active = true;
                this.percent.string = '00.00%';
                cc.eventManager.removeListener(this._checkListener);
                break;
            default:
                break;
        }
        this.hotUpdate();
    },

    updateCb: function updateCb(event) {
        var needRestart = false;
        var failed = false;
        switch (event.getEventCode()) {
            case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
                cc.log('No local manifest file found, hot update skipped.');
                failed = true;
                break;
            case jsb.EventAssetsManager.UPDATE_PROGRESSION:
                var percent = event.getPercent();
                var percentByFile = event.getPercentByFile();

                var msg = event.getMessage();
                if (msg) {
                    cc.log(msg);
                }
                cc.log(percent.toFixed(2) + '%');
                this.percent.string = percent + '%';
                break;
            case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
            case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
                cc.log('Fail to download manifest file, hot update skipped.');
                failed = true;
                break;
            case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
                cc.log('Already up to date with the latest remote version.');
                failed = true;
                break;
            case jsb.EventAssetsManager.UPDATE_FINISHED:
                cc.log('Update finished. ' + event.getMessage());

                needRestart = true;
                break;
            case jsb.EventAssetsManager.UPDATE_FAILED:
                cc.log('Update failed. ' + event.getMessage());

                this._failCount++;
                if (this._failCount < 5) {
                    this._am.downloadFailedAssets();
                } else {
                    cc.log('Reach maximum fail count, exit update process');
                    this._failCount = 0;
                    failed = true;
                }
                break;
            case jsb.EventAssetsManager.ERROR_UPDATING:
                cc.log('Asset update error: ' + event.getAssetId() + ', ' + event.getMessage());
                break;
            case jsb.EventAssetsManager.ERROR_DECOMPRESS:
                cc.log(event.getMessage());
                break;
            default:
                break;
        }

        if (failed) {
            cc.eventManager.removeListener(this._updateListener);
            this.updatePanel.active = false;
        }

        if (needRestart) {
            cc.eventManager.removeListener(this._updateListener);
            // Prepend the manifest's search path
            var searchPaths = jsb.fileUtils.getSearchPaths();
            var newPaths = this._am.getLocalManifest().getSearchPaths();
            Array.prototype.unshift(searchPaths, newPaths);
            // This value will be retrieved and appended to the default search path during game startup,
            // please refer to samples/js-tests/main.js for detailed usage.
            // !!! Re-add the search paths in main.js is very important, otherwise, new scripts won't take effect.
            cc.sys.localStorage.setItem('HotUpdateSearchPaths', JSON.stringify(searchPaths));

            jsb.fileUtils.setSearchPaths(searchPaths);
            this.lblErr.string += "游戏资源更新完毕\n";
            cc.game.restart();
        }
    },

    hotUpdate: function hotUpdate() {
        if (this._am && this._needUpdate) {
            this.lblErr.string += "开始更新游戏资源...\n";
            this._updateListener = new jsb.EventListenerAssetsManager(this._am, this.updateCb.bind(this));
            cc.eventManager.addListener(this._updateListener, 1);

            this._failCount = 0;
            this._am.update();
        }
    },

    // use this for initialization
    onLoad: function onLoad() {
        // Hot update is only available in Native build
        if (!cc.sys.isNative) {
            return;
        }
        this.lblErr.string += "检查游戏资源...\n";
        var storagePath = (jsb.fileUtils ? jsb.fileUtils.getWritablePath() : '/') + 'tiantianqipai-asset';
        cc.log('Storage path for remote asset : ' + storagePath);
        this.lblErr.string += storagePath + "\n";
        cc.log('Local manifest URL : ' + this.manifestUrl);
        this._am = new jsb.AssetsManager(this.manifestUrl, storagePath);
        this._am.retain();

        this._needUpdate = false;
        if (this._am.getLocalManifest().isLoaded()) {
            this._checkListener = new jsb.EventListenerAssetsManager(this._am, this.checkCb.bind(this));
            cc.eventManager.addListener(this._checkListener, 1);

            this._am.checkUpdate();
        }
    },

    onDestroy: function onDestroy() {
        this._am && this._am.release();
    }
});

cc._RF.pop();
},{}],"HuanSanZhang":[function(require,module,exports){
"use strict";
cc._RF.push(module, '9a096oAgU5HwrxX05ZPNYtW', 'HuanSanZhang');
// scripts/components/HuanSanZhang.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _huanpaitip: null,
        _huanpaiArr: []
    },

    // use this for initialization
    onLoad: function onLoad() {
        this._huanpaitip = cc.find("Canvas/huansanzhang");
        this._huanpaitip.active = cc.vv.gameNetMgr.isHuanSanZhang;

        if (this._huanpaitip.active) {
            this.showHuanpai(cc.vv.gameNetMgr.getSelfData().huanpais == null);
        }
        this.initHuaipaiInfo();

        var btnOk = cc.find("Canvas/huansanzhang/btn_ok");
        if (btnOk) {
            cc.vv.utils.addClickEvent(btnOk, this.node, "HuanSanZhang", "onHuanSanZhang");
        }

        var self = this;

        this.node.on('game_huanpai', function (data) {
            self._huanpaitip.active = true;
            self.showHuanpai(true);
        });

        this.node.on('huanpai_notify', function (data) {
            if (data.detail.seatindex == cc.vv.gameNetMgr.seatIndex) {
                self.initHuaipaiInfo();
            }
        });

        this.node.on('game_huanpai_over', function (data) {
            self._huanpaitip.active = false;
            for (var i = 0; i < self._huanpaiArr.length; ++i) {
                self._huanpaiArr[i].y = 0;
            }
            self._huanpaiArr = [];
            self.initHuaipaiInfo();
        });

        this.node.on('game_huanpai_result', function (data) {
            cc.vv.gameNetMgr.isHuanSanZhang = false;
            self._huanpaitip.active = false;
            for (var i = 0; i < self._huanpaiArr.length; ++i) {
                self._huanpaiArr[i].y = 0;
            }
            self._huanpaiArr = [];
        });

        this.node.on('mj_clicked', function (data) {
            var target = data.detail;
            //如果已经点起来，则取消
            var idx = self._huanpaiArr.indexOf(target);
            if (idx != -1) {
                target.y = 0;
                self._huanpaiArr.splice(idx, 1);
            } else {
                //如果是新的，则加入
                if (self._huanpaiArr.length < 3) {
                    self._huanpaiArr.push(target);
                    target.y = 15;
                }
            }
        });
    },

    showHuanpai: function showHuanpai(interactable) {
        this._huanpaitip.getChildByName("info").getComponent(cc.Label).string = "请选择三张一样花色的牌";
        this._huanpaitip.getChildByName("btn_ok").getComponent(cc.Button).interactable = interactable;
        this._huanpaitip.getChildByName("mask").active = false;
    },

    initHuaipaiInfo: function initHuaipaiInfo() {
        var huaipaiinfo = cc.find("Canvas/game/huanpaiinfo");
        var seat = cc.vv.gameNetMgr.getSelfData();
        if (seat.huanpais == null) {
            huaipaiinfo.active = false;
            return;
        }
        huaipaiinfo.active = true;
        for (var i = 0; i < seat.huanpais.length; ++i) {
            huaipaiinfo.getChildByName("hp" + (i + 1)).getComponent(cc.Sprite).spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID("M_", seat.huanpais[i]);
        }

        var hpm = huaipaiinfo.getChildByName("hpm");
        hpm.active = true;
        if (cc.vv.gameNetMgr.huanpaimethod == 0) {
            hpm.rotation = 90;
        } else if (cc.vv.gameNetMgr.huanpaimethod == 1) {
            hpm.rotation = 0;
        } else if (cc.vv.gameNetMgr.huanpaimethod == 2) {
            hpm.rotation = 180;
        } else {
            hpm.active = false;
        }
    },

    onHuanSanZhang: function onHuanSanZhang(event) {
        if (this._huanpaiArr.length != 3) {
            return;
        }

        var type = null;
        for (var i = 0; i < this._huanpaiArr.length; ++i) {
            var pai = this._huanpaiArr[i].mjId;
            var nt = cc.vv.mahjongmgr.getMahjongType(pai);
            if (type == null) {
                type = nt;
            } else {
                if (type != nt) {
                    return;
                }
            }
        }

        var data = {
            p1: this._huanpaiArr[0].mjId,
            p2: this._huanpaiArr[1].mjId,
            p3: this._huanpaiArr[2].mjId
        };

        this._huanpaitip.getChildByName("info").getComponent(cc.Label).string = "等待其他玩家选牌...";
        this._huanpaitip.getChildByName("btn_ok").getComponent(cc.Button).interactable = false;
        this._huanpaitip.getChildByName("mask").active = true;

        cc.vv.net.send("huanpai", data);
    }

});

cc._RF.pop();
},{}],"ImageLoader":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'ed057Bgp8FHlJbGI+ljAN7d', 'ImageLoader');
// scripts/components/ImageLoader.js

"use strict";

function loadImage(url, code, callback) {
    /*
    if(cc.vv.images == null){
        cc.vv.images = {};
    }
    var imageInfo = cc.vv.images[url];
    if(imageInfo == null){
        imageInfo = {
            image:null,
            queue:[],
        };
        cc.vv.images[url] = imageInfo;
    }
    
    cc.loader.load(url,function (err,tex) {
        imageInfo.image = tex;
        var spriteFrame = new cc.SpriteFrame(tex, cc.Rect(0, 0, tex.width, tex.height));
        for(var i = 0; i < imageInfo.queue.length; ++i){
            var itm = imageInfo.queue[i];
            itm.callback(itm.code,spriteFrame);
        }
        itm.queue = [];
    });
    if(imageInfo.image != null){
        var tex = imageInfo.image;
        var spriteFrame = new cc.SpriteFrame(tex, cc.Rect(0, 0, tex.width, tex.height));
        callback(code,spriteFrame);
    }
    else{
        imageInfo.queue.push({code:code,callback:callback});
    }*/
    cc.loader.load(url, function (err, tex) {
        var spriteFrame = new cc.SpriteFrame(tex, cc.Rect(0, 0, tex.width, tex.height));
        callback(code, spriteFrame);
    });
};

function getBaseInfo(userid, callback) {
    if (cc.vv.baseInfoMap == null) {
        cc.vv.baseInfoMap = {};
    }

    if (cc.vv.baseInfoMap[userid] != null) {
        callback(userid, cc.vv.baseInfoMap[userid]);
    } else {
        cc.vv.http.sendRequest('/base_info', { userid: userid }, function (ret) {
            var url = null;
            if (ret.headimgurl) {
                url = ret.headimgurl + ".jpg";
            }
            var info = {
                name: ret.name,
                sex: ret.sex,
                url: url
            };
            cc.vv.baseInfoMap[userid] = info;
            callback(userid, info);
        }, cc.vv.http.master_url);
    }
};

cc.Class({
    extends: cc.Component,
    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
    },

    // use this for initialization
    onLoad: function onLoad() {
        this.setupSpriteFrame();
    },

    setUserID: function setUserID(userid) {
        if (cc.sys.isNative == false) {
            return;
        }
        if (!userid) {
            return;
        }
        if (cc.vv.images == null) {
            cc.vv.images = {};
        }

        var self = this;
        getBaseInfo(userid, function (code, info) {
            if (info && info.url) {
                loadImage(info.url, userid, function (err, spriteFrame) {
                    self._spriteFrame = spriteFrame;
                    self.setupSpriteFrame();
                });
            }
        });
    },

    setupSpriteFrame: function setupSpriteFrame() {
        if (this._spriteFrame) {
            var spr = this.getComponent(cc.Sprite);
            if (spr) {
                spr.spriteFrame = this._spriteFrame;
            }
        }
    }
    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"JoinGameInput":[function(require,module,exports){
"use strict";
cc._RF.push(module, '10a1c8jz95Ju4NnpkOWUfin', 'JoinGameInput');
// scripts/components/JoinGameInput.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        nums: {
            default: [],
            type: [cc.Label]
        },
        _inputIndex: 0
    },

    // use this for initialization
    onLoad: function onLoad() {},

    onEnable: function onEnable() {
        this.onResetClicked();
    },

    onInputFinished: function onInputFinished(roomId) {
        cc.vv.userMgr.enterRoom(roomId, function (ret) {
            if (ret.errcode == 0) {
                this.node.active = false;
            } else {
                var content = "房间[" + roomId + "]不存在，请重新输入!";
                if (ret.errcode == 4) {
                    content = "房间[" + roomId + "]已满!";
                }
                cc.vv.alert.show("提示", content);
                this.onResetClicked();
            }
        }.bind(this));
    },

    onInput: function onInput(num) {
        if (this._inputIndex >= this.nums.length) {
            return;
        }
        this.nums[this._inputIndex].string = num;
        this._inputIndex += 1;

        if (this._inputIndex == this.nums.length) {
            var roomId = this.parseRoomID();
            console.log("ok:" + roomId);
            this.onInputFinished(roomId);
        }
    },

    onN0Clicked: function onN0Clicked() {
        this.onInput(0);
    },
    onN1Clicked: function onN1Clicked() {
        this.onInput(1);
    },
    onN2Clicked: function onN2Clicked() {
        this.onInput(2);
    },
    onN3Clicked: function onN3Clicked() {
        this.onInput(3);
    },
    onN4Clicked: function onN4Clicked() {
        this.onInput(4);
    },
    onN5Clicked: function onN5Clicked() {
        this.onInput(5);
    },
    onN6Clicked: function onN6Clicked() {
        this.onInput(6);
    },
    onN7Clicked: function onN7Clicked() {
        this.onInput(7);
    },
    onN8Clicked: function onN8Clicked() {
        this.onInput(8);
    },
    onN9Clicked: function onN9Clicked() {
        this.onInput(9);
    },
    onResetClicked: function onResetClicked() {
        for (var i = 0; i < this.nums.length; ++i) {
            this.nums[i].string = "";
        }
        this._inputIndex = 0;
    },
    onDelClicked: function onDelClicked() {
        if (this._inputIndex > 0) {
            this._inputIndex -= 1;
            this.nums[this._inputIndex].string = "";
        }
    },
    onCloseClicked: function onCloseClicked() {
        this.node.active = false;
    },

    parseRoomID: function parseRoomID() {
        var str = "";
        for (var i = 0; i < this.nums.length; ++i) {
            str += this.nums[i].string;
        }
        return str;
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"LoadingLogic":[function(require,module,exports){
"use strict";
cc._RF.push(module, '350d3Ry9aVIqJR27fP2H/z1', 'LoadingLogic');
// scripts/components/LoadingLogic.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        tipLabel: cc.Label,
        _stateStr: '',
        _progress: 0.0,
        _splash: null,
        _isLoading: false
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (!cc.sys.isNative && cc.sys.isMobile) {
            var cvs = this.node.getComponent(cc.Canvas);
            cvs.fitHeight = true;
            cvs.fitWidth = true;
        }
        this.initMgr();
        this.tipLabel.string = this._stateStr;

        this._splash = cc.find("Canvas/splash");
        cc.log("this._splash = " + this._splash);
        cc.log("this._splash.active = " + this._splash.active);
        this._splash.active = true;
    },

    start: function start() {
        var self = this;
        var SHOW_TIME = 3000;
        var FADE_TIME = 500;
        if (cc.sys.os != cc.sys.OS_IOS || !cc.sys.isNative) {
            self._splash.active = true;
            var t = Date.now();
            var fn = function fn() {
                var dt = Date.now() - t;
                if (dt < SHOW_TIME) {
                    setTimeout(fn, 33);
                } else {
                    var op = (1 - (dt - SHOW_TIME) / FADE_TIME) * 255;
                    if (op < 0) {
                        self._splash.opacity = 0;
                        self.checkVersion();
                    } else {
                        self._splash.opacity = op;
                        setTimeout(fn, 33);
                    }
                }
            };
            setTimeout(fn, 33);
        } else {
            this._splash.active = false;
            this.checkVersion();
        }
    },

    initMgr: function initMgr() {
        cc.vv = {};
        var UserMgr = require("UserMgr");
        cc.vv.userMgr = new UserMgr();

        var ReplayMgr = require("ReplayMgr");
        cc.vv.replayMgr = new ReplayMgr();

        cc.vv.http = require("HTTP");
        cc.vv.global = require("Global");
        cc.vv.net = require("Net");

        var GameNetMgr = require("GameNetMgr");
        cc.vv.gameNetMgr = new GameNetMgr();
        cc.vv.gameNetMgr.initHandlers();

        var Cocos2dxBridge = require("Cocos2dxBridge");
        cc.vv.cocos2dxBridge = new Cocos2dxBridge();

        // var AnysdkMgr = require("AnysdkMgr");
        // cc.vv.anysdkMgr = new AnysdkMgr();
        // cc.vv.anysdkMgr.init();

        var VoiceMgr = require("VoiceMgr");
        cc.vv.voiceMgr = new VoiceMgr();
        cc.vv.voiceMgr.init();

        var AudioMgr = require("AudioMgr");
        cc.vv.audioMgr = new AudioMgr();
        cc.vv.audioMgr.init();

        var Utils = require("Utils");
        cc.vv.utils = new Utils();

        cc.args = this.urlParse();
    },

    urlParse: function urlParse() {
        var params = {};
        if (window.location == null) {
            return params;
        }
        var name, value;
        var str = window.location.href; //取得整个地址栏
        var num = str.indexOf("?");
        str = str.substr(num + 1); //取得所有参数   stringvar.substr(start [, length ]

        var arr = str.split("&"); //各个参数放到数组里
        for (var i = 0; i < arr.length; i++) {
            num = arr[i].indexOf("=");
            if (num > 0) {
                name = arr[i].substring(0, num);
                value = arr[i].substr(num + 1);
                params[name] = value;
            }
        }
        return params;
    },

    checkVersion: function checkVersion() {
        var self = this;
        var onGetVersion = function onGetVersion(ret) {
            if (ret.version == null) {
                console.log("error.");
            } else {
                cc.vv.SI = ret;
                if (ret.version != cc.VERSION) {
                    cc.find("Canvas/alert").active = true;
                } else {
                    self.startPreloading();
                }
            }
        };

        var xhr = null;
        var complete = false;
        var fnRequest = function fnRequest() {
            self._stateStr = "正在连接服务器";
            xhr = cc.vv.http.sendRequest("/get_serverinfo", null, function (ret) {
                xhr = null;
                complete = true;
                onGetVersion(ret);
            });
            setTimeout(fn, 5000);
        };

        var fn = function fn() {
            if (!complete) {
                if (xhr) {
                    xhr.abort();
                    self._stateStr = "连接失败，即将重试";
                    setTimeout(function () {
                        fnRequest();
                    }, 5000);
                } else {
                    fnRequest();
                }
            }
        };
        fn();
    },

    onBtnDownloadClicked: function onBtnDownloadClicked() {
        cc.sys.openURL(cc.vv.SI.appweb);
    },

    startPreloading: function startPreloading() {
        this._stateStr = "正在加载资源，请稍候";
        this._isLoading = true;
        var self = this;

        cc.loader.onProgress = function (completedCount, totalCount, item) {
            //console.log("completedCount:" + completedCount + ",totalCount:" + totalCount );
            if (self._isLoading) {
                self._progress = completedCount / totalCount;
            }
        };

        cc.loader.loadResAll("textures", function (err, assets) {
            self.onLoadComplete();
        });
    },

    onLoadComplete: function onLoadComplete() {
        this._isLoading = false;
        this._stateStr = "准备登陆";
        cc.director.loadScene("login");
        cc.loader.onComplete = null;
    },

    // called every frame, uncomment this function to activate update callback
    update: function update(dt) {
        if (this._stateStr.length == 0) {
            return;
        }
        this.tipLabel.string = this._stateStr + ' ';
        if (this._isLoading) {
            this.tipLabel.string += Math.floor(this._progress * 100) + "%";
        } else {
            var t = Math.floor(Date.now() / 1000) % 4;
            for (var i = 0; i < t; ++i) {
                this.tipLabel.string += '.';
            }
        }
    }
});

cc._RF.pop();
},{"AudioMgr":"AudioMgr","Cocos2dxBridge":"Cocos2dxBridge","GameNetMgr":"GameNetMgr","Global":"Global","HTTP":"HTTP","Net":"Net","ReplayMgr":"ReplayMgr","UserMgr":"UserMgr","Utils":"Utils","VoiceMgr":"VoiceMgr"}],"Login":[function(require,module,exports){
"use strict";
cc._RF.push(module, '572a7Qfh69N9ZLXkNthANfi', 'Login');
// scripts/components/Login.js

"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

String.prototype.format = function (args) {
    if (arguments.length > 0) {
        var result = this;
        if (arguments.length == 1 && (typeof args === "undefined" ? "undefined" : _typeof(args)) == "object") {
            for (var key in args) {
                var reg = new RegExp("({" + key + "})", "g");
                result = result.replace(reg, args[key]);
            }
        } else {
            for (var i = 0; i < arguments.length; i++) {
                if (arguments[i] == undefined) {
                    return "";
                } else {
                    var reg = new RegExp("({[" + i + "]})", "g");
                    result = result.replace(reg, arguments[i]);
                }
            }
        }
        return result;
    } else {
        return this;
    }
};

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _mima: null,
        _mimaIndex: 0
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (!cc.sys.isNative && cc.sys.isMobile) {
            var cvs = this.node.getComponent(cc.Canvas);
            cvs.fitHeight = true;
            cvs.fitWidth = true;
        }

        if (!cc.vv) {
            cc.director.loadScene("loading");
            return;
        }
        cc.vv.http.url = cc.vv.http.master_url;
        cc.vv.net.addHandler('push_need_create_role', function () {
            console.log("onLoad:push_need_create_role");
            cc.director.loadScene("createrole");
        });

        cc.vv.audioMgr.playBGM("bgMain.mp3");

        this._mima = ["A", "A", "B", "B", "A", "B", "A", "B", "A", "A", "A", "B", "B", "B"];

        if (!cc.sys.isNative || cc.sys.os == cc.sys.OS_WINDOWS) {
            cc.find("Canvas/btn_yk").active = true;
        }
    },

    start: function start() {
        var account = cc.sys.localStorage.getItem("wx_account");
        var sign = cc.sys.localStorage.getItem("wx_sign");
        if (account != null && sign != null) {
            var ret = {
                errcode: 0,
                account: account,
                sign: sign
            };
            cc.vv.userMgr.onAuth(ret);
        }
    },

    onBtnQuickStartClicked: function onBtnQuickStartClicked() {
        cc.vv.userMgr.guestAuth();
    },

    onBtnWeichatClicked: function onBtnWeichatClicked() {
        var self = this;
        // cc.vv.anysdkMgr.login();
        cc.vv.cocos2dxBridge.login();
    },

    onBtnMIMAClicked: function onBtnMIMAClicked(event) {
        if (this._mima[this._mimaIndex] == event.target.name) {
            this._mimaIndex++;
            if (this._mimaIndex == this._mima.length) {
                cc.find("Canvas/btn_yk").active = true;
            }
        } else {
            console.log("oh ho~~~");
            this._mimaIndex = 0;
        }
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"MJGame":[function(require,module,exports){
"use strict";
cc._RF.push(module, '7fa8fcvrqFOj6lhh6xHzd3c', 'MJGame');
// scripts/components/MJGame.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        gameRoot: {
            default: null,
            type: cc.Node
        },

        prepareRoot: {
            default: null,
            type: cc.Node
        },

        _myMJArr: [],
        _options: null,
        _selectedMJ: null,
        _chupaiSprite: [],
        _mjcount: null,
        _gamecount: null,
        _hupaiTips: [],
        _hupaiLists: [],
        _playEfxs: [],
        _opts: []
    },

    onLoad: function onLoad() {
        if (!cc.sys.isNative && cc.sys.isMobile) {
            var cvs = this.node.getComponent(cc.Canvas);
            cvs.fitHeight = true;
            cvs.fitWidth = true;
        }
        if (!cc.vv) {
            cc.director.loadScene("loading");
            return;
        }
        this.addComponent("NoticeTip");
        this.addComponent("GameOver");
        this.addComponent("DingQue");
        this.addComponent("PengGangs");
        this.addComponent("MJRoom");
        this.addComponent("TimePointer");
        this.addComponent("GameResult");
        this.addComponent("Chat");
        this.addComponent("Folds");
        this.addComponent("ReplayCtrl");
        this.addComponent("PopupMgr");
        this.addComponent("HuanSanZhang");
        this.addComponent("ReConnect");
        this.addComponent("Voice");
        this.addComponent("UserInfoShow");

        this.initView();
        this.initEventHandlers();

        this.gameRoot.active = false;
        this.prepareRoot.active = true;
        this.initWanfaLabel();
        this.onGameBeign();
        cc.vv.audioMgr.playBGM("bgFight.mp3");
    },

    initView: function initView() {

        //搜索需要的子节点
        var gameChild = this.node.getChildByName("game");

        this._mjcount = gameChild.getChildByName('mjcount').getComponent(cc.Label);
        this._mjcount.string = "剩余" + cc.vv.gameNetMgr.numOfMJ + "张";
        this._gamecount = gameChild.getChildByName('gamecount').getComponent(cc.Label);
        this._gamecount.string = "" + cc.vv.gameNetMgr.numOfGames + "/" + cc.vv.gameNetMgr.maxNumOfGames + "局";

        var myselfChild = gameChild.getChildByName("myself");
        var myholds = myselfChild.getChildByName("holds");

        for (var i = 0; i < myholds.children.length; ++i) {
            var sprite = myholds.children[i].getComponent(cc.Sprite);
            this._myMJArr.push(sprite);
            sprite.spriteFrame = null;
        }

        var realwidth = cc.director.getVisibleSize().width;
        myholds.scaleX *= realwidth / 1280;
        myholds.scaleY *= realwidth / 1280;

        var sides = ["myself", "right", "up", "left"];
        for (var i = 0; i < sides.length; ++i) {
            var side = sides[i];

            var sideChild = gameChild.getChildByName(side);
            this._hupaiTips.push(sideChild.getChildByName("HuPai"));
            this._hupaiLists.push(sideChild.getChildByName("hupailist"));
            this._playEfxs.push(sideChild.getChildByName("play_efx").getComponent(cc.Animation));
            this._chupaiSprite.push(sideChild.getChildByName("ChuPai").children[0].getComponent(cc.Sprite));

            var opt = sideChild.getChildByName("opt");
            opt.active = false;
            var sprite = opt.getChildByName("pai").getComponent(cc.Sprite);
            var data = {
                node: opt,
                sprite: sprite
            };
            this._opts.push(data);
        }

        var opts = gameChild.getChildByName("ops");
        this._options = opts;
        this.hideOptions();
        this.hideChupai();
    },

    hideChupai: function hideChupai() {
        for (var i = 0; i < this._chupaiSprite.length; ++i) {
            this._chupaiSprite[i].node.active = false;
        }
    },

    initEventHandlers: function initEventHandlers() {
        cc.vv.gameNetMgr.dataEventHandler = this.node;

        //初始化事件监听器
        var self = this;

        this.node.on('game_holds', function (data) {
            self.initMahjongs();
            self.checkQueYiMen();
        });

        this.node.on('game_begin', function (data) {
            self.onGameBeign();
        });

        this.node.on('game_sync', function (data) {
            self.onGameBeign();
        });

        this.node.on('game_chupai', function (data) {
            data = data.detail;
            self.hideChupai();
            self.checkQueYiMen();
            if (data.last != cc.vv.gameNetMgr.seatIndex) {
                self.initMopai(data.last, null);
            }
            if (!cc.vv.replayMgr.isReplay() && data.turn != cc.vv.gameNetMgr.seatIndex) {
                self.initMopai(data.turn, -1);
            }
        });

        this.node.on('game_mopai', function (data) {
            self.hideChupai();
            data = data.detail;
            var pai = data.pai;
            var localIndex = cc.vv.gameNetMgr.getLocalIndex(data.seatIndex);
            if (localIndex == 0) {
                var index = 13;
                var sprite = self._myMJArr[index];
                self.setSpriteFrameByMJID("M_", sprite, pai, index);
                sprite.node.mjId = pai;
            } else if (cc.vv.replayMgr.isReplay()) {
                self.initMopai(data.seatIndex, pai);
            }
        });

        this.node.on('game_action', function (data) {
            self.showAction(data.detail);
        });

        this.node.on('hupai', function (data) {
            var data = data.detail;
            //如果不是玩家自己，则将玩家的牌都放倒
            var seatIndex = data.seatindex;
            var localIndex = cc.vv.gameNetMgr.getLocalIndex(seatIndex);
            var hupai = self._hupaiTips[localIndex];
            hupai.active = true;

            if (localIndex == 0) {
                self.hideOptions();
            }
            var seatData = cc.vv.gameNetMgr.seats[seatIndex];
            seatData.hued = true;
            if (cc.vv.gameNetMgr.conf.type == "xlch") {
                hupai.getChildByName("sprHu").active = true;
                hupai.getChildByName("sprZimo").active = false;
                self.initHupai(localIndex, data.hupai);
                if (data.iszimo) {
                    if (seatData.seatindex == cc.vv.gameNetMgr.seatIndex) {
                        seatData.holds.pop();
                        self.initMahjongs();
                    } else {
                        self.initOtherMahjongs(seatData);
                    }
                }
            } else {
                hupai.getChildByName("sprHu").active = !data.iszimo;
                hupai.getChildByName("sprZimo").active = data.iszimo;

                if (!(data.iszimo && localIndex == 0)) {
                    //if(cc.vv.replayMgr.isReplay() == false && localIndex != 0){
                    //    self.initEmptySprites(seatIndex);                
                    //}
                    self.initMopai(seatIndex, data.hupai);
                }
            }

            if (cc.vv.replayMgr.isReplay() == true && cc.vv.gameNetMgr.conf.type != "xlch") {
                var opt = self._opts[localIndex];
                opt.node.active = true;
                opt.sprite.spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID("M_", data.hupai);
            }

            if (data.iszimo) {
                self.playEfx(localIndex, "play_zimo");
            } else {
                self.playEfx(localIndex, "play_hu");
            }

            cc.vv.audioMgr.playSFX("nv/hu.mp3");
        });

        this.node.on('mj_count', function (data) {
            self._mjcount.string = "剩余" + cc.vv.gameNetMgr.numOfMJ + "张";
        });

        this.node.on('game_num', function (data) {
            self._gamecount.string = "" + cc.vv.gameNetMgr.numOfGames + "/" + cc.vv.gameNetMgr.maxNumOfGames + "局";
        });

        this.node.on('game_over', function (data) {
            self.gameRoot.active = false;
            self.prepareRoot.active = true;
        });

        this.node.on('game_chupai_notify', function (data) {
            self.hideChupai();
            var seatData = data.detail.seatData;
            //如果是自己，则刷新手牌
            if (seatData.seatindex == cc.vv.gameNetMgr.seatIndex) {
                self.initMahjongs();
            } else {
                self.initOtherMahjongs(seatData);
            }
            self.showChupai();
            var audioUrl = cc.vv.mahjongmgr.getAudioURLByMJID(data.detail.pai);
            cc.vv.audioMgr.playSFX(audioUrl);
        });

        this.node.on('guo_notify', function (data) {
            self.hideChupai();
            self.hideOptions();
            var seatData = data.detail;
            //如果是自己，则刷新手牌
            if (seatData.seatindex == cc.vv.gameNetMgr.seatIndex) {
                self.initMahjongs();
            }
            cc.vv.audioMgr.playSFX("give.mp3");
        });

        this.node.on('guo_result', function (data) {
            self.hideOptions();
        });

        this.node.on('game_dingque_finish', function (data) {
            self.initMahjongs();
        });

        this.node.on('peng_notify', function (data) {
            self.hideChupai();

            var seatData = data.detail;
            if (seatData.seatindex == cc.vv.gameNetMgr.seatIndex) {
                self.initMahjongs();
            } else {
                self.initOtherMahjongs(seatData);
            }
            var localIndex = self.getLocalIndex(seatData.seatindex);
            self.playEfx(localIndex, "play_peng");
            cc.vv.audioMgr.playSFX("nv/peng.mp3");
            self.hideOptions();
        });

        this.node.on('gang_notify', function (data) {
            self.hideChupai();
            var data = data.detail;
            var seatData = data.seatData;
            var gangtype = data.gangtype;
            if (seatData.seatindex == cc.vv.gameNetMgr.seatIndex) {
                self.initMahjongs();
            } else {
                self.initOtherMahjongs(seatData);
            }

            var localIndex = self.getLocalIndex(seatData.seatindex);
            if (gangtype == "wangang") {
                self.playEfx(localIndex, "play_guafeng");
                cc.vv.audioMgr.playSFX("guafeng.mp3");
            } else {
                self.playEfx(localIndex, "play_xiayu");
                cc.vv.audioMgr.playSFX("rain.mp3");
            }
        });

        this.node.on("hangang_notify", function (data) {
            var data = data.detail;
            var localIndex = self.getLocalIndex(data);
            self.playEfx(localIndex, "play_gang");
            cc.vv.audioMgr.playSFX("nv/gang.mp3");
            self.hideOptions();
        });
    },

    showChupai: function showChupai() {
        var pai = cc.vv.gameNetMgr.chupai;
        if (pai >= 0) {
            //
            var localIndex = this.getLocalIndex(cc.vv.gameNetMgr.turn);
            var sprite = this._chupaiSprite[localIndex];
            sprite.spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID("M_", pai);
            sprite.node.active = true;
        }
    },

    addOption: function addOption(btnName, pai) {
        for (var i = 0; i < this._options.childrenCount; ++i) {
            var child = this._options.children[i];
            if (child.name == "op" && child.active == false) {
                child.active = true;
                var sprite = child.getChildByName("opTarget").getComponent(cc.Sprite);
                sprite.spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID("M_", pai);
                var btn = child.getChildByName(btnName);
                btn.active = true;
                btn.pai = pai;
                return;
            }
        }
    },

    hideOptions: function hideOptions(data) {
        this._options.active = false;
        for (var i = 0; i < this._options.childrenCount; ++i) {
            var child = this._options.children[i];
            if (child.name == "op") {
                child.active = false;
                child.getChildByName("btnPeng").active = false;
                child.getChildByName("btnGang").active = false;
                child.getChildByName("btnHu").active = false;
            }
        }
    },

    showAction: function showAction(data) {
        if (this._options.active) {
            this.hideOptions();
        }

        if (data && (data.hu || data.gang || data.peng)) {
            this._options.active = true;
            if (data.hu) {
                this.addOption("btnHu", data.pai);
            }
            if (data.peng) {
                this.addOption("btnPeng", data.pai);
            }

            if (data.gang) {
                for (var i = 0; i < data.gangpai.length; ++i) {
                    var gp = data.gangpai[i];
                    this.addOption("btnGang", gp);
                }
            }
        }
    },

    initWanfaLabel: function initWanfaLabel() {
        var wanfa = cc.find("Canvas/infobar/wanfa").getComponent(cc.Label);
        wanfa.string = cc.vv.gameNetMgr.getWanfa();
    },

    initHupai: function initHupai(localIndex, pai) {
        if (cc.vv.gameNetMgr.conf.type == "xlch") {
            var hupailist = this._hupaiLists[localIndex];
            for (var i = 0; i < hupailist.children.length; ++i) {
                var hupainode = hupailist.children[i];
                if (hupainode.active == false) {
                    var pre = cc.vv.mahjongmgr.getFoldPre(localIndex);
                    hupainode.getComponent(cc.Sprite).spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID(pre, pai);
                    hupainode.active = true;
                    break;
                }
            }
        }
    },

    playEfx: function playEfx(index, name) {
        this._playEfxs[index].node.active = true;
        this._playEfxs[index].play(name);
    },

    onGameBeign: function onGameBeign() {

        for (var i = 0; i < this._playEfxs.length; ++i) {
            this._playEfxs[i].node.active = false;
        }

        for (var i = 0; i < this._hupaiLists.length; ++i) {
            for (var j = 0; j < this._hupaiLists[i].childrenCount; ++j) {
                this._hupaiLists[i].children[j].active = false;
            }
        }

        for (var i = 0; i < cc.vv.gameNetMgr.seats.length; ++i) {
            var seatData = cc.vv.gameNetMgr.seats[i];
            var localIndex = cc.vv.gameNetMgr.getLocalIndex(i);
            var hupai = this._hupaiTips[localIndex];
            hupai.active = seatData.hued;
            if (seatData.hued) {
                hupai.getChildByName("sprHu").active = !seatData.iszimo;
                hupai.getChildByName("sprZimo").active = seatData.iszimo;
            }

            if (seatData.huinfo) {
                for (var j = 0; j < seatData.huinfo.length; ++j) {
                    var info = seatData.huinfo[j];
                    if (info.ishupai) {
                        this.initHupai(localIndex, info.pai);
                    }
                }
            }
        }

        this.hideChupai();
        this.hideOptions();
        var sides = ["right", "up", "left"];
        var gameChild = this.node.getChildByName("game");
        for (var i = 0; i < sides.length; ++i) {
            var sideChild = gameChild.getChildByName(sides[i]);
            var holds = sideChild.getChildByName("holds");
            for (var j = 0; j < holds.childrenCount; ++j) {
                var nc = holds.children[j];
                nc.active = true;
                nc.scaleX = 1.0;
                nc.scaleY = 1.0;
                var sprite = nc.getComponent(cc.Sprite);
                sprite.spriteFrame = cc.vv.mahjongmgr.holdsEmpty[i + 1];
            }
        }

        if (cc.vv.gameNetMgr.gamestate == "" && cc.vv.replayMgr.isReplay() == false) {
            return;
        }

        this.gameRoot.active = true;
        this.prepareRoot.active = false;
        this.initMahjongs();
        var seats = cc.vv.gameNetMgr.seats;
        for (var i in seats) {
            var seatData = seats[i];
            var localIndex = cc.vv.gameNetMgr.getLocalIndex(i);
            if (localIndex != 0) {
                this.initOtherMahjongs(seatData);
                if (i == cc.vv.gameNetMgr.turn) {
                    this.initMopai(i, -1);
                } else {
                    this.initMopai(i, null);
                }
            }
        }
        this.showChupai();
        if (cc.vv.gameNetMgr.curaction != null) {
            this.showAction(cc.vv.gameNetMgr.curaction);
            cc.vv.gameNetMgr.curaction = null;
        }

        this.checkQueYiMen();
    },

    onMJClicked: function onMJClicked(event) {
        if (cc.vv.gameNetMgr.isHuanSanZhang) {
            this.node.emit("mj_clicked", event.target);
            return;
        }

        //如果不是自己的轮子，则忽略
        if (cc.vv.gameNetMgr.turn != cc.vv.gameNetMgr.seatIndex) {
            console.log("not your turn." + cc.vv.gameNetMgr.turn);
            return;
        }

        for (var i = 0; i < this._myMJArr.length; ++i) {
            if (event.target == this._myMJArr[i].node) {
                //如果是再次点击，则出牌
                if (event.target == this._selectedMJ) {
                    this.shoot(this._selectedMJ.mjId);
                    this._selectedMJ.y = 0;
                    this._selectedMJ = null;
                    return;
                }
                if (this._selectedMJ != null) {
                    this._selectedMJ.y = 0;
                }
                event.target.y = 15;
                this._selectedMJ = event.target;
                return;
            }
        }
    },

    //出牌
    shoot: function shoot(mjId) {
        if (mjId == null) {
            return;
        }
        cc.vv.net.send('chupai', mjId);
    },

    getMJIndex: function getMJIndex(side, index) {
        if (side == "right" || side == "up") {
            return 13 - index;
        }
        return index;
    },

    initMopai: function initMopai(seatIndex, pai) {
        var localIndex = cc.vv.gameNetMgr.getLocalIndex(seatIndex);
        var side = cc.vv.mahjongmgr.getSide(localIndex);
        var pre = cc.vv.mahjongmgr.getFoldPre(localIndex);

        var gameChild = this.node.getChildByName("game");
        var sideChild = gameChild.getChildByName(side);
        var holds = sideChild.getChildByName("holds");

        var lastIndex = this.getMJIndex(side, 13);
        var nc = holds.children[lastIndex];

        nc.scaleX = 1.0;
        nc.scaleY = 1.0;

        if (pai == null) {
            nc.active = false;
        } else if (pai >= 0) {
            nc.active = true;
            if (side == "up") {
                nc.scaleX = 0.73;
                nc.scaleY = 0.73;
            }
            var sprite = nc.getComponent(cc.Sprite);
            sprite.spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID(pre, pai);
        } else if (pai != null) {
            nc.active = true;
            if (side == "up") {
                nc.scaleX = 1.0;
                nc.scaleY = 1.0;
            }
            var sprite = nc.getComponent(cc.Sprite);
            sprite.spriteFrame = cc.vv.mahjongmgr.getHoldsEmptySpriteFrame(side);
        }
    },

    initEmptySprites: function initEmptySprites(seatIndex) {
        var localIndex = cc.vv.gameNetMgr.getLocalIndex(seatIndex);
        var side = cc.vv.mahjongmgr.getSide(localIndex);
        var pre = cc.vv.mahjongmgr.getFoldPre(localIndex);

        var gameChild = this.node.getChildByName("game");
        var sideChild = gameChild.getChildByName(side);
        var holds = sideChild.getChildByName("holds");
        var spriteFrame = cc.vv.mahjongmgr.getEmptySpriteFrame(side);
        for (var i = 0; i < holds.childrenCount; ++i) {
            var nc = holds.children[i];
            nc.scaleX = 1.0;
            nc.scaleY = 1.0;

            var sprite = nc.getComponent(cc.Sprite);
            sprite.spriteFrame = spriteFrame;
        }
    },

    initOtherMahjongs: function initOtherMahjongs(seatData) {
        //console.log("seat:" + seatData.seatindex);
        var localIndex = this.getLocalIndex(seatData.seatindex);
        if (localIndex == 0) {
            return;
        }
        var side = cc.vv.mahjongmgr.getSide(localIndex);
        var game = this.node.getChildByName("game");
        var sideRoot = game.getChildByName(side);
        var sideHolds = sideRoot.getChildByName("holds");
        var num = seatData.pengs.length + seatData.angangs.length + seatData.diangangs.length + seatData.wangangs.length;
        num *= 3;
        for (var i = 0; i < num; ++i) {
            var idx = this.getMJIndex(side, i);
            sideHolds.children[idx].active = false;
        }

        var pre = cc.vv.mahjongmgr.getFoldPre(localIndex);
        var holds = this.sortHolds(seatData);
        if (holds != null && holds.length > 0) {
            for (var i = 0; i < holds.length; ++i) {
                var idx = this.getMJIndex(side, i + num);
                var sprite = sideHolds.children[idx].getComponent(cc.Sprite);
                if (side == "up") {
                    sprite.node.scaleX = 0.73;
                    sprite.node.scaleY = 0.73;
                }
                sprite.node.active = true;
                sprite.spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID(pre, holds[i]);
            }

            if (holds.length + num == 13) {
                var lasetIdx = this.getMJIndex(side, 13);
                sideHolds.children[lasetIdx].active = false;
            }
        }
    },

    sortHolds: function sortHolds(seatData) {
        var holds = seatData.holds;
        if (holds == null) {
            return null;
        }
        //如果手上的牌的数目是2,5,8,11,14，表示最后一张牌是刚摸到的牌
        var mopai = null;
        var l = holds.length;
        if (l == 2 || l == 5 || l == 8 || l == 11 || l == 14) {
            mopai = holds.pop();
        }

        var dingque = seatData.dingque;
        cc.vv.mahjongmgr.sortMJ(holds, dingque);

        //将摸牌添加到最后
        if (mopai != null) {
            holds.push(mopai);
        }
        return holds;
    },

    initMahjongs: function initMahjongs() {
        var seats = cc.vv.gameNetMgr.seats;
        var seatData = seats[cc.vv.gameNetMgr.seatIndex];
        var holds = this.sortHolds(seatData);
        if (holds == null) {
            return;
        }

        //初始化手牌
        var lackingNum = (seatData.pengs.length + seatData.angangs.length + seatData.diangangs.length + seatData.wangangs.length) * 3;
        for (var i = 0; i < holds.length; ++i) {
            var mjid = holds[i];
            var sprite = this._myMJArr[i + lackingNum];
            sprite.node.mjId = mjid;
            sprite.node.y = 0;
            this.setSpriteFrameByMJID("M_", sprite, mjid);
        }
        for (var i = 0; i < lackingNum; ++i) {
            var sprite = this._myMJArr[i];
            sprite.node.mjId = null;
            sprite.spriteFrame = null;
            sprite.node.active = false;
        }
        for (var i = lackingNum + holds.length; i < this._myMJArr.length; ++i) {
            var sprite = this._myMJArr[i];
            sprite.node.mjId = null;
            sprite.spriteFrame = null;
            sprite.node.active = false;
        }
    },

    setSpriteFrameByMJID: function setSpriteFrameByMJID(pre, sprite, mjid) {
        sprite.spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID(pre, mjid);
        sprite.node.active = true;
    },

    //如果玩家手上还有缺的牌没有打，则只能打缺牌
    checkQueYiMen: function checkQueYiMen() {
        if (cc.vv.gameNetMgr.conf == null || cc.vv.gameNetMgr.conf.type != "xlch" || !cc.vv.gameNetMgr.getSelfData().hued) {
            //遍历检查看是否有未打缺的牌 如果有，则需要将不是定缺的牌设置为不可用
            var dingque = cc.vv.gameNetMgr.dingque;
            //        console.log(dingque)
            var hasQue = false;
            if (cc.vv.gameNetMgr.seatIndex == cc.vv.gameNetMgr.turn) {
                for (var i = 0; i < this._myMJArr.length; ++i) {
                    var sprite = this._myMJArr[i];
                    //                console.log("sprite.node.mjId:" + sprite.node.mjId);
                    if (sprite.node.mjId != null) {
                        var type = cc.vv.mahjongmgr.getMahjongType(sprite.node.mjId);
                        if (type == dingque) {
                            hasQue = true;
                            break;
                        }
                    }
                }
            }

            //        console.log("hasQue:" + hasQue);
            for (var i = 0; i < this._myMJArr.length; ++i) {
                var sprite = this._myMJArr[i];
                if (sprite.node.mjId != null) {
                    var type = cc.vv.mahjongmgr.getMahjongType(sprite.node.mjId);
                    if (hasQue && type != dingque) {
                        sprite.node.getComponent(cc.Button).interactable = false;
                    } else {
                        sprite.node.getComponent(cc.Button).interactable = true;
                    }
                }
            }
        } else {
            if (cc.vv.gameNetMgr.seatIndex == cc.vv.gameNetMgr.turn) {
                for (var i = 0; i < 14; ++i) {
                    var sprite = this._myMJArr[i];
                    if (sprite.node.active == true) {
                        sprite.node.getComponent(cc.Button).interactable = i == 13;
                    }
                }
            } else {
                for (var i = 0; i < 14; ++i) {
                    var sprite = this._myMJArr[i];
                    if (sprite.node.active == true) {
                        sprite.node.getComponent(cc.Button).interactable = true;
                    }
                }
            }
        }
    },

    getLocalIndex: function getLocalIndex(index) {
        var ret = (index - cc.vv.gameNetMgr.seatIndex + 4) % 4;
        //console.log("old:" + index + ",base:" + cc.vv.gameNetMgr.seatIndex + ",new:" + ret);
        return ret;
    },

    onOptionClicked: function onOptionClicked(event) {
        console.log(event.target.pai);
        if (event.target.name == "btnPeng") {
            cc.vv.net.send("peng");
        } else if (event.target.name == "btnGang") {
            cc.vv.net.send("gang", event.target.pai);
        } else if (event.target.name == "btnHu") {
            cc.vv.net.send("hu");
        } else if (event.target.name == "btnGuo") {
            cc.vv.net.send("guo");
        }
    },

    // called every frame, uncomment this function to activate update callback
    update: function update(dt) {},

    onDestroy: function onDestroy() {
        console.log("onDestroy");
        if (cc.vv) {
            cc.vv.gameNetMgr.clear();
        }
    }
});

cc._RF.pop();
},{}],"MJRoom":[function(require,module,exports){
"use strict";
cc._RF.push(module, '921dfQJZddJ+5GFUXqxmMmT', 'MJRoom');
// scripts/components/MJRoom.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        lblRoomNo: {
            default: null,
            type: cc.Label
        },
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _seats: [],
        _seats2: [],
        _timeLabel: null,
        _voiceMsgQueue: [],
        _lastPlayingSeat: null,
        _playingSeat: null,
        _lastPlayTime: null
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (cc.vv == null) {
            return;
        }

        this.initView();
        this.initSeats();
        this.initEventHandlers();
    },

    initView: function initView() {
        var prepare = this.node.getChildByName("prepare");
        var seats = prepare.getChildByName("seats");
        for (var i = 0; i < seats.children.length; ++i) {
            this._seats.push(seats.children[i].getComponent("Seat"));
        }

        this.refreshBtns();

        this.lblRoomNo = cc.find("Canvas/infobar/Z_room_txt/New Label").getComponent(cc.Label);
        this._timeLabel = cc.find("Canvas/infobar/time").getComponent(cc.Label);
        this.lblRoomNo.string = cc.vv.gameNetMgr.roomId;
        var gameChild = this.node.getChildByName("game");
        var sides = ["myself", "right", "up", "left"];
        for (var i = 0; i < sides.length; ++i) {
            var sideNode = gameChild.getChildByName(sides[i]);
            var seat = sideNode.getChildByName("seat");
            this._seats2.push(seat.getComponent("Seat"));
        }

        var btnWechat = cc.find("Canvas/prepare/btnWeichat");
        if (btnWechat) {
            cc.vv.utils.addClickEvent(btnWechat, this.node, "MJRoom", "onBtnWeichatClicked");
        }

        var titles = cc.find("Canvas/typeTitle");
        for (var i = 0; i < titles.children.length; ++i) {
            titles.children[i].active = false;
        }

        if (cc.vv.gameNetMgr.conf) {
            var type = cc.vv.gameNetMgr.conf.type;
            if (type == null || type == "") {
                type = "xzdd";
            }

            titles.getChildByName(type).active = true;
        }
    },

    refreshBtns: function refreshBtns() {
        var prepare = this.node.getChildByName("prepare");
        var btnExit = prepare.getChildByName("btnExit");
        var btnDispress = prepare.getChildByName("btnDissolve");
        var btnWeichat = prepare.getChildByName("btnWeichat");
        var btnBack = prepare.getChildByName("btnBack");
        var isIdle = cc.vv.gameNetMgr.numOfGames == 0;

        btnExit.active = !cc.vv.gameNetMgr.isOwner() && isIdle;
        btnDispress.active = cc.vv.gameNetMgr.isOwner() && isIdle;

        btnWeichat.active = isIdle;
        btnBack.active = isIdle;
    },

    initEventHandlers: function initEventHandlers() {
        var self = this;
        this.node.on('new_user', function (data) {
            self.initSingleSeat(data.detail);
        });

        this.node.on('user_state_changed', function (data) {
            self.initSingleSeat(data.detail);
        });

        this.node.on('game_begin', function (data) {
            self.refreshBtns();
            self.initSeats();
        });

        this.node.on('game_num', function (data) {
            self.refreshBtns();
        });

        this.node.on('game_huanpai', function (data) {
            for (var i in self._seats2) {
                self._seats2[i].refreshXuanPaiState();
            }
        });

        this.node.on('huanpai_notify', function (data) {
            var idx = data.detail.seatindex;
            var localIdx = cc.vv.gameNetMgr.getLocalIndex(idx);
            self._seats2[localIdx].refreshXuanPaiState();
        });

        this.node.on('game_huanpai_over', function (data) {
            for (var i in self._seats2) {
                self._seats2[i].refreshXuanPaiState();
            }
        });

        this.node.on('voice_msg', function (data) {
            var data = data.detail;
            self._voiceMsgQueue.push(data);
            self.playVoice();
        });

        this.node.on('chat_push', function (data) {
            var data = data.detail;
            var idx = cc.vv.gameNetMgr.getSeatIndexByID(data.sender);
            var localIdx = cc.vv.gameNetMgr.getLocalIndex(idx);
            self._seats[localIdx].chat(data.content);
            self._seats2[localIdx].chat(data.content);
        });

        this.node.on('quick_chat_push', function (data) {
            var data = data.detail;
            var idx = cc.vv.gameNetMgr.getSeatIndexByID(data.sender);
            var localIdx = cc.vv.gameNetMgr.getLocalIndex(idx);

            var index = data.content;
            var info = cc.vv.chat.getQuickChatInfo(index);
            self._seats[localIdx].chat(info.content);
            self._seats2[localIdx].chat(info.content);

            cc.vv.audioMgr.playSFX(info.sound);
        });

        this.node.on('emoji_push', function (data) {
            var data = data.detail;
            var idx = cc.vv.gameNetMgr.getSeatIndexByID(data.sender);
            var localIdx = cc.vv.gameNetMgr.getLocalIndex(idx);
            console.log(data);
            self._seats[localIdx].emoji(data.content);
            self._seats2[localIdx].emoji(data.content);
        });
    },

    initSeats: function initSeats() {
        var seats = cc.vv.gameNetMgr.seats;
        for (var i = 0; i < seats.length; ++i) {
            this.initSingleSeat(seats[i]);
        }
    },

    initSingleSeat: function initSingleSeat(seat) {
        var index = cc.vv.gameNetMgr.getLocalIndex(seat.seatindex);
        var isOffline = !seat.online;
        var isZhuang = seat.seatindex == cc.vv.gameNetMgr.button;

        console.log("isOffline:" + isOffline);

        this._seats[index].setInfo(seat.name, seat.score);
        this._seats[index].setReady(seat.ready);
        this._seats[index].setOffline(isOffline);
        this._seats[index].setID(seat.userid);
        this._seats[index].voiceMsg(false);

        this._seats2[index].setInfo(seat.name, seat.score);
        this._seats2[index].setZhuang(isZhuang);
        this._seats2[index].setOffline(isOffline);
        this._seats2[index].setID(seat.userid);
        this._seats2[index].voiceMsg(false);
        this._seats2[index].refreshXuanPaiState();
    },

    onBtnSettingsClicked: function onBtnSettingsClicked() {
        cc.vv.popupMgr.showSettings();
    },

    onBtnBackClicked: function onBtnBackClicked() {
        cc.vv.alert.show("返回大厅", "返回大厅房间仍会保留，快去邀请大伙来玩吧！", function () {
            cc.director.loadScene("hall");
        }, true);
    },

    onBtnChatClicked: function onBtnChatClicked() {},

    onBtnWeichatClicked: function onBtnWeichatClicked() {
        var title = "<血战到底>";
        if (cc.vv.gameNetMgr.conf.type == "xlch") {
            var title = "<血流成河>";
        }
        cc.vv.anysdkMgr.share("达达麻将" + title, "房号:" + cc.vv.gameNetMgr.roomId + " 玩法:" + cc.vv.gameNetMgr.getWanfa());
    },

    onBtnDissolveClicked: function onBtnDissolveClicked() {
        cc.vv.alert.show("解散房间", "解散房间不扣房卡，是否确定解散？", function () {
            cc.vv.net.send("dispress");
        }, true);
    },

    onBtnExit: function onBtnExit() {
        cc.vv.net.send("exit");
    },

    playVoice: function playVoice() {
        if (this._playingSeat == null && this._voiceMsgQueue.length) {
            console.log("playVoice2");
            var data = this._voiceMsgQueue.shift();
            var idx = cc.vv.gameNetMgr.getSeatIndexByID(data.sender);
            var localIndex = cc.vv.gameNetMgr.getLocalIndex(idx);
            this._playingSeat = localIndex;
            this._seats[localIndex].voiceMsg(true);
            this._seats2[localIndex].voiceMsg(true);

            var msgInfo = JSON.parse(data.content);

            var msgfile = "voicemsg.amr";
            console.log(msgInfo.msg.length);
            cc.vv.voiceMgr.writeVoice(msgfile, msgInfo.msg);
            cc.vv.voiceMgr.play(msgfile);
            this._lastPlayTime = Date.now() + msgInfo.time;
        }
    },

    // called every frame, uncomment this function to activate update callback
    update: function update(dt) {
        var minutes = Math.floor(Date.now() / 1000 / 60);
        if (this._lastMinute != minutes) {
            this._lastMinute = minutes;
            var date = new Date();
            var h = date.getHours();
            h = h < 10 ? "0" + h : h;

            var m = date.getMinutes();
            m = m < 10 ? "0" + m : m;
            this._timeLabel.string = "" + h + ":" + m;
        }

        if (this._lastPlayTime != null) {
            if (Date.now() > this._lastPlayTime + 200) {
                this.onPlayerOver();
                this._lastPlayTime = null;
            }
        } else {
            this.playVoice();
        }
    },

    onPlayerOver: function onPlayerOver() {
        cc.vv.audioMgr.resumeAll();
        console.log("onPlayCallback:" + this._playingSeat);
        var localIndex = this._playingSeat;
        this._playingSeat = null;
        this._seats[localIndex].voiceMsg(false);
        this._seats2[localIndex].voiceMsg(false);
    },

    onDestroy: function onDestroy() {
        cc.vv.voiceMgr.stop();
        //        cc.vv.voiceMgr.onPlayCallback = null;
    }
});

cc._RF.pop();
},{}],"MahjongMgr":[function(require,module,exports){
"use strict";
cc._RF.push(module, '0ecea6X+IFIK5XFdJe38hXa', 'MahjongMgr');
// scripts/MahjongMgr.js

"use strict";

var mahjongSprites = [];

cc.Class({
    extends: cc.Component,

    properties: {
        leftAtlas: {
            default: null,
            type: cc.SpriteAtlas
        },

        rightAtlas: {
            default: null,
            type: cc.SpriteAtlas
        },

        bottomAtlas: {
            default: null,
            type: cc.SpriteAtlas
        },

        bottomFoldAtlas: {
            default: null,
            type: cc.SpriteAtlas
        },

        pengPrefabSelf: {
            default: null,
            type: cc.Prefab
        },

        pengPrefabLeft: {
            default: null,
            type: cc.Prefab
        },

        emptyAtlas: {
            default: null,
            type: cc.SpriteAtlas
        },

        holdsEmpty: {
            default: [],
            type: [cc.SpriteFrame]
        },

        _sides: null,
        _pres: null,
        _foldPres: null
    },

    onLoad: function onLoad() {
        if (cc.vv == null) {
            return;
        }
        this._sides = ["myself", "right", "up", "left"];
        this._pres = ["M_", "R_", "B_", "L_"];
        this._foldPres = ["B_", "R_", "B_", "L_"];
        cc.vv.mahjongmgr = this;
        //筒
        for (var i = 1; i < 10; ++i) {
            mahjongSprites.push("dot_" + i);
        }

        //条
        for (var i = 1; i < 10; ++i) {
            mahjongSprites.push("bamboo_" + i);
        }

        //万
        for (var i = 1; i < 10; ++i) {
            mahjongSprites.push("character_" + i);
        }

        //中、发、白
        mahjongSprites.push("red");
        mahjongSprites.push("green");
        mahjongSprites.push("white");

        //东西南北风
        mahjongSprites.push("wind_east");
        mahjongSprites.push("wind_west");
        mahjongSprites.push("wind_south");
        mahjongSprites.push("wind_north");
    },

    getMahjongSpriteByID: function getMahjongSpriteByID(id) {
        return mahjongSprites[id];
    },

    getMahjongType: function getMahjongType(id) {
        if (id >= 0 && id < 9) {
            return 0;
        } else if (id >= 9 && id < 18) {
            return 1;
        } else if (id >= 18 && id < 27) {
            return 2;
        }
    },

    getSpriteFrameByMJID: function getSpriteFrameByMJID(pre, mjid) {
        var spriteFrameName = this.getMahjongSpriteByID(mjid);
        spriteFrameName = pre + spriteFrameName;
        if (pre == "M_") {
            return this.bottomAtlas.getSpriteFrame(spriteFrameName);
        } else if (pre == "B_") {
            return this.bottomFoldAtlas.getSpriteFrame(spriteFrameName);
        } else if (pre == "L_") {
            return this.leftAtlas.getSpriteFrame(spriteFrameName);
        } else if (pre == "R_") {
            return this.rightAtlas.getSpriteFrame(spriteFrameName);
        }
    },

    getAudioURLByMJID: function getAudioURLByMJID(id) {
        var realId = 0;
        if (id >= 0 && id < 9) {
            realId = id + 21;
        } else if (id >= 9 && id < 18) {
            realId = id - 8;
        } else if (id >= 18 && id < 27) {
            realId = id - 7;
        }
        return "nv/" + realId + ".mp3";
    },

    getEmptySpriteFrame: function getEmptySpriteFrame(side) {
        if (side == "up") {
            return this.emptyAtlas.getSpriteFrame("e_mj_b_up");
        } else if (side == "myself") {
            return this.emptyAtlas.getSpriteFrame("e_mj_b_bottom");
        } else if (side == "left") {
            return this.emptyAtlas.getSpriteFrame("e_mj_b_left");
        } else if (side == "right") {
            return this.emptyAtlas.getSpriteFrame("e_mj_b_right");
        }
    },

    getHoldsEmptySpriteFrame: function getHoldsEmptySpriteFrame(side) {
        if (side == "up") {
            return this.emptyAtlas.getSpriteFrame("e_mj_up");
        } else if (side == "myself") {
            return null;
        } else if (side == "left") {
            return this.emptyAtlas.getSpriteFrame("e_mj_left");
        } else if (side == "right") {
            return this.emptyAtlas.getSpriteFrame("e_mj_right");
        }
    },

    sortMJ: function sortMJ(mahjongs, dingque) {
        var self = this;
        mahjongs.sort(function (a, b) {
            if (dingque >= 0) {
                var t1 = self.getMahjongType(a);
                var t2 = self.getMahjongType(b);
                if (t1 != t2) {
                    if (dingque == t1) {
                        return 1;
                    } else if (dingque == t2) {
                        return -1;
                    }
                }
            }
            return a - b;
        });
    },

    getSide: function getSide(localIndex) {
        return this._sides[localIndex];
    },

    getPre: function getPre(localIndex) {
        return this._pres[localIndex];
    },

    getFoldPre: function getFoldPre(localIndex) {
        return this._foldPres[localIndex];
    }
});

cc._RF.pop();
},{}],"NativeBridge":[function(require,module,exports){
(function (global){
"use strict";
cc._RF.push(module, '31dddPmkIlM4IHsR5Z1xtaQ', 'NativeBridge');
// scripts/NativeBridge.js

"use strict";

var NBWXCallback = function NBWXCallback(data) {
    cc.log("NBWXCallback11:" + data);
    data = data instanceof Object ? data : eval("(" + data + ")");
    if (data.success == 0) {
        var u = data.userInfo;
        var ret = {};
        ret.errcode = 0;
        ret.account = u.unionId;
        ret.sign = u.unionId;
        cc.sys.localStorage.setItem("wx_account", u.unionId);
        cc.sys.localStorage.setItem("wx_sign", u.unionId);
        cc.log("ss =" + cc.vv.userMgr);
        cc.vv.userMgr.onAuth(ret);
    }
    cc.log(data);
};

global.NBWXCallback = NBWXCallback;

cc._RF.pop();
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"Net":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'b1cc9yRd15CXqFg0vTGKZUk', 'Net');
// scripts/Net.js

"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

if (window.io == null) {
    window.io = require("socket-io");
}

var Global = cc.Class({
    extends: cc.Component,
    statics: {
        ip: "",
        sio: null,
        isPinging: false,
        fnDisconnect: null,
        handlers: {},
        addHandler: function addHandler(event, fn) {
            if (this.handlers[event]) {
                console.log("event:" + event + "' handler has been registered.");
                return;
            }

            var handler = function handler(data) {
                //console.log(event + "(" + typeof(data) + "):" + (data? data.toString():"null"));
                if (event != "disconnect" && typeof data == "string") {
                    data = JSON.parse(data);
                }
                fn(data);
            };

            this.handlers[event] = handler;
            if (this.sio) {
                console.log("register:function " + event);
                this.sio.on(event, handler);
            }
        },
        connect: function connect(fnConnect, fnError) {
            var self = this;

            var opts = {
                'reconnection': false,
                'force new connection': true,
                'transports': ['websocket', 'polling']
            };
            this.sio = window.io.connect(this.ip, opts);
            this.sio.on('reconnect', function () {
                console.log('reconnection');
            });
            this.sio.on('connect', function (data) {
                self.sio.connected = true;
                fnConnect(data);
            });

            this.sio.on('disconnect', function (data) {
                console.log("disconnect");
                self.sio.connected = false;
                self.close();
            });

            this.sio.on('connect_failed', function () {
                console.log('connect_failed');
            });

            for (var key in this.handlers) {
                var value = this.handlers[key];
                if (typeof value == "function") {
                    if (key == 'disconnect') {
                        this.fnDisconnect = value;
                    } else {
                        console.log("register:function " + key);
                        this.sio.on(key, value);
                    }
                }
            }

            this.startHearbeat();
        },

        startHearbeat: function startHearbeat() {
            this.sio.on('game_pong', function () {
                console.log('game_pong');
                self.lastRecieveTime = Date.now();
            });
            this.lastRecieveTime = Date.now();
            var self = this;
            console.log(1);
            if (!self.isPinging) {
                console.log(1);
                self.isPinging = true;
                setInterval(function () {
                    console.log(3);
                    if (self.sio) {
                        console.log(4);
                        if (Date.now() - self.lastRecieveTime > 10000) {
                            self.close();
                        } else {
                            self.ping();
                        }
                    }
                }, 5000);
            }
        },
        send: function send(event, data) {
            if (this.sio.connected) {
                if (data != null && (typeof data === "undefined" ? "undefined" : _typeof(data)) == "object") {
                    data = JSON.stringify(data);
                    //console.log(data);              
                }
                this.sio.emit(event, data);
            }
        },

        ping: function ping() {
            this.send('game_ping');
        },

        close: function close() {
            console.log('close');
            if (this.sio && this.sio.connected) {
                this.sio.connected = false;
                this.sio.disconnect();
                this.sio = null;
            }
            if (this.fnDisconnect) {
                this.fnDisconnect();
                this.fnDisconnect = null;
            }
        },

        test: function test(fnResult) {
            var xhr = null;
            var fn = function fn(ret) {
                fnResult(ret.isonline);
                xhr = null;
            };

            var arr = this.ip.split(':');
            var data = {
                account: cc.vv.userMgr.account,
                sign: cc.vv.userMgr.sign,
                ip: arr[0],
                port: arr[1]
            };
            xhr = cc.vv.http.sendRequest("/is_server_online", data, fn);
            setTimeout(function () {
                if (xhr) {
                    xhr.abort();
                    fnResult(false);
                }
            }, 1500);
            /*
            var opts = {
                'reconnection':false,
                'force new connection': true,
                'transports':['websocket', 'polling']
            }
            var self = this;
            this.testsio = window.io.connect(this.ip,opts);
            this.testsio.on('connect',function(){
                console.log('connect');
                self.testsio.close();
                self.testsio = null;
                fnResult(true);
            });
            this.testsio.on('connect_error',function(){
                console.log('connect_failed');
                self.testsio = null;
                fnResult(false);
            });
            */
        }
    }
});

cc._RF.pop();
},{"socket-io":"socket-io"}],"NoticeTip":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'df61b4+FzFDvbpO5g8UNVIM', 'NoticeTip');
// scripts/components/NoticeTip.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _guohu: null,
        _info: null,
        _guohuTime: -1
    },

    // use this for initialization
    onLoad: function onLoad() {
        this._guohu = cc.find("Canvas/tip_notice");
        this._guohu.active = false;

        this._info = cc.find("Canvas/tip_notice/info").getComponent(cc.Label);

        var self = this;
        this.node.on('push_notice', function (data) {
            var data = data.detail;
            self._guohu.active = true;
            self._guohuTime = data.time;
            self._info.string = data.info;
        });
    },

    // called every frame, uncomment this function to activate update callback
    update: function update(dt) {
        if (this._guohuTime > 0) {
            this._guohuTime -= dt;
            if (this._guohuTime < 0) {
                this._guohu.active = false;
            }
        }
    }
});

cc._RF.pop();
},{}],"OnBack":[function(require,module,exports){
"use strict";
cc._RF.push(module, '6fd982Tyi5NOYJWt/fGY8Lj', 'OnBack');
// scripts/components/OnBack.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
    },

    // use this for initialization
    onLoad: function onLoad() {
        var btn = this.node.getChildByName("btn_back");
        cc.vv.utils.addClickEvent(btn, this.node, "OnBack", "onBtnClicked");
    },

    onBtnClicked: function onBtnClicked(event) {
        if (event.target.name == "btn_back") {
            this.node.active = false;
        }
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"PengGangs":[function(require,module,exports){
"use strict";
cc._RF.push(module, '279d9pNFGRB3rD/ngr1LIXQ', 'PengGangs');
// scripts/components/PengGangs.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (!cc.vv) {
            return;
        }

        var gameChild = this.node.getChildByName("game");
        var myself = gameChild.getChildByName("myself");
        var pengangroot = myself.getChildByName("penggangs");
        var realwidth = cc.director.getVisibleSize().width;
        var scale = realwidth / 1280;
        pengangroot.scaleX *= scale;
        pengangroot.scaleY *= scale;

        var self = this;
        this.node.on('peng_notify', function (data) {
            //刷新所有的牌
            //console.log(data.detail);
            var data = data.detail;
            self.onPengGangChanged(data);
        });

        this.node.on('gang_notify', function (data) {
            //刷新所有的牌
            //console.log(data.detail);
            var data = data.detail;
            self.onPengGangChanged(data.seatData);
        });

        this.node.on('game_begin', function (data) {
            self.onGameBein();
        });

        var seats = cc.vv.gameNetMgr.seats;
        for (var i in seats) {
            this.onPengGangChanged(seats[i]);
        }
    },

    onGameBein: function onGameBein() {
        this.hideSide("myself");
        this.hideSide("right");
        this.hideSide("up");
        this.hideSide("left");
    },

    hideSide: function hideSide(side) {
        var gameChild = this.node.getChildByName("game");
        var myself = gameChild.getChildByName(side);
        var pengangroot = myself.getChildByName("penggangs");
        if (pengangroot) {
            for (var i = 0; i < pengangroot.childrenCount; ++i) {
                pengangroot.children[i].active = false;
            }
        }
    },

    onPengGangChanged: function onPengGangChanged(seatData) {

        if (seatData.angangs == null && seatData.diangangs == null && seatData.wangangs == null && seatData.pengs == null) {
            return;
        }
        var localIndex = cc.vv.gameNetMgr.getLocalIndex(seatData.seatindex);
        var side = cc.vv.mahjongmgr.getSide(localIndex);
        var pre = cc.vv.mahjongmgr.getFoldPre(localIndex);

        console.log("onPengGangChanged" + localIndex);

        var gameChild = this.node.getChildByName("game");
        var myself = gameChild.getChildByName(side);
        var pengangroot = myself.getChildByName("penggangs");

        for (var i = 0; i < pengangroot.childrenCount; ++i) {
            pengangroot.children[i].active = false;
        }
        //初始化杠牌
        var index = 0;

        var gangs = seatData.angangs;
        for (var i = 0; i < gangs.length; ++i) {
            var mjid = gangs[i];
            this.initPengAndGangs(pengangroot, side, pre, index, mjid, "angang");
            index++;
        }
        var gangs = seatData.diangangs;
        for (var i = 0; i < gangs.length; ++i) {
            var mjid = gangs[i];
            this.initPengAndGangs(pengangroot, side, pre, index, mjid, "diangang");
            index++;
        }

        var gangs = seatData.wangangs;
        for (var i = 0; i < gangs.length; ++i) {
            var mjid = gangs[i];
            this.initPengAndGangs(pengangroot, side, pre, index, mjid, "wangang");
            index++;
        }

        //初始化碰牌
        var pengs = seatData.pengs;
        if (pengs) {
            for (var i = 0; i < pengs.length; ++i) {
                var mjid = pengs[i];
                this.initPengAndGangs(pengangroot, side, pre, index, mjid, "peng");
                index++;
            }
        }
    },

    initPengAndGangs: function initPengAndGangs(pengangroot, side, pre, index, mjid, flag) {
        var pgroot = null;
        if (pengangroot.childrenCount <= index) {
            if (side == "left" || side == "right") {
                pgroot = cc.instantiate(cc.vv.mahjongmgr.pengPrefabLeft);
            } else {
                pgroot = cc.instantiate(cc.vv.mahjongmgr.pengPrefabSelf);
            }

            pengangroot.addChild(pgroot);
        } else {
            pgroot = pengangroot.children[index];
            pgroot.active = true;
        }

        if (side == "left") {
            pgroot.y = -(index * 25 * 3);
        } else if (side == "right") {
            pgroot.y = index * 25 * 3;
            pgroot.setLocalZOrder(-index);
        } else if (side == "myself") {
            pgroot.x = index * 55 * 3 + index * 10;
        } else {
            pgroot.x = -(index * 55 * 3);
        }

        var sprites = pgroot.getComponentsInChildren(cc.Sprite);
        for (var s = 0; s < sprites.length; ++s) {
            var sprite = sprites[s];
            if (sprite.node.name == "gang") {
                var isGang = flag != "peng";
                sprite.node.active = isGang;
                sprite.node.scaleX = 1.0;
                sprite.node.scaleY = 1.0;
                if (flag == "angang") {
                    sprite.spriteFrame = cc.vv.mahjongmgr.getEmptySpriteFrame(side);
                    if (side == "myself" || side == "up") {
                        sprite.node.scaleX = 1.4;
                        sprite.node.scaleY = 1.4;
                    }
                } else {
                    sprite.spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID(pre, mjid);
                }
            } else {
                sprite.spriteFrame = cc.vv.mahjongmgr.getSpriteFrameByMJID(pre, mjid);
            }
        }
    }

});

cc._RF.pop();
},{}],"PopupMgr":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'bc0d2VLgL1Avo166tHLsjCJ', 'PopupMgr');
// scripts/components/PopupMgr.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _popuproot: null,
        _settings: null,
        _dissolveNotice: null,

        _endTime: -1,
        _extraInfo: null,
        _noticeLabel: null
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (cc.vv == null) {
            return;
        }

        cc.vv.popupMgr = this;

        this._popuproot = cc.find("Canvas/popups");
        this._settings = cc.find("Canvas/popups/settings");
        this._dissolveNotice = cc.find("Canvas/popups/dissolve_notice");
        this._noticeLabel = this._dissolveNotice.getChildByName("info").getComponent(cc.Label);

        this.closeAll();

        this.addBtnHandler("settings/btn_close");
        this.addBtnHandler("settings/btn_sqjsfj");
        this.addBtnHandler("dissolve_notice/btn_agree");
        this.addBtnHandler("dissolve_notice/btn_reject");
        this.addBtnHandler("dissolve_notice/btn_ok");

        var self = this;
        this.node.on("dissolve_notice", function (event) {
            var data = event.detail;
            self.showDissolveNotice(data);
        });

        this.node.on("dissolve_cancel", function (event) {
            self.closeAll();
        });
    },

    start: function start() {
        if (cc.vv.gameNetMgr.dissoveData) {
            this.showDissolveNotice(cc.vv.gameNetMgr.dissoveData);
        }
    },

    addBtnHandler: function addBtnHandler(btnName) {
        var btn = cc.find("Canvas/popups/" + btnName);
        this.addClickEvent(btn, this.node, "PopupMgr", "onBtnClicked");
    },

    addClickEvent: function addClickEvent(node, target, component, handler) {
        var eventHandler = new cc.Component.EventHandler();
        eventHandler.target = target;
        eventHandler.component = component;
        eventHandler.handler = handler;

        var clickEvents = node.getComponent(cc.Button).clickEvents;
        clickEvents.push(eventHandler);
    },

    onBtnClicked: function onBtnClicked(event) {
        this.closeAll();
        var btnName = event.target.name;
        if (btnName == "btn_agree") {
            cc.vv.net.send("dissolve_agree");
        } else if (btnName == "btn_reject") {
            cc.vv.net.send("dissolve_reject");
        } else if (btnName == "btn_sqjsfj") {
            cc.vv.net.send("dissolve_request");
        }
    },

    closeAll: function closeAll() {
        this._popuproot.active = false;
        this._settings.active = false;
        this._dissolveNotice.active = false;
    },

    showSettings: function showSettings() {
        this.closeAll();
        this._popuproot.active = true;
        this._settings.active = true;
    },

    showDissolveRequest: function showDissolveRequest() {
        this.closeAll();
        this._popuproot.active = true;
    },

    showDissolveNotice: function showDissolveNotice(data) {
        this._endTime = Date.now() / 1000 + data.time;
        this._extraInfo = "";
        for (var i = 0; i < data.states.length; ++i) {
            var b = data.states[i];
            var name = cc.vv.gameNetMgr.seats[i].name;
            if (b) {
                this._extraInfo += "\n[已同意] " + name;
            } else {
                this._extraInfo += "\n[待确认] " + name;
            }
        }
        this.closeAll();
        this._popuproot.active = true;
        this._dissolveNotice.active = true;;
    },

    // called every frame, uncomment this function to activate update callback
    update: function update(dt) {
        if (this._endTime > 0) {
            var lastTime = this._endTime - Date.now() / 1000;
            if (lastTime < 0) {
                this._endTime = -1;
            }

            var m = Math.floor(lastTime / 60);
            var s = Math.ceil(lastTime - m * 60);

            var str = "";
            if (m > 0) {
                str += m + "分";
            }

            this._noticeLabel.string = str + s + "秒后房间将自动解散" + this._extraInfo;
        }
    }
});

cc._RF.pop();
},{}],"RadioButton":[function(require,module,exports){
"use strict";
cc._RF.push(module, '8d571y2U+9AiKntO+TSf0Fb', 'RadioButton');
// scripts/components/RadioButton.js

"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        target: cc.Node,
        sprite: cc.SpriteFrame,
        checkedSprite: cc.SpriteFrame,
        checked: false,
        groupId: -1
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (cc.vv == null) {
            return;
        }
        if (cc.vv.radiogroupmgr == null) {
            var RadioGroupMgr = require("RadioGroupMgr");
            cc.vv.radiogroupmgr = new RadioGroupMgr();
            cc.vv.radiogroupmgr.init();
        }
        console.log(_typeof(cc.vv.radiogroupmgr.add));
        cc.vv.radiogroupmgr.add(this);

        this.refresh();
    },

    refresh: function refresh() {
        var targetSprite = this.target.getComponent(cc.Sprite);
        if (this.checked) {
            targetSprite.spriteFrame = this.checkedSprite;
        } else {
            targetSprite.spriteFrame = this.sprite;
        }
    },

    check: function check(value) {
        this.checked = value;
        this.refresh();
    },

    onClicked: function onClicked() {
        cc.vv.radiogroupmgr.check(this);
    },

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },

    onDestroy: function onDestroy() {
        if (cc.vv && cc.vv.radiogroupmgr) {
            cc.vv.radiogroupmgr.del(this);
        }
    }
});

cc._RF.pop();
},{"RadioGroupMgr":"RadioGroupMgr"}],"RadioGroupMgr":[function(require,module,exports){
"use strict";
cc._RF.push(module, '824eapeRYNKY4RJzg2Z4YA2', 'RadioGroupMgr');
// scripts/components/RadioGroupMgr.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _groups: null
    },

    // use this for initialization
    init: function init() {
        this._groups = {};
    },

    add: function add(radioButton) {
        var groupId = radioButton.groupId;
        var buttons = this._groups[groupId];
        if (buttons == null) {
            buttons = [];
            this._groups[groupId] = buttons;
        }
        buttons.push(radioButton);
    },

    del: function del(radioButton) {
        var groupId = radioButton.groupId;
        var buttons = this._groups[groupId];
        if (buttons == null) {
            return;
        }
        var idx = buttons.indexOf(radioButton);
        if (idx != -1) {
            buttons.splice(idx, 1);
        }
        if (buttons.length == 0) {
            delete this._groups[groupId];
        }
    },

    check: function check(radioButton) {
        var groupId = radioButton.groupId;
        var buttons = this._groups[groupId];
        if (buttons == null) {
            return;
        }
        for (var i = 0; i < buttons.length; ++i) {
            var btn = buttons[i];
            if (btn == radioButton) {
                btn.check(true);
            } else {
                btn.check(false);
            }
        }
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"ReConnect":[function(require,module,exports){
"use strict";
cc._RF.push(module, '7f553G0boRH6KrTE7wACaXx', 'ReConnect');
// scripts/components/ReConnect.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _reconnect: null,
        _lblTip: null,
        _lastPing: 0
    },

    // use this for initialization
    onLoad: function onLoad() {
        this._reconnect = cc.find("Canvas/reconnect");
        this._lblTip = cc.find("Canvas/reconnect/tip").getComponent(cc.Label);
        var self = this;

        var fnTestServerOn = function fnTestServerOn() {
            cc.vv.net.test(function (ret) {
                if (ret) {
                    cc.director.loadScene('hall');
                } else {
                    setTimeout(fnTestServerOn, 3000);
                }
            });
        };

        var fn = function fn(data) {
            self.node.off('disconnect', fn);
            self._reconnect.active = true;
            fnTestServerOn();
        };
        console.log("adasfdasdfsdf");
        this.node.on('disconnect', fn);
    },
    // called every frame, uncomment this function to activate update callback
    update: function update(dt) {
        if (this._reconnect.active) {
            var t = Math.floor(Date.now() / 1000) % 4;
            this._lblTip.string = "与服务器断开连接，正在尝试重连";
            for (var i = 0; i < t; ++i) {
                this._lblTip.string += '.';
            }
        }
    }
});

cc._RF.pop();
},{}],"ReplayCtrl":[function(require,module,exports){
"use strict";
cc._RF.push(module, '21e6a+ajGNDTJwDHbV3A72m', 'ReplayCtrl');
// scripts/components/ReplayCtrl.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _nextPlayTime: 1,
        _replay: null,
        _isPlaying: true
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (cc.vv == null) {
            return;
        }

        this._replay = cc.find("Canvas/replay");
        this._replay.active = cc.vv.replayMgr.isReplay();
    },

    onBtnPauseClicked: function onBtnPauseClicked() {
        this._isPlaying = false;
    },

    onBtnPlayClicked: function onBtnPlayClicked() {
        this._isPlaying = true;
    },

    onBtnBackClicked: function onBtnBackClicked() {
        cc.vv.replayMgr.clear();
        cc.vv.gameNetMgr.reset();
        cc.vv.gameNetMgr.roomId = null;
        cc.director.loadScene("hall");
    },

    // called every frame, uncomment this function to activate update callback
    update: function update(dt) {
        if (cc.vv) {
            if (this._isPlaying && cc.vv.replayMgr.isReplay() == true && this._nextPlayTime > 0) {
                this._nextPlayTime -= dt;
                if (this._nextPlayTime < 0) {
                    this._nextPlayTime = cc.vv.replayMgr.takeAction();
                }
            }
        }
    }
});

cc._RF.pop();
},{}],"ReplayMgr":[function(require,module,exports){
"use strict";
cc._RF.push(module, '1a6a1p86NFL6KZEZCnbu7tt', 'ReplayMgr');
// scripts/ReplayMgr.js

'use strict';

var ACTION_CHUPAI = 1;
var ACTION_MOPAI = 2;
var ACTION_PENG = 3;
var ACTION_GANG = 4;
var ACTION_HU = 5;

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _lastAction: null,
        _actionRecords: null,
        _currentIndex: 0
    },

    // use this for initialization
    onLoad: function onLoad() {},

    clear: function clear() {
        this._lastAction = null;
        this._actionRecords = null;
        this._currentIndex = 0;
    },

    init: function init(data) {
        this._actionRecords = data.action_records;
        if (this._actionRecords == null) {
            this._actionRecords = {};
        }
        this._currentIndex = 0;
        this._lastAction = null;
    },

    isReplay: function isReplay() {
        return this._actionRecords != null;
    },

    getNextAction: function getNextAction() {
        if (this._currentIndex >= this._actionRecords.length) {
            return null;
        }

        var si = this._actionRecords[this._currentIndex++];
        var action = this._actionRecords[this._currentIndex++];
        var pai = this._actionRecords[this._currentIndex++];
        return { si: si, type: action, pai: pai };
    },

    takeAction: function takeAction() {
        var action = this.getNextAction();
        if (this._lastAction != null && this._lastAction.type == ACTION_CHUPAI) {
            if (action != null && action.type != ACTION_PENG && action.type != ACTION_GANG && action.type != ACTION_HU) {
                cc.vv.gameNetMgr.doGuo(this._lastAction.si, this._lastAction.pai);
            }
        }
        this._lastAction = action;
        if (action == null) {
            return -1;
        }
        var nextActionDelay = 1.0;
        if (action.type == ACTION_CHUPAI) {
            //console.log("chupai");
            cc.vv.gameNetMgr.doChupai(action.si, action.pai);
            return 1.0;
        } else if (action.type == ACTION_MOPAI) {
            //console.log("mopai");
            cc.vv.gameNetMgr.doMopai(action.si, action.pai);
            cc.vv.gameNetMgr.doTurnChange(action.si);
            return 0.5;
        } else if (action.type == ACTION_PENG) {
            //console.log("peng");
            cc.vv.gameNetMgr.doPeng(action.si, action.pai);
            cc.vv.gameNetMgr.doTurnChange(action.si);
            return 1.0;
        } else if (action.type == ACTION_GANG) {
            //console.log("gang");
            cc.vv.gameNetMgr.dispatchEvent('hangang_notify', action.si);
            cc.vv.gameNetMgr.doGang(action.si, action.pai);
            cc.vv.gameNetMgr.doTurnChange(action.si);
            return 1.0;
        } else if (action.type == ACTION_HU) {
            //console.log("hu");
            cc.vv.gameNetMgr.doHu({ seatindex: action.si, hupai: action.pai, iszimo: false });
            return 1.5;
        }
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"Seat":[function(require,module,exports){
"use strict";
cc._RF.push(module, '820870ltMZNDYlvzr+qCDEJ', 'Seat');
// scripts/components/Seat.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        _sprIcon: null,
        _zhuang: null,
        _ready: null,
        _offline: null,
        _lblName: null,
        _lblScore: null,
        _scoreBg: null,
        _nddayingjia: null,
        _voicemsg: null,

        _chatBubble: null,
        _emoji: null,
        _lastChatTime: -1,

        _userName: "",
        _score: 0,
        _dayingjia: false,
        _isOffline: false,
        _isReady: false,
        _isZhuang: false,
        _userId: null
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (cc.vv == null) {
            return;
        }

        this._sprIcon = this.node.getChildByName("icon").getComponent("ImageLoader");
        this._lblName = this.node.getChildByName("name").getComponent(cc.Label);
        this._lblScore = this.node.getChildByName("score").getComponent(cc.Label);
        this._voicemsg = this.node.getChildByName("voicemsg");
        this._xuanpai = this.node.getChildByName("xuanpai");
        this.refreshXuanPaiState();

        if (this._voicemsg) {
            this._voicemsg.active = false;
        }

        if (this._sprIcon && this._sprIcon.getComponent(cc.Button)) {
            cc.vv.utils.addClickEvent(this._sprIcon, this.node, "Seat", "onIconClicked");
        }

        this._offline = this.node.getChildByName("offline");

        this._ready = this.node.getChildByName("ready");

        this._zhuang = this.node.getChildByName("zhuang");

        this._scoreBg = this.node.getChildByName("Z_money_frame");
        this._nddayingjia = this.node.getChildByName("dayingjia");

        this._chatBubble = this.node.getChildByName("ChatBubble");
        if (this._chatBubble != null) {
            this._chatBubble.active = false;
        }

        this._emoji = this.node.getChildByName("emoji");
        if (this._emoji != null) {
            this._emoji.active = false;
        }

        this.refresh();

        if (this._sprIcon && this._userId) {
            this._sprIcon.setUserID(this._userId);
        }
    },

    onIconClicked: function onIconClicked() {
        var iconSprite = this._sprIcon.node.getComponent(cc.Sprite);
        if (this._userId != null && this._userId > 0) {
            var seat = cc.vv.gameNetMgr.getSeatByID(this._userId);
            var sex = 0;
            if (cc.vv.baseInfoMap) {
                var info = cc.vv.baseInfoMap[this._userId];
                if (info) {
                    sex = info.sex;
                }
            }
            cc.vv.userinfoShow.show(seat.name, seat.userid, iconSprite, sex, seat.ip);
        }
    },

    refresh: function refresh() {
        if (this._lblName != null) {
            this._lblName.string = this._userName;
        }

        if (this._lblScore != null) {
            this._lblScore.string = this._score;
        }

        if (this._nddayingjia != null) {
            this._nddayingjia.active = this._dayingjia == true;
        }

        if (this._offline) {
            this._offline.active = this._isOffline && this._userName != "";
        }

        if (this._ready) {
            this._ready.active = this._isReady && cc.vv.gameNetMgr.numOfGames > 0;
        }

        if (this._zhuang) {
            this._zhuang.active = this._isZhuang;
        }

        this.node.active = this._userName != null && this._userName != "";
    },

    setInfo: function setInfo(name, score, dayingjia) {
        this._userName = name;
        this._score = score;
        if (this._score == null) {
            this._score = 0;
        }
        this._dayingjia = dayingjia;

        if (this._scoreBg != null) {
            this._scoreBg.active = this._score != null;
        }

        if (this._lblScore != null) {
            this._lblScore.node.active = this._score != null;
        }

        this.refresh();
    },


    setZhuang: function setZhuang(value) {
        if (this._zhuang) {
            this._zhuang.active = value;
        }
    },

    setReady: function setReady(isReady) {
        this._isReady = isReady;
        if (this._ready) {
            this._ready.active = this._isReady && cc.vv.gameNetMgr.numOfGames > 0;
        }
    },

    setID: function setID(id) {
        var idNode = this.node.getChildByName("id");
        if (idNode) {
            var lbl = idNode.getComponent(cc.Label);
            lbl.string = "ID:" + id;
        }

        this._userId = id;
        if (this._sprIcon) {
            this._sprIcon.setUserID(id);
        }
    },

    setOffline: function setOffline(isOffline) {
        this._isOffline = isOffline;
        if (this._offline) {
            this._offline.active = this._isOffline && this._userName != "";
        }
    },

    chat: function chat(content) {
        if (this._chatBubble == null || this._emoji == null) {
            return;
        }
        this._emoji.active = false;
        this._chatBubble.active = true;
        this._chatBubble.getComponent(cc.Label).string = content;
        this._chatBubble.getChildByName("New Label").getComponent(cc.Label).string = content;
        this._lastChatTime = 3;
    },

    emoji: function emoji(_emoji) {
        //emoji = JSON.parse(emoji);
        if (this._emoji == null || this._emoji == null) {
            return;
        }
        console.log(_emoji);
        this._chatBubble.active = false;
        this._emoji.active = true;
        this._emoji.getComponent(cc.Animation).play(_emoji);
        this._lastChatTime = 3;
    },

    voiceMsg: function voiceMsg(show) {
        if (this._voicemsg) {
            this._voicemsg.active = show;
        }
    },

    refreshXuanPaiState: function refreshXuanPaiState() {
        if (this._xuanpai == null) {
            return;
        }

        this._xuanpai.active = cc.vv.gameNetMgr.isHuanSanZhang;
        if (cc.vv.gameNetMgr.isHuanSanZhang == false) {
            return;
        }

        this._xuanpai.getChildByName("xz").active = false;
        this._xuanpai.getChildByName("xd").active = false;

        var seat = cc.vv.gameNetMgr.getSeatByID(this._userId);
        if (seat) {
            if (seat.huanpais == null) {
                this._xuanpai.getChildByName("xz").active = true;
            } else {
                this._xuanpai.getChildByName("xd").active = true;
            }
        }
    },

    // called every frame, uncomment this function to activate update callback
    update: function update(dt) {
        if (this._lastChatTime > 0) {
            this._lastChatTime -= dt;
            if (this._lastChatTime < 0) {
                this._chatBubble.active = false;
                this._emoji.active = false;
                this._emoji.getComponent(cc.Animation).stop();
            }
        }
    }
});

cc._RF.pop();
},{}],"Settings":[function(require,module,exports){
"use strict";
cc._RF.push(module, '4c04fyd89JAZY7qGjvubi+f', 'Settings');
// scripts/components/Settings.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _btnYXOpen: null,
        _btnYXClose: null,
        _btnYYOpen: null,
        _btnYYClose: null
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (cc.vv == null) {
            return;
        }

        this._btnYXOpen = this.node.getChildByName("yinxiao").getChildByName("btn_yx_open");
        this._btnYXClose = this.node.getChildByName("yinxiao").getChildByName("btn_yx_close");

        this._btnYYOpen = this.node.getChildByName("yinyue").getChildByName("btn_yy_open");
        this._btnYYClose = this.node.getChildByName("yinyue").getChildByName("btn_yy_close");

        this.initButtonHandler(this.node.getChildByName("btn_close"));
        this.initButtonHandler(this.node.getChildByName("btn_exit"));

        this.initButtonHandler(this._btnYXOpen);
        this.initButtonHandler(this._btnYXClose);
        this.initButtonHandler(this._btnYYOpen);
        this.initButtonHandler(this._btnYYClose);

        var slider = this.node.getChildByName("yinxiao").getChildByName("progress");
        cc.vv.utils.addSlideEvent(slider, this.node, "Settings", "onSlided");

        var slider = this.node.getChildByName("yinyue").getChildByName("progress");
        cc.vv.utils.addSlideEvent(slider, this.node, "Settings", "onSlided");

        this.refreshVolume();
    },

    onSlided: function onSlided(slider) {
        if (slider.node.parent.name == "yinxiao") {
            cc.vv.audioMgr.setSFXVolume(slider.progress);
        } else if (slider.node.parent.name == "yinyue") {
            cc.vv.audioMgr.setBGMVolume(slider.progress);
        }
        this.refreshVolume();
    },

    initButtonHandler: function initButtonHandler(btn) {
        cc.vv.utils.addClickEvent(btn, this.node, "Settings", "onBtnClicked");
    },

    refreshVolume: function refreshVolume() {

        this._btnYXClose.active = cc.vv.audioMgr.sfxVolume > 0;
        this._btnYXOpen.active = !this._btnYXClose.active;

        var yx = this.node.getChildByName("yinxiao");
        var width = 430 * cc.vv.audioMgr.sfxVolume;
        var progress = yx.getChildByName("progress");
        progress.getComponent(cc.Slider).progress = cc.vv.audioMgr.sfxVolume;
        progress.getChildByName("progress").width = width;
        //yx.getChildByName("btn_progress").x = progress.x + width;


        this._btnYYClose.active = cc.vv.audioMgr.bgmVolume > 0;
        this._btnYYOpen.active = !this._btnYYClose.active;
        var yy = this.node.getChildByName("yinyue");
        var width = 430 * cc.vv.audioMgr.bgmVolume;
        var progress = yy.getChildByName("progress");
        progress.getComponent(cc.Slider).progress = cc.vv.audioMgr.bgmVolume;

        progress.getChildByName("progress").width = width;
        //yy.getChildByName("btn_progress").x = progress.x + width;
    },

    onBtnClicked: function onBtnClicked(event) {
        if (event.target.name == "btn_close") {
            this.node.active = false;
        } else if (event.target.name == "btn_exit") {
            cc.sys.localStorage.removeItem("wx_account");
            cc.sys.localStorage.removeItem("wx_sign");
            cc.director.loadScene("login");
        } else if (event.target.name == "btn_yx_open") {
            cc.vv.audioMgr.setSFXVolume(1.0);
            this.refreshVolume();
        } else if (event.target.name == "btn_yx_close") {
            cc.vv.audioMgr.setSFXVolume(0);
            this.refreshVolume();
        } else if (event.target.name == "btn_yy_open") {
            cc.vv.audioMgr.setBGMVolume(1);
            this.refreshVolume();
        } else if (event.target.name == "btn_yy_close") {
            cc.vv.audioMgr.setBGMVolume(0);
            this.refreshVolume();
        }
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"TimePointer":[function(require,module,exports){
"use strict";
cc._RF.push(module, '5b586erPK1H5bFfrMKWs+Y6', 'TimePointer');
// scripts/components/TimePointer.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        _arrow: null,
        _pointer: null,
        _timeLabel: null,
        _time: -1,
        _alertTime: -1
    },

    // use this for initialization
    onLoad: function onLoad() {
        var gameChild = this.node.getChildByName("game");
        this._arrow = gameChild.getChildByName("arrow");
        this._pointer = this._arrow.getChildByName("pointer");
        this.initPointer();

        this._timeLabel = this._arrow.getChildByName("lblTime").getComponent(cc.Label);
        this._timeLabel.string = "00";

        var self = this;

        this.node.on('game_begin', function (data) {
            self.initPointer();
        });

        this.node.on('game_chupai', function (data) {
            self.initPointer();
            self._time = 10;
            self._alertTime = 3;
        });
    },

    initPointer: function initPointer() {
        if (cc.vv == null) {
            return;
        }
        this._arrow.active = cc.vv.gameNetMgr.gamestate == "playing";
        if (!this._arrow.active) {
            return;
        }
        var turn = cc.vv.gameNetMgr.turn;
        var localIndex = cc.vv.gameNetMgr.getLocalIndex(turn);
        for (var i = 0; i < this._pointer.children.length; ++i) {
            this._pointer.children[i].active = i == localIndex;
        }
    },

    // called every frame, uncomment this function to activate update callback
    update: function update(dt) {
        if (this._time > 0) {
            this._time -= dt;
            if (this._alertTime > 0 && this._time < this._alertTime) {
                cc.vv.audioMgr.playSFX("timeup_alarm.mp3");
                this._alertTime = -1;
            }
            var pre = "";
            if (this._time < 0) {
                this._time = 0;
            }

            var t = Math.ceil(this._time);
            if (t < 10) {
                pre = "0";
            }
            this._timeLabel.string = pre + t;
        }
    }
});

cc._RF.pop();
},{}],"UserInfoShow":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'fe4f16CAmpBlZphnpsH1ETv', 'UserInfoShow');
// scripts/components/UserInfoShow.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _userinfo: null
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (cc.vv == null) {
            return;
        }

        this._userinfo = cc.find("Canvas/userinfo");
        this._userinfo.active = false;
        cc.vv.utils.addClickEvent(this._userinfo, this.node, "UserInfoShow", "onClicked");

        cc.vv.userinfoShow = this;
    },

    show: function show(name, userId, iconSprite, sex, ip) {
        if (userId != null && userId > 0) {
            this._userinfo.active = true;
            this._userinfo.getChildByName("icon").getComponent(cc.Sprite).spriteFrame = iconSprite.spriteFrame;
            this._userinfo.getChildByName("name").getComponent(cc.Label).string = name;
            this._userinfo.getChildByName("ip").getComponent(cc.Label).string = "IP: " + ip.replace("::ffff:", "");
            this._userinfo.getChildByName("id").getComponent(cc.Label).string = "ID: " + userId;

            var sex_female = this._userinfo.getChildByName("sex_female");
            sex_female.active = false;

            var sex_male = this._userinfo.getChildByName("sex_male");
            sex_male.active = false;

            if (sex == 1) {
                sex_male.active = true;
            } else if (sex == 2) {
                sex_female.active = true;
            }
        }
    },

    onClicked: function onClicked() {
        this._userinfo.active = false;
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});

cc._RF.pop();
},{}],"UserMgr":[function(require,module,exports){
"use strict";
cc._RF.push(module, '74d78JBqHdDKY6hckY2YuL+', 'UserMgr');
// scripts/UserMgr.js

"use strict";

cc.Class({
    extends: cc.Component,
    properties: {
        account: null,
        userId: null,
        userName: null,
        lv: 0,
        exp: 0,
        coins: 0,
        gems: 0,
        sign: 0,
        ip: "",
        sex: 0,
        roomData: null,

        oldRoomId: null
    },

    guestAuth: function guestAuth() {
        var account = cc.args["account"];
        if (account == null) {
            account = cc.sys.localStorage.getItem("account");
        }

        if (account == null) {
            account = Date.now();
            cc.sys.localStorage.setItem("account", account);
        }

        cc.vv.http.sendRequest("/guest", { account: account }, this.onAuth);
    },

    onAuth: function onAuth(ret) {
        var self = cc.vv.userMgr;
        if (ret.errcode !== 0) {
            console.log(ret.errmsg);
        } else {
            self.account = ret.account;
            self.sign = ret.sign;
            cc.vv.http.url = "http://" + cc.vv.SI.hall;
            self.login();
        }
    },

    login: function login() {
        var self = this;
        var onLogin = function onLogin(ret) {
            if (ret.errcode !== 0) {
                console.log(ret.errmsg);
            } else {
                if (!ret.userid) {
                    //jump to register user info.
                    cc.director.loadScene("createrole");
                } else {
                    console.log(ret);
                    self.account = ret.account;
                    self.userId = ret.userid;
                    self.userName = ret.name;
                    self.lv = ret.lv;
                    self.exp = ret.exp;
                    self.coins = ret.coins;
                    self.gems = ret.gems;
                    self.roomData = ret.roomid;
                    self.sex = ret.sex;
                    self.ip = ret.ip;
                    cc.director.loadScene("hall");
                }
            }
        };
        cc.vv.wc.show("正在登录游戏");
        cc.vv.http.sendRequest("/login", { account: this.account, sign: this.sign }, onLogin);
    },

    create: function create(name) {
        var self = this;
        var onCreate = function onCreate(ret) {
            if (ret.errcode !== 0) {
                console.log(ret.errmsg);
            } else {
                self.login();
            }
        };

        var data = {
            account: this.account,
            sign: this.sign,
            name: name
        };
        cc.vv.http.sendRequest("/create_user", data, onCreate);
    },

    enterRoom: function enterRoom(roomId, callback) {
        var self = this;
        var onEnter = function onEnter(ret) {
            if (ret.errcode !== 0) {
                if (ret.errcode == -1) {
                    setTimeout(function () {
                        self.enterRoom(roomId, callback);
                    }, 5000);
                } else {
                    cc.vv.wc.hide();
                    if (callback != null) {
                        callback(ret);
                    }
                }
            } else {
                if (callback != null) {
                    callback(ret);
                }
                cc.vv.gameNetMgr.connectGameServer(ret);
            }
        };

        var data = {
            account: cc.vv.userMgr.account,
            sign: cc.vv.userMgr.sign,
            roomid: roomId
        };
        cc.vv.wc.show("正在进入房间 " + roomId);
        cc.vv.http.sendRequest("/enter_private_room", data, onEnter);
    },
    getHistoryList: function getHistoryList(callback) {
        var self = this;
        var onGet = function onGet(ret) {
            if (ret.errcode !== 0) {
                console.log(ret.errmsg);
            } else {
                console.log(ret.history);
                if (callback != null) {
                    callback(ret.history);
                }
            }
        };

        var data = {
            account: cc.vv.userMgr.account,
            sign: cc.vv.userMgr.sign
        };
        cc.vv.http.sendRequest("/get_history_list", data, onGet);
    },
    getGamesOfRoom: function getGamesOfRoom(uuid, callback) {
        var self = this;
        var onGet = function onGet(ret) {
            if (ret.errcode !== 0) {
                console.log(ret.errmsg);
            } else {
                console.log(ret.data);
                callback(ret.data);
            }
        };

        var data = {
            account: cc.vv.userMgr.account,
            sign: cc.vv.userMgr.sign,
            uuid: uuid
        };
        cc.vv.http.sendRequest("/get_games_of_room", data, onGet);
    },

    getDetailOfGame: function getDetailOfGame(uuid, index, callback) {
        var self = this;
        var onGet = function onGet(ret) {
            if (ret.errcode !== 0) {
                console.log(ret.errmsg);
            } else {
                console.log(ret.data);
                callback(ret.data);
            }
        };

        var data = {
            account: cc.vv.userMgr.account,
            sign: cc.vv.userMgr.sign,
            uuid: uuid,
            index: index
        };
        cc.vv.http.sendRequest("/get_detail_of_game", data, onGet);
    }
});

cc._RF.pop();
},{}],"Utils":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'b717fzww0hNzIqvNbb1t9wx', 'Utils');
// scripts/Utils.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
    },

    addClickEvent: function addClickEvent(node, target, component, handler) {
        console.log(component + ":" + handler);
        var eventHandler = new cc.Component.EventHandler();
        eventHandler.target = target;
        eventHandler.component = component;
        eventHandler.handler = handler;

        var clickEvents = node.getComponent(cc.Button).clickEvents;
        clickEvents.push(eventHandler);
    },

    addSlideEvent: function addSlideEvent(node, target, component, handler) {
        var eventHandler = new cc.Component.EventHandler();
        eventHandler.target = target;
        eventHandler.component = component;
        eventHandler.handler = handler;

        var slideEvents = node.getComponent(cc.Slider).slideEvents;
        slideEvents.push(eventHandler);
    }

});

cc._RF.pop();
},{}],"VoiceMgr":[function(require,module,exports){
"use strict";
cc._RF.push(module, '1f066RbLAxKGJZtkDFO2kq/', 'VoiceMgr');
// scripts/VoiceMgr.js

"use strict";

var radix = 12;
var base = 128 - radix;
function crypto(value) {
    value -= base;
    var h = Math.floor(value / radix) + base;
    var l = value % radix + base;
    return String.fromCharCode(h) + String.fromCharCode(l);
}

var encodermap = {};
var decodermap = {};
for (var i = 0; i < 256; ++i) {
    var code = null;
    var v = i + 1;
    if (v >= base) {
        code = crypto(v);
    } else {
        code = String.fromCharCode(v);
    }

    encodermap[i] = code;
    decodermap[code] = i;
}

function encode(data) {
    var content = "";
    var len = data.length;
    var a = len >> 24 & 0xff;
    var b = len >> 16 & 0xff;
    var c = len >> 8 & 0xff;
    var d = len & 0xff;
    content += encodermap[a];
    content += encodermap[b];
    content += encodermap[c];
    content += encodermap[d];
    for (var i = 0; i < data.length; ++i) {
        content += encodermap[data[i]];
    }
    return content;
}

function getCode(content, index) {
    var c = content.charCodeAt(index);
    if (c >= base) {
        c = content.charAt(index) + content.charAt(index + 1);
    } else {
        c = content.charAt(index);
    }
    return c;
}
function decode(content) {
    var index = 0;
    var len = 0;
    for (var i = 0; i < 4; ++i) {
        var c = getCode(content, index);
        index += c.length;
        var v = decodermap[c];
        len |= v << (3 - i) * 8;
    }

    var newData = new Uint8Array(len);
    var cnt = 0;
    while (index < content.length) {
        var c = getCode(content, index);
        index += c.length;
        newData[cnt] = decodermap[c];
        cnt++;
    }
    return newData;
}

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        onPlayCallback: null,
        _voiceMediaPath: null
    },

    // use this for initialization
    init: function init() {
        /*
        var url = cc.url.raw("resources/test.amr");
        var fileData = jsb.fileUtils.getDataFromFile(url);
        var content = "";
        var sep = "";
        for(var i = 0; i < fileData.length; ++i){
            content += sep + fileData[i];
            sep = ",";
        }
        
        var url = cc.url.raw("resources/test.txt");
        jsb.fileUtils.writeStringToFile(content,url);
        
        var url = cc.url.raw("resources/test2.amrs");
        var content = encode(fileData);
        jsb.fileUtils.writeStringToFile(content,url);
        
        var url = cc.url.raw("resources/test2.amr");
        jsb.fileUtils.writeDataToFile(decode(content),url);
        */

        if (cc.sys.isNative) {
            this._voiceMediaPath = jsb.fileUtils.getWritablePath() + "/voicemsgs/";
            this.setStorageDir(this._voiceMediaPath);
        }
    },

    prepare: function prepare(filename) {
        if (!cc.sys.isNative) {
            return;
        }
        cc.vv.audioMgr.pauseAll();
        this.clearCache(filename);
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            jsb.reflection.callStaticMethod("com/vivigames/voicesdk/VoiceRecorder", "prepare", "(Ljava/lang/String;)V", filename);
        } else if (cc.sys.os == cc.sys.OS_IOS) {
            jsb.reflection.callStaticMethod("VoiceSDK", "prepareRecord:", filename);
        }
    },

    release: function release() {
        if (!cc.sys.isNative) {
            return;
        }
        cc.vv.audioMgr.resumeAll();
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            jsb.reflection.callStaticMethod("com/vivigames/voicesdk/VoiceRecorder", "release", "()V");
        } else if (cc.sys.os == cc.sys.OS_IOS) {
            jsb.reflection.callStaticMethod("VoiceSDK", "finishRecord");
        }
    },

    cancel: function cancel() {
        if (!cc.sys.isNative) {
            return;
        }
        cc.vv.audioMgr.resumeAll();
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            jsb.reflection.callStaticMethod("com/vivigames/voicesdk/VoiceRecorder", "cancel", "()V");
        } else if (cc.sys.os == cc.sys.OS_IOS) {
            jsb.reflection.callStaticMethod("VoiceSDK", "cancelRecord");
        }
    },

    writeVoice: function writeVoice(filename, voiceData) {
        if (!cc.sys.isNative) {
            return;
        }
        if (voiceData && voiceData.length > 0) {
            var fileData = decode(voiceData);
            var url = this._voiceMediaPath + filename;
            this.clearCache(filename);
            jsb.fileUtils.writeDataToFile(fileData, url);
        }
    },

    clearCache: function clearCache(filename) {
        if (cc.sys.isNative) {
            var url = this._voiceMediaPath + filename;
            //console.log("check file:" + url);
            if (jsb.fileUtils.isFileExist(url)) {
                //console.log("remove:" + url);
                jsb.fileUtils.removeFile(url);
            }
            if (jsb.fileUtils.isFileExist(url + ".wav")) {
                //console.log("remove:" + url + ".wav");
                jsb.fileUtils.removeFile(url + ".wav");
            }
        }
    },

    play: function play(filename) {
        if (!cc.sys.isNative) {
            return;
        }
        cc.vv.audioMgr.pauseAll();
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            jsb.reflection.callStaticMethod("com/vivigames/voicesdk/VoicePlayer", "play", "(Ljava/lang/String;)V", filename);
        } else if (cc.sys.os == cc.sys.OS_IOS) {
            jsb.reflection.callStaticMethod("VoiceSDK", "play:", filename);
        } else {}
    },

    stop: function stop() {
        if (!cc.sys.isNative) {
            return;
        }
        cc.vv.audioMgr.resumeAll();
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            jsb.reflection.callStaticMethod("com/vivigames/voicesdk/VoicePlayer", "stop", "()V");
        } else if (cc.sys.os == cc.sys.OS_IOS) {
            jsb.reflection.callStaticMethod("VoiceSDK", "stopPlay");
        } else {}
    },

    getVoiceLevel: function getVoiceLevel(maxLevel) {
        return Math.floor(Math.random() * maxLevel + 1);
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            return jsb.reflection.callStaticMethod("com/vivigames/voicesdk/VoiceRecorder", "getVoiceLevel", "(I)I", maxLevel);
        } else if (cc.sys.os == cc.sys.OS_IOS) {} else {
            return Math.floor(Math.random() * maxLevel + 1);
        }
    },

    getVoiceData: function getVoiceData(filename) {
        if (cc.sys.isNative) {
            var url = this._voiceMediaPath + filename;
            console.log("getVoiceData:" + url);
            var fileData = jsb.fileUtils.getDataFromFile(url);
            if (fileData) {
                var content = encode(fileData);
                return content;
            }
        }
        return "";
    },

    download: function download() {},
    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },

    setStorageDir: function setStorageDir(dir) {
        if (!cc.sys.isNative) {
            return;
        }
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            jsb.reflection.callStaticMethod("com/vivigames/voicesdk/VoiceRecorder", "setStorageDir", "(Ljava/lang/String;)V", dir);
        } else if (cc.sys.os == cc.sys.OS_IOS) {
            cc.log("setStorageDir=" + dir);
            jsb.reflection.callStaticMethod("VoiceSDK", "setStorageDir:", dir);
            if (!jsb.fileUtils.isDirectoryExist(dir)) {
                jsb.fileUtils.createDirectory(dir);
            }
        }
    }
});

cc._RF.pop();
},{}],"Voice":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'f6db9z0CxdEzpRVgU569dDu', 'Voice');
// scripts/components/Voice.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _lastTouchTime: null,
        _voice: null,
        _volume: null,
        _voice_failed: null,
        _lastCheckTime: -1,
        _timeBar: null,
        MAX_TIME: 15000
    },

    // use this for initialization
    onLoad: function onLoad() {

        this._voice = cc.find("Canvas/voice");
        this._voice.active = false;

        this._voice_failed = cc.find("Canvas/voice/voice_failed");
        this._voice_failed.active = false;

        this._timeBar = cc.find("Canvas/voice/time");
        this._timeBar.scaleX = 0.0;

        this._volume = cc.find("Canvas/voice/volume");
        for (var i = 1; i < this._volume.children.length; ++i) {
            this._volume.children[i].active = false;
        }

        var btnVoice = cc.find("Canvas/voice/voice_failed/btn_ok");
        if (btnVoice) {
            cc.vv.utils.addClickEvent(btnVoice, this.node, "Voice", "onBtnOKClicked");
        }

        var self = this;
        var btnVoice = cc.find("Canvas/btn_voice");
        if (btnVoice) {
            btnVoice.on(cc.Node.EventType.TOUCH_START, function () {
                console.log("cc.Node.EventType.TOUCH_START");
                cc.vv.voiceMgr.prepare("record.amr");
                self._lastTouchTime = Date.now();
                self._voice.active = true;
                self._voice_failed.active = false;
            });

            btnVoice.on(cc.Node.EventType.TOUCH_MOVE, function () {
                console.log("cc.Node.EventType.TOUCH_MOVE");
            });

            btnVoice.on(cc.Node.EventType.TOUCH_END, function () {
                console.log("cc.Node.EventType.TOUCH_END");
                if (Date.now() - self._lastTouchTime < 1000) {
                    self._voice_failed.active = true;
                    cc.vv.voiceMgr.cancel();
                } else {
                    self.onVoiceOK();
                }
                self._lastTouchTime = null;
            });

            btnVoice.on(cc.Node.EventType.TOUCH_CANCEL, function () {
                console.log("cc.Node.EventType.TOUCH_CANCEL");
                cc.vv.voiceMgr.cancel();
                self._lastTouchTime = null;
                self._voice.active = false;
            });
        }
    },

    onVoiceOK: function onVoiceOK() {
        if (this._lastTouchTime != null) {
            cc.vv.voiceMgr.release();
            var time = Date.now() - this._lastTouchTime;
            var msg = cc.vv.voiceMgr.getVoiceData("record.amr");
            cc.vv.net.send("voice_msg", { msg: msg, time: time });
        }
        this._voice.active = false;
    },

    onBtnOKClicked: function onBtnOKClicked() {
        this._voice.active = false;
    },

    // called every frame, uncomment this function to activate update callback
    update: function update(dt) {
        if (this._voice.active == true && this._voice_failed.active == false) {
            if (Date.now() - this._lastCheckTime > 300) {
                for (var i = 0; i < this._volume.children.length; ++i) {
                    this._volume.children[i].active = false;
                }
                var v = cc.vv.voiceMgr.getVoiceLevel(7);
                if (v >= 1 && v <= 7) {
                    this._volume.children[v - 1].active = true;
                }
                this._lastCheckTime = Date.now();
            }
        }

        if (this._lastTouchTime) {
            var time = Date.now() - this._lastTouchTime;
            if (time >= this.MAX_TIME) {
                this.onVoiceOK();
                this._lastTouchTime = null;
            } else {
                var percent = time / this.MAX_TIME;
                this._timeBar.scaleX = 1 - percent;
            }
        }
    }
});

cc._RF.pop();
},{}],"WaitingConnection":[function(require,module,exports){
"use strict";
cc._RF.push(module, '10e32jDstpLhIGHWrQEq2vN', 'WaitingConnection');
// scripts/components/WaitingConnection.js

"use strict";

cc.Class({
    extends: cc.Component,
    properties: {
        target: cc.Node,
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _isShow: false,
        lblContent: cc.Label
    },

    // use this for initialization
    onLoad: function onLoad() {
        if (cc.vv == null) {
            return null;
        }

        cc.vv.wc = this;
        this.node.active = this._isShow;
    },

    // called every frame, uncomment this function to activate update callback
    update: function update(dt) {
        this.target.rotation = this.target.rotation - dt * 45;
    },

    show: function show(content) {
        this._isShow = true;
        if (this.node) {
            this.node.active = this._isShow;
        }
        if (this.lblContent) {
            if (content == null) {
                content = "";
            }
            this.lblContent.string = content;
        }
    },
    hide: function hide() {
        this._isShow = false;
        if (this.node) {
            this.node.active = this._isShow;
        }
    }
});

cc._RF.pop();
},{}],"socket-io":[function(require,module,exports){
(function (global){
"use strict";
cc._RF.push(module, '393290vPc1IIYfh8FrmxcNZ', 'socket-io');
// scripts/3rdparty/socket-io.js

"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

if (!CC_JSB && !cc.sys.isNative) {
	(function (f) {
		if ((typeof exports === "undefined" ? "undefined" : _typeof(exports)) === "object" && typeof module !== "undefined") {
			module.exports = f();
		} else if (typeof define === "function" && define.amd) {
			define([], f);
		} else {
			var g;if (typeof window !== "undefined") {
				g = window;
			} else if (typeof global !== "undefined") {
				g = global;
			} else if (typeof self !== "undefined") {
				g = self;
			} else {
				g = this;
			}g.io = f();
		}
	})(function () {
		var define, module, exports;return function e(t, n, r) {
			function s(o, u) {
				if (!n[o]) {
					if (!t[o]) {
						var a = typeof require == "function" && require;if (!u && a) return a(o, !0);if (i) return i(o, !0);var f = new Error("Cannot find module '" + o + "'");throw f.code = "MODULE_NOT_FOUND", f;
					}var l = n[o] = { exports: {} };t[o][0].call(l.exports, function (e) {
						var n = t[o][1][e];return s(n ? n : e);
					}, l, l.exports, e, t, n, r);
				}return n[o].exports;
			}var i = typeof require == "function" && require;for (var o = 0; o < r.length; o++) {
				s(r[o]);
			}return s;
		}({ 1: [function (_dereq_, module, exports) {

				module.exports = _dereq_('./lib/');
			}, { "./lib/": 2 }], 2: [function (_dereq_, module, exports) {

				module.exports = _dereq_('./socket');

				/**
     * Exports parser
     *
     * @api public
     *
     */
				module.exports.parser = _dereq_('engine.io-parser');
			}, { "./socket": 3, "engine.io-parser": 19 }], 3: [function (_dereq_, module, exports) {
				(function (global) {
					/**
      * Module dependencies.
      */

					var transports = _dereq_('./transports');
					var Emitter = _dereq_('component-emitter');
					var debug = _dereq_('debug')('engine.io-client:socket');
					var index = _dereq_('indexof');
					var parser = _dereq_('engine.io-parser');
					var parseuri = _dereq_('parseuri');
					var parsejson = _dereq_('parsejson');
					var parseqs = _dereq_('parseqs');

					/**
      * Module exports.
      */

					module.exports = Socket;

					/**
      * Noop function.
      *
      * @api private
      */

					function noop() {}

					/**
      * Socket constructor.
      *
      * @param {String|Object} uri or options
      * @param {Object} options
      * @api public
      */

					function Socket(uri, opts) {
						if (!(this instanceof Socket)) return new Socket(uri, opts);

						opts = opts || {};

						if (uri && 'object' == (typeof uri === "undefined" ? "undefined" : _typeof(uri))) {
							opts = uri;
							uri = null;
						}

						if (uri) {
							uri = parseuri(uri);
							opts.hostname = uri.host;
							opts.secure = uri.protocol == 'https' || uri.protocol == 'wss';
							opts.port = uri.port;
							if (uri.query) opts.query = uri.query;
						} else if (opts.host) {
							opts.hostname = parseuri(opts.host).host;
						}

						this.secure = null != opts.secure ? opts.secure : global.location && 'https:' == location.protocol;

						if (opts.hostname && !opts.port) {
							// if no port is specified manually, use the protocol default
							opts.port = this.secure ? '443' : '80';
						}

						this.agent = opts.agent || false;
						this.hostname = opts.hostname || (global.location ? location.hostname : 'localhost');
						this.port = opts.port || (global.location && location.port ? location.port : this.secure ? 443 : 80);
						this.query = opts.query || {};
						if ('string' == typeof this.query) this.query = parseqs.decode(this.query);
						this.upgrade = false !== opts.upgrade;
						this.path = (opts.path || '/engine.io').replace(/\/$/, '') + '/';
						this.forceJSONP = !!opts.forceJSONP;
						this.jsonp = false !== opts.jsonp;
						this.forceBase64 = !!opts.forceBase64;
						this.enablesXDR = !!opts.enablesXDR;
						this.timestampParam = opts.timestampParam || 't';
						this.timestampRequests = opts.timestampRequests;
						this.transports = opts.transports || ['polling', 'websocket'];
						this.readyState = '';
						this.writeBuffer = [];
						this.policyPort = opts.policyPort || 843;
						this.rememberUpgrade = opts.rememberUpgrade || false;
						this.binaryType = null;
						this.onlyBinaryUpgrades = opts.onlyBinaryUpgrades;
						this.perMessageDeflate = false !== opts.perMessageDeflate ? opts.perMessageDeflate || {} : false;

						if (true === this.perMessageDeflate) this.perMessageDeflate = {};
						if (this.perMessageDeflate && null == this.perMessageDeflate.threshold) {
							this.perMessageDeflate.threshold = 1024;
						}

						// SSL options for Node.js client
						this.pfx = opts.pfx || null;
						this.key = opts.key || null;
						this.passphrase = opts.passphrase || null;
						this.cert = opts.cert || null;
						this.ca = opts.ca || null;
						this.ciphers = opts.ciphers || null;
						this.rejectUnauthorized = opts.rejectUnauthorized === undefined ? true : opts.rejectUnauthorized;

						// other options for Node.js client
						var freeGlobal = (typeof global === "undefined" ? "undefined" : _typeof(global)) == 'object' && global;
						if (freeGlobal.global === freeGlobal) {
							if (opts.extraHeaders && Object.keys(opts.extraHeaders).length > 0) {
								this.extraHeaders = opts.extraHeaders;
							}
						}

						this.open();
					}

					Socket.priorWebsocketSuccess = false;

					/**
      * Mix in `Emitter`.
      */

					Emitter(Socket.prototype);

					/**
      * Protocol version.
      *
      * @api public
      */

					Socket.protocol = parser.protocol; // this is an int

					/**
      * Expose deps for legacy compatibility
      * and standalone browser access.
      */

					Socket.Socket = Socket;
					Socket.Transport = _dereq_('./transport');
					Socket.transports = _dereq_('./transports');
					Socket.parser = _dereq_('engine.io-parser');

					/**
      * Creates transport of the given type.
      *
      * @param {String} transport name
      * @return {Transport}
      * @api private
      */

					Socket.prototype.createTransport = function (name) {
						debug('creating transport "%s"', name);
						var query = clone(this.query);

						// append engine.io protocol identifier
						query.EIO = parser.protocol;

						// transport name
						query.transport = name;

						// session id if we already have one
						if (this.id) query.sid = this.id;

						var transport = new transports[name]({
							agent: this.agent,
							hostname: this.hostname,
							port: this.port,
							secure: this.secure,
							path: this.path,
							query: query,
							forceJSONP: this.forceJSONP,
							jsonp: this.jsonp,
							forceBase64: this.forceBase64,
							enablesXDR: this.enablesXDR,
							timestampRequests: this.timestampRequests,
							timestampParam: this.timestampParam,
							policyPort: this.policyPort,
							socket: this,
							pfx: this.pfx,
							key: this.key,
							passphrase: this.passphrase,
							cert: this.cert,
							ca: this.ca,
							ciphers: this.ciphers,
							rejectUnauthorized: this.rejectUnauthorized,
							perMessageDeflate: this.perMessageDeflate,
							extraHeaders: this.extraHeaders
						});

						return transport;
					};

					function clone(obj) {
						var o = {};
						for (var i in obj) {
							if (obj.hasOwnProperty(i)) {
								o[i] = obj[i];
							}
						}
						return o;
					}

					/**
      * Initializes transport to use and starts probe.
      *
      * @api private
      */
					Socket.prototype.open = function () {
						var transport;
						if (this.rememberUpgrade && Socket.priorWebsocketSuccess && this.transports.indexOf('websocket') != -1) {
							transport = 'websocket';
						} else if (0 === this.transports.length) {
							// Emit error on next tick so it can be listened to
							var self = this;
							setTimeout(function () {
								self.emit('error', 'No transports available');
							}, 0);
							return;
						} else {
							transport = this.transports[0];
						}
						this.readyState = 'opening';

						// Retry with the next transport if the transport is disabled (jsonp: false)
						try {
							transport = this.createTransport(transport);
						} catch (e) {
							this.transports.shift();
							this.open();
							return;
						}

						transport.open();
						this.setTransport(transport);
					};

					/**
      * Sets the current transport. Disables the existing one (if any).
      *
      * @api private
      */

					Socket.prototype.setTransport = function (transport) {
						debug('setting transport %s', transport.name);
						var self = this;

						if (this.transport) {
							debug('clearing existing transport %s', this.transport.name);
							this.transport.removeAllListeners();
						}

						// set up transport
						this.transport = transport;

						// set up transport listeners
						transport.on('drain', function () {
							self.onDrain();
						}).on('packet', function (packet) {
							self.onPacket(packet);
						}).on('error', function (e) {
							self.onError(e);
						}).on('close', function () {
							self.onClose('transport close');
						});
					};

					/**
      * Probes a transport.
      *
      * @param {String} transport name
      * @api private
      */

					Socket.prototype.probe = function (name) {
						debug('probing transport "%s"', name);
						var transport = this.createTransport(name, { probe: 1 }),
						    failed = false,
						    self = this;

						Socket.priorWebsocketSuccess = false;

						function onTransportOpen() {
							if (self.onlyBinaryUpgrades) {
								var upgradeLosesBinary = !this.supportsBinary && self.transport.supportsBinary;
								failed = failed || upgradeLosesBinary;
							}
							if (failed) return;

							debug('probe transport "%s" opened', name);
							transport.send([{ type: 'ping', data: 'probe' }]);
							transport.once('packet', function (msg) {
								if (failed) return;
								if ('pong' == msg.type && 'probe' == msg.data) {
									debug('probe transport "%s" pong', name);
									self.upgrading = true;
									self.emit('upgrading', transport);
									if (!transport) return;
									Socket.priorWebsocketSuccess = 'websocket' == transport.name;

									debug('pausing current transport "%s"', self.transport.name);
									self.transport.pause(function () {
										if (failed) return;
										if ('closed' == self.readyState) return;
										debug('changing transport and sending upgrade packet');

										cleanup();

										self.setTransport(transport);
										transport.send([{ type: 'upgrade' }]);
										self.emit('upgrade', transport);
										transport = null;
										self.upgrading = false;
										self.flush();
									});
								} else {
									debug('probe transport "%s" failed', name);
									var err = new Error('probe error');
									err.transport = transport.name;
									self.emit('upgradeError', err);
								}
							});
						}

						function freezeTransport() {
							if (failed) return;

							// Any callback called by transport should be ignored since now
							failed = true;

							cleanup();

							transport.close();
							transport = null;
						}

						//Handle any error that happens while probing
						function onerror(err) {
							var error = new Error('probe error: ' + err);
							error.transport = transport.name;

							freezeTransport();

							debug('probe transport "%s" failed because of error: %s', name, err);

							self.emit('upgradeError', error);
						}

						function onTransportClose() {
							onerror("transport closed");
						}

						//When the socket is closed while we're probing
						function onclose() {
							onerror("socket closed");
						}

						//When the socket is upgraded while we're probing
						function onupgrade(to) {
							if (transport && to.name != transport.name) {
								debug('"%s" works - aborting "%s"', to.name, transport.name);
								freezeTransport();
							}
						}

						//Remove all listeners on the transport and on self
						function cleanup() {
							transport.removeListener('open', onTransportOpen);
							transport.removeListener('error', onerror);
							transport.removeListener('close', onTransportClose);
							self.removeListener('close', onclose);
							self.removeListener('upgrading', onupgrade);
						}

						transport.once('open', onTransportOpen);
						transport.once('error', onerror);
						transport.once('close', onTransportClose);

						this.once('close', onclose);
						this.once('upgrading', onupgrade);

						transport.open();
					};

					/**
      * Called when connection is deemed open.
      *
      * @api public
      */

					Socket.prototype.onOpen = function () {
						debug('socket open');
						this.readyState = 'open';
						Socket.priorWebsocketSuccess = 'websocket' == this.transport.name;
						this.emit('open');
						this.flush();

						// we check for `readyState` in case an `open`
						// listener already closed the socket
						if ('open' == this.readyState && this.upgrade && this.transport.pause) {
							debug('starting upgrade probes');
							for (var i = 0, l = this.upgrades.length; i < l; i++) {
								this.probe(this.upgrades[i]);
							}
						}
					};

					/**
      * Handles a packet.
      *
      * @api private
      */

					Socket.prototype.onPacket = function (packet) {
						if ('opening' == this.readyState || 'open' == this.readyState) {
							debug('socket receive: type "%s", data "%s"', packet.type, packet.data);

							this.emit('packet', packet);

							// Socket is live - any packet counts
							this.emit('heartbeat');

							switch (packet.type) {
								case 'open':
									this.onHandshake(parsejson(packet.data));
									break;

								case 'pong':
									this.setPing();
									this.emit('pong');
									break;

								case 'error':
									var err = new Error('server error');
									err.code = packet.data;
									this.onError(err);
									break;

								case 'message':
									this.emit('data', packet.data);
									this.emit('message', packet.data);
									break;
							}
						} else {
							debug('packet received with socket readyState "%s"', this.readyState);
						}
					};

					/**
      * Called upon handshake completion.
      *
      * @param {Object} handshake obj
      * @api private
      */

					Socket.prototype.onHandshake = function (data) {
						this.emit('handshake', data);
						this.id = data.sid;
						this.transport.query.sid = data.sid;
						this.upgrades = this.filterUpgrades(data.upgrades);
						this.pingInterval = data.pingInterval;
						this.pingTimeout = data.pingTimeout;
						this.onOpen();
						// In case open handler closes socket
						if ('closed' == this.readyState) return;
						this.setPing();

						// Prolong liveness of socket on heartbeat
						this.removeListener('heartbeat', this.onHeartbeat);
						this.on('heartbeat', this.onHeartbeat);
					};

					/**
      * Resets ping timeout.
      *
      * @api private
      */

					Socket.prototype.onHeartbeat = function (timeout) {
						clearTimeout(this.pingTimeoutTimer);
						var self = this;
						self.pingTimeoutTimer = setTimeout(function () {
							if ('closed' == self.readyState) return;
							self.onClose('ping timeout');
						}, timeout || self.pingInterval + self.pingTimeout);
					};

					/**
      * Pings server every `this.pingInterval` and expects response
      * within `this.pingTimeout` or closes connection.
      *
      * @api private
      */

					Socket.prototype.setPing = function () {
						var self = this;
						clearTimeout(self.pingIntervalTimer);
						self.pingIntervalTimer = setTimeout(function () {
							debug('writing ping packet - expecting pong within %sms', self.pingTimeout);
							self.ping();
							self.onHeartbeat(self.pingTimeout);
						}, self.pingInterval);
					};

					/**
     * Sends a ping packet.
     *
     * @api private
     */

					Socket.prototype.ping = function () {
						var self = this;
						this.sendPacket('ping', function () {
							self.emit('ping');
						});
					};

					/**
      * Called on `drain` event
      *
      * @api private
      */

					Socket.prototype.onDrain = function () {
						this.writeBuffer.splice(0, this.prevBufferLen);

						// setting prevBufferLen = 0 is very important
						// for example, when upgrading, upgrade packet is sent over,
						// and a nonzero prevBufferLen could cause problems on `drain`
						this.prevBufferLen = 0;

						if (0 === this.writeBuffer.length) {
							this.emit('drain');
						} else {
							this.flush();
						}
					};

					/**
      * Flush write buffers.
      *
      * @api private
      */

					Socket.prototype.flush = function () {
						if ('closed' != this.readyState && this.transport.writable && !this.upgrading && this.writeBuffer.length) {
							debug('flushing %d packets in socket', this.writeBuffer.length);
							this.transport.send(this.writeBuffer);
							// keep track of current length of writeBuffer
							// splice writeBuffer and callbackBuffer on `drain`
							this.prevBufferLen = this.writeBuffer.length;
							this.emit('flush');
						}
					};

					/**
      * Sends a message.
      *
      * @param {String} message.
      * @param {Function} callback function.
      * @param {Object} options.
      * @return {Socket} for chaining.
      * @api public
      */

					Socket.prototype.write = Socket.prototype.send = function (msg, options, fn) {
						this.sendPacket('message', msg, options, fn);
						return this;
					};

					/**
      * Sends a packet.
      *
      * @param {String} packet type.
      * @param {String} data.
      * @param {Object} options.
      * @param {Function} callback function.
      * @api private
      */

					Socket.prototype.sendPacket = function (type, data, options, fn) {
						if ('function' == typeof data) {
							fn = data;
							data = undefined;
						}

						if ('function' == typeof options) {
							fn = options;
							options = null;
						}

						if ('closing' == this.readyState || 'closed' == this.readyState) {
							return;
						}

						options = options || {};
						options.compress = false !== options.compress;

						var packet = {
							type: type,
							data: data,
							options: options
						};
						this.emit('packetCreate', packet);
						this.writeBuffer.push(packet);
						if (fn) this.once('flush', fn);
						this.flush();
					};

					/**
      * Closes the connection.
      *
      * @api private
      */

					Socket.prototype.close = function () {
						if ('opening' == this.readyState || 'open' == this.readyState) {
							this.readyState = 'closing';

							var self = this;

							if (this.writeBuffer.length) {
								this.once('drain', function () {
									if (this.upgrading) {
										waitForUpgrade();
									} else {
										close();
									}
								});
							} else if (this.upgrading) {
								waitForUpgrade();
							} else {
								close();
							}
						}

						function close() {
							self.onClose('forced close');
							debug('socket closing - telling transport to close');
							self.transport.close();
						}

						function cleanupAndClose() {
							self.removeListener('upgrade', cleanupAndClose);
							self.removeListener('upgradeError', cleanupAndClose);
							close();
						}

						function waitForUpgrade() {
							// wait for upgrade to finish since we can't send packets while pausing a transport
							self.once('upgrade', cleanupAndClose);
							self.once('upgradeError', cleanupAndClose);
						}

						return this;
					};

					/**
      * Called upon transport error
      *
      * @api private
      */

					Socket.prototype.onError = function (err) {
						debug('socket error %j', err);
						Socket.priorWebsocketSuccess = false;
						this.emit('error', err);
						this.onClose('transport error', err);
					};

					/**
      * Called upon transport close.
      *
      * @api private
      */

					Socket.prototype.onClose = function (reason, desc) {
						if ('opening' == this.readyState || 'open' == this.readyState || 'closing' == this.readyState) {
							debug('socket close with reason: "%s"', reason);
							var self = this;

							// clear timers
							clearTimeout(this.pingIntervalTimer);
							clearTimeout(this.pingTimeoutTimer);

							// stop event from firing again for transport
							this.transport.removeAllListeners('close');

							// ensure transport won't stay open
							this.transport.close();

							// ignore further transport communication
							this.transport.removeAllListeners();

							// set ready state
							this.readyState = 'closed';

							// clear session id
							this.id = null;

							// emit close event
							this.emit('close', reason, desc);

							// clean buffers after, so users can still
							// grab the buffers on `close` event
							self.writeBuffer = [];
							self.prevBufferLen = 0;
						}
					};

					/**
      * Filters upgrades, returning only those matching client transports.
      *
      * @param {Array} server upgrades
      * @api private
      *
      */

					Socket.prototype.filterUpgrades = function (upgrades) {
						var filteredUpgrades = [];
						for (var i = 0, j = upgrades.length; i < j; i++) {
							if (~index(this.transports, upgrades[i])) filteredUpgrades.push(upgrades[i]);
						}
						return filteredUpgrades;
					};
				}).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
			}, { "./transport": 4, "./transports": 5, "component-emitter": 15, "debug": 17, "engine.io-parser": 19, "indexof": 23, "parsejson": 26, "parseqs": 27, "parseuri": 28 }], 4: [function (_dereq_, module, exports) {
				/**
     * Module dependencies.
     */

				var parser = _dereq_('engine.io-parser');
				var Emitter = _dereq_('component-emitter');

				/**
     * Module exports.
     */

				module.exports = Transport;

				/**
     * Transport abstract constructor.
     *
     * @param {Object} options.
     * @api private
     */

				function Transport(opts) {
					this.path = opts.path;
					this.hostname = opts.hostname;
					this.port = opts.port;
					this.secure = opts.secure;
					this.query = opts.query;
					this.timestampParam = opts.timestampParam;
					this.timestampRequests = opts.timestampRequests;
					this.readyState = '';
					this.agent = opts.agent || false;
					this.socket = opts.socket;
					this.enablesXDR = opts.enablesXDR;

					// SSL options for Node.js client
					this.pfx = opts.pfx;
					this.key = opts.key;
					this.passphrase = opts.passphrase;
					this.cert = opts.cert;
					this.ca = opts.ca;
					this.ciphers = opts.ciphers;
					this.rejectUnauthorized = opts.rejectUnauthorized;

					// other options for Node.js client
					this.extraHeaders = opts.extraHeaders;
				}

				/**
     * Mix in `Emitter`.
     */

				Emitter(Transport.prototype);

				/**
     * Emits an error.
     *
     * @param {String} str
     * @return {Transport} for chaining
     * @api public
     */

				Transport.prototype.onError = function (msg, desc) {
					var err = new Error(msg);
					err.type = 'TransportError';
					err.description = desc;
					this.emit('error', err);
					return this;
				};

				/**
     * Opens the transport.
     *
     * @api public
     */

				Transport.prototype.open = function () {
					if ('closed' == this.readyState || '' == this.readyState) {
						this.readyState = 'opening';
						this.doOpen();
					}

					return this;
				};

				/**
     * Closes the transport.
     *
     * @api private
     */

				Transport.prototype.close = function () {
					if ('opening' == this.readyState || 'open' == this.readyState) {
						this.doClose();
						this.onClose();
					}

					return this;
				};

				/**
     * Sends multiple packets.
     *
     * @param {Array} packets
     * @api private
     */

				Transport.prototype.send = function (packets) {
					if ('open' == this.readyState) {
						this.write(packets);
					} else {
						throw new Error('Transport not open');
					}
				};

				/**
     * Called upon open
     *
     * @api private
     */

				Transport.prototype.onOpen = function () {
					this.readyState = 'open';
					this.writable = true;
					this.emit('open');
				};

				/**
     * Called with data.
     *
     * @param {String} data
     * @api private
     */

				Transport.prototype.onData = function (data) {
					var packet = parser.decodePacket(data, this.socket.binaryType);
					this.onPacket(packet);
				};

				/**
     * Called with a decoded packet.
     */

				Transport.prototype.onPacket = function (packet) {
					this.emit('packet', packet);
				};

				/**
     * Called upon close.
     *
     * @api private
     */

				Transport.prototype.onClose = function () {
					this.readyState = 'closed';
					this.emit('close');
				};
			}, { "component-emitter": 15, "engine.io-parser": 19 }], 5: [function (_dereq_, module, exports) {
				(function (global) {
					/**
      * Module dependencies
      */

					var XMLHttpRequest = _dereq_('xmlhttprequest-ssl');
					var XHR = _dereq_('./polling-xhr');
					var JSONP = _dereq_('./polling-jsonp');
					var websocket = _dereq_('./websocket');

					/**
      * Export transports.
      */

					exports.polling = polling;
					exports.websocket = websocket;

					/**
      * Polling transport polymorphic constructor.
      * Decides on xhr vs jsonp based on feature detection.
      *
      * @api private
      */

					function polling(opts) {
						var xhr;
						var xd = false;
						var xs = false;
						var jsonp = false !== opts.jsonp;

						if (global.location) {
							var isSSL = 'https:' == location.protocol;
							var port = location.port;

							// some user agents have empty `location.port`
							if (!port) {
								port = isSSL ? 443 : 80;
							}

							xd = opts.hostname != location.hostname || port != opts.port;
							xs = opts.secure != isSSL;
						}

						opts.xdomain = xd;
						opts.xscheme = xs;
						xhr = new XMLHttpRequest(opts);

						if ('open' in xhr && !opts.forceJSONP) {
							return new XHR(opts);
						} else {
							if (!jsonp) throw new Error('JSONP disabled');
							return new JSONP(opts);
						}
					}
				}).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
			}, { "./polling-jsonp": 6, "./polling-xhr": 7, "./websocket": 9, "xmlhttprequest-ssl": 10 }], 6: [function (_dereq_, module, exports) {
				(function (global) {

					/**
      * Module requirements.
      */

					var Polling = _dereq_('./polling');
					var inherit = _dereq_('component-inherit');

					/**
      * Module exports.
      */

					module.exports = JSONPPolling;

					/**
      * Cached regular expressions.
      */

					var rNewline = /\n/g;
					var rEscapedNewline = /\\n/g;

					/**
      * Global JSONP callbacks.
      */

					var callbacks;

					/**
      * Callbacks count.
      */

					var index = 0;

					/**
      * Noop.
      */

					function empty() {}

					/**
      * JSONP Polling constructor.
      *
      * @param {Object} opts.
      * @api public
      */

					function JSONPPolling(opts) {
						Polling.call(this, opts);

						this.query = this.query || {};

						// define global callbacks array if not present
						// we do this here (lazily) to avoid unneeded global pollution
						if (!callbacks) {
							// we need to consider multiple engines in the same page
							if (!global.___eio) global.___eio = [];
							callbacks = global.___eio;
						}

						// callback identifier
						this.index = callbacks.length;

						// add callback to jsonp global
						var self = this;
						callbacks.push(function (msg) {
							self.onData(msg);
						});

						// append to query string
						this.query.j = this.index;

						// prevent spurious errors from being emitted when the window is unloaded
						if (global.document && global.addEventListener) {
							global.addEventListener('beforeunload', function () {
								if (self.script) self.script.onerror = empty;
							}, false);
						}
					}

					/**
      * Inherits from Polling.
      */

					inherit(JSONPPolling, Polling);

					/*
      * JSONP only supports binary as base64 encoded strings
      */

					JSONPPolling.prototype.supportsBinary = false;

					/**
      * Closes the socket.
      *
      * @api private
      */

					JSONPPolling.prototype.doClose = function () {
						if (this.script) {
							this.script.parentNode.removeChild(this.script);
							this.script = null;
						}

						if (this.form) {
							this.form.parentNode.removeChild(this.form);
							this.form = null;
							this.iframe = null;
						}

						Polling.prototype.doClose.call(this);
					};

					/**
      * Starts a poll cycle.
      *
      * @api private
      */

					JSONPPolling.prototype.doPoll = function () {
						var self = this;
						var script = document.createElement('script');

						if (this.script) {
							this.script.parentNode.removeChild(this.script);
							this.script = null;
						}

						script.async = true;
						script.src = this.uri();
						script.onerror = function (e) {
							self.onError('jsonp poll error', e);
						};

						var insertAt = document.getElementsByTagName('script')[0];
						if (insertAt) {
							insertAt.parentNode.insertBefore(script, insertAt);
						} else {
							(document.head || document.body).appendChild(script);
						}
						this.script = script;

						var isUAgecko = 'undefined' != typeof navigator && /gecko/i.test(navigator.userAgent);

						if (isUAgecko) {
							setTimeout(function () {
								var iframe = document.createElement('iframe');
								document.body.appendChild(iframe);
								document.body.removeChild(iframe);
							}, 100);
						}
					};

					/**
      * Writes with a hidden iframe.
      *
      * @param {String} data to send
      * @param {Function} called upon flush.
      * @api private
      */

					JSONPPolling.prototype.doWrite = function (data, fn) {
						var self = this;

						if (!this.form) {
							var form = document.createElement('form');
							var area = document.createElement('textarea');
							var id = this.iframeId = 'eio_iframe_' + this.index;
							var iframe;

							form.className = 'socketio';
							form.style.position = 'absolute';
							form.style.top = '-1000px';
							form.style.left = '-1000px';
							form.target = id;
							form.method = 'POST';
							form.setAttribute('accept-charset', 'utf-8');
							area.name = 'd';
							form.appendChild(area);
							document.body.appendChild(form);

							this.form = form;
							this.area = area;
						}

						this.form.action = this.uri();

						function complete() {
							initIframe();
							fn();
						}

						function initIframe() {
							if (self.iframe) {
								try {
									self.form.removeChild(self.iframe);
								} catch (e) {
									self.onError('jsonp polling iframe removal error', e);
								}
							}

							try {
								// ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
								var html = '<iframe src="javascript:0" name="' + self.iframeId + '">';
								iframe = document.createElement(html);
							} catch (e) {
								iframe = document.createElement('iframe');
								iframe.name = self.iframeId;
								iframe.src = 'javascript:0';
							}

							iframe.id = self.iframeId;

							self.form.appendChild(iframe);
							self.iframe = iframe;
						}

						initIframe();

						// escape \n to prevent it from being converted into \r\n by some UAs
						// double escaping is required for escaped new lines because unescaping of new lines can be done safely on server-side
						data = data.replace(rEscapedNewline, '\\\n');
						this.area.value = data.replace(rNewline, '\\n');

						try {
							this.form.submit();
						} catch (e) {}

						if (this.iframe.attachEvent) {
							this.iframe.onreadystatechange = function () {
								if (self.iframe.readyState == 'complete') {
									complete();
								}
							};
						} else {
							this.iframe.onload = complete;
						}
					};
				}).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
			}, { "./polling": 8, "component-inherit": 16 }], 7: [function (_dereq_, module, exports) {
				(function (global) {
					/**
      * Module requirements.
      */

					var XMLHttpRequest = _dereq_('xmlhttprequest-ssl');
					var Polling = _dereq_('./polling');
					var Emitter = _dereq_('component-emitter');
					var inherit = _dereq_('component-inherit');
					var debug = _dereq_('debug')('engine.io-client:polling-xhr');

					/**
      * Module exports.
      */

					module.exports = XHR;
					module.exports.Request = Request;

					/**
      * Empty function
      */

					function empty() {}

					/**
      * XHR Polling constructor.
      *
      * @param {Object} opts
      * @api public
      */

					function XHR(opts) {
						Polling.call(this, opts);

						if (global.location) {
							var isSSL = 'https:' == location.protocol;
							var port = location.port;

							// some user agents have empty `location.port`
							if (!port) {
								port = isSSL ? 443 : 80;
							}

							this.xd = opts.hostname != global.location.hostname || port != opts.port;
							this.xs = opts.secure != isSSL;
						} else {
							this.extraHeaders = opts.extraHeaders;
						}
					}

					/**
      * Inherits from Polling.
      */

					inherit(XHR, Polling);

					/**
      * XHR supports binary
      */

					XHR.prototype.supportsBinary = true;

					/**
      * Creates a request.
      *
      * @param {String} method
      * @api private
      */

					XHR.prototype.request = function (opts) {
						opts = opts || {};
						opts.uri = this.uri();
						opts.xd = this.xd;
						opts.xs = this.xs;
						opts.agent = this.agent || false;
						opts.supportsBinary = this.supportsBinary;
						opts.enablesXDR = this.enablesXDR;

						// SSL options for Node.js client
						opts.pfx = this.pfx;
						opts.key = this.key;
						opts.passphrase = this.passphrase;
						opts.cert = this.cert;
						opts.ca = this.ca;
						opts.ciphers = this.ciphers;
						opts.rejectUnauthorized = this.rejectUnauthorized;

						// other options for Node.js client
						opts.extraHeaders = this.extraHeaders;

						return new Request(opts);
					};

					/**
      * Sends data.
      *
      * @param {String} data to send.
      * @param {Function} called upon flush.
      * @api private
      */

					XHR.prototype.doWrite = function (data, fn) {
						var isBinary = typeof data !== 'string' && data !== undefined;
						var req = this.request({ method: 'POST', data: data, isBinary: isBinary });
						var self = this;
						req.on('success', fn);
						req.on('error', function (err) {
							self.onError('xhr post error', err);
						});
						this.sendXhr = req;
					};

					/**
      * Starts a poll cycle.
      *
      * @api private
      */

					XHR.prototype.doPoll = function () {
						debug('xhr poll');
						var req = this.request();
						var self = this;
						req.on('data', function (data) {
							self.onData(data);
						});
						req.on('error', function (err) {
							self.onError('xhr poll error', err);
						});
						this.pollXhr = req;
					};

					/**
      * Request constructor
      *
      * @param {Object} options
      * @api public
      */

					function Request(opts) {
						this.method = opts.method || 'GET';
						this.uri = opts.uri;
						this.xd = !!opts.xd;
						this.xs = !!opts.xs;
						this.async = false !== opts.async;
						this.data = undefined != opts.data ? opts.data : null;
						this.agent = opts.agent;
						this.isBinary = opts.isBinary;
						this.supportsBinary = opts.supportsBinary;
						this.enablesXDR = opts.enablesXDR;

						// SSL options for Node.js client
						this.pfx = opts.pfx;
						this.key = opts.key;
						this.passphrase = opts.passphrase;
						this.cert = opts.cert;
						this.ca = opts.ca;
						this.ciphers = opts.ciphers;
						this.rejectUnauthorized = opts.rejectUnauthorized;

						// other options for Node.js client
						this.extraHeaders = opts.extraHeaders;

						this.create();
					}

					/**
      * Mix in `Emitter`.
      */

					Emitter(Request.prototype);

					/**
      * Creates the XHR object and sends the request.
      *
      * @api private
      */

					Request.prototype.create = function () {
						var opts = { agent: this.agent, xdomain: this.xd, xscheme: this.xs, enablesXDR: this.enablesXDR };

						// SSL options for Node.js client
						opts.pfx = this.pfx;
						opts.key = this.key;
						opts.passphrase = this.passphrase;
						opts.cert = this.cert;
						opts.ca = this.ca;
						opts.ciphers = this.ciphers;
						opts.rejectUnauthorized = this.rejectUnauthorized;

						var xhr = this.xhr = new XMLHttpRequest(opts);
						var self = this;

						try {
							debug('xhr open %s: %s', this.method, this.uri);
							xhr.open(this.method, this.uri, this.async);
							try {
								if (this.extraHeaders) {
									xhr.setDisableHeaderCheck(true);
									for (var i in this.extraHeaders) {
										if (this.extraHeaders.hasOwnProperty(i)) {
											xhr.setRequestHeader(i, this.extraHeaders[i]);
										}
									}
								}
							} catch (e) {}
							if (this.supportsBinary) {
								// This has to be done after open because Firefox is stupid
								// http://stackoverflow.com/questions/13216903/get-binary-data-with-xmlhttprequest-in-a-firefox-extension
								xhr.responseType = 'arraybuffer';
							}

							if ('POST' == this.method) {
								try {
									if (this.isBinary) {
										xhr.setRequestHeader('Content-type', 'application/octet-stream');
									} else {
										xhr.setRequestHeader('Content-type', 'text/plain;charset=UTF-8');
									}
								} catch (e) {}
							}

							// ie6 check
							if ('withCredentials' in xhr) {
								xhr.withCredentials = true;
							}

							if (this.hasXDR()) {
								xhr.onload = function () {
									self.onLoad();
								};
								xhr.onerror = function () {
									self.onError(xhr.responseText);
								};
							} else {
								xhr.onreadystatechange = function () {
									if (4 != xhr.readyState) return;
									if (200 == xhr.status || 1223 == xhr.status) {
										self.onLoad();
									} else {
										// make sure the `error` event handler that's user-set
										// does not throw in the same tick and gets caught here
										setTimeout(function () {
											self.onError(xhr.status);
										}, 0);
									}
								};
							}

							debug('xhr data %s', this.data);
							xhr.send(this.data);
						} catch (e) {
							// Need to defer since .create() is called directly fhrom the constructor
							// and thus the 'error' event can only be only bound *after* this exception
							// occurs.  Therefore, also, we cannot throw here at all.
							setTimeout(function () {
								self.onError(e);
							}, 0);
							return;
						}

						if (global.document) {
							this.index = Request.requestsCount++;
							Request.requests[this.index] = this;
						}
					};

					/**
      * Called upon successful response.
      *
      * @api private
      */

					Request.prototype.onSuccess = function () {
						this.emit('success');
						this.cleanup();
					};

					/**
      * Called if we have data.
      *
      * @api private
      */

					Request.prototype.onData = function (data) {
						this.emit('data', data);
						this.onSuccess();
					};

					/**
      * Called upon error.
      *
      * @api private
      */

					Request.prototype.onError = function (err) {
						this.emit('error', err);
						this.cleanup(true);
					};

					/**
      * Cleans up house.
      *
      * @api private
      */

					Request.prototype.cleanup = function (fromError) {
						if ('undefined' == typeof this.xhr || null === this.xhr) {
							return;
						}
						// xmlhttprequest
						if (this.hasXDR()) {
							this.xhr.onload = this.xhr.onerror = empty;
						} else {
							this.xhr.onreadystatechange = empty;
						}

						if (fromError) {
							try {
								this.xhr.abort();
							} catch (e) {}
						}

						if (global.document) {
							delete Request.requests[this.index];
						}

						this.xhr = null;
					};

					/**
      * Called upon load.
      *
      * @api private
      */

					Request.prototype.onLoad = function () {
						var data;
						try {
							var contentType;
							try {
								contentType = this.xhr.getResponseHeader('Content-Type').split(';')[0];
							} catch (e) {}
							if (contentType === 'application/octet-stream') {
								data = this.xhr.response;
							} else {
								if (!this.supportsBinary) {
									data = this.xhr.responseText;
								} else {
									try {
										data = String.fromCharCode.apply(null, new Uint8Array(this.xhr.response));
									} catch (e) {
										var ui8Arr = new Uint8Array(this.xhr.response);
										var dataArray = [];
										for (var idx = 0, length = ui8Arr.length; idx < length; idx++) {
											dataArray.push(ui8Arr[idx]);
										}

										data = String.fromCharCode.apply(null, dataArray);
									}
								}
							}
						} catch (e) {
							this.onError(e);
						}
						if (null != data) {
							this.onData(data);
						}
					};

					/**
      * Check if it has XDomainRequest.
      *
      * @api private
      */

					Request.prototype.hasXDR = function () {
						return 'undefined' !== typeof global.XDomainRequest && !this.xs && this.enablesXDR;
					};

					/**
      * Aborts the request.
      *
      * @api public
      */

					Request.prototype.abort = function () {
						this.cleanup();
					};

					/**
      * Aborts pending requests when unloading the window. This is needed to prevent
      * memory leaks (e.g. when using IE) and to ensure that no spurious error is
      * emitted.
      */

					if (global.document) {
						Request.requestsCount = 0;
						Request.requests = {};
						if (global.attachEvent) {
							global.attachEvent('onunload', unloadHandler);
						} else if (global.addEventListener) {
							global.addEventListener('beforeunload', unloadHandler, false);
						}
					}

					function unloadHandler() {
						for (var i in Request.requests) {
							if (Request.requests.hasOwnProperty(i)) {
								Request.requests[i].abort();
							}
						}
					}
				}).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
			}, { "./polling": 8, "component-emitter": 15, "component-inherit": 16, "debug": 17, "xmlhttprequest-ssl": 10 }], 8: [function (_dereq_, module, exports) {
				/**
     * Module dependencies.
     */

				var Transport = _dereq_('../transport');
				var parseqs = _dereq_('parseqs');
				var parser = _dereq_('engine.io-parser');
				var inherit = _dereq_('component-inherit');
				var yeast = _dereq_('yeast');
				var debug = _dereq_('debug')('engine.io-client:polling');

				/**
     * Module exports.
     */

				module.exports = Polling;

				/**
     * Is XHR2 supported?
     */

				var hasXHR2 = function () {
					var XMLHttpRequest = _dereq_('xmlhttprequest-ssl');
					var xhr = new XMLHttpRequest({ xdomain: false });
					return null != xhr.responseType;
				}();

				/**
     * Polling interface.
     *
     * @param {Object} opts
     * @api private
     */

				function Polling(opts) {
					var forceBase64 = opts && opts.forceBase64;
					if (!hasXHR2 || forceBase64) {
						this.supportsBinary = false;
					}
					Transport.call(this, opts);
				}

				/**
     * Inherits from Transport.
     */

				inherit(Polling, Transport);

				/**
     * Transport name.
     */

				Polling.prototype.name = 'polling';

				/**
     * Opens the socket (triggers polling). We write a PING message to determine
     * when the transport is open.
     *
     * @api private
     */

				Polling.prototype.doOpen = function () {
					this.poll();
				};

				/**
     * Pauses polling.
     *
     * @param {Function} callback upon buffers are flushed and transport is paused
     * @api private
     */

				Polling.prototype.pause = function (onPause) {
					var pending = 0;
					var self = this;

					this.readyState = 'pausing';

					function pause() {
						debug('paused');
						self.readyState = 'paused';
						onPause();
					}

					if (this.polling || !this.writable) {
						var total = 0;

						if (this.polling) {
							debug('we are currently polling - waiting to pause');
							total++;
							this.once('pollComplete', function () {
								debug('pre-pause polling complete');
								--total || pause();
							});
						}

						if (!this.writable) {
							debug('we are currently writing - waiting to pause');
							total++;
							this.once('drain', function () {
								debug('pre-pause writing complete');
								--total || pause();
							});
						}
					} else {
						pause();
					}
				};

				/**
     * Starts polling cycle.
     *
     * @api public
     */

				Polling.prototype.poll = function () {
					debug('polling');
					this.polling = true;
					this.doPoll();
					this.emit('poll');
				};

				/**
     * Overloads onData to detect payloads.
     *
     * @api private
     */

				Polling.prototype.onData = function (data) {
					var self = this;
					debug('polling got data %s', data);
					var callback = function callback(packet, index, total) {
						// if its the first message we consider the transport open
						if ('opening' == self.readyState) {
							self.onOpen();
						}

						// if its a close packet, we close the ongoing requests
						if ('close' == packet.type) {
							self.onClose();
							return false;
						}

						// otherwise bypass onData and handle the message
						self.onPacket(packet);
					};

					// decode payload
					parser.decodePayload(data, this.socket.binaryType, callback);

					// if an event did not trigger closing
					if ('closed' != this.readyState) {
						// if we got data we're not polling
						this.polling = false;
						this.emit('pollComplete');

						if ('open' == this.readyState) {
							this.poll();
						} else {
							debug('ignoring poll - transport state "%s"', this.readyState);
						}
					}
				};

				/**
     * For polling, send a close packet.
     *
     * @api private
     */

				Polling.prototype.doClose = function () {
					var self = this;

					function close() {
						debug('writing close packet');
						self.write([{ type: 'close' }]);
					}

					if ('open' == this.readyState) {
						debug('transport open - closing');
						close();
					} else {
						// in case we're trying to close while
						// handshaking is in progress (GH-164)
						debug('transport not open - deferring close');
						this.once('open', close);
					}
				};

				/**
     * Writes a packets payload.
     *
     * @param {Array} data packets
     * @param {Function} drain callback
     * @api private
     */

				Polling.prototype.write = function (packets) {
					var self = this;
					this.writable = false;
					var callbackfn = function callbackfn() {
						self.writable = true;
						self.emit('drain');
					};

					var self = this;
					parser.encodePayload(packets, this.supportsBinary, function (data) {
						self.doWrite(data, callbackfn);
					});
				};

				/**
     * Generates uri for connection.
     *
     * @api private
     */

				Polling.prototype.uri = function () {
					var query = this.query || {};
					var schema = this.secure ? 'https' : 'http';
					var port = '';

					// cache busting is forced
					if (false !== this.timestampRequests) {
						query[this.timestampParam] = yeast();
					}

					if (!this.supportsBinary && !query.sid) {
						query.b64 = 1;
					}

					query = parseqs.encode(query);

					// avoid port if default for schema
					if (this.port && ('https' == schema && this.port != 443 || 'http' == schema && this.port != 80)) {
						port = ':' + this.port;
					}

					// prepend ? to query
					if (query.length) {
						query = '?' + query;
					}

					var ipv6 = this.hostname.indexOf(':') !== -1;
					return schema + '://' + (ipv6 ? '[' + this.hostname + ']' : this.hostname) + port + this.path + query;
				};
			}, { "../transport": 4, "component-inherit": 16, "debug": 17, "engine.io-parser": 19, "parseqs": 27, "xmlhttprequest-ssl": 10, "yeast": 30 }], 9: [function (_dereq_, module, exports) {
				(function (global) {
					/**
      * Module dependencies.
      */

					var Transport = _dereq_('../transport');
					var parser = _dereq_('engine.io-parser');
					var parseqs = _dereq_('parseqs');
					var inherit = _dereq_('component-inherit');
					var yeast = _dereq_('yeast');
					var debug = _dereq_('debug')('engine.io-client:websocket');
					var BrowserWebSocket = global.WebSocket || global.MozWebSocket;

					/**
      * Get either the `WebSocket` or `MozWebSocket` globals
      * in the browser or try to resolve WebSocket-compatible
      * interface exposed by `ws` for Node-like environment.
      */

					var WebSocket = BrowserWebSocket;
					if (!WebSocket && typeof window === 'undefined') {
						try {
							WebSocket = _dereq_('ws');
						} catch (e) {}
					}

					/**
      * Module exports.
      */

					module.exports = WS;

					/**
      * WebSocket transport constructor.
      *
      * @api {Object} connection options
      * @api public
      */

					function WS(opts) {
						var forceBase64 = opts && opts.forceBase64;
						if (forceBase64) {
							this.supportsBinary = false;
						}
						this.perMessageDeflate = opts.perMessageDeflate;
						Transport.call(this, opts);
					}

					/**
      * Inherits from Transport.
      */

					inherit(WS, Transport);

					/**
      * Transport name.
      *
      * @api public
      */

					WS.prototype.name = 'websocket';

					/*
      * WebSockets support binary
      */

					WS.prototype.supportsBinary = true;

					/**
      * Opens socket.
      *
      * @api private
      */

					WS.prototype.doOpen = function () {
						if (!this.check()) {
							// let probe timeout
							return;
						}

						var self = this;
						var uri = this.uri();
						var protocols = void 0;
						var opts = {
							agent: this.agent,
							perMessageDeflate: this.perMessageDeflate
						};

						// SSL options for Node.js client
						opts.pfx = this.pfx;
						opts.key = this.key;
						opts.passphrase = this.passphrase;
						opts.cert = this.cert;
						opts.ca = this.ca;
						opts.ciphers = this.ciphers;
						opts.rejectUnauthorized = this.rejectUnauthorized;
						if (this.extraHeaders) {
							opts.headers = this.extraHeaders;
						}

						this.ws = BrowserWebSocket ? new WebSocket(uri) : new WebSocket(uri, protocols, opts);

						if (this.ws.binaryType === undefined) {
							this.supportsBinary = false;
						}

						if (this.ws.supports && this.ws.supports.binary) {
							this.supportsBinary = true;
							this.ws.binaryType = 'buffer';
						} else {
							this.ws.binaryType = 'arraybuffer';
						}

						this.addEventListeners();
					};

					/**
      * Adds event listeners to the socket
      *
      * @api private
      */

					WS.prototype.addEventListeners = function () {
						var self = this;

						this.ws.onopen = function () {
							self.onOpen();
						};
						this.ws.onclose = function () {
							self.onClose();
						};
						this.ws.onmessage = function (ev) {
							self.onData(ev.data);
						};
						this.ws.onerror = function (e) {
							self.onError('websocket error', e);
						};
					};

					/**
      * Override `onData` to use a timer on iOS.
      * See: https://gist.github.com/mloughran/2052006
      *
      * @api private
      */

					if ('undefined' != typeof navigator && /iPad|iPhone|iPod/i.test(navigator.userAgent)) {
						WS.prototype.onData = function (data) {
							var self = this;
							setTimeout(function () {
								Transport.prototype.onData.call(self, data);
							}, 0);
						};
					}

					/**
      * Writes data to socket.
      *
      * @param {Array} array of packets.
      * @api private
      */

					WS.prototype.write = function (packets) {
						var self = this;
						this.writable = false;

						// encodePacket efficient as it uses WS framing
						// no need for encodePayload
						var total = packets.length;
						for (var i = 0, l = total; i < l; i++) {
							(function (packet) {
								parser.encodePacket(packet, self.supportsBinary, function (data) {
									if (!BrowserWebSocket) {
										// always create a new object (GH-437)
										var opts = {};
										if (packet.options) {
											opts.compress = packet.options.compress;
										}

										if (self.perMessageDeflate) {
											var len = 'string' == typeof data ? global.Buffer.byteLength(data) : data.length;
											if (len < self.perMessageDeflate.threshold) {
												opts.compress = false;
											}
										}
									}

									//Sometimes the websocket has already been closed but the browser didn't
									//have a chance of informing us about it yet, in that case send will
									//throw an error
									try {
										if (BrowserWebSocket) {
											// TypeError is thrown when passing the second argument on Safari
											self.ws.send(data);
										} else {
											self.ws.send(data, opts);
										}
									} catch (e) {
										debug('websocket closed before onclose event');
									}

									--total || done();
								});
							})(packets[i]);
						}

						function done() {
							self.emit('flush');

							// fake drain
							// defer to next tick to allow Socket to clear writeBuffer
							setTimeout(function () {
								self.writable = true;
								self.emit('drain');
							}, 0);
						}
					};

					/**
      * Called upon close
      *
      * @api private
      */

					WS.prototype.onClose = function () {
						Transport.prototype.onClose.call(this);
					};

					/**
      * Closes socket.
      *
      * @api private
      */

					WS.prototype.doClose = function () {
						if (typeof this.ws !== 'undefined') {
							this.ws.close();
						}
					};

					/**
      * Generates uri for connection.
      *
      * @api private
      */

					WS.prototype.uri = function () {
						var query = this.query || {};
						var schema = this.secure ? 'wss' : 'ws';
						var port = '';

						// avoid port if default for schema
						if (this.port && ('wss' == schema && this.port != 443 || 'ws' == schema && this.port != 80)) {
							port = ':' + this.port;
						}

						// append timestamp to URI
						if (this.timestampRequests) {
							query[this.timestampParam] = yeast();
						}

						// communicate binary support capabilities
						if (!this.supportsBinary) {
							query.b64 = 1;
						}

						query = parseqs.encode(query);

						// prepend ? to query
						if (query.length) {
							query = '?' + query;
						}

						var ipv6 = this.hostname.indexOf(':') !== -1;
						return schema + '://' + (ipv6 ? '[' + this.hostname + ']' : this.hostname) + port + this.path + query;
					};

					/**
      * Feature detection for WebSocket.
      *
      * @return {Boolean} whether this transport is available.
      * @api public
      */

					WS.prototype.check = function () {
						return !!WebSocket && !('__initialize' in WebSocket && this.name === WS.prototype.name);
					};
				}).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
			}, { "../transport": 4, "component-inherit": 16, "debug": 17, "engine.io-parser": 19, "parseqs": 27, "ws": undefined, "yeast": 30 }], 10: [function (_dereq_, module, exports) {
				// browser shim for xmlhttprequest module
				var hasCORS = _dereq_('has-cors');

				module.exports = function (opts) {
					var xdomain = opts.xdomain;

					// scheme must be same when usign XDomainRequest
					// http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx
					var xscheme = opts.xscheme;

					// XDomainRequest has a flow of not sending cookie, therefore it should be disabled as a default.
					// https://github.com/Automattic/engine.io-client/pull/217
					var enablesXDR = opts.enablesXDR;

					// XMLHttpRequest can be disabled on IE
					try {
						if ('undefined' != typeof XMLHttpRequest && (!xdomain || hasCORS)) {
							return new XMLHttpRequest();
						}
					} catch (e) {}

					// Use XDomainRequest for IE8 if enablesXDR is true
					// because loading bar keeps flashing when using jsonp-polling
					// https://github.com/yujiosaka/socke.io-ie8-loading-example
					try {
						if ('undefined' != typeof XDomainRequest && !xscheme && enablesXDR) {
							return new XDomainRequest();
						}
					} catch (e) {}

					if (!xdomain) {
						try {
							return new ActiveXObject('Microsoft.XMLHTTP');
						} catch (e) {}
					}
				};
			}, { "has-cors": 22 }], 11: [function (_dereq_, module, exports) {
				module.exports = after;

				function after(count, callback, err_cb) {
					var bail = false;
					err_cb = err_cb || noop;
					proxy.count = count;

					return count === 0 ? callback() : proxy;

					function proxy(err, result) {
						if (proxy.count <= 0) {
							throw new Error('after called too many times');
						}
						--proxy.count;

						// after first error, rest are passed to err_cb
						if (err) {
							bail = true;
							callback(err);
							// future error callbacks will go to error handler
							callback = err_cb;
						} else if (proxy.count === 0 && !bail) {
							callback(null, result);
						}
					}
				}

				function noop() {}
			}, {}], 12: [function (_dereq_, module, exports) {
				/**
     * An abstraction for slicing an arraybuffer even when
     * ArrayBuffer.prototype.slice is not supported
     *
     * @api public
     */

				module.exports = function (arraybuffer, start, end) {
					var bytes = arraybuffer.byteLength;
					start = start || 0;
					end = end || bytes;

					if (arraybuffer.slice) {
						return arraybuffer.slice(start, end);
					}

					if (start < 0) {
						start += bytes;
					}
					if (end < 0) {
						end += bytes;
					}
					if (end > bytes) {
						end = bytes;
					}

					if (start >= bytes || start >= end || bytes === 0) {
						return new ArrayBuffer(0);
					}

					var abv = new Uint8Array(arraybuffer);
					var result = new Uint8Array(end - start);
					for (var i = start, ii = 0; i < end; i++, ii++) {
						result[ii] = abv[i];
					}
					return result.buffer;
				};
			}, {}], 13: [function (_dereq_, module, exports) {
				/*
     * base64-arraybuffer
     * https://github.com/niklasvh/base64-arraybuffer
     *
     * Copyright (c) 2012 Niklas von Hertzen
     * Licensed under the MIT license.
     */
				(function (chars) {
					"use strict";

					exports.encode = function (arraybuffer) {
						var bytes = new Uint8Array(arraybuffer),
						    i,
						    len = bytes.length,
						    base64 = "";

						for (i = 0; i < len; i += 3) {
							base64 += chars[bytes[i] >> 2];
							base64 += chars[(bytes[i] & 3) << 4 | bytes[i + 1] >> 4];
							base64 += chars[(bytes[i + 1] & 15) << 2 | bytes[i + 2] >> 6];
							base64 += chars[bytes[i + 2] & 63];
						}

						if (len % 3 === 2) {
							base64 = base64.substring(0, base64.length - 1) + "=";
						} else if (len % 3 === 1) {
							base64 = base64.substring(0, base64.length - 2) + "==";
						}

						return base64;
					};

					exports.decode = function (base64) {
						var bufferLength = base64.length * 0.75,
						    len = base64.length,
						    i,
						    p = 0,
						    encoded1,
						    encoded2,
						    encoded3,
						    encoded4;

						if (base64[base64.length - 1] === "=") {
							bufferLength--;
							if (base64[base64.length - 2] === "=") {
								bufferLength--;
							}
						}

						var arraybuffer = new ArrayBuffer(bufferLength),
						    bytes = new Uint8Array(arraybuffer);

						for (i = 0; i < len; i += 4) {
							encoded1 = chars.indexOf(base64[i]);
							encoded2 = chars.indexOf(base64[i + 1]);
							encoded3 = chars.indexOf(base64[i + 2]);
							encoded4 = chars.indexOf(base64[i + 3]);

							bytes[p++] = encoded1 << 2 | encoded2 >> 4;
							bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
							bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
						}

						return arraybuffer;
					};
				})("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
			}, {}], 14: [function (_dereq_, module, exports) {
				(function (global) {
					/**
      * Create a blob builder even when vendor prefixes exist
      */

					var BlobBuilder = global.BlobBuilder || global.WebKitBlobBuilder || global.MSBlobBuilder || global.MozBlobBuilder;

					/**
      * Check if Blob constructor is supported
      */

					var blobSupported = function () {
						try {
							var a = new Blob(['hi']);
							return a.size === 2;
						} catch (e) {
							return false;
						}
					}();

					/**
      * Check if Blob constructor supports ArrayBufferViews
      * Fails in Safari 6, so we need to map to ArrayBuffers there.
      */

					var blobSupportsArrayBufferView = blobSupported && function () {
						try {
							var b = new Blob([new Uint8Array([1, 2])]);
							return b.size === 2;
						} catch (e) {
							return false;
						}
					}();

					/**
      * Check if BlobBuilder is supported
      */

					var blobBuilderSupported = BlobBuilder && BlobBuilder.prototype.append && BlobBuilder.prototype.getBlob;

					/**
      * Helper function that maps ArrayBufferViews to ArrayBuffers
      * Used by BlobBuilder constructor and old browsers that didn't
      * support it in the Blob constructor.
      */

					function mapArrayBufferViews(ary) {
						for (var i = 0; i < ary.length; i++) {
							var chunk = ary[i];
							if (chunk.buffer instanceof ArrayBuffer) {
								var buf = chunk.buffer;

								// if this is a subarray, make a copy so we only
								// include the subarray region from the underlying buffer
								if (chunk.byteLength !== buf.byteLength) {
									var copy = new Uint8Array(chunk.byteLength);
									copy.set(new Uint8Array(buf, chunk.byteOffset, chunk.byteLength));
									buf = copy.buffer;
								}

								ary[i] = buf;
							}
						}
					}

					function BlobBuilderConstructor(ary, options) {
						options = options || {};

						var bb = new BlobBuilder();
						mapArrayBufferViews(ary);

						for (var i = 0; i < ary.length; i++) {
							bb.append(ary[i]);
						}

						return options.type ? bb.getBlob(options.type) : bb.getBlob();
					};

					function BlobConstructor(ary, options) {
						mapArrayBufferViews(ary);
						return new Blob(ary, options || {});
					};

					module.exports = function () {
						if (blobSupported) {
							return blobSupportsArrayBufferView ? global.Blob : BlobConstructor;
						} else if (blobBuilderSupported) {
							return BlobBuilderConstructor;
						} else {
							return undefined;
						}
					}();
				}).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
			}, {}], 15: [function (_dereq_, module, exports) {

				/**
     * Expose `Emitter`.
     */

				module.exports = Emitter;

				/**
     * Initialize a new `Emitter`.
     *
     * @api public
     */

				function Emitter(obj) {
					if (obj) return mixin(obj);
				};

				/**
     * Mixin the emitter properties.
     *
     * @param {Object} obj
     * @return {Object}
     * @api private
     */

				function mixin(obj) {
					for (var key in Emitter.prototype) {
						obj[key] = Emitter.prototype[key];
					}
					return obj;
				}

				/**
     * Listen on the given `event` with `fn`.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

				Emitter.prototype.on = Emitter.prototype.addEventListener = function (event, fn) {
					this._callbacks = this._callbacks || {};
					(this._callbacks[event] = this._callbacks[event] || []).push(fn);
					return this;
				};

				/**
     * Adds an `event` listener that will be invoked a single
     * time then automatically removed.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

				Emitter.prototype.once = function (event, fn) {
					var self = this;
					this._callbacks = this._callbacks || {};

					function on() {
						self.off(event, on);
						fn.apply(this, arguments);
					}

					on.fn = fn;
					this.on(event, on);
					return this;
				};

				/**
     * Remove the given callback for `event` or all
     * registered callbacks.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

				Emitter.prototype.off = Emitter.prototype.removeListener = Emitter.prototype.removeAllListeners = Emitter.prototype.removeEventListener = function (event, fn) {
					this._callbacks = this._callbacks || {};

					// all
					if (0 == arguments.length) {
						this._callbacks = {};
						return this;
					}

					// specific event
					var callbacks = this._callbacks[event];
					if (!callbacks) return this;

					// remove all handlers
					if (1 == arguments.length) {
						delete this._callbacks[event];
						return this;
					}

					// remove specific handler
					var cb;
					for (var i = 0; i < callbacks.length; i++) {
						cb = callbacks[i];
						if (cb === fn || cb.fn === fn) {
							callbacks.splice(i, 1);
							break;
						}
					}
					return this;
				};

				/**
     * Emit `event` with the given args.
     *
     * @param {String} event
     * @param {Mixed} ...
     * @return {Emitter}
     */

				Emitter.prototype.emit = function (event) {
					this._callbacks = this._callbacks || {};
					var args = [].slice.call(arguments, 1),
					    callbacks = this._callbacks[event];

					if (callbacks) {
						callbacks = callbacks.slice(0);
						for (var i = 0, len = callbacks.length; i < len; ++i) {
							callbacks[i].apply(this, args);
						}
					}

					return this;
				};

				/**
     * Return array of callbacks for `event`.
     *
     * @param {String} event
     * @return {Array}
     * @api public
     */

				Emitter.prototype.listeners = function (event) {
					this._callbacks = this._callbacks || {};
					return this._callbacks[event] || [];
				};

				/**
     * Check if this emitter has `event` handlers.
     *
     * @param {String} event
     * @return {Boolean}
     * @api public
     */

				Emitter.prototype.hasListeners = function (event) {
					return !!this.listeners(event).length;
				};
			}, {}], 16: [function (_dereq_, module, exports) {

				module.exports = function (a, b) {
					var fn = function fn() {};
					fn.prototype = b.prototype;
					a.prototype = new fn();
					a.prototype.constructor = a;
				};
			}, {}], 17: [function (_dereq_, module, exports) {

				/**
     * This is the web browser implementation of `debug()`.
     *
     * Expose `debug()` as the module.
     */

				exports = module.exports = _dereq_('./debug');
				exports.log = log;
				exports.formatArgs = formatArgs;
				exports.save = save;
				exports.load = load;
				exports.useColors = useColors;
				exports.storage = 'undefined' != typeof chrome && 'undefined' != typeof chrome.storage ? chrome.storage.local : localstorage();

				/**
     * Colors.
     */

				exports.colors = ['lightseagreen', 'forestgreen', 'goldenrod', 'dodgerblue', 'darkorchid', 'crimson'];

				/**
     * Currently only WebKit-based Web Inspectors, Firefox >= v31,
     * and the Firebug extension (any Firefox version) are known
     * to support "%c" CSS customizations.
     *
     * TODO: add a `localStorage` variable to explicitly enable/disable colors
     */

				function useColors() {
					// is webkit? http://stackoverflow.com/a/16459606/376773
					return 'WebkitAppearance' in document.documentElement.style ||
					// is firebug? http://stackoverflow.com/a/398120/376773
					window.console && (console.firebug || console.exception && console.table) ||
					// is firefox >= v31?
					// https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
					navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31;
				}

				/**
     * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
     */

				exports.formatters.j = function (v) {
					return JSON.stringify(v);
				};

				/**
     * Colorize log arguments if enabled.
     *
     * @api public
     */

				function formatArgs() {
					var args = arguments;
					var useColors = this.useColors;

					args[0] = (useColors ? '%c' : '') + this.namespace + (useColors ? ' %c' : ' ') + args[0] + (useColors ? '%c ' : ' ') + '+' + exports.humanize(this.diff);

					if (!useColors) return args;

					var c = 'color: ' + this.color;
					args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

					// the final "%c" is somewhat tricky, because there could be other
					// arguments passed either before or after the %c, so we need to
					// figure out the correct index to insert the CSS into
					var index = 0;
					var lastC = 0;
					args[0].replace(/%[a-z%]/g, function (match) {
						if ('%%' === match) return;
						index++;
						if ('%c' === match) {
							// we only are interested in the *last* %c
							// (the user may have provided their own)
							lastC = index;
						}
					});

					args.splice(lastC, 0, c);
					return args;
				}

				/**
     * Invokes `console.log()` when available.
     * No-op when `console.log` is not a "function".
     *
     * @api public
     */

				function log() {
					// this hackery is required for IE8/9, where
					// the `console.log` function doesn't have 'apply'
					return 'object' === (typeof console === "undefined" ? "undefined" : _typeof(console)) && console.log && Function.prototype.apply.call(console.log, console, arguments);
				}

				/**
     * Save `namespaces`.
     *
     * @param {String} namespaces
     * @api private
     */

				function save(namespaces) {
					try {
						if (null == namespaces) {
							exports.storage.removeItem('debug');
						} else {
							exports.storage.debug = namespaces;
						}
					} catch (e) {}
				}

				/**
     * Load `namespaces`.
     *
     * @return {String} returns the previously persisted debug modes
     * @api private
     */

				function load() {
					var r;
					try {
						r = exports.storage.debug;
					} catch (e) {}
					return r;
				}

				/**
     * Enable namespaces listed in `localStorage.debug` initially.
     */

				exports.enable(load());

				/**
     * Localstorage attempts to return the localstorage.
     *
     * This is necessary because safari throws
     * when a user disables cookies/localstorage
     * and you attempt to access it.
     *
     * @return {LocalStorage}
     * @api private
     */

				function localstorage() {
					try {
						return window.localStorage;
					} catch (e) {}
				}
			}, { "./debug": 18 }], 18: [function (_dereq_, module, exports) {

				/**
     * This is the common logic for both the Node.js and web browser
     * implementations of `debug()`.
     *
     * Expose `debug()` as the module.
     */

				exports = module.exports = debug;
				exports.coerce = coerce;
				exports.disable = disable;
				exports.enable = enable;
				exports.enabled = enabled;
				exports.humanize = _dereq_('ms');

				/**
     * The currently active debug mode names, and names to skip.
     */

				exports.names = [];
				exports.skips = [];

				/**
     * Map of special "%n" handling functions, for the debug "format" argument.
     *
     * Valid key names are a single, lowercased letter, i.e. "n".
     */

				exports.formatters = {};

				/**
     * Previously assigned color.
     */

				var prevColor = 0;

				/**
     * Previous log timestamp.
     */

				var prevTime;

				/**
     * Select a color.
     *
     * @return {Number}
     * @api private
     */

				function selectColor() {
					return exports.colors[prevColor++ % exports.colors.length];
				}

				/**
     * Create a debugger with the given `namespace`.
     *
     * @param {String} namespace
     * @return {Function}
     * @api public
     */

				function debug(namespace) {

					// define the `disabled` version
					function disabled() {}
					disabled.enabled = false;

					// define the `enabled` version
					function enabled() {

						var self = enabled;

						// set `diff` timestamp
						var curr = +new Date();
						var ms = curr - (prevTime || curr);
						self.diff = ms;
						self.prev = prevTime;
						self.curr = curr;
						prevTime = curr;

						// add the `color` if not set
						if (null == self.useColors) self.useColors = exports.useColors();
						if (null == self.color && self.useColors) self.color = selectColor();

						var args = Array.prototype.slice.call(arguments);

						args[0] = exports.coerce(args[0]);

						if ('string' !== typeof args[0]) {
							// anything else let's inspect with %o
							args = ['%o'].concat(args);
						}

						// apply any `formatters` transformations
						var index = 0;
						args[0] = args[0].replace(/%([a-z%])/g, function (match, format) {
							// if we encounter an escaped % then don't increase the array index
							if (match === '%%') return match;
							index++;
							var formatter = exports.formatters[format];
							if ('function' === typeof formatter) {
								var val = args[index];
								match = formatter.call(self, val);

								// now we need to remove `args[index]` since it's inlined in the `format`
								args.splice(index, 1);
								index--;
							}
							return match;
						});

						if ('function' === typeof exports.formatArgs) {
							args = exports.formatArgs.apply(self, args);
						}
						var logFn = enabled.log || exports.log || console.log.bind(console);
						logFn.apply(self, args);
					}
					enabled.enabled = true;

					var fn = exports.enabled(namespace) ? enabled : disabled;

					fn.namespace = namespace;

					return fn;
				}

				/**
     * Enables a debug mode by namespaces. This can include modes
     * separated by a colon and wildcards.
     *
     * @param {String} namespaces
     * @api public
     */

				function enable(namespaces) {
					exports.save(namespaces);

					var split = (namespaces || '').split(/[\s,]+/);
					var len = split.length;

					for (var i = 0; i < len; i++) {
						if (!split[i]) continue; // ignore empty strings
						namespaces = split[i].replace(/\*/g, '.*?');
						if (namespaces[0] === '-') {
							exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
						} else {
							exports.names.push(new RegExp('^' + namespaces + '$'));
						}
					}
				}

				/**
     * Disable debug output.
     *
     * @api public
     */

				function disable() {
					exports.enable('');
				}

				/**
     * Returns true if the given mode name is enabled, false otherwise.
     *
     * @param {String} name
     * @return {Boolean}
     * @api public
     */

				function enabled(name) {
					var i, len;
					for (i = 0, len = exports.skips.length; i < len; i++) {
						if (exports.skips[i].test(name)) {
							return false;
						}
					}
					for (i = 0, len = exports.names.length; i < len; i++) {
						if (exports.names[i].test(name)) {
							return true;
						}
					}
					return false;
				}

				/**
     * Coerce `val`.
     *
     * @param {Mixed} val
     * @return {Mixed}
     * @api private
     */

				function coerce(val) {
					if (val instanceof Error) return val.stack || val.message;
					return val;
				}
			}, { "ms": 25 }], 19: [function (_dereq_, module, exports) {
				(function (global) {
					/**
      * Module dependencies.
      */

					var keys = _dereq_('./keys');
					var hasBinary = _dereq_('has-binary');
					var sliceBuffer = _dereq_('arraybuffer.slice');
					var base64encoder = _dereq_('base64-arraybuffer');
					var after = _dereq_('after');
					var utf8 = _dereq_('utf8');

					/**
      * Check if we are running an android browser. That requires us to use
      * ArrayBuffer with polling transports...
      *
      * http://ghinda.net/jpeg-blob-ajax-android/
      */

					var isAndroid = navigator.userAgent.match(/Android/i);

					/**
      * Check if we are running in PhantomJS.
      * Uploading a Blob with PhantomJS does not work correctly, as reported here:
      * https://github.com/ariya/phantomjs/issues/11395
      * @type boolean
      */
					var isPhantomJS = /PhantomJS/i.test(navigator.userAgent);

					/**
      * When true, avoids using Blobs to encode payloads.
      * @type boolean
      */
					var dontSendBlobs = isAndroid || isPhantomJS;

					/**
      * Current protocol version.
      */

					exports.protocol = 3;

					/**
      * Packet types.
      */

					var packets = exports.packets = {
						open: 0 // non-ws
						, close: 1 // non-ws
						, ping: 2,
						pong: 3,
						message: 4,
						upgrade: 5,
						noop: 6
					};

					var packetslist = keys(packets);

					/**
      * Premade error packet.
      */

					var err = { type: 'error', data: 'parser error' };

					/**
      * Create a blob api even for blob builder when vendor prefixes exist
      */

					var Blob = _dereq_('blob');

					/**
      * Encodes a packet.
      *
      *     <packet type id> [ <data> ]
      *
      * Example:
      *
      *     5hello world
      *     3
      *     4
      *
      * Binary is encoded in an identical principle
      *
      * @api private
      */

					exports.encodePacket = function (packet, supportsBinary, utf8encode, callback) {
						if ('function' == typeof supportsBinary) {
							callback = supportsBinary;
							supportsBinary = false;
						}

						if ('function' == typeof utf8encode) {
							callback = utf8encode;
							utf8encode = null;
						}

						var data = packet.data === undefined ? undefined : packet.data.buffer || packet.data;

						if (global.ArrayBuffer && data instanceof ArrayBuffer) {
							return encodeArrayBuffer(packet, supportsBinary, callback);
						} else if (Blob && data instanceof global.Blob) {
							return encodeBlob(packet, supportsBinary, callback);
						}

						// might be an object with { base64: true, data: dataAsBase64String }
						if (data && data.base64) {
							return encodeBase64Object(packet, callback);
						}

						// Sending data as a utf-8 string
						var encoded = packets[packet.type];

						// data fragment is optional
						if (undefined !== packet.data) {
							encoded += utf8encode ? utf8.encode(String(packet.data)) : String(packet.data);
						}

						return callback('' + encoded);
					};

					function encodeBase64Object(packet, callback) {
						// packet data is an object { base64: true, data: dataAsBase64String }
						var message = 'b' + exports.packets[packet.type] + packet.data.data;
						return callback(message);
					}

					/**
      * Encode packet helpers for binary types
      */

					function encodeArrayBuffer(packet, supportsBinary, callback) {
						if (!supportsBinary) {
							return exports.encodeBase64Packet(packet, callback);
						}

						var data = packet.data;
						var contentArray = new Uint8Array(data);
						var resultBuffer = new Uint8Array(1 + data.byteLength);

						resultBuffer[0] = packets[packet.type];
						for (var i = 0; i < contentArray.length; i++) {
							resultBuffer[i + 1] = contentArray[i];
						}

						return callback(resultBuffer.buffer);
					}

					function encodeBlobAsArrayBuffer(packet, supportsBinary, callback) {
						if (!supportsBinary) {
							return exports.encodeBase64Packet(packet, callback);
						}

						var fr = new FileReader();
						fr.onload = function () {
							packet.data = fr.result;
							exports.encodePacket(packet, supportsBinary, true, callback);
						};
						return fr.readAsArrayBuffer(packet.data);
					}

					function encodeBlob(packet, supportsBinary, callback) {
						if (!supportsBinary) {
							return exports.encodeBase64Packet(packet, callback);
						}

						if (dontSendBlobs) {
							return encodeBlobAsArrayBuffer(packet, supportsBinary, callback);
						}

						var length = new Uint8Array(1);
						length[0] = packets[packet.type];
						var blob = new Blob([length.buffer, packet.data]);

						return callback(blob);
					}

					/**
      * Encodes a packet with binary data in a base64 string
      *
      * @param {Object} packet, has `type` and `data`
      * @return {String} base64 encoded message
      */

					exports.encodeBase64Packet = function (packet, callback) {
						var message = 'b' + exports.packets[packet.type];
						if (Blob && packet.data instanceof global.Blob) {
							var fr = new FileReader();
							fr.onload = function () {
								var b64 = fr.result.split(',')[1];
								callback(message + b64);
							};
							return fr.readAsDataURL(packet.data);
						}

						var b64data;
						try {
							b64data = String.fromCharCode.apply(null, new Uint8Array(packet.data));
						} catch (e) {
							// iPhone Safari doesn't let you apply with typed arrays
							var typed = new Uint8Array(packet.data);
							var basic = new Array(typed.length);
							for (var i = 0; i < typed.length; i++) {
								basic[i] = typed[i];
							}
							b64data = String.fromCharCode.apply(null, basic);
						}
						message += global.btoa(b64data);
						return callback(message);
					};

					/**
      * Decodes a packet. Changes format to Blob if requested.
      *
      * @return {Object} with `type` and `data` (if any)
      * @api private
      */

					exports.decodePacket = function (data, binaryType, utf8decode) {
						// String data
						if (typeof data == 'string' || data === undefined) {
							if (data.charAt(0) == 'b') {
								return exports.decodeBase64Packet(data.substr(1), binaryType);
							}

							if (utf8decode) {
								try {
									data = utf8.decode(data);
								} catch (e) {
									return err;
								}
							}
							var type = data.charAt(0);

							if (Number(type) != type || !packetslist[type]) {
								return err;
							}

							if (data.length > 1) {
								return { type: packetslist[type], data: data.substring(1) };
							} else {
								return { type: packetslist[type] };
							}
						}

						var asArray = new Uint8Array(data);
						var type = asArray[0];
						var rest = sliceBuffer(data, 1);
						if (Blob && binaryType === 'blob') {
							rest = new Blob([rest]);
						}
						return { type: packetslist[type], data: rest };
					};

					/**
      * Decodes a packet encoded in a base64 string
      *
      * @param {String} base64 encoded message
      * @return {Object} with `type` and `data` (if any)
      */

					exports.decodeBase64Packet = function (msg, binaryType) {
						var type = packetslist[msg.charAt(0)];
						if (!global.ArrayBuffer) {
							return { type: type, data: { base64: true, data: msg.substr(1) } };
						}

						var data = base64encoder.decode(msg.substr(1));

						if (binaryType === 'blob' && Blob) {
							data = new Blob([data]);
						}

						return { type: type, data: data };
					};

					/**
      * Encodes multiple messages (payload).
      *
      *     <length>:data
      *
      * Example:
      *
      *     11:hello world2:hi
      *
      * If any contents are binary, they will be encoded as base64 strings. Base64
      * encoded strings are marked with a b before the length specifier
      *
      * @param {Array} packets
      * @api private
      */

					exports.encodePayload = function (packets, supportsBinary, callback) {
						if (typeof supportsBinary == 'function') {
							callback = supportsBinary;
							supportsBinary = null;
						}

						var isBinary = hasBinary(packets);

						if (supportsBinary && isBinary) {
							if (Blob && !dontSendBlobs) {
								return exports.encodePayloadAsBlob(packets, callback);
							}

							return exports.encodePayloadAsArrayBuffer(packets, callback);
						}

						if (!packets.length) {
							return callback('0:');
						}

						function setLengthHeader(message) {
							return message.length + ':' + message;
						}

						function encodeOne(packet, doneCallback) {
							exports.encodePacket(packet, !isBinary ? false : supportsBinary, true, function (message) {
								doneCallback(null, setLengthHeader(message));
							});
						}

						map(packets, encodeOne, function (err, results) {
							return callback(results.join(''));
						});
					};

					/**
      * Async array map using after
      */

					function map(ary, each, done) {
						var result = new Array(ary.length);
						var next = after(ary.length, done);

						var eachWithIndex = function eachWithIndex(i, el, cb) {
							each(el, function (error, msg) {
								result[i] = msg;
								cb(error, result);
							});
						};

						for (var i = 0; i < ary.length; i++) {
							eachWithIndex(i, ary[i], next);
						}
					}

					/*
      * Decodes data when a payload is maybe expected. Possible binary contents are
      * decoded from their base64 representation
      *
      * @param {String} data, callback method
      * @api public
      */

					exports.decodePayload = function (data, binaryType, callback) {
						if (typeof data != 'string') {
							return exports.decodePayloadAsBinary(data, binaryType, callback);
						}

						if (typeof binaryType === 'function') {
							callback = binaryType;
							binaryType = null;
						}

						var packet;
						if (data == '') {
							// parser error - ignoring payload
							return callback(err, 0, 1);
						}

						var length = '',
						    n,
						    msg;

						for (var i = 0, l = data.length; i < l; i++) {
							var chr = data.charAt(i);

							if (':' != chr) {
								length += chr;
							} else {
								if ('' == length || length != (n = Number(length))) {
									// parser error - ignoring payload
									return callback(err, 0, 1);
								}

								msg = data.substr(i + 1, n);

								if (length != msg.length) {
									// parser error - ignoring payload
									return callback(err, 0, 1);
								}

								if (msg.length) {
									packet = exports.decodePacket(msg, binaryType, true);

									if (err.type == packet.type && err.data == packet.data) {
										// parser error in individual packet - ignoring payload
										return callback(err, 0, 1);
									}

									var ret = callback(packet, i + n, l);
									if (false === ret) return;
								}

								// advance cursor
								i += n;
								length = '';
							}
						}

						if (length != '') {
							// parser error - ignoring payload
							return callback(err, 0, 1);
						}
					};

					/**
      * Encodes multiple messages (payload) as binary.
      *
      * <1 = binary, 0 = string><number from 0-9><number from 0-9>[...]<number
      * 255><data>
      *
      * Example:
      * 1 3 255 1 2 3, if the binary contents are interpreted as 8 bit integers
      *
      * @param {Array} packets
      * @return {ArrayBuffer} encoded payload
      * @api private
      */

					exports.encodePayloadAsArrayBuffer = function (packets, callback) {
						if (!packets.length) {
							return callback(new ArrayBuffer(0));
						}

						function encodeOne(packet, doneCallback) {
							exports.encodePacket(packet, true, true, function (data) {
								return doneCallback(null, data);
							});
						}

						map(packets, encodeOne, function (err, encodedPackets) {
							var totalLength = encodedPackets.reduce(function (acc, p) {
								var len;
								if (typeof p === 'string') {
									len = p.length;
								} else {
									len = p.byteLength;
								}
								return acc + len.toString().length + len + 2; // string/binary identifier + separator = 2
							}, 0);

							var resultArray = new Uint8Array(totalLength);

							var bufferIndex = 0;
							encodedPackets.forEach(function (p) {
								var isString = typeof p === 'string';
								var ab = p;
								if (isString) {
									var view = new Uint8Array(p.length);
									for (var i = 0; i < p.length; i++) {
										view[i] = p.charCodeAt(i);
									}
									ab = view.buffer;
								}

								if (isString) {
									// not true binary
									resultArray[bufferIndex++] = 0;
								} else {
									// true binary
									resultArray[bufferIndex++] = 1;
								}

								var lenStr = ab.byteLength.toString();
								for (var i = 0; i < lenStr.length; i++) {
									resultArray[bufferIndex++] = parseInt(lenStr[i]);
								}
								resultArray[bufferIndex++] = 255;

								var view = new Uint8Array(ab);
								for (var i = 0; i < view.length; i++) {
									resultArray[bufferIndex++] = view[i];
								}
							});

							return callback(resultArray.buffer);
						});
					};

					/**
      * Encode as Blob
      */

					exports.encodePayloadAsBlob = function (packets, callback) {
						function encodeOne(packet, doneCallback) {
							exports.encodePacket(packet, true, true, function (encoded) {
								var binaryIdentifier = new Uint8Array(1);
								binaryIdentifier[0] = 1;
								if (typeof encoded === 'string') {
									var view = new Uint8Array(encoded.length);
									for (var i = 0; i < encoded.length; i++) {
										view[i] = encoded.charCodeAt(i);
									}
									encoded = view.buffer;
									binaryIdentifier[0] = 0;
								}

								var len = encoded instanceof ArrayBuffer ? encoded.byteLength : encoded.size;

								var lenStr = len.toString();
								var lengthAry = new Uint8Array(lenStr.length + 1);
								for (var i = 0; i < lenStr.length; i++) {
									lengthAry[i] = parseInt(lenStr[i]);
								}
								lengthAry[lenStr.length] = 255;

								if (Blob) {
									var blob = new Blob([binaryIdentifier.buffer, lengthAry.buffer, encoded]);
									doneCallback(null, blob);
								}
							});
						}

						map(packets, encodeOne, function (err, results) {
							return callback(new Blob(results));
						});
					};

					/*
      * Decodes data when a payload is maybe expected. Strings are decoded by
      * interpreting each byte as a key code for entries marked to start with 0. See
      * description of encodePayloadAsBinary
      *
      * @param {ArrayBuffer} data, callback method
      * @api public
      */

					exports.decodePayloadAsBinary = function (data, binaryType, callback) {
						if (typeof binaryType === 'function') {
							callback = binaryType;
							binaryType = null;
						}

						var bufferTail = data;
						var buffers = [];

						var numberTooLong = false;
						while (bufferTail.byteLength > 0) {
							var tailArray = new Uint8Array(bufferTail);
							var isString = tailArray[0] === 0;
							var msgLength = '';

							for (var i = 1;; i++) {
								if (tailArray[i] == 255) break;

								if (msgLength.length > 310) {
									numberTooLong = true;
									break;
								}

								msgLength += tailArray[i];
							}

							if (numberTooLong) return callback(err, 0, 1);

							bufferTail = sliceBuffer(bufferTail, 2 + msgLength.length);
							msgLength = parseInt(msgLength);

							var msg = sliceBuffer(bufferTail, 0, msgLength);
							if (isString) {
								try {
									msg = String.fromCharCode.apply(null, new Uint8Array(msg));
								} catch (e) {
									// iPhone Safari doesn't let you apply to typed arrays
									var typed = new Uint8Array(msg);
									msg = '';
									for (var i = 0; i < typed.length; i++) {
										msg += String.fromCharCode(typed[i]);
									}
								}
							}

							buffers.push(msg);
							bufferTail = sliceBuffer(bufferTail, msgLength);
						}

						var total = buffers.length;
						buffers.forEach(function (buffer, i) {
							callback(exports.decodePacket(buffer, binaryType, true), i, total);
						});
					};
				}).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
			}, { "./keys": 20, "after": 11, "arraybuffer.slice": 12, "base64-arraybuffer": 13, "blob": 14, "has-binary": 21, "utf8": 29 }], 20: [function (_dereq_, module, exports) {

				/**
     * Gets the keys for an object.
     *
     * @return {Array} keys
     * @api private
     */

				module.exports = Object.keys || function keys(obj) {
					var arr = [];
					var has = Object.prototype.hasOwnProperty;

					for (var i in obj) {
						if (has.call(obj, i)) {
							arr.push(i);
						}
					}
					return arr;
				};
			}, {}], 21: [function (_dereq_, module, exports) {
				(function (global) {

					/*
      * Module requirements.
      */

					var isArray = _dereq_('isarray');

					/**
      * Module exports.
      */

					module.exports = hasBinary;

					/**
      * Checks for binary data.
      *
      * Right now only Buffer and ArrayBuffer are supported..
      *
      * @param {Object} anything
      * @api public
      */

					function hasBinary(data) {

						function _hasBinary(obj) {
							if (!obj) return false;

							if (global.Buffer && global.Buffer.isBuffer(obj) || global.ArrayBuffer && obj instanceof ArrayBuffer || global.Blob && obj instanceof Blob || global.File && obj instanceof File) {
								return true;
							}

							if (isArray(obj)) {
								for (var i = 0; i < obj.length; i++) {
									if (_hasBinary(obj[i])) {
										return true;
									}
								}
							} else if (obj && 'object' == (typeof obj === "undefined" ? "undefined" : _typeof(obj))) {
								if (obj.toJSON) {
									obj = obj.toJSON();
								}

								for (var key in obj) {
									if (Object.prototype.hasOwnProperty.call(obj, key) && _hasBinary(obj[key])) {
										return true;
									}
								}
							}

							return false;
						}

						return _hasBinary(data);
					}
				}).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
			}, { "isarray": 24 }], 22: [function (_dereq_, module, exports) {

				/**
     * Module exports.
     *
     * Logic borrowed from Modernizr:
     *
     *   - https://github.com/Modernizr/Modernizr/blob/master/feature-detects/cors.js
     */

				try {
					module.exports = typeof XMLHttpRequest !== 'undefined' && 'withCredentials' in new XMLHttpRequest();
				} catch (err) {
					// if XMLHttp support is disabled in IE then it will throw
					// when trying to create
					module.exports = false;
				}
			}, {}], 23: [function (_dereq_, module, exports) {

				var indexOf = [].indexOf;

				module.exports = function (arr, obj) {
					if (indexOf) return arr.indexOf(obj);
					for (var i = 0; i < arr.length; ++i) {
						if (arr[i] === obj) return i;
					}
					return -1;
				};
			}, {}], 24: [function (_dereq_, module, exports) {
				module.exports = Array.isArray || function (arr) {
					return Object.prototype.toString.call(arr) == '[object Array]';
				};
			}, {}], 25: [function (_dereq_, module, exports) {
				/**
     * Helpers.
     */

				var s = 1000;
				var m = s * 60;
				var h = m * 60;
				var d = h * 24;
				var y = d * 365.25;

				/**
     * Parse or format the given `val`.
     *
     * Options:
     *
     *  - `long` verbose formatting [false]
     *
     * @param {String|Number} val
     * @param {Object} options
     * @return {String|Number}
     * @api public
     */

				module.exports = function (val, options) {
					options = options || {};
					if ('string' == typeof val) return parse(val);
					return options.long ? long(val) : short(val);
				};

				/**
     * Parse the given `str` and return milliseconds.
     *
     * @param {String} str
     * @return {Number}
     * @api private
     */

				function parse(str) {
					str = '' + str;
					if (str.length > 10000) return;
					var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
					if (!match) return;
					var n = parseFloat(match[1]);
					var type = (match[2] || 'ms').toLowerCase();
					switch (type) {
						case 'years':
						case 'year':
						case 'yrs':
						case 'yr':
						case 'y':
							return n * y;
						case 'days':
						case 'day':
						case 'd':
							return n * d;
						case 'hours':
						case 'hour':
						case 'hrs':
						case 'hr':
						case 'h':
							return n * h;
						case 'minutes':
						case 'minute':
						case 'mins':
						case 'min':
						case 'm':
							return n * m;
						case 'seconds':
						case 'second':
						case 'secs':
						case 'sec':
						case 's':
							return n * s;
						case 'milliseconds':
						case 'millisecond':
						case 'msecs':
						case 'msec':
						case 'ms':
							return n;
					}
				}

				/**
     * Short format for `ms`.
     *
     * @param {Number} ms
     * @return {String}
     * @api private
     */

				function short(ms) {
					if (ms >= d) return Math.round(ms / d) + 'd';
					if (ms >= h) return Math.round(ms / h) + 'h';
					if (ms >= m) return Math.round(ms / m) + 'm';
					if (ms >= s) return Math.round(ms / s) + 's';
					return ms + 'ms';
				}

				/**
     * Long format for `ms`.
     *
     * @param {Number} ms
     * @return {String}
     * @api private
     */

				function long(ms) {
					return plural(ms, d, 'day') || plural(ms, h, 'hour') || plural(ms, m, 'minute') || plural(ms, s, 'second') || ms + ' ms';
				}

				/**
     * Pluralization helper.
     */

				function plural(ms, n, name) {
					if (ms < n) return;
					if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
					return Math.ceil(ms / n) + ' ' + name + 's';
				}
			}, {}], 26: [function (_dereq_, module, exports) {
				(function (global) {
					/**
      * JSON parse.
      *
      * @see Based on jQuery#parseJSON (MIT) and JSON2
      * @api private
      */

					var rvalidchars = /^[\],:{}\s]*$/;
					var rvalidescape = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
					var rvalidtokens = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
					var rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g;
					var rtrimLeft = /^\s+/;
					var rtrimRight = /\s+$/;

					module.exports = function parsejson(data) {
						if ('string' != typeof data || !data) {
							return null;
						}

						data = data.replace(rtrimLeft, '').replace(rtrimRight, '');

						// Attempt to parse using the native JSON parser first
						if (global.JSON && JSON.parse) {
							return JSON.parse(data);
						}

						if (rvalidchars.test(data.replace(rvalidescape, '@').replace(rvalidtokens, ']').replace(rvalidbraces, ''))) {
							return new Function('return ' + data)();
						}
					};
				}).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
			}, {}], 27: [function (_dereq_, module, exports) {
				/**
     * Compiles a querystring
     * Returns string representation of the object
     *
     * @param {Object}
     * @api private
     */

				exports.encode = function (obj) {
					var str = '';

					for (var i in obj) {
						if (obj.hasOwnProperty(i)) {
							if (str.length) str += '&';
							str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
						}
					}

					return str;
				};

				/**
     * Parses a simple querystring into an object
     *
     * @param {String} qs
     * @api private
     */

				exports.decode = function (qs) {
					var qry = {};
					var pairs = qs.split('&');
					for (var i = 0, l = pairs.length; i < l; i++) {
						var pair = pairs[i].split('=');
						qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
					}
					return qry;
				};
			}, {}], 28: [function (_dereq_, module, exports) {
				/**
     * Parses an URI
     *
     * @author Steven Levithan <stevenlevithan.com> (MIT license)
     * @api private
     */

				var re = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

				var parts = ['source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'];

				module.exports = function parseuri(str) {
					var src = str,
					    b = str.indexOf('['),
					    e = str.indexOf(']');

					if (b != -1 && e != -1) {
						str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
					}

					var m = re.exec(str || ''),
					    uri = {},
					    i = 14;

					while (i--) {
						uri[parts[i]] = m[i] || '';
					}

					if (b != -1 && e != -1) {
						uri.source = src;
						uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
						uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
						uri.ipv6uri = true;
					}

					return uri;
				};
			}, {}], 29: [function (_dereq_, module, exports) {
				(function (global) {
					/*! https://mths.be/utf8js v2.0.0 by @mathias */
					;(function (root) {

						// Detect free variables `exports`
						var freeExports = (typeof exports === "undefined" ? "undefined" : _typeof(exports)) == 'object' && exports;

						// Detect free variable `module`
						var freeModule = (typeof module === "undefined" ? "undefined" : _typeof(module)) == 'object' && module && module.exports == freeExports && module;

						// Detect free variable `global`, from Node.js or Browserified code,
						// and use it as `root`
						var freeGlobal = (typeof global === "undefined" ? "undefined" : _typeof(global)) == 'object' && global;
						if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
							root = freeGlobal;
						}

						/*--------------------------------------------------------------------------*/

						var stringFromCharCode = String.fromCharCode;

						// Taken from https://mths.be/punycode
						function ucs2decode(string) {
							var output = [];
							var counter = 0;
							var length = string.length;
							var value;
							var extra;
							while (counter < length) {
								value = string.charCodeAt(counter++);
								if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
									// high surrogate, and there is a next character
									extra = string.charCodeAt(counter++);
									if ((extra & 0xFC00) == 0xDC00) {
										// low surrogate
										output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
									} else {
										// unmatched surrogate; only append this code unit, in case the next
										// code unit is the high surrogate of a surrogate pair
										output.push(value);
										counter--;
									}
								} else {
									output.push(value);
								}
							}
							return output;
						}

						// Taken from https://mths.be/punycode
						function ucs2encode(array) {
							var length = array.length;
							var index = -1;
							var value;
							var output = '';
							while (++index < length) {
								value = array[index];
								if (value > 0xFFFF) {
									value -= 0x10000;
									output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
									value = 0xDC00 | value & 0x3FF;
								}
								output += stringFromCharCode(value);
							}
							return output;
						}

						function checkScalarValue(codePoint) {
							if (codePoint >= 0xD800 && codePoint <= 0xDFFF) {
								throw Error('Lone surrogate U+' + codePoint.toString(16).toUpperCase() + ' is not a scalar value');
							}
						}
						/*--------------------------------------------------------------------------*/

						function createByte(codePoint, shift) {
							return stringFromCharCode(codePoint >> shift & 0x3F | 0x80);
						}

						function encodeCodePoint(codePoint) {
							if ((codePoint & 0xFFFFFF80) == 0) {
								// 1-byte sequence
								return stringFromCharCode(codePoint);
							}
							var symbol = '';
							if ((codePoint & 0xFFFFF800) == 0) {
								// 2-byte sequence
								symbol = stringFromCharCode(codePoint >> 6 & 0x1F | 0xC0);
							} else if ((codePoint & 0xFFFF0000) == 0) {
								// 3-byte sequence
								checkScalarValue(codePoint);
								symbol = stringFromCharCode(codePoint >> 12 & 0x0F | 0xE0);
								symbol += createByte(codePoint, 6);
							} else if ((codePoint & 0xFFE00000) == 0) {
								// 4-byte sequence
								symbol = stringFromCharCode(codePoint >> 18 & 0x07 | 0xF0);
								symbol += createByte(codePoint, 12);
								symbol += createByte(codePoint, 6);
							}
							symbol += stringFromCharCode(codePoint & 0x3F | 0x80);
							return symbol;
						}

						function utf8encode(string) {
							var codePoints = ucs2decode(string);
							var length = codePoints.length;
							var index = -1;
							var codePoint;
							var byteString = '';
							while (++index < length) {
								codePoint = codePoints[index];
								byteString += encodeCodePoint(codePoint);
							}
							return byteString;
						}

						/*--------------------------------------------------------------------------*/

						function readContinuationByte() {
							if (byteIndex >= byteCount) {
								throw Error('Invalid byte index');
							}

							var continuationByte = byteArray[byteIndex] & 0xFF;
							byteIndex++;

							if ((continuationByte & 0xC0) == 0x80) {
								return continuationByte & 0x3F;
							}

							// If we end up here, it’s not a continuation byte
							throw Error('Invalid continuation byte');
						}

						function decodeSymbol() {
							var byte1;
							var byte2;
							var byte3;
							var byte4;
							var codePoint;

							if (byteIndex > byteCount) {
								throw Error('Invalid byte index');
							}

							if (byteIndex == byteCount) {
								return false;
							}

							// Read first byte
							byte1 = byteArray[byteIndex] & 0xFF;
							byteIndex++;

							// 1-byte sequence (no continuation bytes)
							if ((byte1 & 0x80) == 0) {
								return byte1;
							}

							// 2-byte sequence
							if ((byte1 & 0xE0) == 0xC0) {
								var byte2 = readContinuationByte();
								codePoint = (byte1 & 0x1F) << 6 | byte2;
								if (codePoint >= 0x80) {
									return codePoint;
								} else {
									throw Error('Invalid continuation byte');
								}
							}

							// 3-byte sequence (may include unpaired surrogates)
							if ((byte1 & 0xF0) == 0xE0) {
								byte2 = readContinuationByte();
								byte3 = readContinuationByte();
								codePoint = (byte1 & 0x0F) << 12 | byte2 << 6 | byte3;
								if (codePoint >= 0x0800) {
									checkScalarValue(codePoint);
									return codePoint;
								} else {
									throw Error('Invalid continuation byte');
								}
							}

							// 4-byte sequence
							if ((byte1 & 0xF8) == 0xF0) {
								byte2 = readContinuationByte();
								byte3 = readContinuationByte();
								byte4 = readContinuationByte();
								codePoint = (byte1 & 0x0F) << 0x12 | byte2 << 0x0C | byte3 << 0x06 | byte4;
								if (codePoint >= 0x010000 && codePoint <= 0x10FFFF) {
									return codePoint;
								}
							}

							throw Error('Invalid UTF-8 detected');
						}

						var byteArray;
						var byteCount;
						var byteIndex;
						function utf8decode(byteString) {
							byteArray = ucs2decode(byteString);
							byteCount = byteArray.length;
							byteIndex = 0;
							var codePoints = [];
							var tmp;
							while ((tmp = decodeSymbol()) !== false) {
								codePoints.push(tmp);
							}
							return ucs2encode(codePoints);
						}

						/*--------------------------------------------------------------------------*/

						var utf8 = {
							'version': '2.0.0',
							'encode': utf8encode,
							'decode': utf8decode
						};

						// Some AMD build optimizers, like r.js, check for specific condition patterns
						// like the following:
						if (typeof define == 'function' && _typeof(define.amd) == 'object' && define.amd) {
							define(function () {
								return utf8;
							});
						} else if (freeExports && !freeExports.nodeType) {
							if (freeModule) {
								// in Node.js or RingoJS v0.8.0+
								freeModule.exports = utf8;
							} else {
								// in Narwhal or RingoJS v0.7.0-
								var object = {};
								var hasOwnProperty = object.hasOwnProperty;
								for (var key in utf8) {
									hasOwnProperty.call(utf8, key) && (freeExports[key] = utf8[key]);
								}
							}
						} else {
							// in Rhino or a web browser
							root.utf8 = utf8;
						}
					})(this);
				}).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
			}, {}], 30: [function (_dereq_, module, exports) {
				'use strict';

				var alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'.split(''),
				    length = 64,
				    map = {},
				    seed = 0,
				    i = 0,
				    prev;

				/**
     * Return a string representing the specified number.
     *
     * @param {Number} num The number to convert.
     * @returns {String} The string representation of the number.
     * @api public
     */
				function encode(num) {
					var encoded = '';

					do {
						encoded = alphabet[num % length] + encoded;
						num = Math.floor(num / length);
					} while (num > 0);

					return encoded;
				}

				/**
     * Return the integer value specified by the given string.
     *
     * @param {String} str The string to convert.
     * @returns {Number} The integer value represented by the string.
     * @api public
     */
				function decode(str) {
					var decoded = 0;

					for (i = 0; i < str.length; i++) {
						decoded = decoded * length + map[str.charAt(i)];
					}

					return decoded;
				}

				/**
     * Yeast: A tiny growing id generator.
     *
     * @returns {String} A unique id.
     * @api public
     */
				function yeast() {
					var now = encode(+new Date());

					if (now !== prev) return seed = 0, prev = now;
					return now + '.' + encode(seed++);
				}

				//
				// Map each character to its index.
				//
				for (; i < length; i++) {
					map[alphabet[i]] = i;
				} //
				// Expose the `yeast`, `encode` and `decode` functions.
				//
				yeast.encode = encode;
				yeast.decode = decode;
				module.exports = yeast;
			}, {}], 31: [function (_dereq_, module, exports) {

				/**
     * Module dependencies.
     */

				var url = _dereq_('./url');
				var parser = _dereq_('socket.io-parser');
				var Manager = _dereq_('./manager');
				var debug = _dereq_('debug')('socket.io-client');

				/**
     * Module exports.
     */

				module.exports = exports = lookup;

				/**
     * Managers cache.
     */

				var cache = exports.managers = {};

				/**
     * Looks up an existing `Manager` for multiplexing.
     * If the user summons:
     *
     *   `io('http://localhost/a');`
     *   `io('http://localhost/b');`
     *
     * We reuse the existing instance based on same scheme/port/host,
     * and we initialize sockets for each namespace.
     *
     * @api public
     */

				function lookup(uri, opts) {
					if ((typeof uri === "undefined" ? "undefined" : _typeof(uri)) == 'object') {
						opts = uri;
						uri = undefined;
					}

					opts = opts || {};

					var parsed = url(uri);
					var source = parsed.source;
					var id = parsed.id;
					var path = parsed.path;
					var sameNamespace = cache[id] && path in cache[id].nsps;
					var newConnection = opts.forceNew || opts['force new connection'] || false === opts.multiplex || sameNamespace;

					var io;

					if (newConnection) {
						debug('ignoring socket cache for %s', source);
						io = Manager(source, opts);
					} else {
						if (!cache[id]) {
							debug('new io instance for %s', source);
							cache[id] = Manager(source, opts);
						}
						io = cache[id];
					}

					return io.socket(parsed.path);
				}

				/**
     * Protocol version.
     *
     * @api public
     */

				exports.protocol = parser.protocol;

				/**
     * `connect`.
     *
     * @param {String} uri
     * @api public
     */

				exports.connect = lookup;

				/**
     * Expose constructors for standalone build.
     *
     * @api public
     */

				exports.Manager = _dereq_('./manager');
				exports.Socket = _dereq_('./socket');
			}, { "./manager": 32, "./socket": 34, "./url": 35, "debug": 39, "socket.io-parser": 47 }], 32: [function (_dereq_, module, exports) {

				/**
     * Module dependencies.
     */

				var eio = _dereq_('engine.io-client');
				var Socket = _dereq_('./socket');
				var Emitter = _dereq_('component-emitter');
				var parser = _dereq_('socket.io-parser');
				var on = _dereq_('./on');
				var bind = _dereq_('component-bind');
				var debug = _dereq_('debug')('socket.io-client:manager');
				var indexOf = _dereq_('indexof');
				var Backoff = _dereq_('backo2');

				/**
     * IE6+ hasOwnProperty
     */

				var has = Object.prototype.hasOwnProperty;

				/**
     * Module exports
     */

				module.exports = Manager;

				/**
     * `Manager` constructor.
     *
     * @param {String} engine instance or engine uri/opts
     * @param {Object} options
     * @api public
     */

				function Manager(uri, opts) {
					if (!(this instanceof Manager)) return new Manager(uri, opts);
					if (uri && 'object' == (typeof uri === "undefined" ? "undefined" : _typeof(uri))) {
						opts = uri;
						uri = undefined;
					}
					opts = opts || {};

					opts.path = opts.path || '/socket.io';
					this.nsps = {};
					this.subs = [];
					this.opts = opts;
					this.reconnection(opts.reconnection !== false);
					this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
					this.reconnectionDelay(opts.reconnectionDelay || 1000);
					this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
					this.randomizationFactor(opts.randomizationFactor || 0.5);
					this.backoff = new Backoff({
						min: this.reconnectionDelay(),
						max: this.reconnectionDelayMax(),
						jitter: this.randomizationFactor()
					});
					this.timeout(null == opts.timeout ? 20000 : opts.timeout);
					this.readyState = 'closed';
					this.uri = uri;
					this.connecting = [];
					this.lastPing = null;
					this.encoding = false;
					this.packetBuffer = [];
					this.encoder = new parser.Encoder();
					this.decoder = new parser.Decoder();
					this.autoConnect = opts.autoConnect !== false;
					if (this.autoConnect) this.open();
				}

				/**
     * Propagate given event to sockets and emit on `this`
     *
     * @api private
     */

				Manager.prototype.emitAll = function () {
					this.emit.apply(this, arguments);
					for (var nsp in this.nsps) {
						if (has.call(this.nsps, nsp)) {
							this.nsps[nsp].emit.apply(this.nsps[nsp], arguments);
						}
					}
				};

				/**
     * Update `socket.id` of all sockets
     *
     * @api private
     */

				Manager.prototype.updateSocketIds = function () {
					for (var nsp in this.nsps) {
						if (has.call(this.nsps, nsp)) {
							this.nsps[nsp].id = this.engine.id;
						}
					}
				};

				/**
     * Mix in `Emitter`.
     */

				Emitter(Manager.prototype);

				/**
     * Sets the `reconnection` config.
     *
     * @param {Boolean} true/false if it should automatically reconnect
     * @return {Manager} self or value
     * @api public
     */

				Manager.prototype.reconnection = function (v) {
					if (!arguments.length) return this._reconnection;
					this._reconnection = !!v;
					return this;
				};

				/**
     * Sets the reconnection attempts config.
     *
     * @param {Number} max reconnection attempts before giving up
     * @return {Manager} self or value
     * @api public
     */

				Manager.prototype.reconnectionAttempts = function (v) {
					if (!arguments.length) return this._reconnectionAttempts;
					this._reconnectionAttempts = v;
					return this;
				};

				/**
     * Sets the delay between reconnections.
     *
     * @param {Number} delay
     * @return {Manager} self or value
     * @api public
     */

				Manager.prototype.reconnectionDelay = function (v) {
					if (!arguments.length) return this._reconnectionDelay;
					this._reconnectionDelay = v;
					this.backoff && this.backoff.setMin(v);
					return this;
				};

				Manager.prototype.randomizationFactor = function (v) {
					if (!arguments.length) return this._randomizationFactor;
					this._randomizationFactor = v;
					this.backoff && this.backoff.setJitter(v);
					return this;
				};

				/**
     * Sets the maximum delay between reconnections.
     *
     * @param {Number} delay
     * @return {Manager} self or value
     * @api public
     */

				Manager.prototype.reconnectionDelayMax = function (v) {
					if (!arguments.length) return this._reconnectionDelayMax;
					this._reconnectionDelayMax = v;
					this.backoff && this.backoff.setMax(v);
					return this;
				};

				/**
     * Sets the connection timeout. `false` to disable
     *
     * @return {Manager} self or value
     * @api public
     */

				Manager.prototype.timeout = function (v) {
					if (!arguments.length) return this._timeout;
					this._timeout = v;
					return this;
				};

				/**
     * Starts trying to reconnect if reconnection is enabled and we have not
     * started reconnecting yet
     *
     * @api private
     */

				Manager.prototype.maybeReconnectOnOpen = function () {
					// Only try to reconnect if it's the first time we're connecting
					if (!this.reconnecting && this._reconnection && this.backoff.attempts === 0) {
						// keeps reconnection from firing twice for the same reconnection loop
						this.reconnect();
					}
				};

				/**
     * Sets the current transport `socket`.
     *
     * @param {Function} optional, callback
     * @return {Manager} self
     * @api public
     */

				Manager.prototype.open = Manager.prototype.connect = function (fn) {
					debug('readyState %s', this.readyState);
					if (~this.readyState.indexOf('open')) return this;

					debug('opening %s', this.uri);
					this.engine = eio(this.uri, this.opts);
					var socket = this.engine;
					var self = this;
					this.readyState = 'opening';
					this.skipReconnect = false;

					// emit `open`
					var openSub = on(socket, 'open', function () {
						self.onopen();
						fn && fn();
					});

					// emit `connect_error`
					var errorSub = on(socket, 'error', function (data) {
						debug('connect_error');
						self.cleanup();
						self.readyState = 'closed';
						self.emitAll('connect_error', data);
						if (fn) {
							var err = new Error('Connection error');
							err.data = data;
							fn(err);
						} else {
							// Only do this if there is no fn to handle the error
							self.maybeReconnectOnOpen();
						}
					});

					// emit `connect_timeout`
					if (false !== this._timeout) {
						var timeout = this._timeout;
						debug('connect attempt will timeout after %d', timeout);

						// set timer
						var timer = setTimeout(function () {
							debug('connect attempt timed out after %d', timeout);
							openSub.destroy();
							socket.close();
							socket.emit('error', 'timeout');
							self.emitAll('connect_timeout', timeout);
						}, timeout);

						this.subs.push({
							destroy: function destroy() {
								clearTimeout(timer);
							}
						});
					}

					this.subs.push(openSub);
					this.subs.push(errorSub);

					return this;
				};

				/**
     * Called upon transport open.
     *
     * @api private
     */

				Manager.prototype.onopen = function () {
					debug('open');

					// clear old subs
					this.cleanup();

					// mark as open
					this.readyState = 'open';
					this.emit('open');

					// add new subs
					var socket = this.engine;
					this.subs.push(on(socket, 'data', bind(this, 'ondata')));
					this.subs.push(on(socket, 'ping', bind(this, 'onping')));
					this.subs.push(on(socket, 'pong', bind(this, 'onpong')));
					this.subs.push(on(socket, 'error', bind(this, 'onerror')));
					this.subs.push(on(socket, 'close', bind(this, 'onclose')));
					this.subs.push(on(this.decoder, 'decoded', bind(this, 'ondecoded')));
				};

				/**
     * Called upon a ping.
     *
     * @api private
     */

				Manager.prototype.onping = function () {
					this.lastPing = new Date();
					this.emitAll('ping');
				};

				/**
     * Called upon a packet.
     *
     * @api private
     */

				Manager.prototype.onpong = function () {
					this.emitAll('pong', new Date() - this.lastPing);
				};

				/**
     * Called with data.
     *
     * @api private
     */

				Manager.prototype.ondata = function (data) {
					this.decoder.add(data);
				};

				/**
     * Called when parser fully decodes a packet.
     *
     * @api private
     */

				Manager.prototype.ondecoded = function (packet) {
					this.emit('packet', packet);
				};

				/**
     * Called upon socket error.
     *
     * @api private
     */

				Manager.prototype.onerror = function (err) {
					debug('error', err);
					this.emitAll('error', err);
				};

				/**
     * Creates a new socket for the given `nsp`.
     *
     * @return {Socket}
     * @api public
     */

				Manager.prototype.socket = function (nsp) {
					var socket = this.nsps[nsp];
					if (!socket) {
						socket = new Socket(this, nsp);
						this.nsps[nsp] = socket;
						var self = this;
						socket.on('connecting', onConnecting);
						socket.on('connect', function () {
							socket.id = self.engine.id;
						});

						if (this.autoConnect) {
							// manually call here since connecting evnet is fired before listening
							onConnecting();
						}
					}

					function onConnecting() {
						if (!~indexOf(self.connecting, socket)) {
							self.connecting.push(socket);
						}
					}

					return socket;
				};

				/**
     * Called upon a socket close.
     *
     * @param {Socket} socket
     */

				Manager.prototype.destroy = function (socket) {
					var index = indexOf(this.connecting, socket);
					if (~index) this.connecting.splice(index, 1);
					if (this.connecting.length) return;

					this.close();
				};

				/**
     * Writes a packet.
     *
     * @param {Object} packet
     * @api private
     */

				Manager.prototype.packet = function (packet) {
					debug('writing packet %j', packet);
					var self = this;

					if (!self.encoding) {
						// encode, then write to engine with result
						self.encoding = true;
						this.encoder.encode(packet, function (encodedPackets) {
							for (var i = 0; i < encodedPackets.length; i++) {
								self.engine.write(encodedPackets[i], packet.options);
							}
							self.encoding = false;
							self.processPacketQueue();
						});
					} else {
						// add packet to the queue
						self.packetBuffer.push(packet);
					}
				};

				/**
     * If packet buffer is non-empty, begins encoding the
     * next packet in line.
     *
     * @api private
     */

				Manager.prototype.processPacketQueue = function () {
					if (this.packetBuffer.length > 0 && !this.encoding) {
						var pack = this.packetBuffer.shift();
						this.packet(pack);
					}
				};

				/**
     * Clean up transport subscriptions and packet buffer.
     *
     * @api private
     */

				Manager.prototype.cleanup = function () {
					debug('cleanup');

					var sub;
					while (sub = this.subs.shift()) {
						sub.destroy();
					}this.packetBuffer = [];
					this.encoding = false;
					this.lastPing = null;

					this.decoder.destroy();
				};

				/**
     * Close the current socket.
     *
     * @api private
     */

				Manager.prototype.close = Manager.prototype.disconnect = function () {
					debug('disconnect');
					this.skipReconnect = true;
					this.reconnecting = false;
					if ('opening' == this.readyState) {
						// `onclose` will not fire because
						// an open event never happened
						this.cleanup();
					}
					this.backoff.reset();
					this.readyState = 'closed';
					if (this.engine) this.engine.close();
				};

				/**
     * Called upon engine close.
     *
     * @api private
     */

				Manager.prototype.onclose = function (reason) {
					debug('onclose');

					this.cleanup();
					this.backoff.reset();
					this.readyState = 'closed';
					this.emit('close', reason);

					if (this._reconnection && !this.skipReconnect) {
						this.reconnect();
					}
				};

				/**
     * Attempt a reconnection.
     *
     * @api private
     */

				Manager.prototype.reconnect = function () {
					if (this.reconnecting || this.skipReconnect) return this;

					var self = this;

					if (this.backoff.attempts >= this._reconnectionAttempts) {
						debug('reconnect failed');
						this.backoff.reset();
						this.emitAll('reconnect_failed');
						this.reconnecting = false;
					} else {
						var delay = this.backoff.duration();
						debug('will wait %dms before reconnect attempt', delay);

						this.reconnecting = true;
						var timer = setTimeout(function () {
							if (self.skipReconnect) return;

							debug('attempting reconnect');
							self.emitAll('reconnect_attempt', self.backoff.attempts);
							self.emitAll('reconnecting', self.backoff.attempts);

							// check again for the case socket closed in above events
							if (self.skipReconnect) return;

							self.open(function (err) {
								if (err) {
									debug('reconnect attempt error');
									self.reconnecting = false;
									self.reconnect();
									self.emitAll('reconnect_error', err.data);
								} else {
									debug('reconnect success');
									self.onreconnect();
								}
							});
						}, delay);

						this.subs.push({
							destroy: function destroy() {
								clearTimeout(timer);
							}
						});
					}
				};

				/**
     * Called upon successful reconnect.
     *
     * @api private
     */

				Manager.prototype.onreconnect = function () {
					var attempt = this.backoff.attempts;
					this.reconnecting = false;
					this.backoff.reset();
					this.updateSocketIds();
					this.emitAll('reconnect', attempt);
				};
			}, { "./on": 33, "./socket": 34, "backo2": 36, "component-bind": 37, "component-emitter": 38, "debug": 39, "engine.io-client": 1, "indexof": 42, "socket.io-parser": 47 }], 33: [function (_dereq_, module, exports) {

				/**
     * Module exports.
     */

				module.exports = on;

				/**
     * Helper for subscriptions.
     *
     * @param {Object|EventEmitter} obj with `Emitter` mixin or `EventEmitter`
     * @param {String} event name
     * @param {Function} callback
     * @api public
     */

				function on(obj, ev, fn) {
					obj.on(ev, fn);
					return {
						destroy: function destroy() {
							obj.removeListener(ev, fn);
						}
					};
				}
			}, {}], 34: [function (_dereq_, module, exports) {

				/**
     * Module dependencies.
     */

				var parser = _dereq_('socket.io-parser');
				var Emitter = _dereq_('component-emitter');
				var toArray = _dereq_('to-array');
				var on = _dereq_('./on');
				var bind = _dereq_('component-bind');
				var debug = _dereq_('debug')('socket.io-client:socket');
				var hasBin = _dereq_('has-binary');

				/**
     * Module exports.
     */

				module.exports = exports = Socket;

				/**
     * Internal events (blacklisted).
     * These events can't be emitted by the user.
     *
     * @api private
     */

				var events = {
					connect: 1,
					connect_error: 1,
					connect_timeout: 1,
					connecting: 1,
					disconnect: 1,
					error: 1,
					reconnect: 1,
					reconnect_attempt: 1,
					reconnect_failed: 1,
					reconnect_error: 1,
					reconnecting: 1,
					ping: 1,
					pong: 1
				};

				/**
     * Shortcut to `Emitter#emit`.
     */

				var emit = Emitter.prototype.emit;

				/**
     * `Socket` constructor.
     *
     * @api public
     */

				function Socket(io, nsp) {
					this.io = io;
					this.nsp = nsp;
					this.json = this; // compat
					this.ids = 0;
					this.acks = {};
					this.receiveBuffer = [];
					this.sendBuffer = [];
					this.connected = false;
					this.disconnected = true;
					if (this.io.autoConnect) this.open();
				}

				/**
     * Mix in `Emitter`.
     */

				Emitter(Socket.prototype);

				/**
     * Subscribe to open, close and packet events
     *
     * @api private
     */

				Socket.prototype.subEvents = function () {
					if (this.subs) return;

					var io = this.io;
					this.subs = [on(io, 'open', bind(this, 'onopen')), on(io, 'packet', bind(this, 'onpacket')), on(io, 'close', bind(this, 'onclose'))];
				};

				/**
     * "Opens" the socket.
     *
     * @api public
     */

				Socket.prototype.open = Socket.prototype.connect = function () {
					if (this.connected) return this;

					this.subEvents();
					this.io.open(); // ensure open
					if ('open' == this.io.readyState) this.onopen();
					this.emit('connecting');
					return this;
				};

				/**
     * Sends a `message` event.
     *
     * @return {Socket} self
     * @api public
     */

				Socket.prototype.send = function () {
					var args = toArray(arguments);
					args.unshift('message');
					this.emit.apply(this, args);
					return this;
				};

				/**
     * Override `emit`.
     * If the event is in `events`, it's emitted normally.
     *
     * @param {String} event name
     * @return {Socket} self
     * @api public
     */

				Socket.prototype.emit = function (ev) {
					if (events.hasOwnProperty(ev)) {
						emit.apply(this, arguments);
						return this;
					}

					var args = toArray(arguments);
					var parserType = parser.EVENT; // default
					if (hasBin(args)) {
						parserType = parser.BINARY_EVENT;
					} // binary
					var packet = { type: parserType, data: args };

					packet.options = {};
					packet.options.compress = !this.flags || false !== this.flags.compress;

					// event ack callback
					if ('function' == typeof args[args.length - 1]) {
						debug('emitting packet with ack id %d', this.ids);
						this.acks[this.ids] = args.pop();
						packet.id = this.ids++;
					}

					if (this.connected) {
						this.packet(packet);
					} else {
						this.sendBuffer.push(packet);
					}

					delete this.flags;

					return this;
				};

				/**
     * Sends a packet.
     *
     * @param {Object} packet
     * @api private
     */

				Socket.prototype.packet = function (packet) {
					packet.nsp = this.nsp;
					this.io.packet(packet);
				};

				/**
     * Called upon engine `open`.
     *
     * @api private
     */

				Socket.prototype.onopen = function () {
					debug('transport is open - connecting');

					// write connect packet if necessary
					if ('/' != this.nsp) {
						this.packet({ type: parser.CONNECT });
					}
				};

				/**
     * Called upon engine `close`.
     *
     * @param {String} reason
     * @api private
     */

				Socket.prototype.onclose = function (reason) {
					debug('close (%s)', reason);
					this.connected = false;
					this.disconnected = true;
					delete this.id;
					this.emit('disconnect', reason);
				};

				/**
     * Called with socket packet.
     *
     * @param {Object} packet
     * @api private
     */

				Socket.prototype.onpacket = function (packet) {
					if (packet.nsp != this.nsp) return;

					switch (packet.type) {
						case parser.CONNECT:
							this.onconnect();
							break;

						case parser.EVENT:
							this.onevent(packet);
							break;

						case parser.BINARY_EVENT:
							this.onevent(packet);
							break;

						case parser.ACK:
							this.onack(packet);
							break;

						case parser.BINARY_ACK:
							this.onack(packet);
							break;

						case parser.DISCONNECT:
							this.ondisconnect();
							break;

						case parser.ERROR:
							this.emit('error', packet.data);
							break;
					}
				};

				/**
     * Called upon a server event.
     *
     * @param {Object} packet
     * @api private
     */

				Socket.prototype.onevent = function (packet) {
					var args = packet.data || [];
					debug('emitting event %j', args);

					if (null != packet.id) {
						debug('attaching ack callback to event');
						args.push(this.ack(packet.id));
					}

					if (this.connected) {
						emit.apply(this, args);
					} else {
						this.receiveBuffer.push(args);
					}
				};

				/**
     * Produces an ack callback to emit with an event.
     *
     * @api private
     */

				Socket.prototype.ack = function (id) {
					var self = this;
					var sent = false;
					return function () {
						// prevent double callbacks
						if (sent) return;
						sent = true;
						var args = toArray(arguments);
						debug('sending ack %j', args);

						var type = hasBin(args) ? parser.BINARY_ACK : parser.ACK;
						self.packet({
							type: type,
							id: id,
							data: args
						});
					};
				};

				/**
     * Called upon a server acknowlegement.
     *
     * @param {Object} packet
     * @api private
     */

				Socket.prototype.onack = function (packet) {
					var ack = this.acks[packet.id];
					if ('function' == typeof ack) {
						debug('calling ack %s with %j', packet.id, packet.data);
						ack.apply(this, packet.data);
						delete this.acks[packet.id];
					} else {
						debug('bad ack %s', packet.id);
					}
				};

				/**
     * Called upon server connect.
     *
     * @api private
     */

				Socket.prototype.onconnect = function () {
					this.connected = true;
					this.disconnected = false;
					this.emit('connect');
					this.emitBuffered();
				};

				/**
     * Emit buffered events (received and emitted).
     *
     * @api private
     */

				Socket.prototype.emitBuffered = function () {
					var i;
					for (i = 0; i < this.receiveBuffer.length; i++) {
						emit.apply(this, this.receiveBuffer[i]);
					}
					this.receiveBuffer = [];

					for (i = 0; i < this.sendBuffer.length; i++) {
						this.packet(this.sendBuffer[i]);
					}
					this.sendBuffer = [];
				};

				/**
     * Called upon server disconnect.
     *
     * @api private
     */

				Socket.prototype.ondisconnect = function () {
					debug('server disconnect (%s)', this.nsp);
					this.destroy();
					this.onclose('io server disconnect');
				};

				/**
     * Called upon forced client/server side disconnections,
     * this method ensures the manager stops tracking us and
     * that reconnections don't get triggered for this.
     *
     * @api private.
     */

				Socket.prototype.destroy = function () {
					if (this.subs) {
						// clean subscriptions to avoid reconnections
						for (var i = 0; i < this.subs.length; i++) {
							this.subs[i].destroy();
						}
						this.subs = null;
					}

					this.io.destroy(this);
				};

				/**
     * Disconnects the socket manually.
     *
     * @return {Socket} self
     * @api public
     */

				Socket.prototype.close = Socket.prototype.disconnect = function () {
					if (this.connected) {
						debug('performing disconnect (%s)', this.nsp);
						this.packet({ type: parser.DISCONNECT });
					}

					// remove socket from pool
					this.destroy();

					if (this.connected) {
						// fire events
						this.onclose('io client disconnect');
					}
					return this;
				};

				/**
     * Sets the compress flag.
     *
     * @param {Boolean} if `true`, compresses the sending data
     * @return {Socket} self
     * @api public
     */

				Socket.prototype.compress = function (compress) {
					this.flags = this.flags || {};
					this.flags.compress = compress;
					return this;
				};
			}, { "./on": 33, "component-bind": 37, "component-emitter": 38, "debug": 39, "has-binary": 41, "socket.io-parser": 47, "to-array": 51 }], 35: [function (_dereq_, module, exports) {
				(function (global) {

					/**
      * Module dependencies.
      */

					var parseuri = _dereq_('parseuri');
					var debug = _dereq_('debug')('socket.io-client:url');

					/**
      * Module exports.
      */

					module.exports = url;

					/**
      * URL parser.
      *
      * @param {String} url
      * @param {Object} An object meant to mimic window.location.
      *                 Defaults to window.location.
      * @api public
      */

					function url(uri, loc) {
						var obj = uri;

						// default to window.location
						var loc = loc || global.location;
						if (null == uri) uri = loc.protocol + '//' + loc.host;

						// relative path support
						if ('string' == typeof uri) {
							if ('/' == uri.charAt(0)) {
								if ('/' == uri.charAt(1)) {
									uri = loc.protocol + uri;
								} else {
									uri = loc.host + uri;
								}
							}

							if (!/^(https?|wss?):\/\//.test(uri)) {
								debug('protocol-less url %s', uri);
								if ('undefined' != typeof loc) {
									uri = loc.protocol + '//' + uri;
								} else {
									uri = 'https://' + uri;
								}
							}

							// parse
							debug('parse %s', uri);
							obj = parseuri(uri);
						}

						// make sure we treat `localhost:80` and `localhost` equally
						if (!obj.port) {
							if (/^(http|ws)$/.test(obj.protocol)) {
								obj.port = '80';
							} else if (/^(http|ws)s$/.test(obj.protocol)) {
								obj.port = '443';
							}
						}

						obj.path = obj.path || '/';

						var ipv6 = obj.host.indexOf(':') !== -1;
						var host = ipv6 ? '[' + obj.host + ']' : obj.host;

						// define unique id
						obj.id = obj.protocol + '://' + host + ':' + obj.port;
						// define href
						obj.href = obj.protocol + '://' + host + (loc && loc.port == obj.port ? '' : ':' + obj.port);

						return obj;
					}
				}).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
			}, { "debug": 39, "parseuri": 45 }], 36: [function (_dereq_, module, exports) {

				/**
     * Expose `Backoff`.
     */

				module.exports = Backoff;

				/**
     * Initialize backoff timer with `opts`.
     *
     * - `min` initial timeout in milliseconds [100]
     * - `max` max timeout [10000]
     * - `jitter` [0]
     * - `factor` [2]
     *
     * @param {Object} opts
     * @api public
     */

				function Backoff(opts) {
					opts = opts || {};
					this.ms = opts.min || 100;
					this.max = opts.max || 10000;
					this.factor = opts.factor || 2;
					this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
					this.attempts = 0;
				}

				/**
     * Return the backoff duration.
     *
     * @return {Number}
     * @api public
     */

				Backoff.prototype.duration = function () {
					var ms = this.ms * Math.pow(this.factor, this.attempts++);
					if (this.jitter) {
						var rand = Math.random();
						var deviation = Math.floor(rand * this.jitter * ms);
						ms = (Math.floor(rand * 10) & 1) == 0 ? ms - deviation : ms + deviation;
					}
					return Math.min(ms, this.max) | 0;
				};

				/**
     * Reset the number of attempts.
     *
     * @api public
     */

				Backoff.prototype.reset = function () {
					this.attempts = 0;
				};

				/**
     * Set the minimum duration
     *
     * @api public
     */

				Backoff.prototype.setMin = function (min) {
					this.ms = min;
				};

				/**
     * Set the maximum duration
     *
     * @api public
     */

				Backoff.prototype.setMax = function (max) {
					this.max = max;
				};

				/**
     * Set the jitter
     *
     * @api public
     */

				Backoff.prototype.setJitter = function (jitter) {
					this.jitter = jitter;
				};
			}, {}], 37: [function (_dereq_, module, exports) {
				/**
     * Slice reference.
     */

				var slice = [].slice;

				/**
     * Bind `obj` to `fn`.
     *
     * @param {Object} obj
     * @param {Function|String} fn or string
     * @return {Function}
     * @api public
     */

				module.exports = function (obj, fn) {
					if ('string' == typeof fn) fn = obj[fn];
					if ('function' != typeof fn) throw new Error('bind() requires a function');
					var args = slice.call(arguments, 2);
					return function () {
						return fn.apply(obj, args.concat(slice.call(arguments)));
					};
				};
			}, {}], 38: [function (_dereq_, module, exports) {

				/**
     * Expose `Emitter`.
     */

				module.exports = Emitter;

				/**
     * Initialize a new `Emitter`.
     *
     * @api public
     */

				function Emitter(obj) {
					if (obj) return mixin(obj);
				};

				/**
     * Mixin the emitter properties.
     *
     * @param {Object} obj
     * @return {Object}
     * @api private
     */

				function mixin(obj) {
					for (var key in Emitter.prototype) {
						obj[key] = Emitter.prototype[key];
					}
					return obj;
				}

				/**
     * Listen on the given `event` with `fn`.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

				Emitter.prototype.on = Emitter.prototype.addEventListener = function (event, fn) {
					this._callbacks = this._callbacks || {};
					(this._callbacks['$' + event] = this._callbacks['$' + event] || []).push(fn);
					return this;
				};

				/**
     * Adds an `event` listener that will be invoked a single
     * time then automatically removed.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

				Emitter.prototype.once = function (event, fn) {
					function on() {
						this.off(event, on);
						fn.apply(this, arguments);
					}

					on.fn = fn;
					this.on(event, on);
					return this;
				};

				/**
     * Remove the given callback for `event` or all
     * registered callbacks.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

				Emitter.prototype.off = Emitter.prototype.removeListener = Emitter.prototype.removeAllListeners = Emitter.prototype.removeEventListener = function (event, fn) {
					this._callbacks = this._callbacks || {};

					// all
					if (0 == arguments.length) {
						this._callbacks = {};
						return this;
					}

					// specific event
					var callbacks = this._callbacks['$' + event];
					if (!callbacks) return this;

					// remove all handlers
					if (1 == arguments.length) {
						delete this._callbacks['$' + event];
						return this;
					}

					// remove specific handler
					var cb;
					for (var i = 0; i < callbacks.length; i++) {
						cb = callbacks[i];
						if (cb === fn || cb.fn === fn) {
							callbacks.splice(i, 1);
							break;
						}
					}
					return this;
				};

				/**
     * Emit `event` with the given args.
     *
     * @param {String} event
     * @param {Mixed} ...
     * @return {Emitter}
     */

				Emitter.prototype.emit = function (event) {
					this._callbacks = this._callbacks || {};
					var args = [].slice.call(arguments, 1),
					    callbacks = this._callbacks['$' + event];

					if (callbacks) {
						callbacks = callbacks.slice(0);
						for (var i = 0, len = callbacks.length; i < len; ++i) {
							callbacks[i].apply(this, args);
						}
					}

					return this;
				};

				/**
     * Return array of callbacks for `event`.
     *
     * @param {String} event
     * @return {Array}
     * @api public
     */

				Emitter.prototype.listeners = function (event) {
					this._callbacks = this._callbacks || {};
					return this._callbacks['$' + event] || [];
				};

				/**
     * Check if this emitter has `event` handlers.
     *
     * @param {String} event
     * @return {Boolean}
     * @api public
     */

				Emitter.prototype.hasListeners = function (event) {
					return !!this.listeners(event).length;
				};
			}, {}], 39: [function (_dereq_, module, exports) {
				arguments[4][17][0].apply(exports, arguments);
			}, { "./debug": 40, "dup": 17 }], 40: [function (_dereq_, module, exports) {
				arguments[4][18][0].apply(exports, arguments);
			}, { "dup": 18, "ms": 44 }], 41: [function (_dereq_, module, exports) {
				(function (global) {

					/*
      * Module requirements.
      */

					var isArray = _dereq_('isarray');

					/**
      * Module exports.
      */

					module.exports = hasBinary;

					/**
      * Checks for binary data.
      *
      * Right now only Buffer and ArrayBuffer are supported..
      *
      * @param {Object} anything
      * @api public
      */

					function hasBinary(data) {

						function _hasBinary(obj) {
							if (!obj) return false;

							if (global.Buffer && global.Buffer.isBuffer && global.Buffer.isBuffer(obj) || global.ArrayBuffer && obj instanceof ArrayBuffer || global.Blob && obj instanceof Blob || global.File && obj instanceof File) {
								return true;
							}

							if (isArray(obj)) {
								for (var i = 0; i < obj.length; i++) {
									if (_hasBinary(obj[i])) {
										return true;
									}
								}
							} else if (obj && 'object' == (typeof obj === "undefined" ? "undefined" : _typeof(obj))) {
								// see: https://github.com/Automattic/has-binary/pull/4
								if (obj.toJSON && 'function' == typeof obj.toJSON) {
									obj = obj.toJSON();
								}

								for (var key in obj) {
									if (Object.prototype.hasOwnProperty.call(obj, key) && _hasBinary(obj[key])) {
										return true;
									}
								}
							}

							return false;
						}

						return _hasBinary(data);
					}
				}).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
			}, { "isarray": 43 }], 42: [function (_dereq_, module, exports) {
				arguments[4][23][0].apply(exports, arguments);
			}, { "dup": 23 }], 43: [function (_dereq_, module, exports) {
				arguments[4][24][0].apply(exports, arguments);
			}, { "dup": 24 }], 44: [function (_dereq_, module, exports) {
				arguments[4][25][0].apply(exports, arguments);
			}, { "dup": 25 }], 45: [function (_dereq_, module, exports) {
				arguments[4][28][0].apply(exports, arguments);
			}, { "dup": 28 }], 46: [function (_dereq_, module, exports) {
				(function (global) {
					/*global Blob,File*/

					/**
      * Module requirements
      */

					var isArray = _dereq_('isarray');
					var isBuf = _dereq_('./is-buffer');

					/**
      * Replaces every Buffer | ArrayBuffer in packet with a numbered placeholder.
      * Anything with blobs or files should be fed through removeBlobs before coming
      * here.
      *
      * @param {Object} packet - socket.io event packet
      * @return {Object} with deconstructed packet and list of buffers
      * @api public
      */

					exports.deconstructPacket = function (packet) {
						var buffers = [];
						var packetData = packet.data;

						function _deconstructPacket(data) {
							if (!data) return data;

							if (isBuf(data)) {
								var placeholder = { _placeholder: true, num: buffers.length };
								buffers.push(data);
								return placeholder;
							} else if (isArray(data)) {
								var newData = new Array(data.length);
								for (var i = 0; i < data.length; i++) {
									newData[i] = _deconstructPacket(data[i]);
								}
								return newData;
							} else if ('object' == (typeof data === "undefined" ? "undefined" : _typeof(data)) && !(data instanceof Date)) {
								var newData = {};
								for (var key in data) {
									newData[key] = _deconstructPacket(data[key]);
								}
								return newData;
							}
							return data;
						}

						var pack = packet;
						pack.data = _deconstructPacket(packetData);
						pack.attachments = buffers.length; // number of binary 'attachments'
						return { packet: pack, buffers: buffers };
					};

					/**
      * Reconstructs a binary packet from its placeholder packet and buffers
      *
      * @param {Object} packet - event packet with placeholders
      * @param {Array} buffers - binary buffers to put in placeholder positions
      * @return {Object} reconstructed packet
      * @api public
      */

					exports.reconstructPacket = function (packet, buffers) {
						var curPlaceHolder = 0;

						function _reconstructPacket(data) {
							if (data && data._placeholder) {
								var buf = buffers[data.num]; // appropriate buffer (should be natural order anyway)
								return buf;
							} else if (isArray(data)) {
								for (var i = 0; i < data.length; i++) {
									data[i] = _reconstructPacket(data[i]);
								}
								return data;
							} else if (data && 'object' == (typeof data === "undefined" ? "undefined" : _typeof(data))) {
								for (var key in data) {
									data[key] = _reconstructPacket(data[key]);
								}
								return data;
							}
							return data;
						}

						packet.data = _reconstructPacket(packet.data);
						packet.attachments = undefined; // no longer useful
						return packet;
					};

					/**
      * Asynchronously removes Blobs or Files from data via
      * FileReader's readAsArrayBuffer method. Used before encoding
      * data as msgpack. Calls callback with the blobless data.
      *
      * @param {Object} data
      * @param {Function} callback
      * @api private
      */

					exports.removeBlobs = function (data, callback) {
						function _removeBlobs(obj, curKey, containingObject) {
							if (!obj) return obj;

							// convert any blob
							if (global.Blob && obj instanceof Blob || global.File && obj instanceof File) {
								pendingBlobs++;

								// async filereader
								var fileReader = new FileReader();
								fileReader.onload = function () {
									// this.result == arraybuffer
									if (containingObject) {
										containingObject[curKey] = this.result;
									} else {
										bloblessData = this.result;
									}

									// if nothing pending its callback time
									if (! --pendingBlobs) {
										callback(bloblessData);
									}
								};

								fileReader.readAsArrayBuffer(obj); // blob -> arraybuffer
							} else if (isArray(obj)) {
								// handle array
								for (var i = 0; i < obj.length; i++) {
									_removeBlobs(obj[i], i, obj);
								}
							} else if (obj && 'object' == (typeof obj === "undefined" ? "undefined" : _typeof(obj)) && !isBuf(obj)) {
								// and object
								for (var key in obj) {
									_removeBlobs(obj[key], key, obj);
								}
							}
						}

						var pendingBlobs = 0;
						var bloblessData = data;
						_removeBlobs(bloblessData);
						if (!pendingBlobs) {
							callback(bloblessData);
						}
					};
				}).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
			}, { "./is-buffer": 48, "isarray": 43 }], 47: [function (_dereq_, module, exports) {

				/**
     * Module dependencies.
     */

				var debug = _dereq_('debug')('socket.io-parser');
				var json = _dereq_('json3');
				var isArray = _dereq_('isarray');
				var Emitter = _dereq_('component-emitter');
				var binary = _dereq_('./binary');
				var isBuf = _dereq_('./is-buffer');

				/**
     * Protocol version.
     *
     * @api public
     */

				exports.protocol = 4;

				/**
     * Packet types.
     *
     * @api public
     */

				exports.types = ['CONNECT', 'DISCONNECT', 'EVENT', 'BINARY_EVENT', 'ACK', 'BINARY_ACK', 'ERROR'];

				/**
     * Packet type `connect`.
     *
     * @api public
     */

				exports.CONNECT = 0;

				/**
     * Packet type `disconnect`.
     *
     * @api public
     */

				exports.DISCONNECT = 1;

				/**
     * Packet type `event`.
     *
     * @api public
     */

				exports.EVENT = 2;

				/**
     * Packet type `ack`.
     *
     * @api public
     */

				exports.ACK = 3;

				/**
     * Packet type `error`.
     *
     * @api public
     */

				exports.ERROR = 4;

				/**
     * Packet type 'binary event'
     *
     * @api public
     */

				exports.BINARY_EVENT = 5;

				/**
     * Packet type `binary ack`. For acks with binary arguments.
     *
     * @api public
     */

				exports.BINARY_ACK = 6;

				/**
     * Encoder constructor.
     *
     * @api public
     */

				exports.Encoder = Encoder;

				/**
     * Decoder constructor.
     *
     * @api public
     */

				exports.Decoder = Decoder;

				/**
     * A socket.io Encoder instance
     *
     * @api public
     */

				function Encoder() {}

				/**
     * Encode a packet as a single string if non-binary, or as a
     * buffer sequence, depending on packet type.
     *
     * @param {Object} obj - packet object
     * @param {Function} callback - function to handle encodings (likely engine.write)
     * @return Calls callback with Array of encodings
     * @api public
     */

				Encoder.prototype.encode = function (obj, callback) {
					debug('encoding packet %j', obj);

					if (exports.BINARY_EVENT == obj.type || exports.BINARY_ACK == obj.type) {
						encodeAsBinary(obj, callback);
					} else {
						var encoding = encodeAsString(obj);
						callback([encoding]);
					}
				};

				/**
     * Encode packet as string.
     *
     * @param {Object} packet
     * @return {String} encoded
     * @api private
     */

				function encodeAsString(obj) {
					var str = '';
					var nsp = false;

					// first is type
					str += obj.type;

					// attachments if we have them
					if (exports.BINARY_EVENT == obj.type || exports.BINARY_ACK == obj.type) {
						str += obj.attachments;
						str += '-';
					}

					// if we have a namespace other than `/`
					// we append it followed by a comma `,`
					if (obj.nsp && '/' != obj.nsp) {
						nsp = true;
						str += obj.nsp;
					}

					// immediately followed by the id
					if (null != obj.id) {
						if (nsp) {
							str += ',';
							nsp = false;
						}
						str += obj.id;
					}

					// json data
					if (null != obj.data) {
						if (nsp) str += ',';
						str += json.stringify(obj.data);
					}

					debug('encoded %j as %s', obj, str);
					return str;
				}

				/**
     * Encode packet as 'buffer sequence' by removing blobs, and
     * deconstructing packet into object with placeholders and
     * a list of buffers.
     *
     * @param {Object} packet
     * @return {Buffer} encoded
     * @api private
     */

				function encodeAsBinary(obj, callback) {

					function writeEncoding(bloblessData) {
						var deconstruction = binary.deconstructPacket(bloblessData);
						var pack = encodeAsString(deconstruction.packet);
						var buffers = deconstruction.buffers;

						buffers.unshift(pack); // add packet info to beginning of data list
						callback(buffers); // write all the buffers
					}

					binary.removeBlobs(obj, writeEncoding);
				}

				/**
     * A socket.io Decoder instance
     *
     * @return {Object} decoder
     * @api public
     */

				function Decoder() {
					this.reconstructor = null;
				}

				/**
     * Mix in `Emitter` with Decoder.
     */

				Emitter(Decoder.prototype);

				/**
     * Decodes an ecoded packet string into packet JSON.
     *
     * @param {String} obj - encoded packet
     * @return {Object} packet
     * @api public
     */

				Decoder.prototype.add = function (obj) {
					var packet;
					if ('string' == typeof obj) {
						packet = decodeString(obj);
						if (exports.BINARY_EVENT == packet.type || exports.BINARY_ACK == packet.type) {
							// binary packet's json
							this.reconstructor = new BinaryReconstructor(packet);

							// no attachments, labeled binary but no binary data to follow
							if (this.reconstructor.reconPack.attachments === 0) {
								this.emit('decoded', packet);
							}
						} else {
							// non-binary full packet
							this.emit('decoded', packet);
						}
					} else if (isBuf(obj) || obj.base64) {
						// raw binary data
						if (!this.reconstructor) {
							throw new Error('got binary data when not reconstructing a packet');
						} else {
							packet = this.reconstructor.takeBinaryData(obj);
							if (packet) {
								// received final buffer
								this.reconstructor = null;
								this.emit('decoded', packet);
							}
						}
					} else {
						throw new Error('Unknown type: ' + obj);
					}
				};

				/**
     * Decode a packet String (JSON data)
     *
     * @param {String} str
     * @return {Object} packet
     * @api private
     */

				function decodeString(str) {
					var p = {};
					var i = 0;

					// look up type
					p.type = Number(str.charAt(0));
					if (null == exports.types[p.type]) return error();

					// look up attachments if type binary
					if (exports.BINARY_EVENT == p.type || exports.BINARY_ACK == p.type) {
						var buf = '';
						while (str.charAt(++i) != '-') {
							buf += str.charAt(i);
							if (i == str.length) break;
						}
						if (buf != Number(buf) || str.charAt(i) != '-') {
							throw new Error('Illegal attachments');
						}
						p.attachments = Number(buf);
					}

					// look up namespace (if any)
					if ('/' == str.charAt(i + 1)) {
						p.nsp = '';
						while (++i) {
							var c = str.charAt(i);
							if (',' == c) break;
							p.nsp += c;
							if (i == str.length) break;
						}
					} else {
						p.nsp = '/';
					}

					// look up id
					var next = str.charAt(i + 1);
					if ('' !== next && Number(next) == next) {
						p.id = '';
						while (++i) {
							var c = str.charAt(i);
							if (null == c || Number(c) != c) {
								--i;
								break;
							}
							p.id += str.charAt(i);
							if (i == str.length) break;
						}
						p.id = Number(p.id);
					}

					// look up json data
					if (str.charAt(++i)) {
						try {
							p.data = json.parse(str.substr(i));
						} catch (e) {
							return error();
						}
					}

					debug('decoded %s as %j', str, p);
					return p;
				}

				/**
     * Deallocates a parser's resources
     *
     * @api public
     */

				Decoder.prototype.destroy = function () {
					if (this.reconstructor) {
						this.reconstructor.finishedReconstruction();
					}
				};

				/**
     * A manager of a binary event's 'buffer sequence'. Should
     * be constructed whenever a packet of type BINARY_EVENT is
     * decoded.
     *
     * @param {Object} packet
     * @return {BinaryReconstructor} initialized reconstructor
     * @api private
     */

				function BinaryReconstructor(packet) {
					this.reconPack = packet;
					this.buffers = [];
				}

				/**
     * Method to be called when binary data received from connection
     * after a BINARY_EVENT packet.
     *
     * @param {Buffer | ArrayBuffer} binData - the raw binary data received
     * @return {null | Object} returns null if more binary data is expected or
     *   a reconstructed packet object if all buffers have been received.
     * @api private
     */

				BinaryReconstructor.prototype.takeBinaryData = function (binData) {
					this.buffers.push(binData);
					if (this.buffers.length == this.reconPack.attachments) {
						// done with buffer list
						var packet = binary.reconstructPacket(this.reconPack, this.buffers);
						this.finishedReconstruction();
						return packet;
					}
					return null;
				};

				/**
     * Cleans up binary packet reconstruction variables.
     *
     * @api private
     */

				BinaryReconstructor.prototype.finishedReconstruction = function () {
					this.reconPack = null;
					this.buffers = [];
				};

				function error(data) {
					return {
						type: exports.ERROR,
						data: 'parser error'
					};
				}
			}, { "./binary": 46, "./is-buffer": 48, "component-emitter": 49, "debug": 39, "isarray": 43, "json3": 50 }], 48: [function (_dereq_, module, exports) {
				(function (global) {

					module.exports = isBuf;

					/**
      * Returns true if obj is a buffer or an arraybuffer.
      *
      * @api private
      */

					function isBuf(obj) {
						return global.Buffer && global.Buffer.isBuffer(obj) || global.ArrayBuffer && obj instanceof ArrayBuffer;
					}
				}).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
			}, {}], 49: [function (_dereq_, module, exports) {
				arguments[4][15][0].apply(exports, arguments);
			}, { "dup": 15 }], 50: [function (_dereq_, module, exports) {
				(function (global) {
					/*! JSON v3.3.2 | http://bestiejs.github.io/json3 | Copyright 2012-2014, Kit Cambridge | http://kit.mit-license.org */
					;(function () {
						// Detect the `define` function exposed by asynchronous module loaders. The
						// strict `define` check is necessary for compatibility with `r.js`.
						var isLoader = typeof define === "function" && define.amd;

						// A set of types used to distinguish objects from primitives.
						var objectTypes = {
							"function": true,
							"object": true
						};

						// Detect the `exports` object exposed by CommonJS implementations.
						var freeExports = objectTypes[typeof exports === "undefined" ? "undefined" : _typeof(exports)] && exports && !exports.nodeType && exports;

						// Use the `global` object exposed by Node (including Browserify via
						// `insert-module-globals`), Narwhal, and Ringo as the default context,
						// and the `window` object in browsers. Rhino exports a `global` function
						// instead.
						var root = objectTypes[typeof window === "undefined" ? "undefined" : _typeof(window)] && window || this,
						    freeGlobal = freeExports && objectTypes[typeof module === "undefined" ? "undefined" : _typeof(module)] && module && !module.nodeType && (typeof global === "undefined" ? "undefined" : _typeof(global)) == "object" && global;

						if (freeGlobal && (freeGlobal["global"] === freeGlobal || freeGlobal["window"] === freeGlobal || freeGlobal["self"] === freeGlobal)) {
							root = freeGlobal;
						}

						// Public: Initializes JSON 3 using the given `context` object, attaching the
						// `stringify` and `parse` functions to the specified `exports` object.
						function runInContext(context, exports) {
							context || (context = root["Object"]());
							exports || (exports = root["Object"]());

							// Native constructor aliases.
							var Number = context["Number"] || root["Number"],
							    String = context["String"] || root["String"],
							    Object = context["Object"] || root["Object"],
							    Date = context["Date"] || root["Date"],
							    SyntaxError = context["SyntaxError"] || root["SyntaxError"],
							    TypeError = context["TypeError"] || root["TypeError"],
							    Math = context["Math"] || root["Math"],
							    nativeJSON = context["JSON"] || root["JSON"];

							// Delegate to the native `stringify` and `parse` implementations.
							if ((typeof nativeJSON === "undefined" ? "undefined" : _typeof(nativeJSON)) == "object" && nativeJSON) {
								exports.stringify = nativeJSON.stringify;
								exports.parse = nativeJSON.parse;
							}

							// Convenience aliases.
							var objectProto = Object.prototype,
							    getClass = objectProto.toString,
							    _isProperty,
							    _forEach,
							    undef;

							// Test the `Date#getUTC*` methods. Based on work by @Yaffle.
							var isExtended = new Date(-3509827334573292);
							try {
								// The `getUTCFullYear`, `Month`, and `Date` methods return nonsensical
								// results for certain dates in Opera >= 10.53.
								isExtended = isExtended.getUTCFullYear() == -109252 && isExtended.getUTCMonth() === 0 && isExtended.getUTCDate() === 1 &&
								// Safari < 2.0.2 stores the internal millisecond time value correctly,
								// but clips the values returned by the date methods to the range of
								// signed 32-bit integers ([-2 ** 31, 2 ** 31 - 1]).
								isExtended.getUTCHours() == 10 && isExtended.getUTCMinutes() == 37 && isExtended.getUTCSeconds() == 6 && isExtended.getUTCMilliseconds() == 708;
							} catch (exception) {}

							// Internal: Determines whether the native `JSON.stringify` and `parse`
							// implementations are spec-compliant. Based on work by Ken Snyder.
							function has(name) {
								if (has[name] !== undef) {
									// Return cached feature test result.
									return has[name];
								}
								var isSupported;
								if (name == "bug-string-char-index") {
									// IE <= 7 doesn't support accessing string characters using square
									// bracket notation. IE 8 only supports this for primitives.
									isSupported = "a"[0] != "a";
								} else if (name == "json") {
									// Indicates whether both `JSON.stringify` and `JSON.parse` are
									// supported.
									isSupported = has("json-stringify") && has("json-parse");
								} else {
									var value,
									    serialized = "{\"a\":[1,true,false,null,\"\\u0000\\b\\n\\f\\r\\t\"]}";
									// Test `JSON.stringify`.
									if (name == "json-stringify") {
										var stringify = exports.stringify,
										    stringifySupported = typeof stringify == "function" && isExtended;
										if (stringifySupported) {
											// A test function object with a custom `toJSON` method.
											(value = function value() {
												return 1;
											}).toJSON = value;
											try {
												stringifySupported =
												// Firefox 3.1b1 and b2 serialize string, number, and boolean
												// primitives as object literals.
												stringify(0) === "0" &&
												// FF 3.1b1, b2, and JSON 2 serialize wrapped primitives as object
												// literals.
												stringify(new Number()) === "0" && stringify(new String()) == '""' &&
												// FF 3.1b1, 2 throw an error if the value is `null`, `undefined`, or
												// does not define a canonical JSON representation (this applies to
												// objects with `toJSON` properties as well, *unless* they are nested
												// within an object or array).
												stringify(getClass) === undef &&
												// IE 8 serializes `undefined` as `"undefined"`. Safari <= 5.1.7 and
												// FF 3.1b3 pass this test.
												stringify(undef) === undef &&
												// Safari <= 5.1.7 and FF 3.1b3 throw `Error`s and `TypeError`s,
												// respectively, if the value is omitted entirely.
												stringify() === undef &&
												// FF 3.1b1, 2 throw an error if the given value is not a number,
												// string, array, object, Boolean, or `null` literal. This applies to
												// objects with custom `toJSON` methods as well, unless they are nested
												// inside object or array literals. YUI 3.0.0b1 ignores custom `toJSON`
												// methods entirely.
												stringify(value) === "1" && stringify([value]) == "[1]" &&
												// Prototype <= 1.6.1 serializes `[undefined]` as `"[]"` instead of
												// `"[null]"`.
												stringify([undef]) == "[null]" &&
												// YUI 3.0.0b1 fails to serialize `null` literals.
												stringify(null) == "null" &&
												// FF 3.1b1, 2 halts serialization if an array contains a function:
												// `[1, true, getClass, 1]` serializes as "[1,true,],". FF 3.1b3
												// elides non-JSON values from objects and arrays, unless they
												// define custom `toJSON` methods.
												stringify([undef, getClass, null]) == "[null,null,null]" &&
												// Simple serialization test. FF 3.1b1 uses Unicode escape sequences
												// where character escape codes are expected (e.g., `\b` => `\u0008`).
												stringify({ "a": [value, true, false, null, "\x00\b\n\f\r\t"] }) == serialized &&
												// FF 3.1b1 and b2 ignore the `filter` and `width` arguments.
												stringify(null, value) === "1" && stringify([1, 2], null, 1) == "[\n 1,\n 2\n]" &&
												// JSON 2, Prototype <= 1.7, and older WebKit builds incorrectly
												// serialize extended years.
												stringify(new Date(-8.64e15)) == '"-271821-04-20T00:00:00.000Z"' &&
												// The milliseconds are optional in ES 5, but required in 5.1.
												stringify(new Date(8.64e15)) == '"+275760-09-13T00:00:00.000Z"' &&
												// Firefox <= 11.0 incorrectly serializes years prior to 0 as negative
												// four-digit years instead of six-digit years. Credits: @Yaffle.
												stringify(new Date(-621987552e5)) == '"-000001-01-01T00:00:00.000Z"' &&
												// Safari <= 5.1.5 and Opera >= 10.53 incorrectly serialize millisecond
												// values less than 1000. Credits: @Yaffle.
												stringify(new Date(-1)) == '"1969-12-31T23:59:59.999Z"';
											} catch (exception) {
												stringifySupported = false;
											}
										}
										isSupported = stringifySupported;
									}
									// Test `JSON.parse`.
									if (name == "json-parse") {
										var parse = exports.parse;
										if (typeof parse == "function") {
											try {
												// FF 3.1b1, b2 will throw an exception if a bare literal is provided.
												// Conforming implementations should also coerce the initial argument to
												// a string prior to parsing.
												if (parse("0") === 0 && !parse(false)) {
													// Simple parsing test.
													value = parse(serialized);
													var parseSupported = value["a"].length == 5 && value["a"][0] === 1;
													if (parseSupported) {
														try {
															// Safari <= 5.1.2 and FF 3.1b1 allow unescaped tabs in strings.
															parseSupported = !parse('"\t"');
														} catch (exception) {}
														if (parseSupported) {
															try {
																// FF 4.0 and 4.0.1 allow leading `+` signs and leading
																// decimal points. FF 4.0, 4.0.1, and IE 9-10 also allow
																// certain octal literals.
																parseSupported = parse("01") !== 1;
															} catch (exception) {}
														}
														if (parseSupported) {
															try {
																// FF 4.0, 4.0.1, and Rhino 1.7R3-R4 allow trailing decimal
																// points. These environments, along with FF 3.1b1 and 2,
																// also allow trailing commas in JSON objects and arrays.
																parseSupported = parse("1.") !== 1;
															} catch (exception) {}
														}
													}
												}
											} catch (exception) {
												parseSupported = false;
											}
										}
										isSupported = parseSupported;
									}
								}
								return has[name] = !!isSupported;
							}

							if (!has("json")) {
								// Common `[[Class]]` name aliases.
								var functionClass = "[object Function]",
								    dateClass = "[object Date]",
								    numberClass = "[object Number]",
								    stringClass = "[object String]",
								    arrayClass = "[object Array]",
								    booleanClass = "[object Boolean]";

								// Detect incomplete support for accessing string characters by index.
								var charIndexBuggy = has("bug-string-char-index");

								// Define additional utility methods if the `Date` methods are buggy.
								if (!isExtended) {
									var floor = Math.floor;
									// A mapping between the months of the year and the number of days between
									// January 1st and the first of the respective month.
									var Months = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
									// Internal: Calculates the number of days between the Unix epoch and the
									// first day of the given month.
									var getDay = function getDay(year, month) {
										return Months[month] + 365 * (year - 1970) + floor((year - 1969 + (month = +(month > 1))) / 4) - floor((year - 1901 + month) / 100) + floor((year - 1601 + month) / 400);
									};
								}

								// Internal: Determines if a property is a direct property of the given
								// object. Delegates to the native `Object#hasOwnProperty` method.
								if (!(_isProperty = objectProto.hasOwnProperty)) {
									_isProperty = function isProperty(property) {
										var members = {},
										    constructor;
										if ((members.__proto__ = null, members.__proto__ = {
											// The *proto* property cannot be set multiple times in recent
											// versions of Firefox and SeaMonkey.
											"toString": 1
										}, members).toString != getClass) {
											// Safari <= 2.0.3 doesn't implement `Object#hasOwnProperty`, but
											// supports the mutable *proto* property.
											_isProperty = function isProperty(property) {
												// Capture and break the object's prototype chain (see section 8.6.2
												// of the ES 5.1 spec). The parenthesized expression prevents an
												// unsafe transformation by the Closure Compiler.
												var original = this.__proto__,
												    result = property in (this.__proto__ = null, this);
												// Restore the original prototype chain.
												this.__proto__ = original;
												return result;
											};
										} else {
											// Capture a reference to the top-level `Object` constructor.
											constructor = members.constructor;
											// Use the `constructor` property to simulate `Object#hasOwnProperty` in
											// other environments.
											_isProperty = function isProperty(property) {
												var parent = (this.constructor || constructor).prototype;
												return property in this && !(property in parent && this[property] === parent[property]);
											};
										}
										members = null;
										return _isProperty.call(this, property);
									};
								}

								// Internal: Normalizes the `for...in` iteration algorithm across
								// environments. Each enumerated key is yielded to a `callback` function.
								_forEach = function forEach(object, callback) {
									var size = 0,
									    Properties,
									    members,
									    property;

									// Tests for bugs in the current environment's `for...in` algorithm. The
									// `valueOf` property inherits the non-enumerable flag from
									// `Object.prototype` in older versions of IE, Netscape, and Mozilla.
									(Properties = function Properties() {
										this.valueOf = 0;
									}).prototype.valueOf = 0;

									// Iterate over a new instance of the `Properties` class.
									members = new Properties();
									for (property in members) {
										// Ignore all properties inherited from `Object.prototype`.
										if (_isProperty.call(members, property)) {
											size++;
										}
									}
									Properties = members = null;

									// Normalize the iteration algorithm.
									if (!size) {
										// A list of non-enumerable properties inherited from `Object.prototype`.
										members = ["valueOf", "toString", "toLocaleString", "propertyIsEnumerable", "isPrototypeOf", "hasOwnProperty", "constructor"];
										// IE <= 8, Mozilla 1.0, and Netscape 6.2 ignore shadowed non-enumerable
										// properties.
										_forEach = function forEach(object, callback) {
											var isFunction = getClass.call(object) == functionClass,
											    property,
											    length;
											var hasProperty = !isFunction && typeof object.constructor != "function" && objectTypes[_typeof(object.hasOwnProperty)] && object.hasOwnProperty || _isProperty;
											for (property in object) {
												// Gecko <= 1.0 enumerates the `prototype` property of functions under
												// certain conditions; IE does not.
												if (!(isFunction && property == "prototype") && hasProperty.call(object, property)) {
													callback(property);
												}
											}
											// Manually invoke the callback for each non-enumerable property.
											for (length = members.length; property = members[--length]; hasProperty.call(object, property) && callback(property)) {}
										};
									} else if (size == 2) {
										// Safari <= 2.0.4 enumerates shadowed properties twice.
										_forEach = function forEach(object, callback) {
											// Create a set of iterated properties.
											var members = {},
											    isFunction = getClass.call(object) == functionClass,
											    property;
											for (property in object) {
												// Store each property name to prevent double enumeration. The
												// `prototype` property of functions is not enumerated due to cross-
												// environment inconsistencies.
												if (!(isFunction && property == "prototype") && !_isProperty.call(members, property) && (members[property] = 1) && _isProperty.call(object, property)) {
													callback(property);
												}
											}
										};
									} else {
										// No bugs detected; use the standard `for...in` algorithm.
										_forEach = function forEach(object, callback) {
											var isFunction = getClass.call(object) == functionClass,
											    property,
											    isConstructor;
											for (property in object) {
												if (!(isFunction && property == "prototype") && _isProperty.call(object, property) && !(isConstructor = property === "constructor")) {
													callback(property);
												}
											}
											// Manually invoke the callback for the `constructor` property due to
											// cross-environment inconsistencies.
											if (isConstructor || _isProperty.call(object, property = "constructor")) {
												callback(property);
											}
										};
									}
									return _forEach(object, callback);
								};

								// Public: Serializes a JavaScript `value` as a JSON string. The optional
								// `filter` argument may specify either a function that alters how object and
								// array members are serialized, or an array of strings and numbers that
								// indicates which properties should be serialized. The optional `width`
								// argument may be either a string or number that specifies the indentation
								// level of the output.
								if (!has("json-stringify")) {
									// Internal: A map of control characters and their escaped equivalents.
									var Escapes = {
										92: "\\\\",
										34: '\\"',
										8: "\\b",
										12: "\\f",
										10: "\\n",
										13: "\\r",
										9: "\\t"
									};

									// Internal: Converts `value` into a zero-padded string such that its
									// length is at least equal to `width`. The `width` must be <= 6.
									var leadingZeroes = "000000";
									var toPaddedString = function toPaddedString(width, value) {
										// The `|| 0` expression is necessary to work around a bug in
										// Opera <= 7.54u2 where `0 == -0`, but `String(-0) !== "0"`.
										return (leadingZeroes + (value || 0)).slice(-width);
									};

									// Internal: Double-quotes a string `value`, replacing all ASCII control
									// characters (characters with code unit values between 0 and 31) with
									// their escaped equivalents. This is an implementation of the
									// `Quote(value)` operation defined in ES 5.1 section 15.12.3.
									var unicodePrefix = "\\u00";
									var quote = function quote(value) {
										var result = '"',
										    index = 0,
										    length = value.length,
										    useCharIndex = !charIndexBuggy || length > 10;
										var symbols = useCharIndex && (charIndexBuggy ? value.split("") : value);
										for (; index < length; index++) {
											var charCode = value.charCodeAt(index);
											// If the character is a control character, append its Unicode or
											// shorthand escape sequence; otherwise, append the character as-is.
											switch (charCode) {
												case 8:case 9:case 10:case 12:case 13:case 34:case 92:
													result += Escapes[charCode];
													break;
												default:
													if (charCode < 32) {
														result += unicodePrefix + toPaddedString(2, charCode.toString(16));
														break;
													}
													result += useCharIndex ? symbols[index] : value.charAt(index);
											}
										}
										return result + '"';
									};

									// Internal: Recursively serializes an object. Implements the
									// `Str(key, holder)`, `JO(value)`, and `JA(value)` operations.
									var serialize = function serialize(property, object, callback, properties, whitespace, indentation, stack) {
										var value, className, year, month, date, time, hours, minutes, seconds, milliseconds, results, element, index, length, prefix, result;
										try {
											// Necessary for host object support.
											value = object[property];
										} catch (exception) {}
										if ((typeof value === "undefined" ? "undefined" : _typeof(value)) == "object" && value) {
											className = getClass.call(value);
											if (className == dateClass && !_isProperty.call(value, "toJSON")) {
												if (value > -1 / 0 && value < 1 / 0) {
													// Dates are serialized according to the `Date#toJSON` method
													// specified in ES 5.1 section 15.9.5.44. See section 15.9.1.15
													// for the ISO 8601 date time string format.
													if (getDay) {
														// Manually compute the year, month, date, hours, minutes,
														// seconds, and milliseconds if the `getUTC*` methods are
														// buggy. Adapted from @Yaffle's `date-shim` project.
														date = floor(value / 864e5);
														for (year = floor(date / 365.2425) + 1970 - 1; getDay(year + 1, 0) <= date; year++) {}
														for (month = floor((date - getDay(year, 0)) / 30.42); getDay(year, month + 1) <= date; month++) {}
														date = 1 + date - getDay(year, month);
														// The `time` value specifies the time within the day (see ES
														// 5.1 section 15.9.1.2). The formula `(A % B + B) % B` is used
														// to compute `A modulo B`, as the `%` operator does not
														// correspond to the `modulo` operation for negative numbers.
														time = (value % 864e5 + 864e5) % 864e5;
														// The hours, minutes, seconds, and milliseconds are obtained by
														// decomposing the time within the day. See section 15.9.1.10.
														hours = floor(time / 36e5) % 24;
														minutes = floor(time / 6e4) % 60;
														seconds = floor(time / 1e3) % 60;
														milliseconds = time % 1e3;
													} else {
														year = value.getUTCFullYear();
														month = value.getUTCMonth();
														date = value.getUTCDate();
														hours = value.getUTCHours();
														minutes = value.getUTCMinutes();
														seconds = value.getUTCSeconds();
														milliseconds = value.getUTCMilliseconds();
													}
													// Serialize extended years correctly.
													value = (year <= 0 || year >= 1e4 ? (year < 0 ? "-" : "+") + toPaddedString(6, year < 0 ? -year : year) : toPaddedString(4, year)) + "-" + toPaddedString(2, month + 1) + "-" + toPaddedString(2, date) +
													// Months, dates, hours, minutes, and seconds should have two
													// digits; milliseconds should have three.
													"T" + toPaddedString(2, hours) + ":" + toPaddedString(2, minutes) + ":" + toPaddedString(2, seconds) +
													// Milliseconds are optional in ES 5.0, but required in 5.1.
													"." + toPaddedString(3, milliseconds) + "Z";
												} else {
													value = null;
												}
											} else if (typeof value.toJSON == "function" && (className != numberClass && className != stringClass && className != arrayClass || _isProperty.call(value, "toJSON"))) {
												// Prototype <= 1.6.1 adds non-standard `toJSON` methods to the
												// `Number`, `String`, `Date`, and `Array` prototypes. JSON 3
												// ignores all `toJSON` methods on these objects unless they are
												// defined directly on an instance.
												value = value.toJSON(property);
											}
										}
										if (callback) {
											// If a replacement function was provided, call it to obtain the value
											// for serialization.
											value = callback.call(object, property, value);
										}
										if (value === null) {
											return "null";
										}
										className = getClass.call(value);
										if (className == booleanClass) {
											// Booleans are represented literally.
											return "" + value;
										} else if (className == numberClass) {
											// JSON numbers must be finite. `Infinity` and `NaN` are serialized as
											// `"null"`.
											return value > -1 / 0 && value < 1 / 0 ? "" + value : "null";
										} else if (className == stringClass) {
											// Strings are double-quoted and escaped.
											return quote("" + value);
										}
										// Recursively serialize objects and arrays.
										if ((typeof value === "undefined" ? "undefined" : _typeof(value)) == "object") {
											// Check for cyclic structures. This is a linear search; performance
											// is inversely proportional to the number of unique nested objects.
											for (length = stack.length; length--;) {
												if (stack[length] === value) {
													// Cyclic structures cannot be serialized by `JSON.stringify`.
													throw TypeError();
												}
											}
											// Add the object to the stack of traversed objects.
											stack.push(value);
											results = [];
											// Save the current indentation level and indent one additional level.
											prefix = indentation;
											indentation += whitespace;
											if (className == arrayClass) {
												// Recursively serialize array elements.
												for (index = 0, length = value.length; index < length; index++) {
													element = serialize(index, value, callback, properties, whitespace, indentation, stack);
													results.push(element === undef ? "null" : element);
												}
												result = results.length ? whitespace ? "[\n" + indentation + results.join(",\n" + indentation) + "\n" + prefix + "]" : "[" + results.join(",") + "]" : "[]";
											} else {
												// Recursively serialize object members. Members are selected from
												// either a user-specified list of property names, or the object
												// itself.
												_forEach(properties || value, function (property) {
													var element = serialize(property, value, callback, properties, whitespace, indentation, stack);
													if (element !== undef) {
														// According to ES 5.1 section 15.12.3: "If `gap` {whitespace}
														// is not the empty string, let `member` {quote(property) + ":"}
														// be the concatenation of `member` and the `space` character."
														// The "`space` character" refers to the literal space
														// character, not the `space` {width} argument provided to
														// `JSON.stringify`.
														results.push(quote(property) + ":" + (whitespace ? " " : "") + element);
													}
												});
												result = results.length ? whitespace ? "{\n" + indentation + results.join(",\n" + indentation) + "\n" + prefix + "}" : "{" + results.join(",") + "}" : "{}";
											}
											// Remove the object from the traversed object stack.
											stack.pop();
											return result;
										}
									};

									// Public: `JSON.stringify`. See ES 5.1 section 15.12.3.
									exports.stringify = function (source, filter, width) {
										var whitespace, callback, properties, className;
										if (objectTypes[typeof filter === "undefined" ? "undefined" : _typeof(filter)] && filter) {
											if ((className = getClass.call(filter)) == functionClass) {
												callback = filter;
											} else if (className == arrayClass) {
												// Convert the property names array into a makeshift set.
												properties = {};
												for (var index = 0, length = filter.length, value; index < length; value = filter[index++], (className = getClass.call(value), className == stringClass || className == numberClass) && (properties[value] = 1)) {}
											}
										}
										if (width) {
											if ((className = getClass.call(width)) == numberClass) {
												// Convert the `width` to an integer and create a string containing
												// `width` number of space characters.
												if ((width -= width % 1) > 0) {
													for (whitespace = "", width > 10 && (width = 10); whitespace.length < width; whitespace += " ") {}
												}
											} else if (className == stringClass) {
												whitespace = width.length <= 10 ? width : width.slice(0, 10);
											}
										}
										// Opera <= 7.54u2 discards the values associated with empty string keys
										// (`""`) only if they are used directly within an object member list
										// (e.g., `!("" in { "": 1})`).
										return serialize("", (value = {}, value[""] = source, value), callback, properties, whitespace, "", []);
									};
								}

								// Public: Parses a JSON source string.
								if (!has("json-parse")) {
									var fromCharCode = String.fromCharCode;

									// Internal: A map of escaped control characters and their unescaped
									// equivalents.
									var Unescapes = {
										92: "\\",
										34: '"',
										47: "/",
										98: "\b",
										116: "\t",
										110: "\n",
										102: "\f",
										114: "\r"
									};

									// Internal: Stores the parser state.
									var Index, Source;

									// Internal: Resets the parser state and throws a `SyntaxError`.
									var abort = function abort() {
										Index = Source = null;
										throw SyntaxError();
									};

									// Internal: Returns the next token, or `"$"` if the parser has reached
									// the end of the source string. A token may be a string, number, `null`
									// literal, or Boolean literal.
									var lex = function lex() {
										var source = Source,
										    length = source.length,
										    value,
										    begin,
										    position,
										    isSigned,
										    charCode;
										while (Index < length) {
											charCode = source.charCodeAt(Index);
											switch (charCode) {
												case 9:case 10:case 13:case 32:
													// Skip whitespace tokens, including tabs, carriage returns, line
													// feeds, and space characters.
													Index++;
													break;
												case 123:case 125:case 91:case 93:case 58:case 44:
													// Parse a punctuator token (`{`, `}`, `[`, `]`, `:`, or `,`) at
													// the current position.
													value = charIndexBuggy ? source.charAt(Index) : source[Index];
													Index++;
													return value;
												case 34:
													// `"` delimits a JSON string; advance to the next character and
													// begin parsing the string. String tokens are prefixed with the
													// sentinel `@` character to distinguish them from punctuators and
													// end-of-string tokens.
													for (value = "@", Index++; Index < length;) {
														charCode = source.charCodeAt(Index);
														if (charCode < 32) {
															// Unescaped ASCII control characters (those with a code unit
															// less than the space character) are not permitted.
															abort();
														} else if (charCode == 92) {
															// A reverse solidus (`\`) marks the beginning of an escaped
															// control character (including `"`, `\`, and `/`) or Unicode
															// escape sequence.
															charCode = source.charCodeAt(++Index);
															switch (charCode) {
																case 92:case 34:case 47:case 98:case 116:case 110:case 102:case 114:
																	// Revive escaped control characters.
																	value += Unescapes[charCode];
																	Index++;
																	break;
																case 117:
																	// `\u` marks the beginning of a Unicode escape sequence.
																	// Advance to the first character and validate the
																	// four-digit code point.
																	begin = ++Index;
																	for (position = Index + 4; Index < position; Index++) {
																		charCode = source.charCodeAt(Index);
																		// A valid sequence comprises four hexdigits (case-
																		// insensitive) that form a single hexadecimal value.
																		if (!(charCode >= 48 && charCode <= 57 || charCode >= 97 && charCode <= 102 || charCode >= 65 && charCode <= 70)) {
																			// Invalid Unicode escape sequence.
																			abort();
																		}
																	}
																	// Revive the escaped character.
																	value += fromCharCode("0x" + source.slice(begin, Index));
																	break;
																default:
																	// Invalid escape sequence.
																	abort();
															}
														} else {
															if (charCode == 34) {
																// An unescaped double-quote character marks the end of the
																// string.
																break;
															}
															charCode = source.charCodeAt(Index);
															begin = Index;
															// Optimize for the common case where a string is valid.
															while (charCode >= 32 && charCode != 92 && charCode != 34) {
																charCode = source.charCodeAt(++Index);
															}
															// Append the string as-is.
															value += source.slice(begin, Index);
														}
													}
													if (source.charCodeAt(Index) == 34) {
														// Advance to the next character and return the revived string.
														Index++;
														return value;
													}
													// Unterminated string.
													abort();
												default:
													// Parse numbers and literals.
													begin = Index;
													// Advance past the negative sign, if one is specified.
													if (charCode == 45) {
														isSigned = true;
														charCode = source.charCodeAt(++Index);
													}
													// Parse an integer or floating-point value.
													if (charCode >= 48 && charCode <= 57) {
														// Leading zeroes are interpreted as octal literals.
														if (charCode == 48 && (charCode = source.charCodeAt(Index + 1), charCode >= 48 && charCode <= 57)) {
															// Illegal octal literal.
															abort();
														}
														isSigned = false;
														// Parse the integer component.
														for (; Index < length && (charCode = source.charCodeAt(Index), charCode >= 48 && charCode <= 57); Index++) {}
														// Floats cannot contain a leading decimal point; however, this
														// case is already accounted for by the parser.
														if (source.charCodeAt(Index) == 46) {
															position = ++Index;
															// Parse the decimal component.
															for (; position < length && (charCode = source.charCodeAt(position), charCode >= 48 && charCode <= 57); position++) {}
															if (position == Index) {
																// Illegal trailing decimal.
																abort();
															}
															Index = position;
														}
														// Parse exponents. The `e` denoting the exponent is
														// case-insensitive.
														charCode = source.charCodeAt(Index);
														if (charCode == 101 || charCode == 69) {
															charCode = source.charCodeAt(++Index);
															// Skip past the sign following the exponent, if one is
															// specified.
															if (charCode == 43 || charCode == 45) {
																Index++;
															}
															// Parse the exponential component.
															for (position = Index; position < length && (charCode = source.charCodeAt(position), charCode >= 48 && charCode <= 57); position++) {}
															if (position == Index) {
																// Illegal empty exponent.
																abort();
															}
															Index = position;
														}
														// Coerce the parsed value to a JavaScript number.
														return +source.slice(begin, Index);
													}
													// A negative sign may only precede numbers.
													if (isSigned) {
														abort();
													}
													// `true`, `false`, and `null` literals.
													if (source.slice(Index, Index + 4) == "true") {
														Index += 4;
														return true;
													} else if (source.slice(Index, Index + 5) == "false") {
														Index += 5;
														return false;
													} else if (source.slice(Index, Index + 4) == "null") {
														Index += 4;
														return null;
													}
													// Unrecognized token.
													abort();
											}
										}
										// Return the sentinel `$` character if the parser has reached the end
										// of the source string.
										return "$";
									};

									// Internal: Parses a JSON `value` token.
									var get = function get(value) {
										var results, hasMembers;
										if (value == "$") {
											// Unexpected end of input.
											abort();
										}
										if (typeof value == "string") {
											if ((charIndexBuggy ? value.charAt(0) : value[0]) == "@") {
												// Remove the sentinel `@` character.
												return value.slice(1);
											}
											// Parse object and array literals.
											if (value == "[") {
												// Parses a JSON array, returning a new JavaScript array.
												results = [];
												for (;; hasMembers || (hasMembers = true)) {
													value = lex();
													// A closing square bracket marks the end of the array literal.
													if (value == "]") {
														break;
													}
													// If the array literal contains elements, the current token
													// should be a comma separating the previous element from the
													// next.
													if (hasMembers) {
														if (value == ",") {
															value = lex();
															if (value == "]") {
																// Unexpected trailing `,` in array literal.
																abort();
															}
														} else {
															// A `,` must separate each array element.
															abort();
														}
													}
													// Elisions and leading commas are not permitted.
													if (value == ",") {
														abort();
													}
													results.push(get(value));
												}
												return results;
											} else if (value == "{") {
												// Parses a JSON object, returning a new JavaScript object.
												results = {};
												for (;; hasMembers || (hasMembers = true)) {
													value = lex();
													// A closing curly brace marks the end of the object literal.
													if (value == "}") {
														break;
													}
													// If the object literal contains members, the current token
													// should be a comma separator.
													if (hasMembers) {
														if (value == ",") {
															value = lex();
															if (value == "}") {
																// Unexpected trailing `,` in object literal.
																abort();
															}
														} else {
															// A `,` must separate each object member.
															abort();
														}
													}
													// Leading commas are not permitted, object property names must be
													// double-quoted strings, and a `:` must separate each property
													// name and value.
													if (value == "," || typeof value != "string" || (charIndexBuggy ? value.charAt(0) : value[0]) != "@" || lex() != ":") {
														abort();
													}
													results[value.slice(1)] = get(lex());
												}
												return results;
											}
											// Unexpected token encountered.
											abort();
										}
										return value;
									};

									// Internal: Updates a traversed object member.
									var update = function update(source, property, callback) {
										var element = walk(source, property, callback);
										if (element === undef) {
											delete source[property];
										} else {
											source[property] = element;
										}
									};

									// Internal: Recursively traverses a parsed JSON object, invoking the
									// `callback` function for each value. This is an implementation of the
									// `Walk(holder, name)` operation defined in ES 5.1 section 15.12.2.
									var walk = function walk(source, property, callback) {
										var value = source[property],
										    length;
										if ((typeof value === "undefined" ? "undefined" : _typeof(value)) == "object" && value) {
											// `forEach` can't be used to traverse an array in Opera <= 8.54
											// because its `Object#hasOwnProperty` implementation returns `false`
											// for array indices (e.g., `![1, 2, 3].hasOwnProperty("0")`).
											if (getClass.call(value) == arrayClass) {
												for (length = value.length; length--;) {
													update(value, length, callback);
												}
											} else {
												_forEach(value, function (property) {
													update(value, property, callback);
												});
											}
										}
										return callback.call(source, property, value);
									};

									// Public: `JSON.parse`. See ES 5.1 section 15.12.2.
									exports.parse = function (source, callback) {
										var result, value;
										Index = 0;
										Source = "" + source;
										result = get(lex());
										// If a JSON string contains multiple tokens, it is invalid.
										if (lex() != "$") {
											abort();
										}
										// Reset the parser state.
										Index = Source = null;
										return callback && getClass.call(callback) == functionClass ? walk((value = {}, value[""] = result, value), "", callback) : result;
									};
								}
							}

							exports["runInContext"] = runInContext;
							return exports;
						}

						if (freeExports && !isLoader) {
							// Export for CommonJS environments.
							runInContext(root, freeExports);
						} else {
							// Export for web browsers and JavaScript engines.
							var nativeJSON = root.JSON,
							    previousJSON = root["JSON3"],
							    isRestored = false;

							var JSON3 = runInContext(root, root["JSON3"] = {
								// Public: Restores the original value of the global `JSON` object and
								// returns a reference to the `JSON3` object.
								"noConflict": function noConflict() {
									if (!isRestored) {
										isRestored = true;
										root.JSON = nativeJSON;
										root["JSON3"] = previousJSON;
										nativeJSON = previousJSON = null;
									}
									return JSON3;
								}
							});

							root.JSON = {
								"parse": JSON3.parse,
								"stringify": JSON3.stringify
							};
						}

						// Export for asynchronous module loaders.
						if (isLoader) {
							define(function () {
								return JSON3;
							});
						}
					}).call(this);
				}).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
			}, {}], 51: [function (_dereq_, module, exports) {
				module.exports = toArray;

				function toArray(list, index) {
					var array = [];

					index = index || 0;

					for (var i = index || 0; i < list.length; i++) {
						array[i - index] = list[i];
					}

					return array;
				}
			}, {}] }, {}, [31])(31);
	});
}

cc._RF.pop();
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},["socket-io","AudioMgr","Cocos2dxBridge","GameNetMgr","Global","HTTP","HotUpdate","MahjongMgr","NativeBridge","Net","ReplayMgr","UserMgr","Utils","VoiceMgr","Alert","Chat","CheckBox","CreateRole","CreateRoom","DingQue","Folds","GameOver","GameResult","Hall","History","HuanSanZhang","ImageLoader","JoinGameInput","LoadingLogic","Login","MJGame","MJRoom","NoticeTip","OnBack","PengGangs","PopupMgr","RadioButton","RadioGroupMgr","ReConnect","ReplayCtrl","Seat","Settings","TimePointer","UserInfoShow","Voice","WaitingConnection"]);
