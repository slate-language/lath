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
| `style(css)` | a component's stylesheet, registered once for the page |
| `router(routes, at)`, `Link` | one URL, one view, in `lath/router` |
| `useSearch()` | the URL's query as state, in `lath/router` |
| `usePath()` | the address bar as state, in `lath/dom` |
| `atom(initial, write)` | a value outside any component's own tree |
| `createStore()`, `defaultStore()` | where atoms' values actually live |
| `Provider`, `useStore()` | the store a subtree reads its atoms from |
| `useAtom(a)`, `useAtomValue(a)`, `useSetAtom(a)` | an atom's value, or its setter, or both |

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

## Stylesheets

**A component registers the css it needs and the framework puts it on the page once.** The
stylesheet is a file — imported, not quoted — so it stays something an editor highlights and a
browser's dev tools understand.

```
import { createElement, Fragment, mount, style } from lath
import card from "./card.css"

Card(props) =
    style(card)

    <div class="card"><h2>{props.title}</h2>{props.children}</div>
```

`import card from "./card.css"` is [slate's asset
import](https://github.com/slate-language/slate/blob/dev/docs/reference/modules.md): any extension
that is not `.sl` or `.slx` is a file read while the program is compiled and handed over as one
string. It travels inside the program, so there is nothing to install beside the binary and nothing
to fetch at run time, and six components importing one sheet is one string.

**Modern css, and no preprocessor.** Native nesting, custom properties, `@media` and the rest are the
browser's own now; there is no SCSS step here and nothing to configure.

**It is registered once per DISTINCT SHEET, not once per component and not once per render.** The
list is deduplicated by the css itself, which is what makes calling `style` at the top of every
render the right thing to write: a list of fifty cards is one `<style>`.

**It is not a hook.** It keeps no slot, so unlike `useState` it may be called inside a condition —
which is the point, a component that only sometimes renders the thing the sheet is about being the
ordinary case.

**Where it lands depends on the host, and the two answers are the two places a stylesheet can go.**

| | |
|---|---|
| `html(root)` where the tree has a `<head>` | one `<style>` per sheet at the end of the head |
| `html(root)` where it does not — a fragment | one `<style>` per sheet in front of the markup |
| a page | one `<style>` per sheet in the document's head, injected once |

The fragment answer is what makes `html(root)` one self-contained string: drop it in a `<div>` and
the rules arrive before the elements they are about.

**A hydrated page writes none of them.** The `<style>` the server sent is already there, so the host
compares before it writes and the page makes no mutations at all — the same rule that keeps an
attribute already right from being written again. A server's sheets standing inside the container are
kept there across every later render, so a change at the top of the tree does not take a page's
stylesheets off it.

**There is no way to take a sheet back, deliberately.** A sheet is registered by a component that
*uses* it and deduplicated across every component that does, so nothing knows when the last user has
gone; removing one on unmount would strip the rules out from under whoever else asked for them. A
page's stylesheets grow to the set of components it has rendered and stop there.

**Two things are refused.** A sheet that is not text — which is a mistake about the import, and the
fault says so rather than complaining about a string three lines later. And a sheet containing
`</style`, which is the one string that could end the element it is written in: the css is written
raw, because a `>` in a child selector and an `&` in a `content:` string are ordinary css and both
would break if the text were escaped.

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

**A page that means more by following a link says so with `navigateWith`, and what it says wins.**
An application that fetches the record the next page renders from — or keeps the URL in state of its
own — installs a navigator of its own:

```
import { navigateWith } from lath/router

go(to, opts = null)
    if opts == null || opts.push != false then pushPath(to) else replacePath(to)

    setUrl(to)
```

**A page that does this listens for the back button itself**, with `onNavigate` — and `usePath` then
leaves that handler alone, `slate:dom` keeping exactly one of them for the whole program.

**That outranks the one `usePath` installs, and having two slots rather than one is deliberate.**
`useSearch` reads the address bar through `usePath`, so every control that wants a sort order or a
page number registers the built-in navigator as a side effect of asking for the query. Into one slot,
the last control to render would own the page's navigation, and a click would move the address bar and
re-render that control while the application heard nothing at all.

**No nested routes in this version.** A nested router is a component that renders a router, which
needs nothing from here.

### `useSearch()` — the query as state

`useState`'s shape over the address bar. What it is for is that a filter, a sort order, a page number
or an open tab put here is something somebody can bookmark, send to somebody else, and press back out
of — and the same thing put in `useState` vanishes on reload and cannot be linked to.

```
import { useSearch } from lath/router

Filter(props) =
    val [q, setQuery] = useSearch()

    <>
        <input value={q.term ?? ""} onInput={(e) -> setQuery(q with { term: e.value })}/>
        <button onClick={() -> setQuery(q with { page: "2" }, { push: true })}>next page</button>
        <button onClick={() -> setQuery(without(q, "term"))}>clear</button>
    </>
```

**`set` REWRITES the address and does not push, unless it is asked to.** That default is the one a
search box needs: a push per keystroke would leave one history entry per letter and getting off the
page would take twenty presses of back. A page number is the other case, and `{ push: true }` is how
it says so.

**A value of `null` takes the name out of the query**, so `set(q with { term: null })` and
`set(without(q, "term"))` write the same address. Nothing is written as the four letters.

**On a server the query is the one `router()` was handed**, which is why this lives in `lath/router`
and not in `lath/dom`: a server render and the page that hydrates it read the same record, so the
markup matches. On a page it is `usePath` underneath — the address bar, and the back button with it.

**The path and the fragment are kept exactly as they were spelled.** A trailing slash is not a
different route to the *router*, and it is not something a search box is allowed to change either.

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

## App state

**An atom is a value that lives outside any component's own tree, read by whichever components ask
for it.** A context also hands a value to a subtree, but the two move in opposite directions: a
context's value changes because a component *above* the consumer re-rendered, while an atom changes
because something *outside* the tree wrote it — a handler, a timer, a socket — and nothing above the
component is rendering at all.

```
import { atom, useAtom, useAtomValue } from lath

val count = atom(0)
val doubled = atom(get -> get(count) * 2)

Counter(props) =
    val [n, setN] = useAtom(count)

    <button onClick={() -> setN(n + 1)}>{string(n)}</button>

Twice(props) = <p>{string(useAtomValue(doubled))}</p>
```

`atom(initial)` makes a primitive one; `atom(get -> ...)` makes a derived one, read-only, that tracks
whatever it actually asked for on its last computation — no dependency list to get wrong. A derived
atom becomes writable with a second argument, `atom(read, (get, set, v) -> ...)`, which may set
anything, not only what its own `read` reads.

**Every atom's value lives in a store, and `defaultStore()` is the one a program that never mentioned
one is using.** `useAtomValue` subscribes the component to that atom alone, so a component renders
when what *it* read changed and not otherwise; `useSetAtom` writes without subscribing, for a handler
that only ever sets a value it does not show. `useAtom` is the pair.

A store may be written from outside a component the same way a handler would — `defaultStore().set(count, 5)` —
and every subscribed component moves on the next `flush`.

**A server rendering two requests at once needs two sets of values for one set of atoms**, which is
what `createStore()` and `<Provider store={...}>` are for: a fresh store per request, scoping the
atoms underneath it, so that `html(root)` of two of them is two independent answers rather than one
request's numbers leaking into another's page.

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

**A `Boundary` does not catch a mismatch.** It is a fault in the framework's contract with the server
rather than a component failing to render, so it goes past every boundary above it. A boundary that
caught one would render its fallback into markup that is not the fallback's — and the fault that
escaped would then name the *fallback's* tree, burying the sentence that said which element actually
disagreed.

**A string host refuses to hydrate** rather than answering nothing: a server renders the markup a page
adopts and never adopts anything itself, and a silent `null` there would turn `hydrate` into `mount`
without saying so.

### Text, which is the one thing markup cannot say back

Two rules make a tree walkable back out of the markup it wrote, and both are settled in the tree
rather than in the markup — so `html()` is exactly the string it always was, with nothing in it a
component did not ask for.

**Two text children in a row are one text child.** `<h2>{n} replies</h2>` writes `<h2>2 replies</h2>`
and a parser reads one text node back, so lath joins the run before it makes an instance. React
writes a `<!-- -->` between them and reads it back as the seam; that answer would put markup nobody
asked for in every server render, and `slate:dom` cannot tell a comment from a text node anyway.

**An empty text child is no node at all.** `<p>{""}</p>` writes `<p></p>` — there is nothing for an
empty string to write — so the tree holds nothing for it either, and the node arrives the moment the
text does and goes again when it goes.

**The one pair that cannot be joined is a text child beside a component that renders text.**
`<p>hello <Name/></p>` is two instances with two nodes and one text node in the page, and it is a
mismatch that says so in as many words. Write the run as one expression — `<p>{"hello " + name}</p>`
— or put the component's text in an element of its own.

## The host is behind an adapter, and there are two of them

Nothing in the reconciler knows what a node is. `stringHost` builds plain objects and serialises
them; `domHost` creates real elements through the same ten functions — `element`, `text`,
`setProps`, `setText`, `serialise`, `drop`, `mounted`, `adopt`, `patch` and `styles`. **So one set of
components renders to HTML on a server and into the document in a browser**, which is the thing that
makes this worth writing in slate rather than reaching for React.

**Four of the ten were added by writing a second implementation and then a third use**, which is
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

**Three commands, and the last one needs a document.**

```
slate test tests
slate test --js tests
npm install
NODE_OPTIONS="--import ./tests-dom/setup.mjs" slate test --js tests-dom
```

The second runs the same suite on the JavaScript back end, which is worth having because that is
where a page actually runs. Two of its tests need a socket, which that back end has not got yet, and
they say so with `skip` rather than failing — `tests/server.slx` asks by trying.

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

slate **0.0.37** or newer as of lath 0.7.1, and the floor moved because `slate:dom` grew `focus`, `blur` and
`activeElement`: the DOM test harness used to fake the caret with a property setter on
`HTMLElement.prototype` and a republished `data-active` attribute, and `tests-dom/probe.slx` now
calls the real names instead.

slate **0.0.35** or newer as of lath 0.7.0, and the floor moved because `len` was removed in favour
of the `.length` property.

slate **0.0.30** or newer as of lath 0.5.0, and the floor moved because two things in that release
are what this version is made of. **Asset imports** — `import styles from "./card.css"`, the file
read while the program is compiled and travelling inside it — are where `style(css)` gets a
stylesheet from, and without them a sheet would have to be a quoted blob in the middle of a
component. **`insertBefore` and `removeChild` on `slate:dom`** are what let the DOM host apply the
reconciler's operations as operations: reordering three rows of a thousand was three correct
decisions and one `replaceChildren` of a thousand nodes until 0.0.30, and is now six mutation records
and nothing for the rows that stayed.

**0.5.3 is the back button, which is the same fact one layer down.** `slate:dom`'s `onNavigate` keeps
ONE handler for the whole program and the last registration wins, so `usePath` listening on behalf of
a control that asked for the query took the back button off a page that had installed a listener of
its own. It does not listen at all now where a page installed a navigator with `navigateWith` — that
page owns the handler, and its own render is what carries the address to every hook here.

**0.5.2 changes nothing about `Host` either.** What it changes is which navigator a `Link` calls:
what a program installed with `navigateWith` now outranks the one `usePath` installs for a page that
said nothing, and `usePath` reads the address bar on every render rather than keeping a copy of it —
so a movement an application made itself is seen by every `useSearch` on the page.

**0.5.1 changes nothing about `Host`**, and the one thing a host of your own may notice is that
`text("")` is never called any more: an empty text child stands for no node, in every host, so a host
that had special-cased one can stop.

**`Host` grew a tenth function in 0.5.0**, `styles(sheets)`, which is the one change a host of your
own has to make. It is handed the whole list of distinct stylesheets whenever that list grows, and it
is expected to compare before it writes — which is the rule `setProps` and `setText` already follow
and is what keeps a hydrated page from writing a sheet the server already sent. `stringHost() with
{ … }` still gets the rest for free.

**`Host`'s `setKids` became `patch` in 0.4.0**, which was that version's one breaking change: a host
of your own is told what CHANGED about a parent's children — `{ kind: "remove", node }` and
`{ kind: "insert", node, before }`, in order — rather than being handed the whole list.

The floor was 0.0.28 before that, for **`slate:url`**, for **`mods` and `button` on a handler's event
record**, and for **`children`, `tagName`, `nodeText` and `attribute` on `slate:dom`** — without
which nothing could read a page at all and `hydrate` could not exist.

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

**`Host` is the ten functions an adapter answers**, and annotating one with it is the only check
there is that it is whole — this package shipped an adapter with six, needed eight to render into a
document, nine to adopt one and ten to put a stylesheet where a stylesheet goes, and not one of the
four was guessable from the first implementation. `domHost` carries `-> Host` for exactly that
reason.

## Licence

ISC.
