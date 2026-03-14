(function(global){
  'use strict';
  var Remote = {
    match: function(e, vals){
      var key = e.key;
      var code = e.keyCode || e.which;
      var codeName = e.code;
      return vals.indexOf(key) !== -1 || vals.indexOf(code) !== -1 || vals.indexOf(codeName) !== -1;
    },
    action: function(e){
      if(this.match(e, ['ArrowLeft', 37])) return 'left';
      if(this.match(e, ['ArrowRight', 39])) return 'right';
      if(this.match(e, ['ArrowUp', 38])) return 'up';
      if(this.match(e, ['ArrowDown', 40])) return 'down';
      if(this.match(e, ['Enter', 'MediaEnter', 'NumpadEnter', 13])) return 'enter';
      if(this.match(e, ['Escape', 'Back', 'Backspace', 'BrowserBack', 'KeyBack', 8, 27, 461, 10009])) return 'back';
      if(this.match(e, ['MediaPlayPause', 'PlayPause', 'PausePlay', 179])) return 'playpause';
      if(this.match(e, ['MediaPlay', 'KeyMediaPlay', 415])) return 'play';
      if(this.match(e, ['MediaPause', 'KeyMediaPause', 19])) return 'pause';
      if(this.match(e, ['MediaFastForward', 'FastForward', 'NextTrack', 417, 228, 413])) return 'ff';
      if(this.match(e, ['MediaRewind', 'Rewind', 'PreviousTrack', 412, 227, 412])) return 'rw';
      if(this.match(e, ['MediaStop', 'KeyMediaStop', 178])) return 'pause';
      return null;
    },
    bind: function(handler){
      document.addEventListener('keydown', function(e){
        var action = Remote.action(e);
        if(!action) return;
        e.preventDefault();
        handler(action, e);
      }, true);
    }
  };
  global.TVRemote = Remote;
})(window);
