// The router driven against a real DOM: clicks, the address bar, and the back button.
//
// **jsdom rather than a fake document**, for `drive.mjs`'s reason: a shim written beside the code it
// checks agrees with that code by construction, and would pass for every mistake `slate:dom` or
// `dom.slx` could make about what `addEventListener`, `pushState` and `popstate` actually do.
//
//     npm install jsdom
//     slate js check/routed.slx -o check/routed.js
//     node check/routed.mjs check/routed.js
//
// It prints `ok` and nothing else when the router is right, and names what it wanted otherwise.

import { JSDOM } from "jsdom"
import { readFileSync } from "node:fs"

const dom = new JSDOM("<!doctype html><html><body><div id=\"app\"></div></body></html>", {
    url: "https://example.test/",
    runScripts: "outside-only"
})

const w = dom.window
const said = []

w.console = { ...w.console, log: (...parts) => said.push(parts.join(" ")) }

w.eval(readFileSync(process.argv[2], "utf8"))

let failed = 0

const want = (what, got, wanted) => {
    if (got === wanted) return

    console.log("FAIL " + what + ": got " + JSON.stringify(got) + ", wanted " + JSON.stringify(wanted))
    failed += 1
}

const view = () => {
    const el = w.document.getElementById("view")

    return el === null ? "<nothing>" : el.textContent
}

// **A click the way a browser makes one**, with the button and the modifiers on it. Everything this
// file is for is the difference between two of these.
const clickOn = (id, extra) => {
    const el = w.document.getElementById(id)

    if (el === null) {
        console.log("FAIL there is no #" + id + " to click")
        failed += 1

        return
    }

    el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...extra }))
}

const settle = () => new Promise((r) => setTimeout(r, 0))

want("the page starts where the URL says", said[0], "at /")
want("the program reached the end", said[1], "ready")
want("the first view is the root's", view(), "home, and a note")

// **A `Link` renders a real anchor, and that is what makes the page work without slate.** The
// attribute is what a delegating host would look for and the `href` is what a browser follows.
const anchor = w.document.getElementById("toNote")

want("a Link is an anchor", anchor === null ? "<none>" : anchor.tagName, "A")
want("with a real href", anchor === null ? "<none>" : anchor.getAttribute("href"), "/notes/7")
want("and the router's mark", anchor === null ? false : anchor.hasAttribute("data-lath-link"), true)

// -- a plain click is the router's --------------------------------------------------------------

clickOn("toNote", {})

await settle()

want("a plain click changes the view without a page load", view(), "note 7, and home")
want("and moves the address bar", w.location.pathname, "/notes/7")

// -- a modified click is the browser's ----------------------------------------------------------

// **This is the assertion the whole of `mods` and `button` was added to `slate:dom` for.** A router
// that took these would swallow cmd-click, shift-click and middle-click, which is the most ordinary
// thing anybody does to a link. Not calling `preventDefault` is the whole of letting the browser
// have it — jsdom does not navigate, so what is checked is that the default was left alone and that
// the router did not render anything.
const modified = [
    ["a cmd-click", { metaKey: true }],
    ["a ctrl-click", { ctrlKey: true }],
    ["a shift-click", { shiftKey: true }],
    ["an alt-click", { altKey: true }],
    ["a middle click", { button: 1 }],
]

for (const [what, extra] of modified) {
    const el = w.document.getElementById("toHome")
    const e = new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...extra })

    el.dispatchEvent(e)

    await settle()

    want(what + " is left to the browser", e.defaultPrevented, false)
    want(what + " renders nothing new", view(), "note 7, and home")
    want(what + " does not move the address bar", w.location.pathname, "/notes/7")
}

// A plain click on the same link does move, which is what says the five above were refused for their
// modifiers and not because the link was broken.
{
    const el = w.document.getElementById("toHome")
    const e = new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })

    el.dispatchEvent(e)

    await settle()

    want("and a plain click on the same link is taken", e.defaultPrevented, true)
    want("landing back at the root", view(), "home, and a note")
}

// -- the back button ------------------------------------------------------------------------------

// **`pushPath` does not raise `onNavigate` and a back does**, which is what `usePath` is written
// around: a push sets the state itself and the listener is only ever the history buttons.
w.history.back()

await new Promise((r) => setTimeout(r, 50))

want("back returns to the note", w.location.pathname, "/notes/7")
want("and the view follows it", view(), "note 7, and home")

// -- a link to somewhere else ----------------------------------------------------------------------

w.history.pushState({}, "", "/away")
w.dispatchEvent(new w.PopStateEvent("popstate", { state: {} }))

await settle()

want("the away page renders", view(), "away, and off site")

{
    const el = w.document.getElementById("toAway")
    const e = new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })

    el.dispatchEvent(e)

    await settle()

    want("a link to another origin is the browser's", e.defaultPrevented, false)
    want("and nothing was rendered for it", view(), "away, and off site")
}

if (failed === 0) console.log("ok")

process.exit(failed === 0 ? 0 : 1)
