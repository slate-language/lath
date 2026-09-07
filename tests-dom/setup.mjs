// A document, for the half of this package that has one.
//
//     npm install
//     NODE_OPTIONS="--import ./tests-dom/setup.mjs" slate test --js tests-dom
//
// **`slate test --js` writes the whole suite into one file and runs `node` on it**, so there is
// nowhere to put a `<script>` and no page to load. `--import` is the seam: node runs this module
// before the program, and slate's runtime takes the page off `globalThis.document` -- once, at the
// top of its own module -- so a document that is there by then is the document the suite renders
// into.
//
// **jsdom rather than a fake document written beside the code it checks, and that is the point.** A
// shim written here would agree with `dom.slx` by construction: every mistake this package, or
// slate's own `js_rt_dom.sysl`, could make about what `setAttribute`, `replaceChildren` or
// `addEventListener` do, the shim would make too, and the run would pass. jsdom is somebody else's
// reading of the same specification and is free to disagree. It is how `mounted` was found.
//
// ## The one thing a slate test cannot do, and how it is handed to it
//
// **A slate program has no way to reach a JavaScript global** -- a builtin is a parameter of the
// emitted program, not a name taken off `globalThis` -- so anything a test needs that the `dom`
// package has no name for has to arrive through a name it does have. `dispatch` and `observe` are
// that package's own now, and `probe.slx` calls them; one thing is left here:
//
// - **`data-navigations` is how many clicks jsdom was allowed to follow.** jsdom raises
//   *"Not implemented: navigation to another Document"* when a click on an anchor is left alone, so
//   the count of those IS the count of links the router declined -- which is what says the refusals
//   were refusals and not a broken link. It is jsdom's CONSOLE talking, not the page, which is why
//   no name on any DOM package could answer it.
//
// **It is published on a `<meta>` in the HEAD**, so that writing it is not a mutation the observer
// in `probe.slx` -- which watches the body -- would count. It does not fake anything: the number is
// jsdom's own.

let JSDOM
let VirtualConsole

try {
    const jsdom = await import("jsdom")

    JSDOM = jsdom.JSDOM
    VirtualConsole = jsdom.VirtualConsole
} catch (e) {
    console.error("jsdom is not installed: run npm install")
    process.exit(1)
}

let navigations = 0

// **jsdom's own console, intercepted rather than silenced.** A navigation it would not perform is
// the thing the router tests measure, so it is counted here and kept off the terminal; anything else
// jsdom has to say is passed straight through, because a real error swallowed by a harness is how a
// suite goes quietly green.
const console_ = new VirtualConsole()

console_.on("jsdomError", (e) => {
    const said = String(e && e.message ? e.message : e)

    if (said.includes("Not implemented: navigation")) {
        navigations += 1

        publish()

        return
    }

    console.error(said)
})

for (const kind of ["log", "info", "warn", "error", "dir", "table", "trace"])
    console_.on(kind, (...parts) => console[kind === "dir" ? "log" : kind](...parts))

const dom = new JSDOM(
    "<!doctype html><html><head></head><body><div id=\"page\"></div></body></html>",
    { url: "https://example.test/", virtualConsole: console_ })

const w = dom.window
const doc = w.document

// Where the count is published. **In the HEAD on purpose**: `probe.slx`'s observer watches the body,
// so a count written anywhere under it would be a mutation the next read counted.
const probe = doc.createElement("meta")

probe.id = "lath-probe"

doc.head.appendChild(probe)

const publish = () => probe.setAttribute("data-navigations", String(navigations))

publish()

// The names the `dom` package reads off `globalThis`, and the classes a page has.
// **`addEventListener` has to be the WINDOW's**: node's global is an `EventTarget` of its own, so
// leaving it alone would register `popstate` on something the page never raises one on.
//
// **`AbortController` is installed from the WINDOW too, and for the same kind of reason.** It is how
// `off` takes a listener back -- `addEventListener(kind, f, { signal })` and `abort()` -- and a
// signal built in node's realm handed to an element in jsdom's is a foreign object to the interface
// that checks it: *parameter 3 dictionary has member 'signal' that is not of type 'AbortSignal'*.
// A page has one realm and never meets this; a harness has two.
const install = (name, value) => {
    try {
        Object.defineProperty(globalThis, name,
            { value: value, writable: true, configurable: true, enumerable: true })
    } catch (e) {
        globalThis[name] = value
    }
}

install("window", w)
install("document", doc)
install("location", w.location)
install("history", w.history)
install("localStorage", w.localStorage)
install("Node", w.Node)
install("Element", w.Element)
install("HTMLElement", w.HTMLElement)
install("MutationObserver", w.MutationObserver)
install("MouseEvent", w.MouseEvent)
install("KeyboardEvent", w.KeyboardEvent)
install("Event", w.Event)
install("AbortController", w.AbortController)
install("AbortSignal", w.AbortSignal)
install("addEventListener", w.addEventListener.bind(w))
install("removeEventListener", w.removeEventListener.bind(w))
install("dispatchEvent", w.dispatchEvent.bind(w))
