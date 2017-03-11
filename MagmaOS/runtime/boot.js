//The bootloader is responsive for initializing the $magma namespace and facilitating communication between the kernel and other modules.
(function () {
    if ($magma) {
        console.log("Magma already loaded. Error during initialization.");
    } else {
        $magma = function () {
            this.Version = { Major: 0, Minor: 1, Revision: 1, Name: "Mainline" };
        }();

        //Low level exception handling.
        $magma.Exception = function (message) {
            this.message = message;
            this.name = "MagmaRuntimeException";
        }


        $magma.Modules = {
            _modules: new Array(),
            set AddModule(module) {
                if (module instanceof $magma.ModuleDefinition) {
                    //Duplicates not allowed.
                    for (var n = 0; n < _modules.length; n++) {
                        if (_modules[n])
                    }
                } else {
                    throw new $magma.Exception("The provided module was not of the correct type.");
                }
            }
        }

        $magma.ModuleDefinitionType = { Undefined: 0, Kernel: 1, Shell: 2, Application: 3, Peripheral: 4 };
        $magma.Status = { Undefined: 0, Success: 1, Error: 2};

        //Construct module definition. Required before boot to identify necessary modules.
        $magma.ModuleDefinition = function () {

            //Private Members
            var _internalName = "";
            var _location = "";
            var _moduleType = $magma.ModuleDefinitionType.Undefined;

            //Public Members
            Object.defineProperty(this,"Name",{get:function(){return this._internalName;}});



            Object.freeze(this);
        };

        //Construct a Message object when you want to post a message to a web worker. 
        $magma.Message = function () {
            this.StatusCode = $magma.Status.Undefined;
            this.Name = "";
            this.VerboseMessage = "";
            this.Payload = {};
        }

    }
})();