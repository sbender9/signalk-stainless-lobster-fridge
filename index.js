/*
 * Copyright 2017 Scott Bender <scott@scottbender.net>
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
const SerialPort = require('serialport')
const _ = require("lodash")

const keyPrefix = 'environment.'

module.exports = function(app) {
  var plugin = {
  };
  var tempUnits;
  var statusMessage

  plugin.id = PLUGIN_ID
  plugin.name = "Stainless Lobster Fridge Optimizer"
  plugin.description = "SignalK node server plugin that reads data from a Stainless Lobster Fridge Optimiztier via USB"

  plugin.schema = {
    type: "object",
    properties: {
      devices: {
        type: 'array',
        title: 'Devices',
        items: {
          type: 'object',
          properties: {
            usbDevice: {
              type: "string",
              title: "USB Device Name",
              default: "/dev/ttyUSB0"
            },
            key: {
              type: "string",
              title: "Signal K Key",
              description: "This is used to build the path in Signal K. It will be appended to 'environment'",
              default: "inside.refrigerator"
            }
          }
        }
      }
    }
  }

  const setProviderStatus = app.setProviderStatus
        ? (msg) => {
          app.setProviderStatus(msg)
          statusMessage = msg
        } : (msg) => { statusMessage = msg }

  const setProviderError = app.setProviderError
        ? (msg) => {
          app.setProviderError(msg)
          statusMessage = `error: ${msg}`
        } : (msg, type) => { statusMessage = `error: ${msg}` }
    
  plugin.start = function(options) {
    plugin.reconnectDelay = 1000
    let devices
    if ( !options.devices && options.device ) {
      devices = [ { key: 'inside.refrigerator', usbDevice: options.device } ]
    } else {
      devices = options.devices
    }

    plugin.serialPorts = []
    devices.forEach((device, index) => {
      plugin.connect(device.usbDevice, device.key, index)
    })
  }

  plugin.connect = function(usbDevice, key, index) {
    console.log(`connecting to ${usbDevice}:${key}:${index}`)
    try {
      let serial = new SerialPort(usbDevice, {
        baudRate: 115200
      })
      plugin.serialPorts[index] = serial

      serial.on(
        'open',
        function () {
          const parser = new SerialPort.parsers.Readline()
          serial.pipe(parser)
          plugin.reconnectDelay = 1000
          
          parser.on('data', data => {
            parseData(key, data)
          });
          setProviderStatus('Connected, wating for data...')
        }
      )
      
      
      serial.on('error', function (err) {
        app.error(err.toString())
        setProviderError(err.toString())
        scheduleReconnect(usbDevice, key, index)
      })
      serial.on('close', function() {
        app.debug("closed")
        scheduleReconnect(usbDevice, key, index)
      })
    } catch ( err ) {
      app.error(err)
      setProviderError(err.message)
      scheduleReconnect(usbDevice, key, index)
    }
  }

  function scheduleReconnect(usbDevice, key, index) {
    plugin.reconnectDelay *= plugin.reconnectDelay < 60 * 1000 ? 1.5 : 1
    const msg = `Not connected (retry delay ${(
    plugin.reconnectDelay / 1000
  ).toFixed(0)} s)`
    console.log(msg)
    setProviderError(msg)
    setTimeout(plugin.connect.bind(plugin, usbDevice, key, index), plugin.reconnectDelay)
  }


  plugin.statusMessage = () => {
    return statusMessage
  }
  
  plugin.stop = function() {
    if ( plugin.serialPorts ) {
      plugin.serialPorts.forEach(serial => {
        serial.close()
      })
    }
  }

  function parseData(key, data) {
    app.debug('Data:', data);
    
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
              path: keyPrefix + key + '.' + path,
              value: theValue
            }
          });

          deltas.push(delta)
        });
      }
      app.debug(`deltas: ${JSON.stringify(deltas)}`)
      deltas.forEach(delta => {
        app.handleMessage(PLUGIN_ID, delta)
      })
      setProviderStatus('Connected and receiving data')
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
        path: 'compressorStatusNumber',
        conversion: (val) => {
          return _.isUndefined(val) ? null : Number(val)
        }
      },
      {
        path: 'compressorStatus',
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
      path: 'defrostStatus',
      conversion: (val) => {
        return _.isUndefined(val) ? null : Number(val);
      }
    },
    {
      path: 'boxFan',
      conversion: (val) => {
        return _.isUndefined(val) ? null : Number(val);
      }
    },
    {
      path: 'compressorRoomFan',
      conversion: (val) => {
        return _.isUndefined(val) ? null : Number(val);
      }
    },
    {
      path: 'temperature',
      conversion: convTemperature
    },
    {
      path: 'controllerTemperature',
      conversion: convTemperature
    },
    {
      path: 'relativeHumidity',
      conversion: (val) => { return Number(val) / 100 }
    },
    {
      path: 'controllerHumidity',
      conversion: (val) => { return Number(val) / 100 }
    },
    {
      path: 'voltage',
      conversion: (val) => { return Number(val) }
    },
    {
      //temperature units
      ignore: true
    },
    {
      path: 'current',
      conversion: (val) => { return Number(val) }
    }
  ];

  return plugin
}
