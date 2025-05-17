<div align="center">
    <img src="https://i.ibb.co/QvjPtjHt/Suey.png" alt="Suey Logo" width="120" />
</div>

# Suey - Real-Time Interactive Presentation System

## About

Suey is a system for enhancing live presentations by enabling real-time interaction between an Emcee, the presentation software (Microsoft PowerPoint), and physical elements like smart lighting. It utilizes a web-based control interface and can control smart home devices, such as LED lights, to create a dynamic and engaging experience.

This project was developed between July and August 2023 for a personal awards show event, demonstrating the integration of desktop automation, web services, WebSocket communication, and hardware control. Suey was open-sourced and further documented in May 2025.

## Core Structure

Suey consists of three main interconnected components:

1.  **PowerPoint Extension (C# VSTO Add-in):**
    * Operates within Microsoft PowerPoint on the presentation machine.
    * Parses "Suey Script" commands embedded in PowerPoint slide object names.
    * Communicates with the Suey Server via WebSockets to send slide events and receive control commands.
    * Triggers local actions (playing sounds) and external commands (lighting changes) based on the parsed Suey Script.

2.  **Suey Server (Node.js & Express.js):**
    * Functions as the central communication hub using `express-ws` for WebSocket connections.
    * Manages connections from the Emcee web interface, the PowerPoint Extension, and Log viewers.
    * Relays commands from the Emcee to the PowerPoint Extension.
    * Receives state updates from PowerPoint and forwards them.
    * Interfaces with smart LED lights via the `colors.js` module (using `tuyapi`) to execute lighting commands based on Suey Script events.
    * Serves static HTML/JS/CSS for the Emcee and Log viewer web interfaces.

3.  **Emcee Web Interface (HTML, CSS, JavaScript):**
    * A tablet-friendly web application for remote control of the PowerPoint presentation.
    * Displays current slide information and presentation status.
    * Sends control commands (Start, Stop, Next, Previous) to the Suey Server.
    * Supports swipe gestures for navigation.

## Suey Script - Custom In-Slide Commands

A key feature of Suey is its custom scripting language embedded into the names of PowerPoint shapes. This allows control over presentation events from within the PowerPoint interface.

* **Syntax:** Commands are placed within a shape named `Suey[...]`. Multiple commands are separated by semicolons (`;`). Each command is a `key=value` pair. Multiple key-value pairs for a single trigger are structured as `trigger:key=value,key2=value2`.
    * Example: `Suey[Base:PlaySound=Success,SetColor=#FF0000;1:SetScene=Intro]`
* **Triggers:**
    * `Base`: Commands execute when the slide loads (timeline index 0).
    * `[index]`: Commands execute when the PowerPoint animation timeline reaches the specified numerical `index`.
* **Supported Commands:** `PlaySound`, `SetScene`, `SetColor`, `SetBrightness`, `SetLeftColor`, `SetRightColor`. These are parsed by the Extension and often relayed to the Server for action. More commands are listed in the `Extension/ThisAddIn.cs` file.

## Key Features

* Remote PowerPoint presentation control via a web interface.
* Synchronized smart lighting effects based on Suey Script events.
* Custom in-slide scripting using "Suey Script" within PowerPoint shape names.
* Real-time WebSocket communication between system components.
* Live event logging viewable through a dedicated web interface.

## Technologies Used

* **PowerPoint Extension:** C#, Visual Studio Tools for Office (VSTO)
* **Server:** Node.js, Express.js, express-ws
* **Emcee Web Interface:** HTML, CSS, JavaScript
* **Lighting Control:** `tuyapi` (Node.js library for Tuya smart devices)
* **Data Exchange:** JSON (for WebSocket messages)

## Setup & Installation

### Prerequisites:
* Node.js and npm
* Microsoft PowerPoint (with VSTO runtime installed)
* Visual Studio (with Office/SharePoint development workload for the Extension)
* Tuya-compatible smart lights.
* Local keys and IDs for Tuya devices (obtainable with tools like [tuya-local-key-extractor](https://github.com/redphx/tuya-local-key-extractor)). Configure these in `Server/keys.json`.

### Server:
1. Navigate to the `Server` directory.
2. Run `npm install`.
3. Create `Server/keys.json` and include Tuya device credentials.
4. Run `node suey.js`.

### Extension:
1. Open the `Extension` project in Visual Studio.
2. Build the project to install the PowerPoint Add-in.
3. Name PowerPoint slide objects intended for Suey Script commands appropriately (example: `ShapeNameStartingWithSuey[Base:PlaySound=IntroSound]`).

### Accessing Interfaces:
* **Emcee Control Panel:** `http://localhost:1337/mc?key=awards`
* **Log Viewer:** `http://localhost:1337/logs`

*(Note: The `key=awards` query parameter is a basic access security measure. You can change it to any string you prefer in the `Server/suey.js` file.)*

## Future Ideas

* Enhanced audience interaction features (polling, Q&A).
* Support for a wider range of controllable hardware.
* A visual editor or helper tool for generating Suey Script commands.