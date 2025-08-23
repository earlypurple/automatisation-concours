const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.localStorage = dom.window.localStorage;

// Mock for clipboard API
if (!navigator.clipboard) {
    navigator.clipboard = {
        writeText: text => Promise.resolve(text),
        readText: () => Promise.resolve(''),
    };
}

// Mock for Notifications API
global.Notification = {
    permission: 'granted',
    requestPermission: () => Promise.resolve('granted'),
};

// Mock for fetch API
global.fetch = (url) => {
    return Promise.resolve({
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        ok: true,
        status: 200,
        url: url, // Return the original URL for the test
    });
};
