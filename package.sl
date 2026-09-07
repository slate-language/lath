{
    name: "lath",
    version: "0.7.1",

    // What a bare `import ... from lath` reaches. The framework proper: elements, components,
    // hooks and the reconciler, and nothing that needs a browser.
    main: "lath.slx",

    // The other modules a consumer may name, `lath/<key>`.
    //
    // **The DOM host is separate because most programs must not have it.** A page rendered to
    // markup beside `slate:http`, or under node, never touches a document -- and `dom.slx` imports
    // the `dom` package, whose every command wants a page. Listing it here rather than folding it
    // into `main` is what keeps it out of a program that does not ask.
    // **The router is separate for the same reason and its own.** It needs nothing a browser has --
    // a path is handed in and never read from the world -- so a server importing it does not import
    // the reconciler's whole surface, and a page importing it does not import a document.
    modules: {
        dom: "dom.slx",
        router: "router.slx",
    },

    // **The DOM, as a package rather than a builtin.** `slate:dom` was the one module that worked
    // in one host out of three; this is the same forty-four names over `external`, where a node is
    // the element itself rather than a handle into a table the compiler keeps. Only `dom.slx` and
    // `tests-dom/` import it, which is what the `modules` entry above is for.
    //
    // **The import name is `dom` and the module key above is `dom` too, and they do not collide**: a
    // bare `dom` at an import site is this package, and `lath/dom` is the module. The two live in
    // different namespaces and the compiler reads them apart.
    dependencies: {
        dom: { git: "github.com/slate-language/dom", version: "0.1.0" },
    },
}
