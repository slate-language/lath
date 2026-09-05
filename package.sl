{
    name: "lath",
    version: "0.5.1",

    // What a bare `import ... from lath` reaches. The framework proper: elements, components,
    // hooks and the reconciler, and nothing that needs a browser.
    main: "lath.slx",

    // The other modules a consumer may name, `lath/<key>`.
    //
    // **The DOM host is separate because most programs must not have it.** A page rendered to
    // markup beside `slate:http`, or under node, never touches a document -- and `dom.slx` imports
    // `slate:dom`, which is the one module that works in one host out of three. Listing it here
    // rather than folding it into `main` is what keeps it out of a program that does not ask.
    // **The router is separate for the same reason and its own.** It needs nothing a browser has --
    // a path is handed in and never read from the world -- so a server importing it does not import
    // the reconciler's whole surface, and a page importing it does not import a document.
    modules: {
        dom: "dom.slx",
        router: "router.slx",
    },
}
