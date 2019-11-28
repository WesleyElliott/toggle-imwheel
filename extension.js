/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */
const St = imports.gi.St;
const Main = imports.ui.main;
const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu; 
const Clutter = imports.gi.Clutter;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;

const KeyManager = new Lang.Class({
  Name: 'MyKeyManager',

  _init: function() {
      this.grabbers = new Map()

      global.display.connect(
          'accelerator-activated',
          Lang.bind(this, function(display, action, deviceId, timestamp){
              log('Accelerator Activated: [display={}, action={}, deviceId={}, timestamp={}]',
                  display, action, deviceId, timestamp)
              this._onAccelerator(action)
          }))
  },

  listenFor: function(accelerator, callback){
      log('Trying to listen for hot key [accelerator={}]', accelerator)
      let action = global.display.grab_accelerator(accelerator, 0);

      if(action == Meta.KeyBindingAction.NONE) {
          log('Unable to grab accelerator [binding={}]', accelerator)
      } else {
          log('Grabbed accelerator [action={}]', action)
          let name = Meta.external_binding_name_for_action(action)
          log('Received binding name for action [name={}, action={}]',
              name, action)

          log('Requesting WM to allow binding [name={}]', name)
          Main.wm.allowKeybinding(name, Shell.ActionMode.ALL)

          this.grabbers.set(action, {
              name: name,
              accelerator: accelerator,
              callback: callback,
              action: action
          })
      }

  },

  _onAccelerator: function(action) {
      let grabber = this.grabbers.get(action)

      if(grabber) {
          this.grabbers.get(action).callback()
      } else {
          log('No listeners [action={}]', action)
      }
  }
});

const ImWheelStatusIndicator = new Lang.Class({
  Name: 'ImWheelStatusIndicator', Extends: PanelMenu.Button,

  _init: function() {
    this.keyManager = new KeyManager();
    this.parent(0.0, "ImWheel Status Indicator", false);
    this.buttonText = new St.Label({
      text: "Text",
      y_align: Clutter.ActorAlign.CENTER,
    });
    this.actor.add_actor(this.buttonText);
    this._refresh();
    var self = this;

    this.keyManager.listenFor("<meta><shift>1", function() {
      self._toggleImWheel();
      self._delayLoadInfo();
    });
  },

  _refresh: function() {
    this._loadInfo();
    return true;
  },

  _delayLoadInfo: function() {
    this._removeTimeout();
    this._timeout = Mainloop.timeout_add(200, Lang.bind(this, this._loadInfo));
  },

  _loadInfo: function() {
    let isRunning = GLib.spawn_command_line_sync("pgrep imwheel")[1].toString();
    if (isRunning) {
      global.log("RUNNING");
      this.buttonText.set_text("M");
    } else {
      global.log("NOT RUNNING");
      this.buttonText.set_text("T");
    }

    this._removeTimeout();
  },

  _toggleImWheel: function() {
    Util.spawn(['bash', '-c', '$HOME/.scripts/toggle_imwheel.sh']);
  },

  _removeTimeout: function() {
    if (this._timeout) {
      Mainloop.source_remove(this._timeout);
      this._timeout = null;
    }
  },

  stop: function() {
    if (this._timeout) {
      Mainloop.source_remove(this._timeout);
      this._timeout = undefined;
    }

    this.menu.removeAll();

    for (let it of this.keyManager.grabbers) {
      global.display.ungrab_accelerator(it[1].action)
      Main.wm.allowKeybinding(it[1].name, Shell.ActionMode.NONE)
    }
  }
});

class Extension {
  constructor() {
  }

  enable() {
    this.imwheelStatusIndicator = new ImWheelStatusIndicator();
    Main.panel.addToStatusArea('imwheel-indicator', this.imwheelStatusIndicator);
  }

  disable() {
    this.imwheelStatusIndicator.stop();
    this.imwheelStatusIndicator.destroy();
  }
}

function init() {
  return new Extension();
}
