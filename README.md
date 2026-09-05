# lath

A React-shaped UI framework, written in [slate](https://github.com/slate-language/slate).

A component is a function of its props, state lives in hooks kept on call-order slots, and a change
re-renders the component that owns it while the reconciler matches the new children against the old
by key and moves them into place. That is React's model **and** React's mechanism.

The name is the strip a roof's slates are nailed to — the frame the pieces hang on.

```
slate add github.com/slate-language/lath
```

```
import { createElement, Fragment, mount, html, flush, useState } from lath

Counter(props) =
    val [count, setCount] = useState(0)

    <div class="counter">
        <h1>Count: {count}</h1>
        <button onClick={() -> setCount(count + 1)}>+1</button>
    </div>

val root = mount(<Counter/>)

print(html(root))
```

`createElement` and `Fragment` have to be imported wherever an element is written: slate's parser
desugars `<div/>` into a call to them, and the language itself has no idea what an element means.

**A COMPONENT TAKES ITS PROPS, EVEN WHEN IT IGNORES THEM.** `Counter(props)` or
`Counter({ start = 0 })` — never `Counter()`. React allows the empty parameter list; slate checks
arity, and the framework calls every component with one argument. Writing `Counter()` gets

    error: this function takes 0 arguments and was given 1
       --> lath.slx:199:19

which names *this package* rather than the component, because the call is here. Read past the path:
the line that is wrong is the one in your own program.

## What is here

| | |
|---|---|
| `createElement`, `Fragment` | what slx desugars into |
| `useState`, `useReducer`, `useRef`, `useMemo`, `useCallback`, `useEffect` | hooks |
| `createContext(default)`, `useContext(ctx)` | a value handed to a whole subtree |
| `memo(Component, areEqual)` | a component that is not rendered again while its props are the same |
| `Boundary` | a component that renders a fallback when its subtree faults |
| `createPortal(element, node)` | a subtree rendered into a container somewhere else |
| `mount(element, host)` | render, and keep the tree so it can render again |
| `hydrate(element, host)` | the same render, adopting the markup already on the page |
| `flush(root)` | render every change since the last one, now |
| `html(root)` | the tree as markup — the string host's answer |
| `stringHost()` | the default host |
| `domHost(selector)` | the other one, in `lath/dom` — a real page |
| `router(routes, at)`, `Link` | one URL, one view, in `lath/router` |
| `usePath()` | the address bar as state, in `lath/dom` |

## Three modules, and the splits are not cosmetic

`lath` is the framework, `lath/dom` is the browser host and `lath/router` is the router.

**Most programs must not have `lath/dom`.** It imports `slate:dom`, which works in a browser and
faults everywhere else — so a page rendered to markup beside `slate:http`, or a component tested
under the interpreter, has no business loading it.

**`lath/router` is separate for its own reason: so that a server can import it.** It is handed a path
and never reads one, so nothing in it needs a browser — which is what lets the same routes and the
same views render on a server and in a page.

```
import { createElement, Fragment, mount, useState } from lath
import { domHost } from lath/dom

mount(<Counter/>, domHost("#app"))
```

Then `slate js app.slx -o app.js` and a `<script src="app.js">` beside a `<div id="app">`. The
emitted file is self-contained — the slate runtime, this framework and the program in one — so there
is no bundler and nothing to install.

## The router

A route is a path template and a function, and there is nothing else to learn. `"/notes/:id"` matches
`/notes/42` and binds `id`; `"*"` matches anything and is the last case. There are no regular
expression routes, because a template is what people write and a regular expression is what they
debug.

```
import { createElement, Fragment, mount, html } from lath
import { router, Link, Anything } from lath/router

Home(props) = <p>home, and <Link to="/notes/7">a note</Link></p>
Note(props) = <p>note {props.id}</p>
Missing(props) = <p>nothing at {props.at}</p>

routes = [
    { path: "/",          view: (m) -> <Home/> },
    { path: "/notes/:id", view: (m) -> <Note id={m.params.id}/> },
    { path: Anything,     view: (m) -> <Missing at={m.path}/> },
]

print(html(mount(router(routes, "/notes/7"))))
```

**A view is handed one record**, `{ params, query, path }`, so a route view and an ordinary component
read alike and a query arrives without changing anybody's signature. The query is parsed into strings
by [`slate:url`](https://github.com/slate-language/slate/blob/dev/docs/library/url.md), whose rules
come with it: a repeated name is the last one, and a bare `?debug` is present and empty.

**The path is handed in and never read from the world.** That is the whole design: `req.path` on a
server and `usePath()` in a page, and the router itself knows about neither — which is what lets one
set of routes render in both places. `tests/server.slx` renders them through `slate:http` and
`tests-dom/router.slx` renders the same ones into a document.

**Nothing matching is a fault** unless a `"*"` route says otherwise. A router that quietly rendered
nothing would send the reader to look at the view, and the mistake is a missing route.

**A `Link` is a real `<a href>`** carrying a `data-lath-link` mark, so the markup is the same on a
server and in a browser, the link works on a page whose script has not run, and a middle click is a
middle click. In a page, `usePath()` tells every `Link` to push the address instead of following it:

```
import { domHost, usePath } from lath/dom

App(props) = router(routes, usePath())

mount(<App/>, domHost("#app"))
```

**No nested routes in this version.** A nested router is a component that renders a router, which
needs nothing from here.

## Context, memo, boundaries and portals

**A context hands a value to a whole subtree without threading a prop through everything in
between.** The provider is a field of the context rather than a second name to import, which is
React's arrangement and works here because a dot inside a tag is an ordinary field selection.

```
import { createContext, useContext } from lath

val Theme = createContext("light")

App(props) = <Theme.Provider value="dark"><Page/></Theme.Provider>

Heading(props) = <h1 class={useContext(Theme)}>{props.children}</h1>
```

A consumer with no provider above it gets the context's default rather than a fault, so a component
that reads a theme can be rendered on its own. **`useContext` keeps no hook slot**, so unlike
`useState` it may be called inside a condition.

**`memo` is the one place the framework does not render.**

```
val Row = memo(row)
val Row = memo(row, (was, now) -> was.id == now.id)
```

Props are compared with slate's `==`, which is **structural** where React's default is field-by-field
identity — the same divergence the dependency lists have, and it means an options object rebuilt
with the same fields is not a change. A handler written as a fresh lambda every render still is one,
a function comparing by identity; `useCallback` is what that is for, there as here. **A provider that
changes value renders through every memo below it**, which is a deliberate pessimism: tracking which
subtree reads which context is a great deal of machinery to avoid a render on the one turn a
provider actually changed.

**A render fault stays a fault, and `Boundary` catches one.**

```
<Boundary fallback={(e) -> <p class="broken">{e.message}</p>}>
    <Page/>
</Boundary>
```

slate has [two failure channels](https://github.com/slate-language/slate/blob/dev/docs/reference/faults.md)
and they decide this rather than React does: a result is for a condition the caller was always going
to deal with, and a component that cannot render is a defect in the program. So no component is
handed an `{ ok: false }` to inspect — the fault unwinds to the nearest boundary exactly as it would
unwind to a `try`, which is what a boundary is. **Nothing is swallowed**: the failed subtree is
unmounted and `fallback` is called with the fault object, `message`, `line` and `file` and all.

**A boundary does not catch its own render**, which is React's rule for React's reason — the fallback
is this component's answer, and a component whose own body faults has nothing left to answer with.
Put a boundary above it, and that one catches it.

**A portal renders a subtree into a container of the host's own kind.**

```
createPortal(<Dialog/>, byId("modals"))
```

Its children are that node's children, and the parent that wrote the portal is handed none of them —
which is what lets a dialog written inside a table row escape the row. **On a string host it renders
into the node it was given** and `html(root)` does not show it, which is the honest answer rather
than a fault: a portal is content put somewhere else, and `serialise` of the container is how a
server asks what went there. Hold the container in a `useMemo` rather than looking it up on every
render — `byId` mints a fresh handle each time, and a portal handed a different container is a
different portal.

## Hydration

`hydrate` is `mount` with the creating left out: every node it would have made, it takes from the page
instead.

```
import { createElement, Fragment, hydrate } from lath
import { domHost } from lath/dom

hydrate(<App/>, domHost("#app"))
```

**A hydrated page makes no DOM mutations at all**, and that is measured rather than asserted —
`tests-dom/hydrate.slx` watches the page with a `MutationObserver` and requires it to record nothing.
Everything that would have been created is adopted, every attribute is compared before it is written,
and the child lists are not set at all, each child having been adopted from its parent in order.

**Handlers are attached, and that is what hydration is for.** The markup a server sent is already the
page; what it does not have is a single event listener, and the tree this walks is what installs
them.

**Markup that does not match is a fault**, naming the path and both sides:

    the page does not match what was rendered: at #app > 0 > 1 the tree wants <b> and the page has <i>

**There is no falling back to a client render.** A page that quietly rebuilt what it could not adopt
would hide a server and a client that disagree — which is the one defect hydration exists to expose —
and it would hide it behind a page that looks right.

**A string host refuses to hydrate** rather than answering nothing: a server renders the markup a page
adopts and never adopts anything itself, and a silent `null` there would turn `hydrate` into `mount`
without saying so.

## The host is behind an adapter, and there are two of them

Nothing in the reconciler knows what a node is. `stringHost` builds plain objects and serialises
them; `domHost` creates real elements through the same nine functions — `element`, `text`,
`setProps`, `setText`, `serialise`, `drop`, `mounted`, `adopt` and `patch`. **So one set of
components renders to HTML on a server and into the document in a browser**, which is the thing that
makes this worth writing in slate rather than reaching for React.

**Three of the nine were added by writing a second implementation and then a third use**, which is
the general lesson: an adapter with one implementation is a guess. It shipped with six.

**`adopt(parent, index)` is the newest**, and it is what hydration is: *give me the child that is
there*. It answers `{ node, tag, text }` rather than a bare node, because `lath.slx` may not import
`slate:dom` — the host is the only thing that knows what a node is, and asking a node its tag has to
be its question. `parent` of `null` means the host's own container, which is the one place the
framework has no node to name. **A string host's `adopt` faults**, a server being what renders the
markup a page adopts.

**`drop` and `mounted` are the two the string host does not need**, and they were added when the DOM
host was written rather than guessed at in advance:

- **`drop(node)`** is a node the framework has torn down. A string host's node is an ordinary object
  the collector takes; a DOM host hands out a handle into a table it keeps, and a node nobody tells
  it about is a slot held for the life of the page.
- **`mounted(nodes)`** is the top of the tree, handed over whenever that set **changes**. A component
  at the very top has no host node above it, so when it renders a different set of nodes the
  reconciler has nobody to tell — for a string host that is invisible, `html` walking the tree afresh
  whenever it is asked, and for a DOM host it is an element left on the page after the program
  stopped rendering it. It is compared first because handing a host the same list again is a whole
  child list replaced with itself, which an observer sees and a scroll position is lost to.

**`patch(parent, ops)` is what `setKids` became**, and it is the reason a keyed reorder moves rows
rather than rebuilding them. `ops` says what CHANGED, in order — `{ kind: "remove", node }` and
`{ kind: "insert", node, before }`, where `before` of `null` means the end and where inserting a node
the parent already holds MOVES it, which is what `insertBefore` does. **A host is handed the whole
batch rather than one operation at a time**, which is the difference between the two kinds of host: a
host that can move a single child walks the list, and one that can only write a whole child list
applies the batch to a list of its own and writes once.

`tests/host.slx` and `tests/reconcile.slx` pin all of it against a recording host, which is how a
contract with two implementations gets checked without a document in the room.

## What a handler is given

**A record, not the event.** `MouseEvent` has no representation in slate and inventing one would mean
inventing a foreign value, so `slate:dom` builds an object at the moment the handler fires:

| | |
|---|---|
| `type` | `"click"`, `"input"`, … |
| `value` | what the target holds now, as a string, or `null` |
| `checked` | a checkbox's state, or `null` |
| `key` | for a keyboard event |
| `mods` | `{ meta, ctrl, shift, alt }` — which modifiers were down |
| `button` | `0` left, `1` middle, `2` right, or `null` for a non-mouse event |
| `stop()`, `prevent()` | `stopPropagation` and `preventDefault` |

**`mods` and `button` were added to `slate:dom` for `Link`**, and they are what a link cannot be
written without: a router that intercepted every click would swallow cmd-click, shift-click and
middle-click, which is the most ordinary thing anybody does to one.

A counter reads none of it. A form reads `e.value`, which is a *property* and not the attribute — the
host sets it as one, which is what keeps a re-render from freezing a field somebody is typing in.

## Where it diverges from React, deliberately

- **Dependencies are compared with slate's `==`, which is structural.** `[1, 2] == [1, 2]` is true
  here and false in JavaScript, so an object rebuilt with the same fields is not a change. It is the
  host language's own answer and it removes the surprising direction — recomputing when nothing
  changed.
- **`class`, not `className`.** React's spelling exists because JSX compiles into a JavaScript object
  literal where `class` was reserved. Nothing here is.
- **Children arrive as one array**, not as trailing arguments: slate has no rest parameter, and an
  array is what `props.children` holds anyway.
- **An `undefined` child is refused by slate before the framework sees it** — an element's children
  travel as an array literal and slate refuses `undefined` in an array. `<p>{props.title ?? null}</p>`
  is what a program writes, and `null` renders nothing.

  **The better answer is to take the props apart with defaults**, which is what React code does
  anyway and what slate's patterns learned in order to make this pleasant:

  ```
  Card({ title = "Untitled", size = 1, children }) =
      <div class={"card s" + string(size)}><h2>{title}</h2>{children}</div>
  ```

  A default fires on **absence and nothing else** — a `title` of `0`, `false`, `""` or `null` is the
  value that was given, where JavaScript's `||` would have replaced all four.

## Running the tests

**Two commands, and the second one needs a document.**

```
slate test tests
npm install
NODE_OPTIONS="--import ./tests-dom/setup.mjs" slate test --js tests-dom
```

They are written in slate and run by slate's own runner, which is how anybody using this package
would run their own.

**`tests-dom/` is a separate directory because `slate test tests` walks everything below `tests/`**,
and every file there calls `domHost`, which faults under the interpreter — so it would fail the suite
with the very refusal that proves `slate:dom` is working. `tests-dom/setup.mjs` builds a
[jsdom](https://github.com/jsdom/jsdom) page and installs it before the program runs, which is what
`--import` is for.

**jsdom is a dev dependency of this repository and nothing else.** A program that *uses* lath never
sees npm: `slate add github.com/slate-language/lath` fetches slate source, and `slate js` writes one
self-contained file. The `package.json` here exists so that the framework's own DOM half can be
tested against somebody else's reading of the specification rather than against a fake document
written beside it.

## Requirements

slate **0.0.28** or newer, unchanged in lath 0.4.0. Three things arrived in that release for this
package: **`slate:url`**, so that the percent-coder a router needs can be imported by a page without
dragging a whole HTTP server in with it; **`mods` and `button` on a handler's event record**, without
which `Link` could not tell a plain click from a cmd-click; and **`children`, `tagName`, `nodeText`
and `attribute` on `slate:dom`**, without which nothing could read a page at all and `hydrate` could
not exist.

**`Host`'s `setKids` became `patch` in 0.4.0**, which is the one breaking change: a host of your own
is now told what CHANGED about a parent's children — `{ kind: "remove", node }` and
`{ kind: "insert", node, before }`, in order — rather than being handed the whole list. It is still
nine functions, and `stringHost() with { … }` still gets the rest for free.

**What a real diff is still owed, and it is not this package's to give.** `slate:dom` can set a whole
child list and nothing smaller, so the DOM host applies the operations to a list it keeps and writes
that list with `replaceChildren`: reordering three rows of a thousand is three correct operations and
one write of a thousand nodes. An `insertBefore` and a `removeChild` on `slate:dom` are the whole of
what stands between that and a page that moves three nodes.

The floor before that was 0.0.9, for the two exported types — a `type` declaration could not name one
imported from another file before it, so `type Rendered = { el: Element }` in your own code would not
have compiled. And 0.0.3 before that, for `lath/dom` being a subpath import at all.

## The two types, and what they are for

```
import { createElement, stringHost, Element, Host } from lath

// A component's props are an object and its answer is an element.
box(props: object) -> Element = <div class="box">{props.title}</div>

// A host of your own, checked against the contract.
myHost() -> Host = stringHost() with { serialise: countingSerialise }
```

**`Host` is the nine functions an adapter answers**, and annotating one with it is the only check
there is that it is whole — this package shipped an adapter with six, needed eight to render into a
document and nine to adopt one, and not one of the three was guessable from the first implementation.
`domHost` carries `-> Host` for exactly that reason.

## Licence

ISC.
