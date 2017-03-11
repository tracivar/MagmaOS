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
    this.Message = function (name, message, status) {
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
                        response.Response = { Version: $module.Version, Name: $module.Name };
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

$module._filesystem = new Object();

$module._filesystem.volumes = new Array();

//The heartbeat event is called every 10 seconds and tells the shell that we are not stuck in a loop.
$module._Heartbeat = function (_) {
    var message = new $magma.SchedulerCommand("alive");
    self.postMessage(message);
}

$module._Init = function (_) {
    var message = { "StatusCode": 0, "Name": "Kernel", "VerboseMessage": "Injection succesful.", "Payload": {} };
    self.postMessage(message);

    //The module will be terminated without this.
    self.setInterval($module._Heartbeat, 2500);

    //Initialize memory filesystem.
    var fsdef = new $mfs.defs.volume();
    fsdef.mount = "sys0";

    $module._filesystem.volumes[$module._filesystem.volumes.length] = new $mfs.sys.memoryvolume(fsdef);

}


//Magma file system.
var $mfs = new Object();
$mfs.func = new Object();
$mfs.defs = new Object();
$mfs.log = new Object();
$mfs.sys = new Object();
$mfs.enum = new Object();

$mfs.func.newGuid = function () {
    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }
    return (S4() + S4() + "-" + S4()).toLowerCase();
}

$mfs.defs.root = function () {

        this.volumename = ""; //Max Length 32
        this.volumeGUID = $mfs.func.newGuid();
        this.volumesize = 128;
    this.memcache = true; //Whether to keep the entire collection in memory.
    this.directories = new Array();
    this.files = new Array();
}

$mfs.defs.directory = function () {
    this.name = "New Folder"; //Max Length 128
    this.GUID = $mfs.func.newGuid(); //Short GUID
    this.created = Date.now();  //Unix epoch ms
    this.hidden = false;
    this.system = false;
}

$mfs.defs.file = function () {
    this.name = "New Document.txt"; //Max Length 128
    this.GUID = $mfs.func.newGuid(); //Short GUID
    this.created = Date.now();  //Unix epoch ms
    this.accessed = Date.now(); //Unix epoch ms
    this.modified = Date.now();  //Unix epoch ms
    this.hidden = false;
    this.system = false;
    this.directory = "a570b6d8-5f93"; //GUID of the directory
    this.size = 832642; //File size in bytes.
    this.chunks = []; //Integer ID of chunks which contain the file, sequential order
}

$mfs.defs.endpoint = function () {
    this.transport = "HTTP";
    this.location = "/file";
    this.user = "";
    this.privateKey = "";
    this.ratelimit = 8; //Maximum number of chunks to read per transaction.
}

$mfs.defs.volume = function () {
    this.type = $mfs.enum.InMemory;
    this.mode = $mfs.enum.volumemode.CreateNew;
    this.endpoint = new $mfs.defs.endpoint;
    this.mount = "";
    this.size = 128;
}

$mfs.enum.volumemode = { CreateNew: "crnow", OpenExisting: "openex" };
$mfs.enum.volumetype = {InMemory: "memdb", LocalStorage: "locals", WebSockets: "websock", AJAX: "restdb"};

$mfs.log.volume = function () {
    this.Meta = new $mfs.defs.root();
    this.MountName = "dev0";
    this.cacheChunks = new Array();
    this.cacheLimit = 64; //Limit to how many chunks can be cached at once.
}
$mfs.log.chunk = function () {
    this.ID = 0;
    this.data = new Uint8Array(16384); 
    this.lastAccessed = Date.now();
}
$mfs.log.file = function () {
    this.definition = new $mfs.defs.file();
    this.chunkData = new Array(); //Provide any chunkdata.
    this.streaming = false; //Defines whether the file object contains all chunks to constitute a file.
}



//This object is an entire filesystem in memory. It can be serialized and stored in localStorage or a string.
$mfs.sys.memoryvolume = function (obj) {
    if (obj instanceof $mfs.defs.volume) {

        if (obj.type == $mfs.enum.InMemory) {

            switch (obj.mode) {
                case "crnow": {

                    var startM = Date.now();

                    if (obj.size < 32 || obj.size > 1024) {
                        throw new $mfs.sys.exception("The memoryvolume object detected a desired volume size that is considered unsafe. The chunk size '"+obj.size.toString()+"' is too large to safely store in memory.");
                    }

                    this.Type = obj.type;
                    this.Volume = new $mfs.log.volume();
                    this.Volume.MountName = obj.mount;
                    this.Volume.cacheLimit = obj.size;
                    this.Volume.Meta.memcache = true; 

                    //Create chunks in memory.
                    for (var i = 0; i < obj.size; i++) {
                        this.Volume.cacheChunks[i] = new $mfs.log.chunk();
                    }


                    var message = { "StatusCode": 0, "Name": "MagmaFileSystem", "VerboseMessage": "Initialized in-memory filesystem in "+(Date.now()-startM)+"ms. [" + this.Volume.MountName + ":"+(obj.size*16)+"KB]", "Payload": {} };
                    self.postMessage(message);

                    return this;

                } break;
                default: {
                    throw new $mfs.sys.exception("The memoryvolume object cannot support operating mode of '" + (obj.mode)+"'.");
                } break;
            }


        } else {
            throw new $mfs.sys.exception("A memoryvolume object cannot support a volume of type '" + (obj.type)+"'.");
        }

    } else {
        throw new $mfs.sys.exception("The volume definition provided was not of type $mfs.defs.volume");
    }
    this.toString = function () {
        return "/" + this.Volume.MountName + " [" + this.Type + "] Size: " + this.Volume.Meta.volumesize + " chunks. (" + (this.Volume.Meta.volumesize * 16) + "KB)";
    }
}

$mfs.sys.exception = function (message) {
    this.Name = "FileSystem Exception";
    this.Message = message;
}

//Don't change this, make sure this executes last.
$magma.Init();