# The DOM host, against a real DOM

**This directory is NOT under `tests/`, and that is deliberate.** `slate test tests` walks every
file below `tests/`, and `counter.slx` is a page rather than a test — it calls `domHost`, which
faults under the interpreter because there is no document. Putting it there fails the suite with the
very refusal that proves `slate:dom` is working.

`dom.slx` is the second implementation of the host adapter, and the argument for the
adapter is that one set of components renders in two places. **A contract only one implementation is
ever checked against is a contract with one implementation** — so this is where the other one is run.

    npm install jsdom
    slate js check/counter.slx -o check/counter.js
    node check/drive.mjs check/counter.js

    slate js check/routed.slx -o check/routed.js
    node check/routed.mjs check/routed.js

    slate js check/hydrated.slx -o check/hydrated.js
    node check/hydrated.mjs check/hydrated.js

Each prints `ok` and nothing else when it is right, and names what it wanted otherwise.

**`routed.slx` is the router's half**, and it is here for a sharper reason than the host's: the whole
of what `lath/router` decides about a click is read off `mods` and `button`, which the browser puts
on the event and nothing in `slate test tests` can produce. A cmd-click, a ctrl-click, a shift-click,
an alt-click, a middle click and a link to another origin all have to be left to the browser, and a
plain left click on the same anchor has to be taken -- which is the pair that says the six were
refused for what they were and not because the link was broken.

**`Not implemented: navigation to another Document` six times is the PASS, not noise.** jsdom prints
it when a click it was given is allowed to do what a click does, so the count is exactly the six the
router declined. A run where the router wrongly swallowed one would print five.

**`hydrated.slx` is measured by a `MutationObserver` and could not be measured any other way.**
Counting what lath asked the host to do would only say that lath believes it touched nothing; an
observer is the browser's own answer, and it sees a write the framework did not know it was making —
an attribute set to the value it already held, a child list replaced with the same children, a text
node rewritten with the same text. **The assertion is that the observer records NOTHING.**

The same driver runs the program three times, which is what makes the measurement honest: once
against an empty container, where it renders and prints the markup a server would have sent; once
against that markup, where it must adopt it and touch nothing; and once against markup with one tag
changed, where it must fault naming the path and both sides. **The markup comes from lath's own
string host**, so the whitespace question answers itself — a tree hydrating against its own output is
exact, and a page pretty-printed by anything else is a mismatch and ought to be.

**A slate fault reaches the driver as an `Error` carrying the thrown value on `.value`**, its
`.message` being the runtime's own word. Reading `.message` compares against `"thrown"` for ever and
passes for any fault at all, which cost a round trip here.

**jsdom rather than a fake document written here, and that is the point.** A shim written beside the
code it checks agrees with that code by construction: every mistake `dom.slx`, or slate's own `js_rt_dom.sysl`,
could make about what `setAttribute`, `replaceChildren` or `addEventListener` do, the shim would make
too, and the run would pass. jsdom is somebody else's reading of the same specification and is free
to disagree.

## What it asserts, and why each one is here rather than in `slate test tests`

| | |
|---|---|
| the tree reaches the page, with its attributes | nothing else runs `slate:dom` at all |
| three clicks are three | a host that only ever ADDED listeners would run every closure the component had ever had, and the reading would climb by more than one |
| the second counter is its own | state per instance, through a real event rather than a call to `flush` |
| text reaches the page as text | the DOM host builds text nodes and never markup, which is what makes a renderer safe by construction rather than by escaping — this says it stayed that way |
| a node that stops being rendered leaves the page | a component at the very top has no host node above it, so the reconciler has nobody to tell — `mounted` on every commit is what closes that, and the string host cannot show it |
| the page still works after a node was dropped | `release` giving back a handle that was still in use would be silent until something else took the slot |

**It is not part of `slate test tests`.** jsdom is not a dependency of this repo, and making it one
puts an `npm install` in front of the suite's one command. That is the user's decision to make; until
then this is run by hand, and it has been.

## What is NOT checked here, and cannot be

A real browser. jsdom is a faithful DOM and not a rendering engine: it has no layout, no paint and no
compositor, so nothing here says the counter is *visible*. Open `examples/web/index.html` for that —
it is the same components, built the same way.
