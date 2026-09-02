{
    name: "lath",
    version: "0.2.0",

    // What a bare `import ... from lath` reaches. The framework proper: elements, components,
    // hooks and the reconciler, and nothing that needs a browser.
    main: "lath.slx",

    // The other modules a consumer may name, `lath/<key>`.
    //
    // **The DOM host is separate because most programs must not have it.** A page rendered to
    // markup beside `slate:http`, or under node, never touches a document -- and `dom.slx` imports
    // `slate:dom`, which is the one module that works in one host out of three. Listing it here
    // rather than folding it into `main` is what keeps it out of a program that does not ask.
    modules: {
        dom: "dom.slx",
    },
}
