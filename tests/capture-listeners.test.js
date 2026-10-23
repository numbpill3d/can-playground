import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/script.js', import.meta.url), 'utf8');

function loadApp(invoke) {
    const elements = new Map();
    const callbacks = new Map();
    let activeListeners = 0;

    const element = () => ({
        addEventListener() {},
        classList: { add() {}, remove() {}, toggle() {} },
        className: '',
        innerHTML: '',
        querySelectorAll: () => [],
        style: {},
        textContent: '',
        value: 'any'
    });

    const document = {
        addEventListener() {},
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, element());
            return elements.get(id);
        },
        querySelectorAll: () => []
    };

    async function listen(event, callback) {
        activeListeners++;
        callbacks.set(event, callback);
        let active = true;
        return () => {
            if (active) activeListeners--;
            active = false;
        };
    }

    const sandbox = {
        Blob,
        console,
        document,
        FileReader: class {},
        setTimeout: () => 1,
        clearTimeout() {},
        URL,
        window: {
            __TAURI__: {
                core: { invoke },
                event: { listen }
            }
        }
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);

    return {
        callbacks,
        activeListeners: () => activeListeners,
        startCapture: sandbox.startCapture
    };
}

test('failed capture start removes both registered listeners', async () => {
    const app = loadApp(async () => { throw new Error('candump missing'); });

    await app.startCapture();

    assert.equal(app.activeListeners(), 0);
});

test('natural capture end removes both registered listeners', async () => {
    const app = loadApp(async () => {});
    await app.startCapture();
    assert.equal(app.activeListeners(), 2);

    app.callbacks.get('capture_stopped')();

    assert.equal(app.activeListeners(), 0);
});
