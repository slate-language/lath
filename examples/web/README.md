# A page built with lath

The smallest thing that is a whole application: two counters with their own state, a theme handed
down by a context, and a keyed list that can be shuffled.

    slate js counter.slx -o counter.js

Then open `index.html`. There is no bundler and nothing to install — `slate js` writes one
self-contained file holding the runtime, the framework and the program, which is what a `<script>`
tag wants.

**The interesting line is the last one.** `mount(<App/>, domHost("#app"))` is the only place the page
appears; everything above it is components, and the same components render to markup beside
`slate:http` with no host given at all. That is what the host adapter is for, and
`dom.slx` is the second implementation that makes the claim true rather than a hope.

**The theme button is what a context is for.** Nothing between `App` and `Counter` mentions a theme,
and both counters change when it does — which is the alternative to threading a prop through every
component in between.

**The rotate button is what a key is for.** Each row carries `key={name}`, so moving the last name to
the front moves one row rather than rewriting four; the rows are `memo`'d as well, so the three that
did not change are not rendered again.

**`counter.js` is not checked in.** A committed one would open without the build step above and be
wrong the first time anybody changed the framework under it, with nothing to say so.
