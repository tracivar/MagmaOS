'use strict'

//Module parameters. Change this to reflect what your module does.
var $module = new Object();

$module.Name = "Template Module";
$module.Description = "This is a barebones module with minimal logic. Use this as a template and expand on it.";
$module.Version = { Major: 0, Minor: 1, Revision: 1, Name: "Dev" };


//This is a magma primining module. There is some initialization for communication and management. Do not modify this code.
var $magma = new Object();
(function () {
    this.Status = { Undefined: 0, Success: 1, Error: 2 };
    //Standard model for communicating messages to the shell.
    this.Message = function (name,message,status) {
            this.StatusCode = $magma.Status.Undefined;
            this.Name = "";
            this.SenderIdentity = null;
            this.VerboseMessage = "";
            this.Payload = {};
    }
    //Standard Model for communicating scheduler commands to the shell.
    this.SchedulerCommand = function (command) {
        this.Command = command;
        this.Args = {};
        this.Name = "_sys";
        this.VerboseMessage = "";
        this.Reason = "";
        this.StatusCode = $magma.Status.Undefined;
    }
    //Standard Model for command response from the worker to the shell.
    this.MethodResponse = function () {
        this.Name = "_response";
        this.VerboseMessage = "";
        this.RequestID = "";
        this.Response = {};
        this.StatusCode = $magma.Status.Undefined;
    }
    this.Init = function () {
        $module._Init();
    }
    //The magma module intially handles the request coming in and splits it out into an event-driven model.
    this.MessageProcessor = function (ev) {
        var data = ev.data;
        try {
           data = JSON.parse(data);
        } catch (e) {
            //Exception here.
        }
        if (typeof data === "object") {
            //We need the request ID and the actual command.
            if (typeof data.request !== "undefined" && typeof data.RequestID !== "undefined") {
                switch (data.request.toLowerCase()) {
                    case "moduleinfo": {
                        var response = new $magma.MethodResponse();
                        response.RequestID = data.RequestID;
                        response.Response = { Version: $module.Version, Name: $module.Name};
                        self.postMessage(response);
                    } break;
                    default: {
                        if (typeof $module[data.request] === "function") {
                            try {
                                if (data.request.indexOf("_") == 0) {
                                    var response = new $magma.MethodResponse();
                                    response.RequestID = data.RequestID;
                                    response.Response = { Error: "Illegal operation. Methods denoted with an underscore are for private access only." };
                                    response.StatusCode = $magma.Status.Error;
                                    self.postMessage(response);
                                } else {
                                    var response = $module[data.request](data);
                                    response.RequestID = data.RequestID;
                                    response.StatusCode = $magma.Status.Success;
                                    self.postMessage(response);
                                }
                            } catch (e) {
                                var response = new $magma.MethodResponse();
                                response.RequestID = data.RequestID;
                                response.Response = { Error: "An error occurred trying to process the request.", Exception: e.message.toString(), LineNumber: e.number.toString() };
                                response.StatusCode = $magma.Status.Error;
                                self.postMessage(response);
                            }
                        } else {
                            var response = new $magma.MethodResponse();
                            response.RequestID = data.RequestID;
                            response.Response = { Error: "The request function has no handler. The module could not process the request." };
                            response.StatusCode = $magma.Status.Error;
                            self.postMessage(response);
                        }
                    } break;
                }
            } else {
                var message = { "StatusCode": 1, "Name": "Failure to process request.", "VerboseMessage": "A requested was recieved that did not contain a request ID and/or command.", "Payload": {} };
                self.postMessage(message);
            }
        } 
    }
    self.onmessage = this.MessageProcessor;
    //Usage: Create a message or command object using the types above ($magma.Message) and use self.postMessage to send it to the surface.

    /*  
    
        Creating functionality: Your application should implement event listeners for recieving commands from the surface, as 
        well as a heartbeat to keep the scheduler from terminating and deleting your module at runtime.

        The worker scope has no access to the DOM or variables declared in the global scope. This keeps your application sandboxed from
        the rest of the environment. You must communicate with it using messages, including any data which you wish to surface to
        applications.

        Surface applications are not run in user-space. Whilst third-parties can develop functionality for magma, only functionality
        developed expressly by the team managing the project must exist in the kernel-space. For this reason, modification of the
        two main components, kernel.js and boot.js is strictly forbidden. 

        To use presentation features such as forms and graphics you must interact by posting messages containing payloads that consist of
        compatible objects for the latest version of the presentation layer/shell. The shell runtime is a seperate piece of functionality
        and oversees the drawing of the interface and proxies interaction between modules.

        Events and actions in any GUI result in the creation of event objects which are passed onto the relevant module. Failure to respond
        to a UI request in sufficient time will essentially result in your application 'not responding' and facing subsequent termination,
        which as mentioned above includes termination of your module.

        */

}).bind($magma)();

//The heartbeat event is called every 10 seconds and tells the shell that we are not stuck in a loop.
$module._Heartbeat = function (_) {
    var message = new $magma.SchedulerCommand("alive");
    self.postMessage(message);
}

$module._Init = function (_) {
    var message = new $magma.Message($module.Name, "Injection Successful.", 1);
    self.postMessage(message);

    //The module will be terminated without this.
    self.setInterval($module._Heartbeat, 2500);
}

//Uncomment the code below and replace YourFunction with your desired method name. You can then call this from Magma.
/*
$module.YourFunction = function (obj) {
    var response = new $magma.MethodResponse();

    //The objects in here will be returned to the shell, consider it the output of the function.
    response.Response = { Message: "Executed command successfully!" };

    return response;
}
*/

//Don't change this, make sure this executes last.
$magma.Init();