# MagmaOS
Web based operating environment with kernel and multi-threading.

## Framework Agnostic

This project is explicitly framework agnostic. If you are to contribute to this project you should be adept at vanilla JavaScript. Use of frameworks and third party libraries such as **jQuery**, **AngularJS** and other libraries is strictly forbidden. If you are critical of this decision I'd love to hear your thoughts, but would recommend you consider the benefits of having this approach when developing an already heavily layered environment.

## Topology
The project is imagined as a platform for developing rich applications in a desktop-esque environment. The plan is to have modules execute under web worker instances with strictness enabled, so that true multi-tasking can be achieved. These modules might provide services to the engine as a whole such as IO facilitators/emulators, rendering engines and logic libraries which can communicate with a presentation engine (window manager) to provide an interface.

The application begins by loading **/runtime/boot.js**, this component initializes the global $magma scope, as well as logic to load and facilitate communication between modules and tasks.

Each module is then instantiated as a **WebWorker**, and **some of the standard modules are added by deafult as part of the boot.js initialization**.

## Short Term Goals
The project aims to present a functional shell with basic file operations, and a limited selection of viewers & editors. The main work involved in creating this functionality is in the development of three initial modules:

* Kernel
* WindowManager
* Navigator

### Kernel
The kernel is responsible for interacting with the server to read & write binary data blocks, it then uses various caching mechanisms and data assimilation techniques to construct useful information from the binary data. The file system logic exists only in the browser, or explicitly the kernel, with the actual binary data stored on a remote server. Seek & read operations are performed asynchronously by the kernel and provided to other applications in formats they desire using various functions exposed and available by the Kernel.

### WindowManager
The window manager is a unique module that exists in the global scope, alongside **boot.js**. By design, only the window manager and boot.js logic are permitted to exist outside of web worker modules with strictness enabled. The window manager exclusively deals with the DOM and is the only facilitator of user interaction. It is responsible for providing windows and user controls, and can allow these controls to bound to methods available in any web worker modules.

### Navigator
The navigator is responsible for providing the baseline user experience you'd expect from a desktop environment. The navigator works closely with the WindowManager, and defines many interface components and ways to interact the system as a whole. The navigator is responsible for allowing the user to access other resources, and so contains basic functionality for displaying data both in file navigators and simple viewers. It also handles file associations and handover to other discrete modules and applications to serve and work with content.

## Long Term Goals

As the functionality of the project expands and more technologies become widely available to browsers, more content-rich applications will be developed for **Project Magma**. The focus applications immediately visible are the following:

* Integrated Development Environment (for JS Modules & Magma Applications)
* Hex Editor
* WYSIWYG Text Editor
* 2D Game Engine + Examples

These applications will be reliant on system modules being developed and matured so that desktop experience features such as **Audio** and **Graphics** subsystems are available. These may have to sit in the global scope.
