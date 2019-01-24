'use strict';

const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const fs = require('fs');
const _ = require('lodash');

const p = require('path').join.bind(null, __dirname);
const defaultData = require('./sources/default');

const templates = _.fromPairs(
    fs.readdirSync(p('templates'))
        .map(fileName => {
            const basename = fileName.split('.')[0];
            const content = fs.readFileSync(p('templates', fileName), 'utf8')
            return [basename, Handlebars.compile(content)];
        })
);

const dataSources = fs.readdirSync(p('sources'))
    .filter(fName => !fName.startsWith('default'))
    .map(fileName => {
        const basename = fileName.split('.')[0];
        return {
            basename,
            htmlPath: p('assets', 'generated', `${basename}.html`),
            imagePath: p('assets', 'generated', `${basename}.png`),
            data: require(p('sources', fileName))
        }
    });
console.log(dataSources);

for(const {basename, htmlPath, data} of dataSources) {
    const {template} = data;
    const tpl = templates[template];
    const finalData = {
        ...defaultData,
        ...data
    };
    const html = tpl(finalData);
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log(`Generated ${htmlPath} from template ${template}`);
}

(async () => {
    const browser = await puppeteer.launch();
    for(const {htmlPath, imagePath, basename} of dataSources) {
        const page = await browser.newPage();
        const content = fs.readFileSync(htmlPath, 'utf8');
        await page.setContent(content);
        await screenshotDOMElement(page, '#info', imagePath);
        console.log(`Took screenshot of ${basename}`);
        await page.close();
    }
    await browser.close();
})().catch(err => {
    setImmediate(() => {
        throw err;
    });
});


async function screenshotDOMElement(page, selector, path, padding = 0) {
    const rect = await page.evaluate(selector => {
        const element = document.querySelector(selector);
        const {x, y, width, height} = element.getBoundingClientRect();
        return {left: x, top: y, width, height, id: element.id};
    }, selector);

    return await page.screenshot({
        path,
        clip: {
            x: rect.left - padding,
            y: rect.top - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2
        }
    });
}