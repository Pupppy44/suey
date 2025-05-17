const express = require("express");
const app = express();
require("express-ws")(app);

// Colors module for controlling the lights
const Colors = require("./colors.js");
const colors = new Colors();

// Holders for the connections
var audience = [];
var masters = [];
var sueys = [];
var loggers = [];

// Current state of the show
var currentState = {
    Code: "FreshStart", // FreshStart itself is not a state, but a code 
                        // to indicate that the show is starting from scratch.
    Data: "{}"
};

// Logging system for saving/sending logs
var logs = [];
var log = function(msg) {
    logs.push(msg);
    console.log(msg);

    for (var x in masters) {
        masters[x].send(JSON.stringify({
            Code: "Log",
            Data: {
                Message: msg
            }
        }))
    };

    for (var x in loggers) {
        loggers[x].send(JSON.stringify({
            Code: "Log",
            Data: {
                Message: msg
            }
        }))
    }
};

// This function is called when the show is over.
// It dumps the logs to a file and sets the lights to idle mode.
var dumpLogs = function () {
    require("fs").writeFileSync("logs-" + Math.random().toString(32).slice(2) + ".json", JSON.stringify(logs));
    log("Suey.Server: Dumped logs");

    // Can put idle lights here because logs are only dumped when the show is over
    var currentColor = "#ff0000"
    global.timer = setInterval(() => {
        if (currentState.Code == "Start") clearInterval(timer);
        if (currentColor == "#ff0000") {
            currentColor = "#0000ff";
            colors.setColor(currentColor);
        } else {
            currentColor = "#ff0000";
            colors.setColor(currentColor);
        }
    }, 1500);
}

// Emcee (MC) page
app.get("/mc", function (req, res) {
    res.sendFile(__dirname + "/mc.html");
});

// Logger page
app.get("/logs", function (req, res) {
    res.sendFile(__dirname + "/logs.html");
});

// Audience WebSocket page
// ! Unused, but kept for potential audience interaction
app.ws("/", function (ws, req) {
    audience.push(ws);

    log("Suey.Server: NewConnection -> from Audience");

    ws.on("message", function (msg) {
        log("Suey.Server: Audience -> " + msg);
    });

    ws.on("close", function () {
        audience = audience.filter(x => x !== ws);
    });
});

// Logger WebSocket page
app.ws("/logs", function (ws, req) {
    loggers.push(ws);
    colors.loggers = loggers;

    log("Suey.Server: NewConnection -> from Loggers");

    ws.on("message", function (msg) {
        log("Suey.Server: A logger sent a message...how??");
    });

    ws.on("close", function () {
        loggers = loggers.filter(x => x !== ws);
        colors.loggers = loggers;
    });
});

// Emcee (MC) WebSocket page
app.ws("/mc", function (ws, req) {
    // You can change the key to anything you want, but make sure to update the client code accordingly.
    if (!req.query || req.query.key != "awards") {
        log("Suey.Server: Warning -> MC tried to connect without a valid key");
        return ws.close();
    }

    masters.push(ws);

    log("Suey.Server: NewConnection -> from MC");

    ws.send(JSON.stringify(currentState));

    ws.on("message", function (msg) {
        log("Suey.Server: MC -> " + msg);

        // Validate the message
        var data = JSON.parse(msg);
        JSON.parse(data.Data);

        if (data.Code) {
            if (data.Code == "Start") clearInterval(global.timer);
            if (data.Code == "Stop") dumpLogs();
            if (data.Code == "ReconnectLights") {
                colors = new Colors();
                colors.connect();
                return;
            }

            for (var x in sueys) {
                sueys[x].send(msg);
            }
        }
    });

    ws.on("close", function () {
        masters = masters.filter(x => x !== ws);
    });

    // Ensure everything's good to go
    var check = setInterval(() => {
        if (sueys.length > 0) {
            ws.send(JSON.stringify({
                Code: "Ready",
                Data: "{}"
            }));

            clearInterval(check);
        }
    }, 250);
});

// Extension (PowerPoint) WebSocket page
app.ws("/suey", function (ws, req) {
    if (!req.query || req.query.key != "awards") {
        log("Suey.Server: Warning -> Suey PPT tried to connect without a valid key");
        return ws.close();
    }

    sueys.push(ws);

    log("Suey.Server: NewConnection -> from Suey PPT");

    ws.on("message", function (msg) {
        log("Suey.Server: Suey -> " + msg);

        // ? Validation
        var data = JSON.parse(msg);
        var content = JSON.parse(data.Data);

        currentState = data;

        if (data.For == "MC") {
            for (var x in masters) {
                masters[x].send(msg);
            }
        } else if (data.For == "Audience") {
            for (var x in audience) {
                audience[x].send(msg);
            }
        } else if (data.For == "All") {
            [...audience, ...masters].forEach((c) => {
                c.send(msg);
            });
        }

        // ! Handle color scenes
        // Colors are given as names by the PPT, so we need to convert them to hex.
        // This could need a cleanup if time allows.

        if (data.Code) {
            switch (data.Code) {
                case "SetColor":
                    if (content.Value.startsWith("@")) {
                        if (content.Value == "@KeynoteOne" || content.Value == "@KeynoteTwo" || content.Value == "@Keynote") content.Value = "#0000ff";
                        if (content.Value == "@GameOne") content.Value = "#0000ff";
                        if (content.Value == "@Base") content.Value = "#ffd000";
                        if (content.Value == "@Normal") content.Value = "#ffd000";
                        if (content.Value == "@GameTwo") content.Value = "#00ff00";
                        if (content.Value == "@GameTwoDark") content.Value = "#015c01";
                        if (content.Value == "@Marshal") content.Value = "#fdffcf";
                        if (content.Value == "@SectionStar") content.Value = "#a600ff";
                    }
                    colors.setColor(content.Value);
                    break;
                case "SetLeftColor":
                    colors.setLeftColor(content.Value);
                    break;
                case "SetRightColor":
                    colors.setRightColor(content.Value);
                    break;
                case "SetScene":
                    if (content.Value.includes("Clear")) colors.setColor("#ffd000");

                    // Day 1 Start Color Codes //

                    if (content.Value.includes("CompanyIntro")) colors.setColor("#000000");
                    if (content.Value.includes("Backstage")) colors.setColor("#262300");
                    if (content.Value.includes("AwardsIntro")) colors.setColor("#ffd000");
                    if (content.Value.includes("HowToPlay")) colors.setColor("#000000");
                    if (content.Value.includes("HowToPlay")) colors.setColor("#000000");
                    if (content.Value.includes("SectionOneIntro")) colors.setColor("#595201");
                    if (content.Value.includes("AwardOneIntro")) colors.setColor("#595201");
                    if (content.Value.includes("Nominees")) colors.setColor("#262300");
                    if (content.Value.includes("WinnerDrumroll")) colors.setColor("#000000");

                    if (content.Value.includes("AwardOneWinner")) {
                        colors.setRightColor("#ff0000");
                        colors.setLeftColor("#ff00ff");
                    }

                    if (content.Value.includes("AwardTwoWinner")) {
                        colors.setRightColor("#fffbc4");
                        colors.setLeftColor("#ff6242");
                    }

                    if (content.Value.includes("AwardThreeWinner")) {
                        colors.setRightColor("#ff69ed");
                        colors.setLeftColor("#ff3108");
                    }

                    if (content.Value.includes("AwardFourWinner")) {
                        colors.setRightColor("#ff00ee");
                        colors.setLeftColor("#0000ff");
                    }

                    if (content.Value.includes("Keynote")) colors.setColor("#0000ff");
                    if (content.Value.includes("GameOne")) colors.setColor("#ff6f00");
                    if (content.Value.includes("GameOneWin")) colors.setColor("#00ff00");
                    if (content.Value.includes("SectionTwoIntro")) colors.setColor("#595201");
                    if (content.Value.includes("AwardFiveIntro")) colors.setColor("#595201");

                    if (content.Value.includes("AwardFiveWinner")) {
                        colors.setRightColor("#ff0000");
                        colors.setLeftColor("#ff00ff");
                    }

                    if (content.Value.includes("AwardSixWinner")) {
                        colors.setRightColor("#fffbc4");
                        colors.setLeftColor("#ff6242");
                    }

                    if (content.Value.includes("AwardSevenWinner")) {
                        colors.setRightColor("#ff69ed");
                        colors.setLeftColor("#ff3108");
                    }

                    if (content.Value.includes("AwardEightWinner")) {
                        colors.setRightColor("#0000ff");
                        colors.setLeftColor("#0000ff");
                    }

                    // Day 2 Start Color Codes //

                    if (content.Value.includes("AwardNineWinner")) {
                        colors.setRightColor("#ff0000");
                        colors.setLeftColor("#ff0000");
                    }

                    if (content.Value.includes("AwardTenWinner")) {
                        colors.setRightColor("#0000ff");
                        colors.setLeftColor("#0000ff");
                    }

                    if (content.Value.includes("AwardElevenWinner")) {
                        colors.setRightColor("#fdffcf");
                        colors.setLeftColor("#fdffcf")
                    }

                    if (content.Value.includes("AwardTwelveWinner")) {
                        colors.setRightColor("#ffff00");
                        colors.setLeftColor("#ffff00");
                    }

                    if (content.Value.includes("FOATWinner")) {
                        colors.setRightColor("#ff0000");
                        colors.setLeftColor("#ff00ff");
                    }

                    break;
            }
        };
    });

    ws.on("close", function () {
        sueys = sueys.filter(x => x !== ws);
    });
});

// Even though errors are typically handled in other parts of the code,
// we need to handle uncaught exceptions and unhandled rejections
// to maintain stability and avoid crashing the server.
// This is especially important during an active presentation.

process.on('uncaughtException', (err) => {
    log("Error -> " + err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    log("Error -> " + reason);
});

// The server is started on port 1337.
// This can be changed to any other port,
// but make sure to update the client code accordingly.
app.listen(1337, function () {
    log("Suey.Server: Server is running.");

    colors.connect()
        .then(() => {
            log(`Suey.Server: Connected light bulbs!`);

            // This is the idle state of the lights.
            // They will alternate between red and blue every 1.5 seconds.
            // The idle state is used when the show is not running. You can
            // also find similar code in the dumpLogs function because 
            // the lights are set to idle when the show is over.

            var currentColor = "#ff0000"
            global.timer = setInterval(() => {
                if (currentState.Code == "Start") clearInterval(timer);
                if (currentColor == "#ff0000") {
                    currentColor = "#0000ff";
                    colors.setColor(currentColor);
                } else {
                    currentColor = "#ff0000";
                    colors.setColor(currentColor);
                }
            }, 1500);
        })
        .catch((error) => {
            log("‼️ Suey.Server: Fatal -> Could not connect to all lightbulbs.");
        });
});