using PowerPoint = Microsoft.Office.Interop.PowerPoint;
using System.Media;
using Microsoft.Office.Interop.PowerPoint;
using WatsonWebsocket;
using System.Text;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Converters;
using System;
using System.Linq;

namespace Suey
{
    public partial class ThisAddIn
    {
        public Application app = new Application();
        public SoundPlayer soundPlayer = new SoundPlayer();
        public static WatsonWsClient client;
        public int index = 0;

        private void ThisAddIn_Startup(object sender, System.EventArgs e)
        {
            app.PresentationOpen += App_PresentationOpen;
        }

        private void Log(string msg)
        {
            // Log any errors, but don't just crash PowerPoint because of them
            SueyState state = new SueyState();
            state.For = SueyState.SueyStateFor.MC;
            state.Code = SueyState.SueyStateCode.Log;

            dynamic data = new JObject();
            data.Message = "<b style='color:red'>Suey.Extension: Error -></b> " + msg;

            state.Data = JsonConvert.SerializeObject(data);

            client?.SendAsync(JsonConvert.SerializeObject(state));
        }

        // This event is triggered when a presentation is opened
        // It checks if the presentation contains a Suey object
        // If it does, it sets up the WebSocket client and initiates events
        private void App_PresentationOpen(Presentation Pres)
        {
            foreach (Shape shape in Pres.Slides[1].Shapes)
            {
                // Look for a Suey object to verify this presentation
                if (shape.Name.StartsWith("Suey"))
                {
                    // Setup server
                    client = new WatsonWsClient(new System.Uri("ws://localhost:1337/suey?key=awards"));
                    client.MessageReceived += Client_MessageReceived;
                    client.ServerConnected += Client_ServerConnected;
                    client.Start();

                    // Initiate events
                    app.SlideShowNextSlide += App_SlideShowNextSlide;
                    app.SlideShowOnNext += App_SlideShowOnNext;
                    app.SlideShowOnPrevious += App_SlideShowOnPrevious;
                }
            }
        }

        // This event is triggered when the client connects to the server
        // We are able to know that the client is connected and ready to go!
        private void Client_ServerConnected(object sender, EventArgs e)
        {
            SueyState state = new SueyState();
            state.For = SueyState.SueyStateFor.MC;
            state.Code = SueyState.SueyStateCode.Ready;

            dynamic data = new JObject();
            state.Data = JsonConvert.SerializeObject(data);

            client?.SendAsync(JsonConvert.SerializeObject(state));
        }

        // Slide show events //

        private void App_SlideShowOnNext(SlideShowWindow Wn)
        {
            index++;
            Update();
        }

        private void App_SlideShowOnPrevious(SlideShowWindow Wn)
        {
            index--;
            Update();
        }

        private void App_SlideShowNextSlide(SlideShowWindow Wn)
        {
            index = 0;
            Update();
        }

        // Handles the message received from the client
        private void Client_MessageReceived(object sender, MessageReceivedEventArgs e)
        {
            try
            {
                JObject message = JObject.Parse(Encoding.UTF8.GetString(e.Data.Array));
                string code = (string)message["Code"];

                switch (code)
                {
                    case "Start":
                        app.ActivePresentation.SlideShowSettings.Run();

                        SueyState startState = new SueyState();
                        startState.For = SueyState.SueyStateFor.All;
                        startState.Code = SueyState.SueyStateCode.Start;

                        dynamic data = new JObject();
                        startState.Data = JsonConvert.SerializeObject(data);
                        client?.SendAsync(JsonConvert.SerializeObject(startState));

                        break;
                    case "Next":
                        app.ActivePresentation.SlideShowWindow.View.Next();
                        break;
                    case "Previous":
                        app.ActivePresentation.SlideShowWindow.View.Previous();
                        break;
                    case "Stop":
                        app.ActivePresentation.SlideShowWindow.View.Exit();

                        SueyState stopState = new SueyState();
                        stopState.For = SueyState.SueyStateFor.All;
                        stopState.Code = SueyState.SueyStateCode.Ready;

                        dynamic stopData = new JObject();
                        stopState.Data = JsonConvert.SerializeObject(stopData);
                        client?.SendAsync(JsonConvert.SerializeObject(stopState));
                        break;
                }
            } 
            catch (Exception err)
            {
                Log(err.Message);
            }
        }

        // Updates the Suey Script
        public void Update()
        {
            try
            {
                if (app.ActivePresentation.SlideShowWindow.View == null) return;

                var slide = app.ActivePresentation?.SlideShowWindow?.View?.Slide;
                if (slide != null)
                {
                    foreach (Shape shape in slide.Shapes)
                    {
                        if (shape.Name != null && shape.Name.StartsWith("Suey"))
                        {
                            SueyCore.Parse(shape.Name, index);
                        }
                    }

                    SueyState state = new SueyState();
                    state.For = SueyState.SueyStateFor.MC;
                    state.Code = SueyState.SueyStateCode.Slides;

                    dynamic data = new JObject();
                    data.Slide = slide.SlideIndex;
                    data.TimelinePosition = index;
                    data.TimelineTotal = slide.TimeLine?.MainSequence?.Count ?? 0;

                    state.Data = JsonConvert.SerializeObject(data);

                    client?.SendAsync(JsonConvert.SerializeObject(state));
                }
            } 
            catch (Exception err)
            {
                Log(err.Message);
            }
        }

        private void ThisAddIn_Shutdown(object sender, System.EventArgs e)
        {
        }

        #region VSTO generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InternalStartup()
        {
            this.Startup += new System.EventHandler(ThisAddIn_Startup);
            this.Shutdown += new System.EventHandler(ThisAddIn_Shutdown);
        }

        #endregion
    }

    // SueyCore is the core of the Suey extension
    // It handles the parsing of the Suey code and executes the commands
    public static class SueyCore
    {
        // List of sounds for PlaySound
        static Dictionary<string, string> sounds = new Dictionary<string, string>
        {
            { "Success", "D:\\X\\msg.wav" }
        };

        // List of logs for debugging
        static private List<SueyLog> logs = new List<SueyLog>();

        // Parses the Suey code and executes the commands
        // The code is in the format of "Suey: <command>: <value>; <command>: <value>; ..."
        // The index is the current index of the slide
        static public void Parse(string code, int index)
        {
            // Remove Suey prefix and suffix
            code = code.Substring(7);
            code = code.Substring(0, code.Length - 2);

            // Split code chunk into separate commands
            string[] commands = code.Split(';');

            // Loop through all commands and parse each
            foreach (string command in commands)
            {
                string[] parts = command.Trim().Split(':');

                if (parts.Length == 2)
                {
                    // The name for when to execute the command
                    string name = parts[0].Trim();

                    // The command data
                    string value = parts[1].Trim();

                    // Parses the actual command
                    string[] set = value.Split(',');
                    foreach (string keyValue in set)
                    {
                        string[] pair = keyValue.Split('=');
                        string cmdName = pair[0].Trim();
                        string cmdValue = pair[1].Trim();

                        // Executes valid commands
                        if ((name.Equals("Base") && index == 0) || name.Equals(index.ToString()))
                        {
                            switch (cmdName)
                            {
                                // PlaySound: Plays a sound from the sound list
                                case "PlaySound":
                                    string soundPath;
                                    sounds.TryGetValue(cmdValue, out soundPath);

                                    if (soundPath.Length != 0)
                                    {
                                        SoundPlayer player = new SoundPlayer();
                                        player.SoundLocation = soundPath;
                                        player.Play();
                                    }
                                    else
                                    {
                                        Log(SueyLog.LogType.Error, "Invalid PlaySound sound.");
                                    }
                                    break;
                                default:
                                    SueyState.SueyStateCode stateCode;
                                    if (Enum.TryParse(cmdName, out stateCode))
                                    {
                                        SueyState state = new SueyState();
                                        state.Code = stateCode;
                                        state.For = SueyState.SueyStateFor.All;

                                        dynamic data = new JObject();
                                        data.Value = cmdValue;

                                        state.Data = JsonConvert.SerializeObject(data);

                                        ThisAddIn.client.SendAsync(JsonConvert.SerializeObject(state));
                                    }
                                    break;
                            }
                        }
                    }
                }
            }
        }

        static public void Log(SueyLog.LogType type, string content)
        {
            SueyLog log = new SueyLog();
            log.Type = type;
            log.Content = content;

            logs.Add(log);
        }
    }

    // SueyLog is used to log messages from the Suey extension
    public class SueyLog
    {
        public enum LogType
        {
            Info, // Information
            Error, // Error, not fatal
            Fatal // Fatal error
        }

        public LogType Type;
        public string Content;
    }

    // SueyState is the state of the Suey system
    public class SueyState
    {
        [JsonConverter(typeof(StringEnumConverter))]
        public enum SueyStateCode
        {
            Ready,
            Start,
            Stop,
            Next,
            Previous,
            Slides,
            Timeout,
            PlaySound,
            SetScene,
            SetColor,
            SetBrightness,
            SetLeftColor,
            SetLeftBrightness,
            SetRightColor,
            SetRightBrightness,
            ShakeScreen, // ? Unused
            Log
        }

        // For which part of the system this state is for
        [JsonConverter(typeof(StringEnumConverter))]
        public enum SueyStateFor
        {
            All,
            Audience,
            MC,
            Suey
        }

        public SueyStateFor For;
        public SueyStateCode Code;
        public string Data;
    }
}
