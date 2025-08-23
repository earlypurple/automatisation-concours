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
