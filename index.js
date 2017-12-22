/*
 * Copyright 2016 Teppo Kurki <teppo.kurki@ıki.fi>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const PLUGIN_ID = 'signalk-stainless-lobster-fridge';
const debug = require('debug')(PLUGIN_ID)
const SerialPort = require('serialport')
const _ = require("lodash")

const keyPrefix = 'environment.inside.refrigerator.'

module.exports = function(app) {
  var plugin = {
  };
  var tempUnits;

  plugin.id = PLUGIN_ID
  plugin.name = "Stainless Lobster Fridge Optimizer"
  plugin.description = "SignalK node server plugin that reads data from a Stainless Lobster Fridge Optimiztier via USB"

  plugin.schema = {
    type: "object",
    properties: {
      device: {
        type: "string",
        title: "USB Device Name",
        default: "/dev/ttyUSB0"
      }
    }
  }
  
  plugin.start = function(options) {

    plugin.serial = new SerialPort(options.device, {
      baudRate: 115200
    })

    plugin.serial.on(
      'open',
      function () {
        const parser = new SerialPort.parsers.Readline()
        plugin.serial.pipe(parser)
        
        parser.on('data', parseData);
      }
    )
    
    
    plugin.serial.on('error', function (err) {
      debug(`error: ${err}`)
    })
    plugin.serial.on('close', function() {
      debug("close")
    })
  }
  
  plugin.stop = function() {
  }

  function parseData(data) {
    debug('Data:', data);
    
    //Output: 0,0,0,0,nan,66.20,nan,24.00,5.00,F,0.02
    if ( data.startsWith("Output: ") ) {
      var parts = data.substring(7).split(',')
      var deltas = []
      
      for ( var i = 0; i < fridgeMappings.length; i++ ) {
        var mappings = fridgeMappings[i]

        if ( !_.isArray(mappings) )
          mappings = [mappings]

        mappings.forEach(mapping => {
          if ( mapping.ignore )
            return

          var theValue = parts[i]

          if ( theValue == 'nan' ) {
            theValue = null;
          } else {
            theValue = mapping.conversion(theValue, parts)
          }
          
          var paths = mapping.path
          if ( !_.isArray(paths) ) {
            paths = [ paths ]
          }
          
          var delta = {
            updates: [
              {
                "$source": "stainless",
                timestamp: (new Date()).toISOString()
              }
            ]
          };
               
          delta.updates[0].values = paths.map(path => {
            return {
              path: path,
              value: theValue
            }
          });

          deltas.push(delta)
        });
      }
      debug(`deltas: ${JSON.stringify(deltas)}`)
      deltas.forEach(delta => {
        app.handleMessage(PLUGIN_ID, delta)
      })
    }
  }

  function convTemperature(value, parts) {
    if ( parts[9] === 'F' ) {
      return (Number(value) + 459.67) * (5.0/9.0)
    } else {
      return Number(value) + 273.15;
    }
  }

  const fridgeMappings = [
    [
      {
        path: keyPrefix + 'compressorStatusNumber',
        conversion: (val) => {
          return _.isUndefined(val) ? null : Number(val)
        }
      },
      {
        path: keyPrefix + 'compressorStatus',
        conversion: (val) => {
          return {
            0: 'off',
            1: 'min',
            2: 'max'
          }[Number(val)] || 'unknown';
        }
      },
    ],
    {
      path: keyPrefix + 'defrostStatus',
      conversion: (val) => {
        return _.isUndefined(val) ? null : Number(val);
      }
    },
    {
      path: keyPrefix + 'boxFan',
      conversion: (val) => {
        return _.isUndefined(val) ? null : Number(val);
      }
    },
    {
      path: keyPrefix + 'compressorFan',
      conversion: (val) => {
        return _.isUndefined(val) ? null : Number(val);
      }
    },
    {
      path: keyPrefix + 'temperature',
      conversion: convTemperature
    },
    {
      path: keyPrefix + 'controllerTemperature',
      conversion: convTemperature
    },
    {
      path: keyPrefix + 'relativeHumidity',
      conversion: (val) => { return Number(val) / 100 }
    },
    {
      path: keyPrefix + 'controllerHumidity',
      conversion: (val) => { return Number(val) / 100 }
    },
    {
      path: keyPrefix + 'voltage',
      conversion: (val) => { return Number(val) }
    },
    {
      //temperature units
      ignore: true
    },
    {
      path: keyPrefix + 'current',
      conversion: (val) => { return Number(val) }
    }
  ];

  return plugin
}
