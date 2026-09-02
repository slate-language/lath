# lath

A React-shaped UI framework, written in [slate](https://github.com/slate-language/slate).

A component is a function of its props, state lives in hooks kept on call-order slots, and a change
re-renders the component that owns it while the reconciler matches the new children against the old
by key. That is React's model **and** React's mechanism.

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
| `mount(element, host)` | render, and keep the tree so it can render again |
| `flush(root)` | render every change since the last one, now |
| `html(root)` | the tree as markup — the string host's answer |
| `stringHost()` | the default host |
| `domHost(selector)` | the other one, in `lath/dom` — a real page |

## Two modules, and the split is not cosmetic

`lath` is the framework and `lath/dom` is the browser host, and they are separate because **most
programs must not have the second one**. `dom.slx` imports `slate:dom`, which works in a browser and
faults everywhere else — so a page rendered to markup beside `slate:http`, or a component tested
under the interpreter, has no business loading it.

```
import { createElement, Fragment, mount, useState } from lath
import { domHost } from lath/dom

mount(<Counter/>, domHost("#app"))
```

Then `slate js app.slx -o app.js` and a `<script src="app.js">` beside a `<div id="app">`. The
emitted file is self-contained — the slate runtime, this framework and the program in one — so there
is no bundler and nothing to install.

## The host is behind an adapter, and there are two of them

Nothing in the reconciler knows what a node is. `stringHost` builds plain objects and serialises
them; `domHost` creates real elements through the same eight functions — `element`, `text`,
`setProps`, `setKids`, `setText`, `serialise`, `drop` and `mounted`. **So one set of components
renders to HTML on a server and into the document in a browser**, which is the thing that makes this
worth writing in slate rather than reaching for React.

**`drop` and `mounted` are the two the string host does not need**, and they were added when the DOM
host was written rather than guessed at in advance:

- **`drop(node)`** is a node the framework has torn down. A string host's node is an ordinary object
  the collector takes; a DOM host hands out a handle into a table it keeps, and a node nobody tells
  it about is a slot held for the life of the page.
- **`mounted(nodes)`** is the top of the tree, handed over on **every** commit. A component at the
  very top has no host node above it, so when it renders a different set of nodes the reconciler has
  nobody to tell — for a string host that is invisible, `html` walking the tree afresh whenever it is
  asked, and for a DOM host it is an element left on the page after the program stopped rendering it.

`tests/host.slx` pins both against a recording host, which is how a contract with two
implementations gets checked without a document in the room.

## What a handler is given

**A record, not the event.** `MouseEvent` has no representation in slate and inventing one would mean
inventing a foreign value, so `slate:dom` builds an object at the moment the handler fires:

| | |
|---|---|
| `type` | `"click"`, `"input"`, … |
| `value` | what the target holds now, as a string, or `null` |
| `checked` | a checkbox's state, or `null` |
| `key` | for a keyboard event |
| `stop()`, `prevent()` | `stopPropagation` and `preventDefault` |

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

```
slate test tests
```

They are written in slate and run by slate's own runner, which is how anybody using this package
would run their own.

`check/` is a jsdom driver, run by hand — see its README. It sits outside `tests/` because
`slate test tests` walks everything below that directory and `check/counter.slx` is a page, which
needs a document; and it is not part of the suite because jsdom is not a dependency of this repo, and
adding one would put `npm install` in front of the suite's one command.

## Not here yet

`useContext`, `memo`, error boundaries and portals. **The reconciler replaces a host node's whole
child list rather than moving children**, which was right when the only host was a string and is now
the obvious next thing: `replaceChildren` on a list of a thousand rows rebuilds the lot, where a real
diff would move a handful. It is correct and it is not fast.

## Requirements

slate **0.0.9** or newer, as of lath 0.2.0. `lath/dom` is a subpath import and a package exposing
more than its `main` is what 0.0.3 added, which was the floor until now; 0.0.9 is what the two
exported types need — a `type` declaration could not name one imported from another file before it,
so `type Rendered = { el: Element }` in your own code would not have compiled.

## The two types, and what they are for

```
import { createElement, stringHost, Element, Host } from lath

// A component's props are an object and its answer is an element.
box(props: object) -> Element = <div class="box">{props.title}</div>

// A host of your own, checked against the contract.
myHost() -> Host = stringHost() with { serialise: countingSerialise }
```

**`Host` is the eight functions an adapter answers**, and annotating one with it is the only check
there is that it is whole — this package shipped an adapter with six and needed eight, and neither
missing function was guessable from the first implementation. `domHost` carries `-> Host` for
exactly that reason.

## Licence

ISC.
