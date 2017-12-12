# signalk-stainless-lobster-fridge
SignalK node server plugin that reads data from a Stainless Lobster Fridge Optimiztier via USB

To install, go to the node server App Store or run `npm install signalk-stainless-lobster-fridge`.

Then go to the Plugin Confgiuration in node server, enable it and enter the USB device path for your optimizer.

Example SignalK Full Tree:

```
"electrical" : {
      "refrigeration" : {
         "1" : {
            "voltage" : {
               "timestamp" : "2017-12-12T04:15:27.060Z",
               "$source" : "stainless",
               "value" : 5
            },
            "current" : {
               "value" : 0.02,
               "$source" : "stainless",
               "timestamp" : "2017-12-12T04:15:27.060Z"
            },
            "temperature" : {
               "value" : null,
               "timestamp" : "2017-12-12T04:15:27.059Z",
               "$source" : "stainless"
            },
            "controllerTemperature" : {
               "timestamp" : "2017-12-12T04:15:27.059Z",
               "$source" : "stainless",
               "value" : 290.15
            },
            "compressorFan" : {
               "timestamp" : "2017-12-12T04:15:27.059Z",
               "$source" : "stainless",
               "value" : "not running"
            },
            "humidity" : {
               "$source" : "stainless",
               "timestamp" : "2017-12-12T04:15:27.060Z",
               "value" : null
            },
            "boxFan" : {
               "timestamp" : "2017-12-12T04:15:27.058Z",
               "$source" : "stainless",
               "value" : "not running"
            },
            "controllerHumidity" : {
               "timestamp" : "2017-12-12T04:15:27.060Z",
               "$source" : "stainless",
               "value" : 0.26
            "defrostStatus" : {
               "value" : "not defrosting",
               "timestamp" : "2017-12-12T04:15:27.058Z",
               "$source" : "stainless"
            },
            "compressorStatus" : {
               "value" : "not running",
               "timestamp" : "2017-12-12T04:15:27.057Z",
               "$source" : "stainless"
            }
         }
      }
   }
```
