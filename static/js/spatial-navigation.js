(function(global){
  'use strict';

  var SpatialNavigator = function () {
    this._focus = null;
    this._previous = null;
  };

  SpatialNavigator.prototype = {
    straightOnly: true,
    straightOverlapThreshold: 0.5,
    ignoreHiddenElement: false,
    rememberSource: false,
    navigableFilter: null,
    silent: false,

    follow: function (type, listener) {
      if (this._listeners === undefined) this._listeners = {};
      var listeners = this._listeners;
      if (listeners[type] === undefined) listeners[type] = [];
      if (listeners[type].indexOf(listener) === -1) listeners[type].push(listener);
    },

    on: function (type, listener) {
      this.follow(type, listener);
    },

    hasListener: function (type, listener) {
      if (this._listeners === undefined) return false;
      var listeners = this._listeners;
      return listeners[type] !== undefined && listeners[type].indexOf(listener) !== -1;
    },

    removeListener: function (type, listener) {
      if (this._listeners === undefined) return;
      var listeners = this._listeners;
      var list = listeners[type];
      if (list !== undefined) {
        var index = list.indexOf(listener);
        if (index !== -1) list.splice(index, 1);
      }
    },

    send: function (type, event) {
      if (this._listeners === undefined) return;
      var listeners = this._listeners;
      var list = listeners[type];
      if (list !== undefined) {
        event.target = this;
        var array = list.slice(0);
        for (var i = 0, l = array.length; i < l; i++) {
          array[i].call(this, event);
        }
      }
    },

    _getRect: function snGetRect(elem) {
      var rect = null;
      if (!this._isNavigable(elem)) return null;

      if (elem.getBoundingClientRect) {
        var cr = elem.getBoundingClientRect();
        rect = {
          left: cr.left,
          top: cr.top,
          width: cr.width,
          height: cr.height
        };
      } else if (elem.left !== undefined) {
        rect = {
          left: parseInt(elem.left || 0, 10),
          top: parseInt(elem.top || 0, 10),
          width: parseInt(elem.width || 0, 10),
          height: parseInt(elem.height || 0, 10)
        };
      } else {
        return null;
      }

      rect.element = elem;
      rect.right = rect.left + rect.width;
      rect.bottom = rect.top + rect.height;
      rect.center = {
        x: rect.left + Math.floor(rect.width / 2),
        y: rect.top + Math.floor(rect.height / 2)
      };
      rect.center.left = rect.center.right = rect.center.x;
      rect.center.top = rect.center.bottom = rect.center.y;
      return rect;
    },

    _getAllRects: function snGetAllRects(excludedElem) {
      var rects = [];
      this._collection.forEach(function (elem) {
        if (!excludedElem || excludedElem !== elem) {
          var rect = this._getRect(elem);
          if (rect) rects.push(rect);
        }
      }, this);
      return rects;
    },

    _isNavigable: function snIsNavigable(elem) {
      if (this.ignoreHiddenElement && elem instanceof HTMLElement) {
        var computedStyle = window.getComputedStyle(elem);
        if ((elem.offsetWidth <= 0 && elem.offsetHeight <= 0) ||
          computedStyle.getPropertyValue('visibility') === 'hidden' ||
          computedStyle.getPropertyValue('display') === 'none' ||
          elem.hasAttribute('aria-hidden')) {
          return false;
        }
      }
      if (this.navigableFilter && !this.navigableFilter(elem)) return false;
      return true;
    },

    _partition: function snDemarcate(rects, targetRect) {
      var groups = [[], [], [], [], [], [], [], [], []];
      var threshold = this.straightOverlapThreshold;
      if (threshold > 1 || threshold < 0) threshold = 0.5;

      rects.forEach(function (rect) {
        var center = rect.center;
        var x, y, groupId;

        if (center.x < targetRect.left) x = 0;
        else if (center.x <= targetRect.right) x = 1;
        else x = 2;

        if (center.y < targetRect.top) y = 0;
        else if (center.y <= targetRect.bottom) y = 1;
        else y = 2;

        groupId = y * 3 + x;
        groups[groupId].push(rect);

        if ([0, 2, 6, 8].indexOf(groupId) !== -1) {
          if (rect.left <= targetRect.right - targetRect.width * threshold) {
            if (groupId === 2) groups[1].push(rect);
            else if (groupId === 8) groups[7].push(rect);
          }

          if (rect.right >= targetRect.left + targetRect.width * threshold) {
            if (groupId === 0) groups[1].push(rect);
            else if (groupId === 6) groups[7].push(rect);
          }

          if (rect.top <= targetRect.bottom - targetRect.height * threshold) {
            if (groupId === 6) groups[3].push(rect);
            else if (groupId === 8) groups[5].push(rect);
          }

          if (rect.bottom >= targetRect.top + targetRect.height * threshold) {
            if (groupId === 0) groups[3].push(rect);
            else if (groupId === 2) groups[5].push(rect);
          }
        }
      });

      return groups;
    },

    _getDistanceFunction: function snGetDistanceFunction(targetRect) {
      return {
        nearPlumbLineIsBetter: function (rect) {
          var d;
          if (rect.center.x < targetRect.center.x) {
            d = targetRect.center.x - rect.right;
          } else {
            d = rect.left - targetRect.center.x;
          }
          return d < 0 ? 0 : d;
        },
        nearHorizonIsBetter: function (rect) {
          var d;
          if (rect.center.y < targetRect.center.y) {
            d = targetRect.center.y - rect.bottom;
          } else {
            d = rect.top - targetRect.center.y;
          }
          return d < 0 ? 0 : d;
        },
        nearTargetLeftIsBetter: function (rect) {
          var d;
          if (rect.center.x < targetRect.center.x) {
            d = targetRect.left - rect.right;
          } else {
            d = rect.left - targetRect.left;
          }
          return d < 0 ? 0 : d;
        },
        nearTargetTopIsBetter: function (rect) {
          var d;
          if (rect.center.y < targetRect.center.y) {
            d = targetRect.top - rect.bottom;
          } else {
            d = rect.top - targetRect.top;
          }
          return d < 0 ? 0 : d;
        },
        topIsBetter: function (rect) { return rect.top; },
        bottomIsBetter: function (rect) { return -1 * rect.bottom; },
        leftIsBetter: function (rect) { return rect.left; },
        rightIsBetter: function (rect) { return -1 * rect.right; }
      };
    },

    _prioritize: function snPrioritize(priorities, target, direction) {
      var destPriority = priorities.find(function (p) { return !!p.group.length; });
      if (!destPriority) return null;

      if (this.rememberSource &&
          this._previous &&
          target === this._previous.destination &&
          direction === this._previous.reverse) {

        var source = this._previous.source;
        var found = destPriority.group.find(function (dest) {
          return dest.element === source;
        });
        if (found) return found;
      }

      destPriority.group.sort(function (a, b) {
        return destPriority.distance.reduce(function (answer, distance) {
          return answer || (distance(a) - distance(b));
        }, 0);
      });

      return destPriority.group[0];
    },

    setCollection: function snSetCollection(collection) {
      this.unfocus();
      this._collection = [];
      if (collection) this.multiAdd(collection);
    },

    add: function snAdd(elem) {
      var index = this._collection.indexOf(elem);
      if (index >= 0) return false;
      this._collection.push(elem);
      return true;
    },

    multiAdd: function snMultiAdd(elements) {
      return Array.from(elements).every(this.add, this);
    },

    remove: function snRemove(elem) {
      var index = this._collection.indexOf(elem);
      if (index < 0) return false;
      if (this._focus === elem) this.unfocus();
      this._collection.splice(index, 1);
      return true;
    },

    multiRemove: function snMultiRemove(elements) {
      return Array.from(elements).every(this.remove, this);
    },

    focused: function (elem) {
      this._focus = elem;
    },

    focus: function snFocus(elem) {
      if (!elem && this._focus && this._isNavigable(this._focus)) {
        elem = this._focus;
      }

      if (!this._collection) return false;

      if (!elem) {
        var navigableElems = this._collection.filter(this._isNavigable, this);
        if (!navigableElems.length) return false;
        elem = navigableElems[0];
      } else if (this._collection.indexOf(elem) < 0 || !this._isNavigable(elem)) {
        return false;
      }

      this.unfocus();
      this._focus = elem;
      if (!this.silent) this.send('focus', { elem: this._focus });
      return true;
    },

    unfocus: function snUnfocus() {
      if (this._focus) {
        var elem = this._focus;
        this._focus = null;
        if (!this.silent) this.send('unfocus', { elem: elem });
      }
      return true;
    },

    getFocusedElement: function snGetFocusedElement() {
      return this._focus;
    },

    move: function snMove(direction) {
      var reverse = {
        left: 'right',
        up: 'down',
        right: 'left',
        down: 'up'
      };

      if (!this._focus) {
        this._previous = null;
        this.focus();
      } else {
        var elem = this.navigate(this._focus, direction);
        if (!elem) return false;
        if (this.rememberSource) {
          this._previous = {
            source: this._focus,
            destination: elem,
            reverse: reverse[direction.toLowerCase()]
          };
        }
        this.unfocus();
        this.focus(elem);
      }
      return true;
    },

    canmove: function (direction) {
      if (this._focus) {
        var elem = this.navigate(this._focus, direction);
        if (elem !== null) return elem;
      }
      return false;
    },

    navigate: function snNavigate(target, direction) {
      if (!target || !direction || !this._collection) return null;

      direction = direction.toLowerCase();
      var rects = this._getAllRects(target);
      var targetRect = this._getRect(target);
      if (!targetRect || !rects.length) return null;

      var distanceFunction = this._getDistanceFunction(targetRect);
      var groups = this._partition(rects, targetRect);
      var internalGroups = this._partition(groups[4], targetRect.center);

      var priorities;
      switch (direction) {
        case 'left':
          priorities = [
            { group: internalGroups[0].concat(internalGroups[3]).concat(internalGroups[6]),
              distance: [distanceFunction.nearPlumbLineIsBetter, distanceFunction.topIsBetter] },
            { group: groups[3],
              distance: [distanceFunction.nearPlumbLineIsBetter, distanceFunction.topIsBetter] },
            { group: groups[0].concat(groups[6]),
              distance: [distanceFunction.nearHorizonIsBetter, distanceFunction.rightIsBetter, distanceFunction.nearTargetTopIsBetter] }
          ];
          break;
        case 'right':
          priorities = [
            { group: internalGroups[2].concat(internalGroups[5]).concat(internalGroups[8]),
              distance: [distanceFunction.nearPlumbLineIsBetter, distanceFunction.topIsBetter] },
            { group: groups[5],
              distance: [distanceFunction.nearPlumbLineIsBetter, distanceFunction.topIsBetter] },
            { group: groups[2].concat(groups[8]),
              distance: [distanceFunction.nearHorizonIsBetter, distanceFunction.leftIsBetter, distanceFunction.nearTargetTopIsBetter] }
          ];
          break;
        case 'up':
          priorities = [
            { group: internalGroups[0].concat(internalGroups[1]).concat(internalGroups[2]),
              distance: [distanceFunction.nearHorizonIsBetter, distanceFunction.leftIsBetter] },
            { group: groups[1],
              distance: [distanceFunction.nearHorizonIsBetter, distanceFunction.leftIsBetter] },
            { group: groups[0].concat(groups[2]),
              distance: [distanceFunction.nearPlumbLineIsBetter, distanceFunction.bottomIsBetter, distanceFunction.nearTargetLeftIsBetter] }
          ];
          break;
        case 'down':
          priorities = [
            { group: internalGroups[6].concat(internalGroups[7]).concat(internalGroups[8]),
              distance: [distanceFunction.nearHorizonIsBetter, distanceFunction.leftIsBetter] },
            { group: groups[7],
              distance: [distanceFunction.nearHorizonIsBetter, distanceFunction.leftIsBetter] },
            { group: groups[6].concat(groups[8]),
              distance: [distanceFunction.nearPlumbLineIsBetter, distanceFunction.topIsBetter, distanceFunction.nearTargetLeftIsBetter] }
          ];
          break;
        default:
          return null;
      }

      if (this.straightOnly) priorities.pop();
      var dest = this._prioritize(priorities, target, direction);
      if (!dest) return null;
      return dest.element;
    }
  };

  global.TVSpatialNavigator = SpatialNavigator;
})(window);

