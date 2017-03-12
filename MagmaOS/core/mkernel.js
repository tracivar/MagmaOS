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
$mfs.func.chunkToB64 = function (u8a) {
    var CHUNK_SZ = 16384
    var c = [];
    for (var i = 0; i < u8a.length; i += CHUNK_SZ) {
        c.push(String.fromCharCode.apply(null, u8a.subarray(i, i + CHUNK_SZ)));
    }
    return c.join("");
}
$mfs.func.b64toChunk = function (string) {
    var u8 = new Uint8Array([65, 66, 67, 68]);
    var b64encoded = btoa(Uint8ToString(string));
}

$mfs.defs.root = function () {

    this.volumename = ""; //Max Length 32
    this.volumeGUID = $mfs.func.newGuid();
    this.volumesize = 128;
    this.memcache = true; //Whether to keep the entire collection in memory.
    this.directories = new Array();
    this.files = new Array();
    this.chunks = new Array();
    this.used = function () {
        var used =0;
        for (var n = 0; n < this.chunks.length; n++) {
            if (this.chunks[n].owner != 0) {
                used++;
            }
        }
        return used;
    }

}

$mfs.defs.directory = function () {
    this.name = "New Folder"; //Max Length 128
    this.GUID = $mfs.func.newGuid(); //Short GUID
    this.created = Date.now();  //Unix epoch ms
    this.hidden = false;
    this.system = false;
    this.parent = null;
}

$mfs.defs.file = function () {
    this.name = "New Document.txt"; //Max Length 128
    this.GUID = $mfs.func.newGuid(); //Short GUID
    this.created = Date.now();  //Unix epoch ms
    this.accessed = Date.now(); //Unix epoch ms
    this.modified = Date.now();  //Unix epoch ms
    this.hidden = false;
    this.system = false;
    this.directory = ""; //GUID of the directory
    this.size = 0; //File size in bytes.
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

$mfs.defs.pathpart = function () {
    this.type = "";
    this.name = "";
    this.volumeref = null;
    this.reference = null;
}

$mfs.enum.volumemode = { CreateNew: "crnow", OpenExisting: "openex" };
$mfs.enum.volumetype = { InMemory: "memdb", LocalStorage: "locals", WebSockets: "websock", AJAX: "restdb" };

$mfs.log.volume = function () {
    this.Meta = new $mfs.defs.root();
    this.MountName = "dev0";
    this.cacheChunks = new Array();
    this.cacheLimit = 64; //Limit to how many chunks can be cached at once.
}
$mfs.log.chunkdata = function () {
    this.data = new Uint8Array(16384);
}
$mfs.log.chunk = function () {
    this.ID = 0;
    this.data = null;
    this.active = false;
    this.lastAccessed = Date.now();
    this.owner = 0;
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

                    for (var n = 0; n < $module._filesystem.volumes.length; n++) {
                        if ($module._filesystem.volumes[n].Volume.MountName.toLowerCase() == obj.mount.toLowerCase()) {
                            throw new $mfs.sys.exception("The volume " + obj.mount + " already exists. Please choose a different mount.");
                        }
                    }

                    if (obj.size < 32 || obj.size > 16384) {
                        throw new $mfs.sys.exception("The memoryvolume object detected a desired volume size that is considered unsafe. The chunk size '" + obj.size.toString() + "' is too large to safely store in memory.");
                    }

                    this.Type = obj.type;
                    this.Volume = new $mfs.log.volume();
                    this.Volume.MountName = obj.mount;
                    this.Volume.cacheLimit = obj.size;
                    this.Volume.Meta.memcache = true;

                    //Create chunks in memory.
                    for (var i = 0; i < obj.size; i++) {
                        this.Volume.Meta.chunks[i] = new $mfs.log.chunk();
                        this.Volume.Meta.chunks[i].ID = i;
                        this.Volume.Meta.chunks[i].data = new $mfs.log.chunkdata();
                    }


                    var message = { "StatusCode": 0, "Name": "MagmaFileSystem", "VerboseMessage": "Initialized in-memory filesystem in " + (Date.now() - startM) + "ms. [" + this.Volume.MountName + ":" + (obj.size * 16) + "KB]", "Payload": {} };
                    self.postMessage(message);

                    return this;

                } break;
                default: {
                    throw new $mfs.sys.exception("The memoryvolume object cannot support operating mode of '" + (obj.mode) + "'.");
                } break;
            }


        } else {
            throw new $mfs.sys.exception("A memoryvolume object cannot support a volume of type '" + (obj.type) + "'.");
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

//Takes an input path and segments it into logical objects. Useful for finding the target volumes. The silent flag tells it to fail silently.
$mfs.sys.route = function (path, silent) {

    var split = path.split('/');
    var route = new Array();
    var silent = typeof silent === "undefined" ? false : silent;

    //This can be optimized later by using alphabet metadata sorting and lookup cache.
    var tripOut = false;
    for (var i = 0; i < split.length && !tripOut; i++) {
        if (split[i] == "" || split[i] == " ") {
            split.splice(i, 1);
            i--;
        } else {
            //We need to find the volume.
            if (route.length == 0) {
                for (var n = 0; n < $module._filesystem.volumes.length; n++) {
                    if ($module._filesystem.volumes[n].Volume.MountName.toLowerCase() == split[i].toLowerCase()) {
                        var part = new $mfs.defs.pathpart();
                        part.name = $module._filesystem.volumes[n].Volume.MountName;
                        part.type = "vol";
                        part.volumeref = $module._filesystem.volumes[n];
                        part.reference = $module._filesystem.volumes[n];
                        route[route.length] = part;
                        break;
                    }
                }
                if (route.length == 0) {
                    if (!silent) {
                        throw new $mfs.sys.FileException("Could not find volume '" + split[i].toLowerCase() + "' in part of path '" + path + "'.");
                    } else {
                        tripOut = true;
                    }
                }
            } else {
                //We need to find either a directory or a file with the filename mentioned.
                var found = false;
                for (var n = 0; n < route[0].reference.Volume.Meta.directories.length; n++) {
                    if (route[0].reference.Volume.Meta.directories[n].name.toLowerCase() == split[i].toLowerCase()) {
                        var doit = true;
                        if (route[route.length - 1].type == "vol" && route[0].reference.Volume.Meta.directories[n].parent != null) {
                            doit = false;
                        } else {

                            if (route[route.length - 1].type != "vol" && route[0].reference.Volume.Meta.directories[n].parent != route[route.length - 1].reference.GUID) {
                                doit = false;
                            }

                        }
                        if (doit) {
                            //We've found a directory.
                            var part = new $mfs.defs.pathpart();
                            part.name = route[0].reference.Volume.Meta.directories[n].name;
                            part.type = "dir";
                            part.volumeref = route[0].reference;
                            part.reference = route[0].reference.Volume.Meta.directories[n];
                            route[route.length] = part;
                            found = true;
                            break;
                        }
                    }
                }
                //Lets check files now.
                if (!found && i == split.length - 1) {
                    for (var n = 0; n < route[0].reference.Volume.Meta.files.length; n++) {
                        if (route[0].reference.Volume.Meta.files[n].name.toLowerCase() == split[i].toLowerCase()) {
                            var doit = true;
                            if (route[route.length - 1].type == "vol" && route[0].reference.Volume.Meta.files[n].directory != "") {
                                doit = false;
                            } else {

                                if (route[route.length - 1].type != "vol" && route[0].reference.Volume.Meta.files[n].GUID != route[route.length - 1].reference.GUID) {
                                    doit = false;
                                }

                              
                            }
                            if (doit) {
                                //We've found a file.
                                var part = new $mfs.defs.pathpart();
                                part.name = route[0].reference.Volume.Meta.files[n].name;
                                part.type = "fil";
                                part.volumeref = route[0].reference;
                                part.reference = route[0].reference.Volume.Meta.files[n];
                                route[route.length] = part;
                                found = true;
                                break;
                            }
                        }
                    }
                } else {
                    if (!found) {
                        if (!silent) {
                            throw new $mfs.sys.FileException("Could not find part of path '" + split[i].toLowerCase() + "' in '" + path + "'. Does the file or directory exist?");
                        } else {
                            tripOut = true;
                        }
                    }
                }

            }
        }
    }

    return route;
}


//Abstract objects for dealing with data.
$mfs.File = new Object();

$mfs.File.Open = function (path) {
    throw new $mfs.sys.NotImplementedException();
}
//Attemepts to delete a file with the given path.
$mfs.File.Delete = function (path) {
    var success = false;
    dir = $mfs.File.Exists(path);
    if (dir) {

            

            for (var i = 0; i < dir.volumeref.Volume.Meta.files.length; i++) {
                if (dir.volumeref.Volume.Meta.files[i].GUID == dir.reference.GUID) {
                    var dirName = dir.reference.name;
                    dir.volumeref.Volume.Meta.files.splice(i, 1);
                    success = true;
                    $mfs.sys.clearfile(dir.volumeref.Volume.Meta, dir.reference);
                    $mfs.sys.SuccessMessage("Deleted file '" + dirName + "' at " + path + ".");
                    break;
                }
            }

      
    } else {
        throw new $mfs.sys.FileException("Could not find part of the path or the path provided was invalid.");
    }

    return success;
}
//Attemepts to move a file from one location to another, also used for renaming a file.
$mfs.File.Move = function (source, destination) {
    throw new $mfs.sys.NotImplementedException();
}
//Attemepts to delete a file with the given path.
$mfs.File.Copy = function (source, destination) {
    throw new $mfs.sys.NotImplementedException();
}
//Attempts to create a blank file at the given path.
$mfs.File.Create = function (path) {
    var success = false;
    if (path.length > 0 && path.indexOf("/") >= 0) {

        var route = $mfs.sys.route(path, true);

        if (route.length > 0) {
            var chain = path.split('/');

            for (var i = 0; i < chain.length; i++) {
                if (chain[i] == "" || chain[i] == " ") {
                    chain.splice(i, 1);
                    i--;
                }
            }
            var fileToMake = chain[chain.length - 1];

            if (route[route.length - 1].name.toLowerCase() != fileToMake.toLowerCase() || route[route.length - 1].type != "fil" || route.length != chain.length) {
              
                if (route.length == chain.length - 1) {
                    var fileObj = new $mfs.defs.file();
                    fileObj.name = fileToMake;
                    fileObj.directory = (route[route.length - 1].type == "dir") ? route[route.length - 1].reference.GUID : "";

                    route[0].reference.Volume.Meta.files[route[0].reference.Volume.Meta.files.length] = fileObj;
                    //Allocate 1 chunk to the object.
                    $mfs.sys.imprintfile(route[0].reference.Volume.Meta, fileObj, 8192);
                    success = true;

                    $mfs.sys.SuccessMessage("Created file '" + fileToMake + "' at " + path + ".");
                } else {
                    if (route.length == chain.length) {
                        throw new $mfs.sys.FileException("A directory or file with the same name '" + fileToMake + "' already exists at " + path + ".");
                    } else {
                        throw new $mfs.sys.FileException("Part of the path is missing '" + path + "', could not create file.");
                    }
                }

            } else {
               
                    throw new $mfs.sys.FileException("The file '" + fileToMake + "' already exists at " + path + ".");
               
               
            }
        } else {
            throw new $mfs.sys.FileException("Could not find part of the path or the path provided was invalid.");
        }
    } else {
        throw new $mfs.sys.FileException("The path provided was not a valid path.");
    }

    return success;
}
//Returns true if the file exists at the location.
$mfs.File.Exists = function (path) {
    if (path.length > 0 && path.indexOf("/") >= 0) {
        var route = $mfs.sys.route(path, true);

        if (route.length > 0) {
            var chain = path.split('/');

            for (var i = 0; i < chain.length; i++) {
                if (chain[i] == "" || chain[i] == " ") {
                    chain.splice(i, 1);
                    i--;
                }
            }
            if (chain.length == route.length && route[route.length - 1].type == "fil") {
                return route[route.length - 1];
            } else {
                return false;
            }
        } else {
            return false;
        }
    } else {
        return false;
    }
}
//Writes bytes to the end of the file.
$mfs.File.AppendBytes = function (path, bytes) {
    throw new $mfs.sys.NotImplementedException();
}
//Writes text to the end of the file. UTF-8 encoding.
$mfs.File.AppendText = function (path, text) {
    throw new $mfs.sys.NotImplementedException();
}
//Reads bytes from the file, starting at position <start> for <count> bytes.
$mfs.File.ReadBytes = function (path, start, count) {
    throw new $mfs.sys.NotImplementedException();
}
//Reads text from the file, starting at position <start> for <count> bytes. UTF-8 encoding.
$mfs.File.ReadText = function (path, start, count) {
    throw new $mfs.sys.NotImplementedException();
}

$mfs.Directory = new Object();
//Creates a directory at the specified location. Path should contain the leading /, such that /dev0 is accessing the root of dev0.
$mfs.Directory.CreateDirectory = function (path) {

    var success = false;
    if (path.length > 0 && path.indexOf("/") >= 0) {
        var route = $mfs.sys.route(path, true);

        if (route.length > 0) {
            var chain = path.split('/');

            for (var i = 0; i < chain.length; i++) {
                if (chain[i] == "" || chain[i] == " ") {
                    chain.splice(i, 1);
                    i--;
                }
            }
            var dirToMake = chain[chain.length - 1];

            if (route[route.length - 1].name.toLowerCase() != dirToMake.toLowerCase() || route[route.length - 1].type != "dir" || route.length != chain.length) {
                if (route.length == chain.length - 1) {
                    var dirObj = new $mfs.defs.directory();
                    dirObj.name = dirToMake;
                    dirObj.parent = (route[route.length - 1].type == "dir") ? route[route.length - 1].reference.GUID : null;
                    route[0].reference.Volume.Meta.directories[route[0].reference.Volume.Meta.directories.length] = dirObj;

                    success = true;

                    $mfs.sys.SuccessMessage("Created directory '" + dirToMake + "' at " + path + ".");
                } else {
                    throw new $mfs.sys.FileException("Part of the path is missing '" + path + "', could not create directory.");
                }
            } else {
                throw new $mfs.sys.FileException("The directory '" + dirToMake + "' already exists at " + path + ".");
            }
        } else {
            throw new $mfs.sys.FileException("Could not find part of the path or the path provided was invalid.");
        }
    } else {
        throw new $mfs.sys.FileException("The path provided was not a valid path.");
    }

    return success;
}

//Deletes and empty directory at the specified location.
$mfs.Directory.Delete = function (path) {
    var success = false;
    dir = $mfs.Directory.Exists(path);
    if (dir) {

        if ($mfs.Directory.GetDirectories(path).length == 0 && $mfs.Directory.GetFiles(path).length == 0) {

            for (var i = 0; i < dir.volumeref.Volume.Meta.directories.length; i++) {
                if (dir.volumeref.Volume.Meta.directories[i].GUID == dir.reference.GUID) {
                    var dirName = dir.reference.name;
                    dir.volumeref.Volume.Meta.directories.splice(i, 1);
                    success = true;
                    $mfs.sys.SuccessMessage("Deleted directory '" + dirName + "' at " + path + ".");
                    break;
                }
            }

        } else {
            throw new $mfs.sys.FileException("The directory at " + path + " contains files or folders. You cannot delete this directory.");
        }

    } else {
        throw new $mfs.sys.FileException("Could not find part of the path or the path provided was invalid.");
    }

    return success;
}


//Returns a list of directories at the provided location.
$mfs.Directory.GetDirectories = function (path) {
    var array = new Array();
    var dir = $mfs.Directory.Exists(path);
    if (dir) {

        //Return directories.
        for (var i = 0; i < dir.volumeref.Volume.Meta.directories.length; i++) {
            if (dir.type != "vol") {
                if (dir.volumeref.Volume.Meta.directories[i].parent == dir.reference.GUID) {
                    array[array.length] = dir.volumeref.Volume.Meta.directories[i];
                }
            } else {
                if (dir.volumeref.Volume.Meta.directories[i].parent == null) {
                    array[array.length] = dir.volumeref.Volume.Meta.directories[i];
                }
            }
        }

    } else {
        throw new $mfs.sys.FileException("Cannot enumerate directories for " + path + ". Could not find part of the path or the path provided was invalid.");
    }
    return array;
}

//Returns a list of files at the provided location.
$mfs.Directory.GetFiles = function (path) {
    var array = new Array();
    var dir = $mfs.Directory.Exists(path);
    if (dir) {
        //Return directories.
        for (var i = 0; i < dir.volumeref.Volume.Meta.files.length; i++) {
            if (dir.type != "vol" || dir.volumeref.Volume.Meta.files[i].directory != "") {
                if (dir.volumeref.Volume.Meta.files[i].directory == dir.reference.GUID) {
                    array[array.length] = dir.volumeref.Volume.Meta.files[i];
                }
            } else {
                array[array.length] = dir.volumeref.Volume.Meta.files[i];
            }

        }
    } else {
        throw new $mfs.sys.FileException("Cannot enumerate files for " + path + ". Could not find part of the path or the path provided was invalid.");
    }
    return array;
}

//Returns false if a directory doesn't exist at the location, returns the directory if it does.
$mfs.Directory.Exists = function (path) {

    if (path.length > 0 && path.indexOf("/") >= 0) {
        var route = $mfs.sys.route(path, true);

        if (route.length > 0) {
            var chain = path.split('/');

            for (var i = 0; i < chain.length; i++) {
                if (chain[i] == "" || chain[i] == " ") {
                    chain.splice(i, 1);
                    i--;
                }
            }
            if (chain.length == route.length && route[route.length - 1].type == "dir" || chain.length == route.length && route[route.length - 1].type == "vol") {
                return route[route.length - 1];
            } else {
                return false;
            }
        } else {
            return false;
        }
    } else {
        return false;
    }
}

function getMaxOfArray(numArray) {
    return Math.max.apply(null, numArray);
}

//This function takes an file definition and attempts to pre-eallocate chunks for itself. Useful if file growth is a known quantity and you want to guarantee available space.
//Note that this function is VERY expensive.
$mfs.sys.imprintfile = function (root, fileRef, length) {
    if (fileRef instanceof $mfs.defs.file && root instanceof $mfs.defs.root) {
        var targetLength = (fileRef.chunks.length * 16384) + length;
        var blocksRequired = Math.ceil(targetLength / 16384);
        var blocksToCreate = blocksRequired - fileRef.chunks.length;
        var allocated = 0;
        var start = getMaxOfArray(fileRef.chunks);
        if (start.toString() == "-Infinity") {
            start = 0;
        }
        for (var i = start; i < root.chunks.length ; i++) {
            if (root.chunks[i].owner == 0) {
                root.chunks[i].owner = fileRef.GUID;
                fileRef.chunks[fileRef.chunks.length] = i;
                blocksToCreate--;
                allocated++;
            }
            if (blocksToCreate == 0) { break; }
        }

        if (blocksToCreate > 0) {
            throw new $mfs.sys.FileException("Could not allocate space for " + fileRef.name + " because the volume was full.");
        } else {
            $mfs.sys.SuccessMessage("Allocated " + allocated.toString() + " blocks for '" + fileRef.name + "'. Used: " + Math.floor(fileRef.size / 1024).toString() + "KB Available: " + Math.floor(blocksRequired * 16) + "KB");
        }

    }
}

//This function takes a file definition and removes all chunk ownership and size information, essentially making the file blank.
//The data may still persist, but it is unindexed and should eventually be overwritten.
$mfs.sys.clearfile = function (root, fileRef) {
    if (fileRef instanceof $mfs.defs.file && root instanceof $mfs.defs.root) {

        var clear = 0;
        for (var i = 0; i < root.chunks.length ; i++) {
            if (root.chunks[i].owner == fileRef.GUID) {
                root.chunks[i].owner = 0;
                clear++;
            }
        }

        fileRef.chunks = new Array();
        fileRef.size = 0;

  
            $mfs.sys.SuccessMessage("Cleared " + clear.toString() + " blocks in use by '" + fileRef.name + "'. KB Free: " + (clear * 16).toString() + "KB");
     

    }
}

$mfs.sys.FileException = function (message) {
    this.Name = "FileException";
    this.Message = message;
    this.Inner = null;

    var message = { "StatusCode": 0, "Name": "FileException", "VerboseMessage": message, "Payload": {} };
    self.postMessage(message);
}

$mfs.sys.SuccessMessage = function (message) {
    this.Name = "FileOperationSuccess";
    this.Message = message;
    var message = { "StatusCode": 0, "Name": "FileOperationSuccess", "VerboseMessage": message, "Payload": {} };
    self.postMessage(message);
}

$mfs.sys.NotImplementedException = function () {
    this.Name = "NotImplementedException";
    this.Message = "The requested command has not been developed.";
    this.Inner = null;
}

//Don't change this, make sure this executes last.
$magma.Init();