# A page built with lath

The smallest thing that is a whole application: two counters with their own state, a theme handed
down by a context and kept in the URL, a stylesheet imported from a file, and a keyed list that can
be shuffled.

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

**The theme is in the URL, which is what `useSearch` is for.** `?theme=dark` is a page you can
bookmark and send to somebody, and flipping the theme rewrites the address rather than pushing it —
so ten flips do not put ten entries in the history and one press of back leaves the page.

**`index.html` carries no rules at all.** The application's css is `app.css`, an ordinary stylesheet
imported by `counter.slx` and put on the page by `style(app)` — so the markup and the rules that are
about it travel together, and a server rendering the same components writes the same `<style>` into
what it sends. It is modern css with native nesting; there is no preprocessor and no build step.

**The rotate button is what a key is for.** Each row carries `key={name}`, so moving the last name to
the front moves one row rather than rewriting four; the rows are `memo`'d as well, so the three that
did not change are not rendered again.

**`counter.js` is not checked in.** A committed one would open without the build step above and be
wrong the first time anybody changed the framework under it, with nothing to say so.
