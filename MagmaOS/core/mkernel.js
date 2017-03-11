'use strict'

//Module parameters. Change this to reflect what your module does.
var $module = new Object();

$module.Name = "Kernel";
$module.Description = "Handles low level operations and interactions with external services.";


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
        this.Reason = "";
    }
    this.Init = function () {
        $module.Init();
    }
    //The magma module intially handles the request coming in and splits it out into an event-driven model.
    this.MessageProcessor = function (ev) {
        console.log(ev);
    }
    self.onmessage += this.MessageProcessor;
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
$module.Heartbeat = function (_) {
    var message = new $magma.SchedulerCommand("alive");
    self.postMessage(message);
}

$module.Init = function (_) {
    var message = { "StatusCode": 0, "Name": "Kernel", "VerboseMessage": "Injection succesful.", "Payload": {} };
    self.postMessage(message);
}

$module.Exit = function (_) {

}



//Don't change this, make sure this executes last.
$magma.Init();