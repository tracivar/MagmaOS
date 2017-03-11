//The bootloader is responsive for initializing the $magma namespace and facilitating communication between the kernel and other modules.
(function () {
    if (typeof ($magma) !== "undefined") {
        console.log("Magma already loaded. Error during initialization.");
    } else {

        $magma = new (function () {
            var _version = { Major: 0, Minor: 1, Revision: 1, Name: "Mainline" };
            var _messages = 42;
            var _guidStatic = 0;
            var _initFunc = function () {
                //This is an important function that is the catalyst for runtime.
                //Change carefully!
                _messages = new $magma.MessageBus();

                //Test the message bus.
                aMessage = new $magma.Message();
                aMessage.SenderIdentity = "BootLoader";
                aMessage.VerboseMessage = "The bootloader has initialised the message bus and will begin loading the kernel...";
                _messages.Tell(aMessage);

                //Add the kernel module.
                var kernel = new $magma.ModuleDefinition("Kernel", "/core/mkernel.js", $magma.ModuleDefinitionType.Kernel);
                $magma.Modules.AddModule = kernel;

                //Load all modules.
                $magma.Modules.LoadAll();
            }
            Object.defineProperty(this, "Version", { get: function () { return _version; } });
            Object.defineProperty(this, "Init", { get: function () { return _initFunc; } });
            this.Tell = function (a) {
                _messages.Tell(a);
            };
            Object.defineProperty(this, "GUID_Phase", { get: function () { _guidStatic++; return _guidStatic; } })
        })();

        //Low level exception handling.
        $magma.Exception = function (message) {
            this.message = message;
            this.name = "MagmaRuntimeException";
        }

        $magma.MessageBus = function () {
            var _messages = new Array();
            this.Tell = function (message) {
                if (typeof (message.VerboseMessage) !== "undefined") {
                    console.log("[" + (new Date().toLocaleTimeString()) + "] [%c" + message.SenderIdentity + "%c] %c" + message.VerboseMessage, "font-weight: bold; color: #f00; letter-spacing:5px;", "", "font-weight: bold; color: #135;");
                } else {
                    throw new $magma.Exception("Only valid magma message objects are permitted through transmission to the Tell method.");
                }
            }
        }

        //This object contains the necessary properties for interacting with a module. It gets passed directly to the worker object.
        $magma.MethodRequest = function (targetModule, request, args,callback) {
            var _completed = false;
            var _sent = false;
            var _error = false;
            var _targetModule = "";
            var _request = "";
            var _args = {};
            var _callback = "";
            this.Response = {};
            this.RequestID = "M" + $magma.GUID_Phase.toString();
            if (typeof args == "object") {
                _args = args;
            }
            if (typeof targetModule === "string") {
                _targetModule = targetModule;
            } else {
                throw new $magma.Exception("The target module can't be blank.");
            }
            if (typeof request !== "undefined" && request.length > 0) {
                _request = request;
            } else {
                throw new $magma.Exception("You must provide a request command.");
            }
            this.targetModule = _targetModule;
            this.args = _args;
            this.request = _request;
            if (typeof callback !== "undefined") {
                _callback = callback;
            } 

            //Indicates whether a response was recieved from the module.
            Object.defineProperty(this, "Completed", { get: function () { return _completed; }, set: function (_c) { _complete = _c; try { _callback(); } catch (a) { }; } });
            //Indicates whether the request has been sent to the module.
            Object.defineProperty(this, "Sent", { get: function () { return _sent; }, set: function (_b) { _sent = _b; } });
            //Indicates whether an error ocurred trying to send the request the module.
            Object.defineProperty(this, "Error", { get: function () { return _error; }, set: function (_a) { _error = _a; } });

            this.SendRequest = function () {
                if (!_sent && _request != "") {
                    var module = $magma.Modules.Select(_targetModule);
                    if (typeof module !== "undefined") {
                        if (module.State == $magma.ModuleDefinitionState.Active) {
                            module.Send(this);
                        } else {
                            throw new $magma.Exception("Could not send request to '" + _targetModule + "' because the module was not active.");
                        }
                    } else {
                        throw new $magma.Exception("The module '" + _targetModule + "' was not found in the active module list.");
                    }
                }
            }
        }

      


        Object.freeze($magma.MethodRequest);


        //The module system handles the book-keeping and loading of components.
        $magma.ModuleManager = function () {
            var _modules = new Array();
            Object.defineProperty(this, "AddModule", {
                set: function (module) {
                    if (module instanceof $magma.ModuleDefinition) {

                        //Duplicates not allowed.
                        for (var n = 0; n < _modules.length; n++) {
                            if (_modules[n].Name.toLowerCase() == module.Name.toLowerCase()) {
                                throw new $magma.Exception("The module with name '" + module.Name + "' already exists in the chain.");
                                break;
                            }
                        }
                        _modules[_modules.length] = module;
                    } else {
                        throw new $magma.Exception("The provided module was not of the correct type.");
                    }
                }
            });
            //This should not be enabled in production
            Object.defineProperty(this, "Modules", { get: function () { return _modules; } });
            this.Select = function (name) {
                for (var n = 0; n < _modules.length; n++) {
                    if (_modules[n].Name.toLowerCase() == name.toLowerCase()) {
                        return _modules[n];
                    }
                }
            }
            this.toString = function () {
                return "Magma Module System";
            }
            this.LoadAll = function () {
                for (var n = 0; n < _modules.length; n++) {
                    if (_modules[n].State == $magma.ModuleDefinitionState.Unloaded) {
                        _modules[n].Load();
                    }
                }
            }
        }

        Object.freeze($magma.ModuleManager);

        $magma.Modules = new $magma.ModuleManager();

        $magma.ModuleDefinitionType = { Undefined: 0, Kernel: 1, Shell: 2, Application: 3, Peripheral: 4 };
        $magma.Status = { Undefined: 0, Success: 1, Error: 2 };
        $magma.ModuleDefinitionState = { Unloaded: 0, Loading: 1, Active: 2, Error: 3 };

        //Construct module definition. Required before boot to identify necessary modules.
        $magma.ModuleDefinition = function (name, location, type) {

            //Private Members & init.
            var _internalName = "";
            var _location = "";
            var _moduleType = $magma.ModuleDefinitionType.Undefined;
            var _moduleState = $magma.ModuleDefinitionState.Unloaded;
            var _workerRef = null;
            var _lastCall = Date.now();
            var _sentRequests = new Array();
            var _loadFunc = function () {
                if (_moduleState == 0) {
                    _moduleState = 1;

                    _workerRef = new Worker(_location);
                    _workerRef.addEventListener('message', function (e) {
                        var message = e.data;
                        if (typeof message !== "undefined") {
                            if (typeof message.StatusCode !== "undefined" && typeof message.VerboseMessage !== "undefined") {
                                switch (message.Name.toLowerCase()) {
                                    case "_response": {
                                        if (typeof (message.RequestID) !== "undefined" && typeof (message.Response) !== "undefined") {
                                          
                                                for (var n = 0; n < _sentRequests.length; n++) {
                                                    if (_sentRequests[n].RequestID == message.RequestID) {
                                                        if (message.StatusCode == 2) {
                                                            _sentRequests[n].Error = true;
                                                        }
                                                        _sentRequests[n].Completed = true;
                                                        _sentRequests[n].Response = message.Response;

                                                    }
                                                }
                                        } else {
                                            if (typeof (message.RequestID) !== "undefined") {
                                                for (var n = 0; n < _sentRequests.length; n++) {
                                                    if (_sentRequests[n].RequestID == message.RequestID) {
                                                        _sentRequests[n].Error = true;
                                                    }
                                                }
                                            }
                                            throw new $magma.Exception("A response was recieved for '" + _internalName + "' but it was malformed. ");
                                        }
                                    } break;
                                    case "_sys": {
                                        if (typeof (message.Command) !== "undefined" && typeof (message.Args) !== "undefined") {
                                            switch (message.Command.toLowerCase()) {
                                                case "alive": {
                                                    _moduleState = $magma.ModuleDefinitionState.Active;
                                                    //This is a heartbeat to tell us the application is not timing out.
                                                    _lastCall = Date.now();
                                                } break;
                                                case "stop": {
                                                    _moduleState = $magma.ModuleDefinitionStatmessage.Unloaded;
                                                    self.close();
                                                } break;
                                                default: {
                                                    throw new $magma.Exception("The module '" + _internalName + "' sent an illegal system command '" + message.Command + "'.");
                                                } break;
                                            }
                                        }
                                    } break;
                                    default: {
                                        //Tranpose the object.
                                        var tsMessage = new $magma.Message();
                                        tsMessage.StatusCode = message.StatusCode;
                                        tsMessage.SenderIdentity = _internalName;
                                        tsMessage.VerboseMessage = message.VerboseMessage;
                                        try {
                                            tsMessage.Name = message.Name;
                                            tsMessage.Payload = message.Payload;
                                        } catch (a) {

                                        }
                                        $magma.Tell(tsMessage);
                                    } break;
                                }
                            } else {
                                throw new $magma.Exception("The module '" + _internalName + "' passed a malformed object. The message was disposed.");
                            }
                        }
                        //$magma.Tell(e);
                    })

                } else {
                    throw new $magma.Exception("The module '" + _internalName + "' cannot be loaded because an attempt to load it was already made.");
                }
            }

            if (typeof (type) !== "undefined") {
                _moduleType = type;
            }

            if (_internalName.length > 20) {
                throw new $magma.Exception("The length of module name '" + name + "' exceeds 20 characters. Could not create module definition.");
            }

            if (typeof (name) !== "undefined") {
                _internalName = name;
            } else {
                throw new $magma.Exception("The name of the module must be provided. Could not create module definition.");
            }


            if (typeof (location) !== "undefined") {
                _location = location;
            } else {
                throw new $magma.Exception("The location of the module source *.js must be provided. Could not create module definition.");
            }

            //Public Members
            Object.defineProperty(this, "Name", { get: function () { return _internalName; } });
            Object.defineProperty(this, "State", { get: function () { return _moduleState; } });

            //Sends the method request to the module.
            this.Send = function (obj) {
                if (obj instanceof $magma.MethodRequest && obj.targetModule.toLowerCase() == _internalName.toLowerCase()) {
                    var found = false;
                    for (var n = 0; n < _sentRequests.length; n++) {
                        if (_sentRequests[n].RequestID == obj.RequestID) {
                            found = true;
                        }
                    }
                    if (found) {
                        throw new $magma.Exception("The provided method request '" + obj.RequestID + "' has already been queued for transmission to the module.");
                    }
                    _sentRequests[_sentRequests.length] = obj;
                    obj.Sent = true;
                    _workerRef.postMessage(JSON.stringify(obj));
                }
            }

            this.Load = _loadFunc;

        };

        Object.freeze($magma.ModuleDefinition);

        //Construct a Message object when you want to post a message to a web worker. 
        $magma.Message = function () {
            this.StatusCode = $magma.Status.Undefined;
            this.Name = "";
            this.SenderIdentity = null;
            this.VerboseMessage = "";
            this.Payload = {};
        }

        //The scheduler command object tells the scheduler what to do with the web worker.
        $magma.SchedulerCommand = function () {
            this.Command = "";
            this.Args = {};
            this.Reason = "";
        }

        Object.freeze($magma.SchedulerCommand);

        Object.freeze($magma.Message);

        //Seal the deal. ;)
        (function () {
            var _messages = new $magma.MessageBus();
        }.bind($magma))();

        Object.freeze($magma);

        //GO
        $magma.Init();

    }
})();