
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element.sheet;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
        return style.sheet;
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    const managed_styles = new Map();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_style_information(doc, node) {
        const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
        managed_styles.set(doc, info);
        return info;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = get_root_for_style(node);
        const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
        if (!rules[name]) {
            rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            managed_styles.forEach(info => {
                const { ownerNode } = info.stylesheet;
                // there is no ownerNode if it runs on jsdom.
                if (ownerNode)
                    detach(ownerNode);
            });
            managed_styles.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        const options = { direction: 'in' };
        let config = fn(node, params, options);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                started = true;
                delete_rule(node);
                if (is_function(config)) {
                    config = config(options);
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /*
    Adapted from https://github.com/mattdesl
    Distributed under MIT License https://github.com/mattdesl/eases/blob/master/LICENSE.md
    */
    function backInOut(t) {
        const s = 1.70158 * 1.525;
        if ((t *= 2) < 1)
            return 0.5 * (t * t * ((s + 1) * t - s));
        return 0.5 * ((t -= 2) * t * ((s + 1) * t + s) + 2);
    }

    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }

    /* src/App.svelte generated by Svelte v3.59.2 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[17] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	return child_ctx;
    }

    // (248:3) {:else}
    function create_else_block(ctx) {
    	let img;
    	let img_src_value;
    	let img_intro;

    	const block = {
    		c: function create() {
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = imgUnknown)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "svelte-z605cv");
    			add_location(img, file, 248, 3, 11141);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (!img_intro) {
    				add_render_callback(() => {
    					img_intro = create_in_transition(img, fade, { duration: 1000 });
    					img_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(248:3) {:else}",
    		ctx
    	});

    	return block;
    }

    // (246:3) {#if cell.isOpened }
    function create_if_block(ctx) {
    	let img;
    	let img_src_value;
    	let img_intro;

    	const block = {
    		c: function create() {
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = /*cell*/ ctx[17].src)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "svelte-z605cv");
    			add_location(img, file, 246, 3, 11068);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*cells*/ 2 && !src_url_equal(img.src, img_src_value = /*cell*/ ctx[17].src)) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		i: function intro(local) {
    			if (!img_intro) {
    				add_render_callback(() => {
    					img_intro = create_in_transition(img, fade, { duration: 1000 });
    					img_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(246:3) {#if cell.isOpened }",
    		ctx
    	});

    	return block;
    }

    // (244:2) {#each [cell.src] as {}}
    function create_each_block_2(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*cell*/ ctx[17].isOpened) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	function click_handler() {
    		return /*click_handler*/ ctx[5](/*cell*/ ctx[17]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			if_block.c();
    			attr_dev(button, "class", "cell svelte-z605cv");
    			add_location(button, file, 244, 2, 10984);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			if_block.m(button, null);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(button, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			transition_in(if_block);
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(244:2) {#each [cell.src] as {}}",
    		ctx
    	});

    	return block;
    }

    // (242:1) {#each row as cell}
    function create_each_block_1(ctx) {
    	let th;
    	let each_value_2 = [/*cell*/ ctx[17].src];
    	validate_each_argument(each_value_2);
    	let each_blocks = [];

    	for (let i = 0; i < 1; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx));
    	}

    	const block = {
    		c: function create() {
    			th = element("th");

    			for (let i = 0; i < 1; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(th, "class", "svelte-z605cv");
    			add_location(th, file, 242, 2, 10950);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, th, anchor);

    			for (let i = 0; i < 1; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(th, null);
    				}
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*onCellClick, cells, imgUnknown*/ 10) {
    				each_value_2 = [/*cell*/ ctx[17].src];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < 1; i += 1) {
    					const child_ctx = get_each_context_2(ctx);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(th, null);
    					}
    				}

    				for (; i < 1; i += 1) {
    					each_blocks[i].d(1);
    				}
    			}
    		},
    		i: function intro(local) {
    			for (let i = 0; i < 1; i += 1) {
    				transition_in(each_blocks[i]);
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(th);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(242:1) {#each row as cell}",
    		ctx
    	});

    	return block;
    }

    // (240:0) {#each cells as row}
    function create_each_block(ctx) {
    	let tr;
    	let t;
    	let each_value_1 = /*row*/ ctx[14];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			tr = element("tr");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			attr_dev(tr, "class", "svelte-z605cv");
    			add_location(tr, file, 240, 1, 10922);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(tr, null);
    				}
    			}

    			append_dev(tr, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*cells, onCellClick, imgUnknown*/ 10) {
    				each_value_1 = /*row*/ ctx[14];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(tr, t);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		i: function intro(local) {
    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(240:0) {#each cells as row}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div;
    	let h1;
    	let t1;
    	let table;
    	let div_class_value;
    	let mounted;
    	let dispose;
    	let each_value = /*cells*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "Котеки, проба Svelte";
    			t1 = space();
    			table = element("table");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(h1, file, 237, 0, 10862);
    			attr_dev(table, "class", "svelte-z605cv");
    			add_location(table, file, 238, 0, 10892);
    			attr_dev(div, "id", "board");
    			attr_dev(div, "class", div_class_value = "" + (/*boardShake*/ ctx[0] + " center" + " svelte-z605cv"));
    			add_location(div, file, 235, 0, 10792);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(div, t1);
    			append_dev(div, table);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(table, null);
    				}
    			}

    			if (!mounted) {
    				dispose = listen_dev(div, "click", /*onBoardClick*/ ctx[2], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*cells, onCellClick, imgUnknown*/ 10) {
    				each_value = /*cells*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(table, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*boardShake*/ 1 && div_class_value !== (div_class_value = "" + (/*boardShake*/ ctx[0] + " center" + " svelte-z605cv"))) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		i: function intro(local) {
    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const CLOSE_CELL_MS = 2000;
    const imgUnknown = "https://upload.wikimedia.org/wikipedia/commons/b/bc/Unknown_person.jpg";

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const prerender = true;
    	let currentPair = { first: null, second: null };
    	let boardShake = "";

    	const catsImgs = [
    		'data:image/jpeg;base64,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',
    		'https://i.pinimg.com/236x/35/f9/01/35f901247dde2fdf27553b5148bdee16.jpg',
    		'https://cs11.pikabu.ru/images/previews_comm/2018-11_5/1542925492141874444.jpg',
    		'https://i.pinimg.com/236x/9e/68/c3/9e68c3c90a4d7c1b40da89bbda3bf167.jpg',
    		'https://avatars.dzeninfra.ru/get-zen_doc/5194534/pub_60d736e753b1df70c252e972_60d7375e80a7ce60d52319cf/scale_1200',
    		'https://memchik.ru/images/templates/silniy_kot.jpg'
    	];

    	let pairPicked = false;
    	let lastPairIndex = 0;

    	const getCatImage = () => {
    		if (!pairPicked) {
    			pairPicked = true;
    			return catsImgs[lastPairIndex];
    		} else {
    			pairPicked = false;
    			lastPairIndex++;
    			if (lastPairIndex > catsImgs.length) lastPairIndex = 0;
    			return catsImgs[lastPairIndex - 1];
    		}
    	};

    	class Cell {
    		src = "";
    		isOpened = false;
    		isGuessed = false;
    		id = null;

    		constructor(id) {
    			this.id = id;
    		}
    	}

    	let cells = [
    		[new Cell(0), new Cell(1), new Cell(2), new Cell(3)],
    		[new Cell(4), new Cell(5), new Cell(6), new Cell(7)],
    		[new Cell(8), new Cell(9), new Cell(10), new Cell(11)]
    	];

    	const fillCells = () => {
    		let freeCells = [];

    		for (let i = 0; i < cells.length; i++) {
    			for (let x = 0; x < cells[i].length; x++) {
    				freeCells.push([i, x]);
    			}
    		}

    		while (freeCells.length > 0) {
    			let rndI = Math.floor(Math.random() * freeCells.length);
    			$$invalidate(1, cells[freeCells[rndI][0]][freeCells[rndI][1]].src = getCatImage(), cells);
    			freeCells.splice(rndI, 1);
    		}
    	};

    	fillCells();

    	const findIndexById = id => {
    		for (let i = 0; i < cells.length; i++) {
    			for (let x = 0; x < cells[i].length; x++) {
    				if (cells[i][x].id == id) return [i, x];
    			}
    		}

    		return [-1, -1];
    	};

    	const onBoardClick = () => {
    		if (currentPair.second == null) return;
    		$$invalidate(0, boardShake = 'shake');

    		let timer = setInterval(
    			function () {
    				clearInterval(timer);
    				$$invalidate(0, boardShake = '');
    			},
    			200
    		);
    	};

    	const onCellClick = arg1 => {
    		console.log(arg1);
    		if (arg1.isOpened) return;
    		let index = findIndexById(arg1.id);
    		if (index[0] == -1) return;
    		let i = index[0];
    		let x = index[1];

    		if (currentPair.second != null) {
    			console.log('Пара заполнена, жди...');
    			return;
    		}

    		if (cells[i][x].isOpened) {
    			console.log('Уже открыта');
    			return;
    		}

    		if (currentPair.first == null) {
    			//Занимаем первый элемент в паре
    			currentPair.first = [i, x];

    			$$invalidate(1, cells[i][x].isOpened = true, cells);
    			console.log('Открыли', cells[i][x].id, 'как первую ячейку');

    			let timer = setInterval(
    				function () {
    					clearInterval(timer);
    					console.log('Закрываем первую ячейцу', cells[i][x].id);

    					if (cells[i][x].isGuessed) {
    						console.log('Отменяем закрытие первой', cells[i][x].id);
    						return;
    					}

    					$$invalidate(1, cells[i][x].isOpened = false, cells);
    				},
    				CLOSE_CELL_MS
    			);
    		} else if (currentPair.second == null) {
    			//Занимаем первый элемент в паре
    			currentPair.second = [i, x];

    			$$invalidate(1, cells[i][x].isOpened = true, cells);
    			console.log('Открыли', cells[i][x].id, 'как вторую ячейку');

    			let timer = setInterval(
    				function () {
    					clearInterval(timer);
    					console.log('Закрываем вторую ячейцу', cells[i][x].id);

    					if (cells[i][x].isGuessed) {
    						console.log('Отменяем закрытие второй', cells[i][x].id);
    						return;
    					}

    					currentPair.first = null;
    					currentPair.second = null;
    					$$invalidate(1, cells[i][x].isOpened = false, cells);
    				},
    				CLOSE_CELL_MS
    			);

    			//Проверка на одинаковые картинки
    			let f = {
    				i: currentPair.first[0],
    				x: currentPair.first[1]
    			};

    			let s = {
    				i: currentPair.second[0],
    				x: currentPair.second[1]
    			};

    			if (cells[f.i][f.x].src == cells[s.i][s.x].src) {
    				console.log('Одинаковые картинки');
    				$$invalidate(1, cells[f.i][f.x].isOpened = true, cells);
    				$$invalidate(1, cells[f.i][f.x].isGuessed = true, cells);
    				$$invalidate(1, cells[s.i][s.x].isOpened = true, cells);
    				$$invalidate(1, cells[s.i][s.x].isGuessed = true, cells);
    				currentPair.first = null;
    				currentPair.second = null;
    			}
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = cell => onCellClick(cell);

    	$$self.$capture_state = () => ({
    		prerender,
    		fade,
    		backInOut,
    		currentPair,
    		boardShake,
    		CLOSE_CELL_MS,
    		imgUnknown,
    		catsImgs,
    		pairPicked,
    		lastPairIndex,
    		getCatImage,
    		Cell,
    		cells,
    		fillCells,
    		findIndexById,
    		onBoardClick,
    		onCellClick
    	});

    	$$self.$inject_state = $$props => {
    		if ('currentPair' in $$props) currentPair = $$props.currentPair;
    		if ('boardShake' in $$props) $$invalidate(0, boardShake = $$props.boardShake);
    		if ('pairPicked' in $$props) pairPicked = $$props.pairPicked;
    		if ('lastPairIndex' in $$props) lastPairIndex = $$props.lastPairIndex;
    		if ('cells' in $$props) $$invalidate(1, cells = $$props.cells);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [boardShake, cells, onBoardClick, onCellClick, prerender, click_handler];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { prerender: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get prerender() {
    		return this.$$.ctx[4];
    	}

    	set prerender(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
