// Helper functions for color conversion for the Tuya lights //

function num2hex(t) {
    let e = Math.abs(t).toString(16);
    for (; e.length < 4;) e = "0" + e;
    if (t < 0) {
        let t = e.split("");
        t = t.map((t => (15 - parseInt(t, 16)).toString(16))), e = t.join("")
    }
    return e
}

function rgb2hsv(t, e, n) {
    t /= 255, e /= 255, n /= 255;
    var r, a, s = Math.max(t, e, n),
        g = Math.min(t, e, n),
        i = s,
        l = s - g;
    if (a = 0 == s ? 0 : l / s, s == g) r = 0;
    else {
        switch (s) {
            case t:
                r = (e - n) / l + (e < n ? 6 : 0);
                break;
            case e:
                r = (n - t) / l + 2;
                break;
            case n:
                r = (t - e) / l + 4;
                break
        }
        r /= 6
    }
    return [r, a, i]
}

function toTuyaColor(hex) {
    var hsv = rgb2hsv(...[
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16)
    ])
    var hex = `${num2hex(Math.round(hsv[0] * 360))}${num2hex(Math.round(hsv[1] * 1000))}${num2hex(Math.round(hsv[2] * 1000))}`;
    return hex;
}

// Main code begins here //

const tuyapi = require('tuyapi');
const path = require('path');

// Has light IDs and keys
const config = JSON.parse(require("fs").readFileSync(path.resolve(__dirname, 'keys.json'), "utf8"));

// Colors class to control the lights
// Functions include specific commands sent to the lights themselves,
// as well as a function to set the color of both lights at once.
// Credentials, IP addresses, and other settings should be validated before use.
class Colors {
    constructor() {
        for (var x in config) {
            if (config[x].device_name == "Alpha") {
                // Set the IP address to the correct one for your device
                // You can find the IP address using the Tuya app or by scanning your network
                this.alpha = new tuyapi({
                    id: config[x].device_id,
                    key: config[x].local_key,
                    ip: "192.168.1.162",
                    version: "3.4",
                    issueRefreshOnConnect: true
                });
            } else if (config[x].device_name == "Beta") {
                // Set the IP address to the correct one for your device
                // You can find the IP address using the Tuya app or by scanning your network
                this.beta = new tuyapi({
                    id: config[x].device_id,
                    key: config[x].local_key,
                    ip: "192.168.1.165",
                    version: "3.4",
                    issueRefreshOnConnect: true
                });
            }
        }

        this.connected = false;
        this.loggers = [];
    }

    connect() {
        return new Promise((resolve, reject) => {
            var connections = 0;

            const connectDevice = (device) => {
                device.find().then(() => {
                    device.connect().then(() => {
                        connections++;

                        if (connections === 2) {
                            this.connected = true;
                            resolve();
                        }
                    }).catch((error) => {
                        reject(error);
                    });
                }).catch((error) => {
                    reject(error);
                });
            };

            connectDevice(this.alpha);
            connectDevice(this.beta);
        });
    }

    setLeftColor(color) {
        return new Promise(async (resolve, reject) => {
            this.alpha.set({
                multiple: true,
                data: {
                    '20': true,
                    '21': 'colour',
                    '22': 1000,
                    '23': 0,
                    '24': toTuyaColor(color),
                    '25': '000e0d0000000000000000c80000',
                    '26': 0,
                    '34': false,
                    '41': true
                }
            })
                .then(() => {
                    this.alpha.set(
                        {
                            dps: '21',
                            set: 'colour'
                        }
                    )
                        .then(() => {
                            resolve();
                        })
                        .catch((error) => {
                            reject(error);
                        })
                })
                .catch((error) => {
                    this.setLeftColor(color)
                    reject(error);
                })
        });
    }

    setRightColor(color) {
        return new Promise(async (resolve, reject) => {
            this.beta.set({
                multiple: true,
                data: {
                    '20': true,
                    '21': 'colour',
                    '22': 1000,
                    '23': 0,
                    '24': toTuyaColor(color),
                    '25': '000e0d0000000000000000c80000',
                    '26': 0,
                    '34': false,
                    '41': true
                }
            })
                .then(() => {
                    // Weird lightbulb? Sometimes goes to white without this or the color is too faint
                    this.beta.set(
                        {
                            dps: '21',
                            set: 'colour'
                        }
                    )
                        .then(() => {
                            resolve();
                        })
                        .catch((error) => {
                            reject(error);
                        })
                })
                .catch((error) => {
                    this.setRightColor(color)
                    reject(error);
                })
        });
    }

    setColor(color) {
        return new Promise((resolve, reject) => {
            for (var x in this.loggers) { this.loggers[x].send(JSON.stringify({ Code: "Log", Data: { Message: "Suey.Server: Color change -> " + color } })) }

            var completions = 0;

            this.setLeftColor(color)
                .then(() => {
                    completions++;

                    if (completions === 2) {
                        resolve();
                    }
                })
                .catch((error) => {
                    reject(error);
                })

            this.setRightColor(color)
                .then(() => {
                    completions++;

                    if (completions === 2) {
                        resolve();
                    }
                })
                .catch((error) => {
                    reject(error);
                })
        });
    }
}

module.exports = Colors;