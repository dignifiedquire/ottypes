// This is a prelude which comes before the JS blob of each JS type for the web.
(function(){
  var module = {exports:{}};
  var exports = module.exports;

/*
 This is the implementation of the JSON OT type.

 Spec is here: https://github.com/josephg/ShareJS/wiki/JSON-Operations

 Note: This is being made obsolete. It will soon be replaced by the JSON2 type.
*/

/**
 * UTILITY FUNCTIONS
 */

/**
 * Checks if the passed object is an Array instance. Can't use Array.isArray
 * yet because its not supported on IE8.
 *
 * @param obj
 * @returns {boolean}
 */
var isArray = function(obj) {
  return Object.prototype.toString.call(obj) == '[object Array]';
};

/**
 * Clones the passed object using JSON serialization (which is slow).
 *
 * hax, copied from test/types/json. Apparently this is still the fastest way
 * to deep clone an object, assuming we have browser support for JSON.  @see
 * http://jsperf.com/cloning-an-object/12
 */
var clone = function(o) {
  return JSON.parse(JSON.stringify(o));
};



/**
 * Reference to the Text OT type. This is used for the JSON String operations.
 * @type {*}
 */
var text = typeof require !== "undefined" ? require('./text-old') : window.ottypes.text;



/**
 * JSON OT Type
 * @type {*}
 */
var json = { 
  name: 'json0',
  uri: 'http://sharejs.org/types/JSONv0'
};

json.create = function(data) {
  // Null instead of undefined if you don't pass an argument.
  return data === undefined ? null : data;
};

json.invertComponent = function(c) {
  var c_ = {p: c.p};

  if (c.si !== void 0) c_.sd = c.si;
  if (c.sd !== void 0) c_.si = c.sd;
  if (c.oi !== void 0) c_.od = c.oi;
  if (c.od !== void 0) c_.oi = c.od;
  if (c.li !== void 0) c_.ld = c.li;
  if (c.ld !== void 0) c_.li = c.ld;
  if (c.na !== void 0) c_.na = -c.na;

  if (c.lm !== void 0) {
    c_.lm = c.p[c.p.length-1];
    c_.p = c.p.slice(0,c.p.length-1).concat([c.lm]);
  }

  return c_;
};

json.invert = function(op) {
  var op_ = op.slice().reverse();
  var iop = [];
  for (var i = 0; i < op_.length; i++) {
    iop.push(json.invertComponent(op_[i]));
  }
  return iop;
};

json.checkValidOp = function(op) {
  for (var i = 0; i < op.length; i++) {
  if (!isArray(op[i].p))
    throw new Error('Missing path');
  }
};

json.checkList = function(elem) {
  if (!isArray(elem))
    throw new Error('Referenced element not a list');
};

json.checkObj = function(elem) {
  if (elem.constructor !== Object) {
    throw new Error("Referenced element not an object (it was " + JSON.stringify(elem) + ")");
  }
};

json.apply = function(snapshot, op) {
  json.checkValidOp(op);

  op = clone(op);

  var container = {
    data: snapshot
  };

  for (var i = 0; i < op.length; i++) {
    var c = op[i];

    var parent = null;
    var parentKey = null;
    var elem = container;
    var key = 'data';

    for (var j = 0; j < c.p.length; j++) {
      var p = c.p[j];

      parent = elem;
      parentKey = key;
      elem = elem[key];
      key = p;

      if (parent == null)
        throw new Error('Path invalid');
    }

    // Number add
    if (c.na !== void 0) {
      if (typeof elem[key] != 'number')
        throw new Error('Referenced element not a number');

      elem[key] += c.na;
    }

    else

    // String insert
    if (c.si !== void 0) {
      if (typeof elem != 'string')
        throw new Error('Referenced element not a string (it was '+JSON.stringify(elem)+')');

      parent[parentKey] = elem.slice(0,key) + c.si + elem.slice(key);
    }

    else

    // String delete
    if (c.sd !== void 0) {
      if (typeof elem != 'string')
        throw new Error('Referenced element not a string');

      if (elem.slice(key,key + c.sd.length) !== c.sd)
        throw new Error('Deleted string does not match');

      parent[parentKey] = elem.slice(0,key) + elem.slice(key + c.sd.length);
    }

    else

    // List replace
    if (c.li !== void 0 && c.ld !== void 0) {
      json.checkList(elem);
      // Should check the list element matches c.ld
      elem[key] = c.li;
    }

    else

    // List insert
    if (c.li !== void 0) {
      json.checkList(elem);
      elem.splice(key,0, c.li);
    }

    else

    // List delete
    if (c.ld !== void 0) {
      json.checkList(elem);
      // Should check the list element matches c.ld here too.
      elem.splice(key,1);
    }

    else

    // List move
    if (c.lm !== void 0) {
      json.checkList(elem);
      if (c.lm != key) {
        var e = elem[key];
        // Remove it...
        elem.splice(key,1);
        // And insert it back.
        elem.splice(c.lm,0,e);
      }
    }

    else

    // Object insert / replace
    if (c.oi !== void 0) {
      json.checkObj(elem);

      // Should check that elem[key] == c.od
      elem[key] = c.oi;
    }

    else

    // Object delete
    if (c.od !== void 0) {
      json.checkObj(elem);

      // Should check that elem[key] == c.od
      delete elem[key];
    }

    else {
      throw new Error('invalid / missing instruction in op');
    }
  }

  return container.data;
};

// Helper for incrementally applying an operation to a snapshot. Calls yield
// after each op component has been applied.
json.incrementalApply = function(snapshot, op, _yield) {
  for (var i = 0; i < op.length; i++) {
    var smallOp = [op[i]];
    snapshot = json.apply(snapshot, smallOp);
    // I'd just call this yield, but thats a reserved keyword. Bah!
    _yield(smallOp, snapshot);
  }
  
  return snapshot;
};

// Checks if two paths, p1 and p2 match.
json.pathMatches = function(p1, p2, ignoreLast) {
  if (p1.length != p2.length)
    return false;

  for (var i = 0; i < p1.length; i++) {
    if (p1[i] !== p2[i] && (!ignoreLast || i !== p1.length - 1))
      return false;
  }

  return true;
};

var _convertToTextComponent = function(component) {
  var newC = {p: component.p[component.p.length - 1]};
  if (component.si != null) {
    newC.i = component.si;
  } else {
    newC.d = component.sd;
  }
  return newC;
};

json.append = function(dest,c) {
  c = clone(c);

  var last;

  if (dest.length != 0 && json.pathMatches(c.p, (last = dest[dest.length - 1]).p)) {
    if (last.na != null && c.na != null) {
      dest[dest.length - 1] = {p: last.p, na: last.na + c.na};
    } else if (last.li !== undefined && c.li === undefined && c.ld === last.li) {
      // insert immediately followed by delete becomes a noop.
      if (last.ld !== undefined) {
        // leave the delete part of the replace
        delete last.li;
      } else {
        dest.pop();
      }
    } else if (last.od !== undefined && last.oi === undefined && c.oi !== undefined && c.od === undefined) {
      last.oi = c.oi;
    } else if (c.lm !== undefined && c.p[c.p.length - 1] === c.lm) {
      // don't do anything
    } else {
      dest.push(c);
    }
  } else if (dest.length != 0 && json.pathMatches(c.p, last.p, true)) {
    if ((c.si != null || c.sd != null) && (last.si != null || last.sd != null)) {
      // Try to compose the string ops together using text's equivalent methods
      var textOp = [_convertToTextComponent(last)];
      text._append(textOp, _convertToTextComponent(c));
      
      // Then convert back.
      if (textOp.length !== 1) {
        dest.push(c);
      } else {
        var textC = textOp[0];
        last.p[last.p.length - 1] = textC.p;
        if (textC.i != null)
          last.si = textC.i;
        else
          last.sd = textC.d;
      }
    } else {
      dest.push(c);
    }
  } else {
    dest.push(c);
  }
};

json.compose = function(op1,op2) {
  json.checkValidOp(op1);
  json.checkValidOp(op2);

  var newOp = clone(op1);

  for (var i = 0; i < op2.length; i++) {
    json.append(newOp,op2[i]);
  }

  return newOp;
};

json.normalize = function(op) {
  var newOp = [];

  op = isArray(op) ? op : [op];

  for (var i = 0; i < op.length; i++) {
    var c = op[i];
    if (c.p == null)
      c.p = [];
    json.append(newOp,c);
  }

  return newOp;
};

// Returns true if an op at otherPath may affect an op at path
json.canOpAffectOp = function(otherPath,path) {
  if (otherPath.length === 0)
    return true;

  if (path.length === 0)
    return false;

  path = path.slice(0,path.length - 1);
  otherPath = otherPath.slice(0,otherPath.length - 1);

  for (var i = 0; i < otherPath.length; i++) {
    var p = otherPath[i];
    if (i >= path.length)
      return false;
    if (p != path[i])
      return false;
  }

  // Same
  return true;
};

// transform c so it applies to a document with otherC applied.
json.transformComponent = function(dest, c, otherC, type) {
  c = clone(c);

  if (c.na !== void 0)
    c.p.push(0);

  if (otherC.na !== void 0)
    otherC.p.push(0);

  var common;
  if (json.canOpAffectOp(otherC.p, c.p))
    common = otherC.p.length - 1;

  var common2;
  if (json.canOpAffectOp(c.p,otherC.p))
    common2 = c.p.length - 1;

  var cplength = c.p.length;
  var otherCplength = otherC.p.length;

  if (c.na !== void 0) // hax
    c.p.pop();

  if (otherC.na !== void 0)
    otherC.p.pop();

  if (otherC.na) {
    if (common2 != null && otherCplength >= cplength && otherC.p[common2] == c.p[common2]) {
      if (c.ld !== void 0) {
        var oc = clone(otherC);
        oc.p = oc.p.slice(cplength);
        c.ld = json.apply(clone(c.ld),[oc]);
      } else if (c.od !== void 0) {
        var oc = clone(otherC);
        oc.p = oc.p.slice(cplength);
        c.od = json.apply(clone(c.od),[oc]);
      }
    }
    json.append(dest,c);
    return dest;
  }

  // if c is deleting something, and that thing is changed by otherC, we need to
  // update c to reflect that change for invertibility.
  // TODO this is probably not needed since we don't have invertibility
  if (common2 != null && otherCplength > cplength && c.p[common2] == otherC.p[common2]) {
    if (c.ld !== void 0) {
      var oc = clone(otherC);
      oc.p = oc.p.slice(cplength);
      c.ld = json.apply(clone(c.ld),[oc]);
    } else if (c.od !== void 0) {
      var oc = clone(otherC);
      oc.p = oc.p.slice(cplength);
      c.od = json.apply(clone(c.od),[oc]);
    }
  }

  if (common != null) {
    var commonOperand = cplength == otherCplength;

    // transform based on otherC
    if (otherC.na !== void 0) {
      // this case is handled above due to icky path hax
    } else if (otherC.si !== void 0 || otherC.sd !== void 0) {
      // String op vs string op - pass through to text type
      if (c.si !== void 0 || c.sd !== void 0) {
        if (!commonOperand)
          throw new Error('must be a string?');

        // Convert an op component to a text op component

        var tc1 = _convertToTextComponent(c);
        var tc2 = _convertToTextComponent(otherC);

        var res = [];

        text._tc(res, tc1, tc2, type);
        for (var i = 0; i < res.length; i++) {
          var tc = res[i];
          var jc = {
            p: c.p.slice(0, common)
          };
          jc.p.push(tc.p);
          if (tc.i != null)
            jc.si = tc.i;
          if (tc.d != null)
            jc.sd = tc.d;
          json.append(dest, jc);
        }
        return dest;
      }
    } else if (otherC.li !== void 0 && otherC.ld !== void 0) {
      if (otherC.p[common] === c.p[common]) {
        // noop

        if (!commonOperand) {
          return dest;
        } else if (c.ld !== void 0) {
          // we're trying to delete the same element, -> noop
          if (c.li !== void 0 && type === 'left') {
            // we're both replacing one element with another. only one can survive
            c.ld = clone(otherC.li);
          } else {
            return dest;
          }
        }
      }
    } else if (otherC.li !== void 0) {
      if (c.li !== void 0 && c.ld === undefined && commonOperand && c.p[common] === otherC.p[common]) {
        // in li vs. li, left wins.
        if (type === 'right')
          c.p[common]++;
      } else if (otherC.p[common] <= c.p[common]) {
        c.p[common]++;
      }

      if (c.lm !== void 0) {
        if (commonOperand) {
          // otherC edits the same list we edit
          if (otherC.p[common] <= c.lm)
            c.lm++;
          // changing c.from is handled above.
        }
      }
    } else if (otherC.ld !== void 0) {
      if (c.lm !== void 0) {
        if (commonOperand) {
          if (otherC.p[common] === c.p[common]) {
            // they deleted the thing we're trying to move
            return dest;
          }
          // otherC edits the same list we edit
          var p = otherC.p[common];
          var from = c.p[common];
          var to = c.lm;
          if (p < to || (p === to && from < to))
            c.lm--;

        }
      }

      if (otherC.p[common] < c.p[common]) {
        c.p[common]--;
      } else if (otherC.p[common] === c.p[common]) {
        if (otherCplength < cplength) {
          // we're below the deleted element, so -> noop
          return dest;
        } else if (c.ld !== void 0) {
          if (c.li !== void 0) {
            // we're replacing, they're deleting. we become an insert.
            delete c.ld;
          } else {
            // we're trying to delete the same element, -> noop
            return dest;
          }
        }
      }

    } else if (otherC.lm !== void 0) {
      if (c.lm !== void 0 && cplength === otherCplength) {
        // lm vs lm, here we go!
        var from = c.p[common];
        var to = c.lm;
        var otherFrom = otherC.p[common];
        var otherTo = otherC.lm;
        if (otherFrom !== otherTo) {
          // if otherFrom == otherTo, we don't need to change our op.

          // where did my thing go?
          if (from === otherFrom) {
            // they moved it! tie break.
            if (type === 'left') {
              c.p[common] = otherTo;
              if (from === to) // ugh
                c.lm = otherTo;
            } else {
              return dest;
            }
          } else {
            // they moved around it
            if (from > otherFrom)
              c.p[common]--;
            if (from > otherTo) {
              c.p[common]++;
            } else if (from === otherTo) {
              if (otherFrom > otherTo) {
                c.p[common]++;
                if (from === to) // ugh, again
                  c.lm++;
              }
            }

            // step 2: where am i going to put it?
            if (to > otherFrom) {
              c.lm--;
            } else if (to === otherFrom) {
              if (to > from)
                c.lm--;
            }
            if (to > otherTo) {
              c.lm++;
            } else if (to === otherTo) {
              // if we're both moving in the same direction, tie break
              if ((otherTo > otherFrom && to > from) ||
                  (otherTo < otherFrom && to < from)) {
                if (type === 'right')
                  c.lm++;
              } else {
                if (to > from)
                  c.lm++;
                else if (to === otherFrom)
                  c.lm--;
              }
            }
          }
        }
      } else if (c.li !== void 0 && c.ld === undefined && commonOperand) {
        // li
        var from = otherC.p[common];
        var to = otherC.lm;
        p = c.p[common];
        if (p > from)
          c.p[common]--;
        if (p > to)
          c.p[common]++;
      } else {
        // ld, ld+li, si, sd, na, oi, od, oi+od, any li on an element beneath
        // the lm
        //
        // i.e. things care about where their item is after the move.
        var from = otherC.p[common];
        var to = otherC.lm;
        p = c.p[common];
        if (p === from) {
          c.p[common] = to;
        } else {
          if (p > from)
            c.p[common]--;
          if (p > to) {
            c.p[common]++;
          } else if (p === to) {
            if (from > to)
              c.p[common]++;
          }
        }
      }
    }
    else if (otherC.oi !== void 0 && otherC.od !== void 0) {
      if (c.p[common] === otherC.p[common]) {
        if (c.oi !== void 0 && commonOperand) {
          // we inserted where someone else replaced
          if (type === 'right') {
            // left wins
            return dest;
          } else {
            // we win, make our op replace what they inserted
            c.od = otherC.oi;
          }
        } else {
          // -> noop if the other component is deleting the same object (or any parent)
          return dest;
        }
      }
    } else if (otherC.oi !== void 0) {
      if (c.oi !== void 0 && c.p[common] === otherC.p[common]) {
        // left wins if we try to insert at the same place
        if (type === 'left') {
          json.append(dest,{p: c.p, od:otherC.oi});
        } else {
          return dest;
        }
      }
    } else if (otherC.od !== void 0) {
      if (c.p[common] == otherC.p[common]) {
        if (!commonOperand)
          return dest;
        if (c.oi !== void 0) {
          delete c.od;
        } else {
          return dest;
        }
      }
    }
  }

  json.append(dest,c);
  return dest;
};

if (typeof require !== "undefined") {
  require('./helpers')._bootstrapTransform(json, json.transformComponent, json.checkValidOp, json.append);
} else {
  // This is kind of awful - come up with a better way to hook this helper code up.
  exports._bootstrapTransform(json, json.transformComponent, json.checkValidOp, json.append);
}

module.exports = json;
// Generated by CoffeeScript 1.6.2
var append, checkValidComponent, checkValidOp, invertComponent, strInject, text, transformComponent, transformPosition;

text = {
  name: 'text-old',
  uri: 'http://sharejs.org/types/textv0',
  create: function() {
    return '';
  }
};

strInject = function(s1, pos, s2) {
  return s1.slice(0, pos) + s2 + s1.slice(pos);
};

checkValidComponent = function(c) {
  var d_type, i_type;

  if (typeof c.p !== 'number') {
    throw new Error('component missing position field');
  }
  i_type = typeof c.i;
  d_type = typeof c.d;
  if (!((i_type === 'string') ^ (d_type === 'string'))) {
    throw new Error('component needs an i or d field');
  }
  if (!(c.p >= 0)) {
    throw new Error('position cannot be negative');
  }
};

checkValidOp = function(op) {
  var c, _i, _len;

  for (_i = 0, _len = op.length; _i < _len; _i++) {
    c = op[_i];
    checkValidComponent(c);
  }
  return true;
};

text.apply = function(snapshot, op) {
  var component, deleted, _i, _len;

  checkValidOp(op);
  for (_i = 0, _len = op.length; _i < _len; _i++) {
    component = op[_i];
    if (component.i != null) {
      snapshot = strInject(snapshot, component.p, component.i);
    } else {
      deleted = snapshot.slice(component.p, component.p + component.d.length);
      if (component.d !== deleted) {
        throw new Error("Delete component '" + component.d + "' does not match deleted text '" + deleted + "'");
      }
      snapshot = snapshot.slice(0, component.p) + snapshot.slice(component.p + component.d.length);
    }
  }
  return snapshot;
};

text._append = append = function(newOp, c) {
  var last, _ref, _ref1;

  if (c.i === '' || c.d === '') {
    return;
  }
  if (newOp.length === 0) {
    return newOp.push(c);
  } else {
    last = newOp[newOp.length - 1];
    if ((last.i != null) && (c.i != null) && (last.p <= (_ref = c.p) && _ref <= (last.p + last.i.length))) {
      return newOp[newOp.length - 1] = {
        i: strInject(last.i, c.p - last.p, c.i),
        p: last.p
      };
    } else if ((last.d != null) && (c.d != null) && (c.p <= (_ref1 = last.p) && _ref1 <= (c.p + c.d.length))) {
      return newOp[newOp.length - 1] = {
        d: strInject(c.d, last.p - c.p, last.d),
        p: c.p
      };
    } else {
      return newOp.push(c);
    }
  }
};

text.compose = function(op1, op2) {
  var c, newOp, _i, _len;

  checkValidOp(op1);
  checkValidOp(op2);
  newOp = op1.slice();
  for (_i = 0, _len = op2.length; _i < _len; _i++) {
    c = op2[_i];
    append(newOp, c);
  }
  return newOp;
};

text.compress = function(op) {
  return text.compose([], op);
};

text.normalize = function(op) {
  var c, newOp, _i, _len, _ref;

  newOp = [];
  if ((op.i != null) || (op.p != null)) {
    op = [op];
  }
  for (_i = 0, _len = op.length; _i < _len; _i++) {
    c = op[_i];
    if ((_ref = c.p) == null) {
      c.p = 0;
    }
    append(newOp, c);
  }
  return newOp;
};

transformPosition = function(pos, c, insertAfter) {
  if (c.i != null) {
    if (c.p < pos || (c.p === pos && insertAfter)) {
      return pos + c.i.length;
    } else {
      return pos;
    }
  } else {
    if (pos <= c.p) {
      return pos;
    } else if (pos <= c.p + c.d.length) {
      return c.p;
    } else {
      return pos - c.d.length;
    }
  }
};

text.transformCursor = function(position, op, side) {
  var c, insertAfter, _i, _len;

  insertAfter = side === 'right';
  for (_i = 0, _len = op.length; _i < _len; _i++) {
    c = op[_i];
    position = transformPosition(position, c, insertAfter);
  }
  return position;
};

text._tc = transformComponent = function(dest, c, otherC, side) {
  var cIntersect, intersectEnd, intersectStart, newC, otherIntersect, s;

  checkValidOp([c]);
  checkValidOp([otherC]);
  if (c.i != null) {
    append(dest, {
      i: c.i,
      p: transformPosition(c.p, otherC, side === 'right')
    });
  } else {
    if (otherC.i != null) {
      s = c.d;
      if (c.p < otherC.p) {
        append(dest, {
          d: s.slice(0, otherC.p - c.p),
          p: c.p
        });
        s = s.slice(otherC.p - c.p);
      }
      if (s !== '') {
        append(dest, {
          d: s,
          p: c.p + otherC.i.length
        });
      }
    } else {
      if (c.p >= otherC.p + otherC.d.length) {
        append(dest, {
          d: c.d,
          p: c.p - otherC.d.length
        });
      } else if (c.p + c.d.length <= otherC.p) {
        append(dest, c);
      } else {
        newC = {
          d: '',
          p: c.p
        };
        if (c.p < otherC.p) {
          newC.d = c.d.slice(0, otherC.p - c.p);
        }
        if (c.p + c.d.length > otherC.p + otherC.d.length) {
          newC.d += c.d.slice(otherC.p + otherC.d.length - c.p);
        }
        intersectStart = Math.max(c.p, otherC.p);
        intersectEnd = Math.min(c.p + c.d.length, otherC.p + otherC.d.length);
        cIntersect = c.d.slice(intersectStart - c.p, intersectEnd - c.p);
        otherIntersect = otherC.d.slice(intersectStart - otherC.p, intersectEnd - otherC.p);
        if (cIntersect !== otherIntersect) {
          throw new Error('Delete ops delete different text in the same region of the document');
        }
        if (newC.d !== '') {
          newC.p = transformPosition(newC.p, otherC);
          append(dest, newC);
        }
      }
    }
  }
  return dest;
};

invertComponent = function(c) {
  if (c.i != null) {
    return {
      d: c.i,
      p: c.p
    };
  } else {
    return {
      i: c.d,
      p: c.p
    };
  }
};

text.invert = function(op) {
  var c, _i, _len, _ref, _results;

  _ref = op.slice().reverse();
  _results = [];
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    c = _ref[_i];
    _results.push(invertComponent(c));
  }
  return _results;
};

if (typeof require === 'undefined') {
  exports._bootstrapTransform(text, text.transformComponent, text.checkValidOp, text.append);
} else {
  require('./helpers')._bootstrapTransform(text, text.transformComponent, text.checkValidOp, text.append);
}

module.exports = text;
// Generated by CoffeeScript 1.6.2
exports._bootstrapTransform = function(type, transformComponent, checkValidOp, append) {
  var transformComponentX, transformX;

  transformComponentX = function(left, right, destLeft, destRight) {
    transformComponent(destLeft, left, right, 'left');
    return transformComponent(destRight, right, left, 'right');
  };
  type.transformX = type.transformX = transformX = function(leftOp, rightOp) {
    var k, l, l_, newLeftOp, newRightOp, nextC, r, r_, rightComponent, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref, _ref1;

    checkValidOp(leftOp);
    checkValidOp(rightOp);
    newRightOp = [];
    for (_i = 0, _len = rightOp.length; _i < _len; _i++) {
      rightComponent = rightOp[_i];
      newLeftOp = [];
      k = 0;
      while (k < leftOp.length) {
        nextC = [];
        transformComponentX(leftOp[k], rightComponent, newLeftOp, nextC);
        k++;
        if (nextC.length === 1) {
          rightComponent = nextC[0];
        } else if (nextC.length === 0) {
          _ref = leftOp.slice(k);
          for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
            l = _ref[_j];
            append(newLeftOp, l);
          }
          rightComponent = null;
          break;
        } else {
          _ref1 = transformX(leftOp.slice(k), nextC), l_ = _ref1[0], r_ = _ref1[1];
          for (_k = 0, _len2 = l_.length; _k < _len2; _k++) {
            l = l_[_k];
            append(newLeftOp, l);
          }
          for (_l = 0, _len3 = r_.length; _l < _len3; _l++) {
            r = r_[_l];
            append(newRightOp, r);
          }
          rightComponent = null;
          break;
        }
      }
      if (rightComponent != null) {
        append(newRightOp, rightComponent);
      }
      leftOp = newLeftOp;
    }
    return [leftOp, newRightOp];
  };
  return type.transform = type['transform'] = function(op, otherOp, type) {
    if (!(type === 'left' || type === 'right')) {
      throw new Error("type must be 'left' or 'right'");
    }
    if (otherOp.length === 0) {
      return op;
    }
    if (op.length === 1 && otherOp.length === 1) {
      return transformComponent([], op[0], otherOp[0], type);
    }
    if (type === 'left') {
      return transformX(op, otherOp)[0];
    } else {
      return transformX(otherOp, op)[1];
    }
  };
};
// This is included after the JS for each type when we build for the web.

  var _types = window.ottypes = window.ottypes || {};
  var _t = module.exports;
  _types[_t.name] = _t;

  if (_t.uri) _types[_t.uri] = _t;
})();
