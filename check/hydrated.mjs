// Hydration driven against a real DOM, and measured with a `MutationObserver`.
//
// **The observer is the whole point.** Counting what lath asked the host to do would only say that
// lath believes it touched nothing; an observer is the browser's own answer, and it sees a write that
// the framework did not know it was making — an attribute set to the value it already held, a child
// list replaced with the same children, a text node rewritten with the same text.
//
//     npm install jsdom
//     slate js check/hydrated.slx -o check/hydrated.js
//     node check/hydrated.mjs check/hydrated.js
//
// It prints `ok` and nothing else when hydration is right, and names what it wanted otherwise.

import { JSDOM } from "jsdom"
import { readFileSync } from "node:fs"

const program = readFileSync(process.argv[2], "utf8")

let failed = 0

const want = (what, got, wanted) => {
    if (got === wanted) return

    console.log("FAIL " + what + ": got " + JSON.stringify(got) + ", wanted " + JSON.stringify(wanted))
    failed += 1
}

// A page with whatever markup we were given already inside `#app`, and the program run against it.
const page = (inside) => {
    const dom = new JSDOM(
        "<!doctype html><html><body><div id=\"app\">" + inside + "</div></body></html>",
        { url: "https://example.test/", runScripts: "outside-only" })

    const w = dom.window
    const said = []

    w.console = { ...w.console, log: (...parts) => said.push(parts.join(" ")) }

    return { w: w, said: said, run: () => w.eval(program) }
}

// -- what a server would have sent ----------------------------------------------------------------

// **The markup comes from lath's own string host**, which is what makes the whitespace question
// answer itself: a tree hydrating against its own output is exact, and a page pretty-printed by
// anything else is a mismatch and ought to be.
const first = page("")

first.run()

want("an empty container is rendered rather than adopted", first.said[0], "rendering")

const markup = (first.said[1] ?? "").replace(/^markup /, "")

want("and the markup is not empty", markup.length > 0, true)

// -- hydrating it makes no mutations at all --------------------------------------------------------

const second = page(markup)
const container = second.w.document.getElementById("app")
const records = []
const observer = new second.w.MutationObserver((rs) => { for (const r of rs) records.push(r) })

observer.observe(container, { childList: true, attributes: true, characterData: true, subtree: true })

second.run()

// jsdom delivers records as microtasks, so the queue has to turn before they can be read.
await new Promise((r) => setTimeout(r, 0))

const seen = records.concat(observer.takeRecords())

want("a container with markup in it is adopted", second.said[0], "hydrating")
want("the program reached the end", second.said[1], "ready")
want("and the page was not touched at all", seen.map((r) => r.type + " on " +
    (r.target.nodeName || "?")).join(", "), "")
want("the markup is still exactly what was sent", container.innerHTML, markup)

// -- and the handlers it attached actually work ----------------------------------------------------

// **This is what hydration is FOR.** The markup a server sent is already the page; what it does not
// have is a single event listener, and the tree that was walked is what installs them.
const tick = second.w.document.getElementById("tick")

want("the counter is the one from the markup", tick === null ? "<none>" : tick.textContent, "0")

tick.dispatchEvent(new second.w.MouseEvent("click", { bubbles: true }))

await new Promise((r) => setTimeout(r, 10))

want("a hydrated tree still renders when its state changes",
    second.w.document.getElementById("tick").textContent, "1")

// -- markup that does not match is a fault, and says where -----------------------------------------

const bent = markup.replace("<h1>Hydrated</h1>", "<h2>Hydrated</h2>")

want("the bent markup really is different", bent === markup, false)

const third = page(bent)
let complained = ""

try {
    third.run()
} catch (e) {
    // **A slate fault reaches JavaScript as an `Error` carrying the thrown VALUE on `.value`**, its
    // `.message` being the runtime's own word for what happened. Reading `.message` here would
    // compare against `"thrown"` for ever and pass for any fault at all.
    complained = String(e && e.value !== undefined ? e.value : (e && e.message ? e.message : e))
}

want("a mismatch faults rather than falling back to a client render", complained.length > 0, true)
want("and names the path", complained.includes("#app > 0 > 0"), true)
want("and says what the tree wanted", complained.includes("wants <h1>"), true)
want("and what the page had", complained.includes("has <h2>"), true)

if (failed === 0) console.log("ok")

process.exit(failed === 0 ? 0 : 1)
